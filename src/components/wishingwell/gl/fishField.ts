/**
 * 许愿池 · 鱼群（实例化）
 *
 * 几条锦鲤在**水下**绕池游动。它们不是独立的一层半透明物体，而是画进
 * 「池底烘焙」那一 pass（floorTex）里 —— 水面着色器本来就是拿这张纹理做
 * 折射采样的，所以鱼会被水色吸收、被涟漪扭曲，天然「在水里」，
 * 而且没有任何透明排序问题。
 *
 * 位置只跟参数有关（确定性），每条鱼各有一个轨道半径、角速度（有正有负）、
 * 深度、体长与摆尾相位。航向取轨迹的数值切线，所以掉头、绕圈都自然。
 *
 * ⚠️ 鱼动 ⇒ 池底纹理必须每帧重画（否则鱼会定格）。硬币很多时本来会启用
 * 烘焙复用，这条依赖见 engine.renderFloorPass 的注释；reduce-motion 下鱼是
 * 静止的，烘焙照旧生效。
 */

import { compose, type Mat4 } from "./mat";

/** 同屏最多几条鱼（再多也看不出差别，纯属浪费实例） */
export const MAX_FISH = 10;
/** 默认放几条 */
export const FISH_COUNT = 7;

function hash01(n: number): number {
  const x = Math.sin(n * 269.5 + 183.3) * 43758.5453;
  return x - Math.floor(x);
}

export interface FishInstance {
  /** 轨道半径基准（实际半径还会缓慢起伏） */
  radius: number;
  /** 初始相位角 */
  angle0: number;
  /** 角速度（rad/s），负值 = 反向游 */
  speed: number;
  /** 巡游深度（水面在 1.15，池底在 0） */
  baseY: number;
  /** 各条鱼自己的一套相位，避免整群同步 */
  phase: number;
  /** 摆尾相位（0..1），写进 aParam.y */
  beat: number;
  /** 体长（世界单位）—— 几何在局部空间是 1 单位长，所以它就是等比缩放 */
  size: number;

  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
}

export class FishField {
  readonly instances: FishInstance[] = [];
  /** 交错实例缓冲，布局同 CoinField / BottleField（20 float / 实例） */
  readonly data = new Float32Array(MAX_FISH * 20);

  constructor(count = FISH_COUNT) {
    const n = Math.min(Math.max(0, count), MAX_FISH);
    for (let i = 0; i < n; i++) {
      const a = hash01(i + 11);
      const b = hash01(i + 47);
      const c = hash01(i + 91);

      this.instances.push({
        /* 半径 1.25–3.6：不钻进池心星芒，也不贴池壁 */
        radius: 1.25 + a * 2.35,
        angle0: i * 2.39996323 + b * 0.9,
        /* 0.10–0.22 rad/s ≈ 一圈 30–60 秒，慢了才像在游，不像在转 */
        speed: (0.1 + b * 0.12) * (i % 2 === 0 ? 1 : -1),
        baseY: 0.4 + c * 0.34,
        phase: b * Math.PI * 2,
        beat: c,
        /* 0.75–1.1：池半径 5，按真实比例该是 0.6 左右；但这是个展示场景，
           稍微放大一档才读得出「鱼」而不是「一根橙色划痕」。 */
        size: 0.75 + a * 0.35,
        x: 0,
        y: 0,
        z: 0,
        rotX: 0,
        rotY: 0,
      });
    }
    /* 先摆到 t=0 的位姿，否则第一帧之前 writeBuffers 会写出全 0 矩阵 */
    this.update(0, false);
  }

  get count() {
    return this.instances.length;
  }

  /** 轨迹上的点（纯函数，数值求切线时也用它） */
  private at(f: FishInstance, time: number): { x: number; z: number } {
    const angle = f.angle0 + time * f.speed;
    const r = f.radius + Math.sin(time * 0.27 + f.phase) * 0.42;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
  }

  /**
   * @param time 场景时间（秒）
   * @param frozen reduce-motion：定格在一个「尾巴正好弯着」的姿势，
   *               而不是退回直角 —— 静止的鱼也该有游动的形状。
   */
  update(time: number, frozen: boolean) {
    const t = frozen ? 3.1 : time;

    for (const f of this.instances) {
      const p = this.at(f, t);
      f.x = p.x;
      f.z = p.z;
      f.y = f.baseY + Math.sin(t * 0.63 + f.phase * 1.7) * 0.07;

      /* 航向 = 轨迹切线。几何的 +z 是鼻端，所以 rotY = atan2(dx, dz) */
      const ahead = this.at(f, t + 0.08);
      const dx = ahead.x - p.x;
      const dz = ahead.z - p.z;
      if (Math.hypot(dx, dz) > 1e-6) f.rotY = Math.atan2(dx, dz);

      /* 一点点俯仰，纯为了「活着」 */
      f.rotX = Math.sin(t * 0.5 + f.phase) * 0.07;
    }
  }

  writeBuffers(time: number) {
    const d = this.data;
    const n = Math.min(this.instances.length, MAX_FISH);
    const tmp: Mat4 = new Float32Array(16);

    for (let i = 0; i < n; i++) {
      const f = this.instances[i];
      compose([f.x, f.y, f.z], f.rotY, f.rotX, f.size, tmp);

      const base = i * 20;
      d.set(tmp, base);
      d[base + 16] = 1; /* aParam.x：身体（鳍自己按 uv 槽分辨） */
      d[base + 17] = f.beat; /* aParam.y：摆尾相位 */
      d[base + 18] = 1; /* aParam.z：不透明 */
      d[base + 19] = time; /* aParam.w：时间，FISH_VS 用它算摆尾 */
    }
  }

  /** 验收用：第一条鱼的位姿（判断「真的在游」比截图更直接） */
  sample() {
    const f = this.instances[0];
    if (!f) return null;
    return {
      x: f.x,
      y: f.y,
      z: f.z,
      rotY: f.rotY,
      size: f.size,
      radius: f.radius,
    };
  }
}
