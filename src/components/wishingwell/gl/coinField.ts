/**
 * 许愿池 · 硬币场（实例化）
 *
 * 上限定死 MAX_COINS = 1000，一次 drawElementsInstanced 画完（1 draw call）。
 * 位置不靠物理模拟，而是一条**只与槽位有关**的确定性布局：
 *
 *   层 = floor(slot / PER_LAYER)          —— 一层摊满就往上叠一层
 *   半径 = sqrt((slot%PER + 0.5) / PER)   —— 面积均匀，从池心往外铺
 *   角度 = slot * 2.39996323              —— 黄金角，铺得最匀且不出现放射条纹
 *
 * 「只与槽位有关」是关键：新硬币进来时，**已有的硬币一枚都不会动**。
 * 否则每投一枚，整池硬币就要重新排布一次，像地震。
 */

import { compose, type Mat4 } from "./mat";
import { COIN_THICK, FLOOR_Y, WATER_LEVEL } from "./geometries";
import type { Wish } from "../../../lib/wishTypes";

export const MAX_COINS = 1000;
/** 同屏在飞的硬币上限（飞行中的不能进池底烘焙，得单独一draw） */
export const MAX_AIRBORNE = 16;
/** 每层能摊多少枚（≈ 半径 2.4 的圆盘铺满） */
const PER_LAYER = 190;
/** 堆体的最大半径 */
const PILE_RADIUS = 2.4;
/** 层与层之间的竖向间距（略小于币厚 → 看起来是压着的） */
const LAYER_GAP = COIN_THICK * 0.88;

/** 稳定 hash：给每枚硬币一个固定的微扰动与色相种子 */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface CoinInstance {
  id: string;
  /** 稳定槽位：位置只由它决定 */
  slot: number;
  restX: number;
  restY: number;
  restZ: number;
  restRotY: number;
  implemented: boolean;
  ghost: boolean;
  /** 动画状态 */
  state: "settled" | "flying";
  /** 飞行/下沉过程中每帧覆写的当前位置 */
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  /** 下沉进度 0..1（1 = 已落底） */
  settle: number;
  scale: number;
  hover: number;
}

/** 由槽位算静止位姿（纯函数，稳定） */
export function coinRestPose(slot: number) {
  const layer = Math.floor(slot / PER_LAYER);
  const k = slot % PER_LAYER;
  const rNorm = Math.sqrt((k + 0.5) / PER_LAYER);
  const r = rNorm * PILE_RADIUS;
  const theta = k * 2.39996323 + layer * 0.37;

  /* 微扰动：打破螺旋的规律感（但必须稳定） */
  const jitter = (hash01(slot) - 0.5) * 0.09;
  const rj = r + jitter;
  const ty = theta + (hash01(slot + 1000) - 0.5) * 0.12;

  return {
    x: Math.cos(ty) * rj,
    y: FLOOR_Y + COIN_THICK * 0.55 + layer * LAYER_GAP,
    z: Math.sin(ty) * rj,
    rotY: hash01(slot + 2000) * Math.PI * 2,
  };
}

export class CoinField {
  readonly instances: CoinInstance[] = [];
  /**
   * 交错实例缓冲：每个实例 20 个 float
   *   [0..15] 模型矩阵（4×vec4）
   *   [16..19] 参数 (已实现档, 色相种子, 不透明度, 时间)
   * 5 个属性指针共用这一条 buffer（stride = 80 字节），每帧只 bufferSubData 一次。
   */
  readonly data = new Float32Array(MAX_COINS * 20);

  /**
   * 在飞的硬币单独一条缓冲（水面之上的那几枚）。
   * 池底烘焙只烘「已落底」的硬币，而 WebGL2 的 drawElementsInstanced
   * **没有 baseInstance**——只能从第 0 个实例开始画，没法画 [k, n)。
   * 所以干脆拆成两条缓冲：落底的进 data，在飞的进 airData。
   */
  readonly airData = new Float32Array(MAX_AIRBORNE * 20);

  /** 上一次 writeBuffers 的结果：两条缓冲各有多少个实例 */
  settledCount = 0;
  airCount = 0;

  private byId = new Map<string, CoinInstance>();
  private nextSlot = 0;

  /** 用数据重建整个场（切数据源 / 首次加载时用） */
  sync(wishes: Wish[]) {
    const seen = new Set<string>();
    for (const w of wishes) {
      if (w.kind !== "coin") continue;
      seen.add(w.id);
      const existing = this.byId.get(w.id);
      if (existing) {
        existing.implemented = w.status === "implemented";
        existing.ghost = Boolean(w.ghost);
        continue;
      }
      if (this.instances.length >= MAX_COINS) continue;
      const inst = this.create(w.id, w.status === "implemented", Boolean(w.ghost));
      this.instances.push(inst);
      this.byId.set(w.id, inst);
    }
    /* 数据源里没有了的（幽灵被顶掉等）：移除 */
    for (let i = this.instances.length - 1; i >= 0; i--) {
      if (!seen.has(this.instances[i].id)) {
        this.byId.delete(this.instances[i].id);
        this.instances.splice(i, 1);
      }
    }
    this.writeBuffers(0);
  }

  create(id: string, implemented: boolean, ghost: boolean): CoinInstance {
    const slot = this.nextSlot++;
    const pose = coinRestPose(slot);
    return {
      id,
      slot,
      restX: pose.x,
      restY: pose.y,
      restZ: pose.z,
      restRotY: pose.rotY,
      implemented,
      ghost,
      state: "settled",
      x: pose.x,
      y: pose.y,
      z: pose.z,
      rotX: Math.PI / 2,
      rotY: pose.rotY,
      settle: 1,
      scale: 1,
      hover: 0,
    };
  }

  /** 乐观插入一枚（幽灵）：先在空中，随后落底 */
  addGhost(id: string): CoinInstance | null {
    if (this.instances.length >= MAX_COINS) return null;
    const inst = this.create(id, false, true);
    this.instances.push(inst);
    this.byId.set(id, inst);
    return inst;
  }

  get(id: string): CoinInstance | undefined {
    return this.byId.get(id);
  }

  /** 幽灵转正：把临时 id 换成真实 id（位置不变，避免「换 id 就跳一下」） */
  rename(oldId: string, newId: string): boolean {
    const inst = this.byId.get(oldId);
    if (!inst) return false;
    this.byId.delete(oldId);
    inst.id = newId;
    this.byId.set(newId, inst);
    return true;
  }

  remove(id: string): boolean {
    const idx = this.instances.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    this.instances.splice(idx, 1);
    this.byId.delete(id);
    return true;
  }

  get count() {
    return this.instances.length;
  }

  /**
   * 把实例状态分成两条交错缓冲：
   *   data     ← 已落底（进池底烘焙）
   *   airData  ← 还在水面之上（主场景里单独画）
   */
  writeBuffers(time: number) {
    const tmp: Mat4 = new Float32Array(16);
    let si = 0;
    let ai = 0;

    for (const c of this.instances) {
      const airborne = c.y > WATER_LEVEL - 0.02 || c.state === "flying";

      /* 目标缓冲 + 写入位置 */
      let target: Float32Array;
      let base: number;
      if (airborne) {
        if (ai >= MAX_AIRBORNE) continue;
        target = this.airData;
        base = ai * 20;
        ai++;
      } else {
        if (si >= MAX_COINS) continue;
        target = this.data;
        base = si * 20;
        si++;
      }

      /* 悬停放大（拾取反馈）。几何本身就是真实尺寸，所以这里传的是**倍率** */
      const s = c.scale * (1 + c.hover * 0.34);
      compose([c.x, c.y, c.z], c.rotY, c.rotX, s, tmp);

      target.set(tmp, base);
      target[base + 16] = c.implemented ? 1 : 0;
      target[base + 17] = hash01(c.slot);
      target[base + 18] = c.ghost ? 0.34 : 1;
      target[base + 19] = time;
    }

    this.settledCount = si;
    this.airCount = ai;
  }

  clear() {
    this.instances.length = 0;
    this.byId.clear();
    this.nextSlot = 0;
  }
}
