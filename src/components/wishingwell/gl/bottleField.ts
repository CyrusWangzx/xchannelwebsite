/**
 * 许愿池 · 漂流瓶场（实例化）
 *
 * 同屏最多 MAX_BOTTLES = 30 个，超出的在 UI 里折成「+N 条建议」。
 * 瓶子浮在水面上，位置同样**只与槽位有关**（新增不挪动已有的），
 * 每帧只叠一个相位错开的上下起伏 + 轻微摇摆。
 */

import { compose, type Mat4 } from "./mat";
import { WATER_LEVEL } from "./geometries";
import type { Wish } from "../../../lib/wishTypes";

export const MAX_BOTTLES = 30;
/** 瓶子分布半径（水面半径 5，留出边距） */
const FIELD_RADIUS = 3.7;

function hash01(n: number): number {
  const x = Math.sin(n * 269.5 + 183.3) * 43758.5453;
  return x - Math.floor(x);
}

export interface BottleInstance {
  id: string;
  slot: number;
  baseX: number;
  baseZ: number;
  baseRotY: number;
  phase: number;
  implemented: boolean;
  ghost: boolean;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  scale: number;
  hover: number;
  /** 正在飞/正在下沉时，起伏动画不接管它的位置 */
  flying: boolean;
}

export class BottleField {
  readonly instances: BottleInstance[] = [];
  /** 交错实例缓冲，布局同 CoinField（20 float / 实例） */
  readonly data = new Float32Array(MAX_BOTTLES * 20);

  private byId = new Map<string, BottleInstance>();
  private nextSlot = 0;

  sync(wishes: Wish[]) {
    const seen = new Set<string>();
    for (const w of wishes) {
      if (w.kind !== "bottle") continue;
      seen.add(w.id);
      const existing = this.byId.get(w.id);
      if (existing) {
        existing.implemented = w.status === "implemented";
        existing.ghost = Boolean(w.ghost);
        continue;
      }
      if (this.instances.length >= MAX_BOTTLES) continue;
      const inst = this.create(w.id, w.status === "implemented", Boolean(w.ghost));
      this.instances.push(inst);
      this.byId.set(w.id, inst);
    }
    for (let i = this.instances.length - 1; i >= 0; i--) {
      if (!seen.has(this.instances[i].id)) {
        this.byId.delete(this.instances[i].id);
        this.instances.splice(i, 1);
      }
    }
  }

  create(id: string, implemented: boolean, ghost: boolean): BottleInstance {
    const slot = this.nextSlot++;
    const rNorm = Math.sqrt((slot + 0.5) / MAX_BOTTLES);
    const r = rNorm * FIELD_RADIUS;
    const theta = slot * 2.39996323;

    return {
      id,
      slot,
      baseX: Math.cos(theta) * r,
      baseZ: Math.sin(theta) * r,
      baseRotY: hash01(slot + 77) * Math.PI * 2,
      phase: hash01(slot + 313) * Math.PI * 2,
      implemented,
      ghost,
      x: Math.cos(theta) * r,
      y: WATER_LEVEL,
      z: Math.sin(theta) * r,
      /* 漂在水上的瓶子是斜靠着的，不是笔直立着 */
      rotX: 0.22,
      rotY: hash01(slot + 77) * Math.PI * 2,
      scale: 1,
      hover: 0,
      flying: false,
    };
  }

  addGhost(id: string): BottleInstance | null {
    if (this.instances.length >= MAX_BOTTLES) return null;
    const inst = this.create(id, false, true);
    this.instances.push(inst);
    this.byId.set(id, inst);
    return inst;
  }

  get(id: string): BottleInstance | undefined {
    return this.byId.get(id);
  }

  /** 幽灵转正：换 id 不动位置 */
  rename(oldId: string, newId: string): boolean {
    const inst = this.byId.get(oldId);
    if (!inst) return false;
    this.byId.delete(oldId);
    inst.id = newId;
    this.byId.set(newId, inst);
    return true;
  }

  remove(id: string): boolean {
    const idx = this.instances.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    this.instances.splice(idx, 1);
    this.byId.delete(id);
    return true;
  }

  get count() {
    return this.instances.length;
  }

  /** 每帧的水面起伏（正在飞的瓶子跳过——它的位置由投掷控制器接管） */
  update(t: number) {
    for (const b of this.instances) {
      if (b.flying) continue;
      const w = t * 1.05 + b.phase;
      b.y = WATER_LEVEL + Math.sin(w) * 0.055 - 0.06;
      b.x = b.baseX + Math.cos(w * 0.6) * 0.08;
      b.z = b.baseZ + Math.sin(w * 0.5) * 0.08;
      /* 摇摆：随波逐流的那点晃动 */
      b.rotX = 0.22 + Math.sin(w * 0.8) * 0.11;
      b.rotY = b.baseRotY + Math.cos(w * 0.45) * 0.09;
    }
  }

  writeBuffers() {
    const d = this.data;
    const n = Math.min(this.instances.length, MAX_BOTTLES);
    const tmp: Mat4 = new Float32Array(16);

    for (let i = 0; i < n; i++) {
      const b = this.instances[i];
      const s = b.scale * (1 + b.hover * 0.3);
      compose([b.x, b.y, b.z], b.rotY, b.rotX, s, tmp);

      const base = i * 20;
      d.set(tmp, base);
      d[base + 16] = b.implemented ? 1 : 0;
      d[base + 17] = hash01(b.slot + 5);
      d[base + 18] = b.ghost ? 0.4 : 1;
      d[base + 19] = 0;
    }
  }

  clear() {
    this.instances.length = 0;
    this.byId.clear();
    this.nextSlot = 0;
  }
}
