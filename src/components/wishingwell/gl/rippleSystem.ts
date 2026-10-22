/**
 * 许愿池 · 涟漪管理
 *
 * 每个涟漪只是一个「中心点 + 已经活了多久 + 初始强度」，
 * 波形本身完全由水面的片元着色器算（见 gl/water.ts）。
 * CPU 侧只负责：开槽、老化、到点回收、把 8 个槽位打包成 uniform。
 *
 * 8 个槽位是硬上限（shader 里的循环次数必须编译期确定）——
 * 满了就顶掉最老的那一圈，视觉上无感。
 */
import { MAX_RIPPLES, RIPPLE_LIFE, type Ripple } from "../../../lib/wellMath";

export class RippleSystem {
  private ripples: Ripple[] = [];

  /** 打包给 shader：每个槽位一个 vec4 = (uv.x, uv.y, age, strength) */
  readonly uniforms = new Float32Array(MAX_RIPPLES * 4);

  /** 供水面 uv 换算 */
  private poolRadius: number;

  constructor(poolRadius: number) {
    this.poolRadius = poolRadius;
  }

  /** 在水面 uv 空间开一圈涟漪 */
  add(x: number, z: number, strength = 1) {
    if (this.ripples.length >= MAX_RIPPLES) {
      /* 顶掉最老的一圈 */
      let oldest = 0;
      for (let i = 1; i < this.ripples.length; i++) {
        if (this.ripples[i].age > this.ripples[oldest].age) oldest = i;
      }
      this.ripples.splice(oldest, 1);
    }
    this.ripples.push({ x, z, age: 0, strength });
  }

  update(dt: number) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += dt;
      if (this.ripples[i].age >= RIPPLE_LIFE) this.ripples.splice(i, 1);
    }
    this.pack();
  }

  private pack() {
    const u = this.uniforms;
    const inv = 1 / (2 * this.poolRadius);

    for (let i = 0; i < MAX_RIPPLES; i++) {
      const o = i * 4;
      const r = this.ripples[i];
      if (!r) {
        /* w = 0 → shader 里直接 continue，不参与循环 */
        u[o] = 0;
        u[o + 1] = 0;
        u[o + 2] = 0;
        u[o + 3] = 0;
        continue;
      }
      u[o] = r.x * inv + 0.5;
      u[o + 1] = r.z * inv + 0.5;
      u[o + 2] = r.age;
      u[o + 3] = r.strength;
    }
  }

  clear() {
    this.ripples.length = 0;
    this.pack();
  }

  get count() {
    return this.ripples.length;
  }
}
