/**
 * 许愿池 · 水花粒子
 *
 * 入水那一瞬间的「噗通」：从落点向上溅一圈小球，走最朴素的抛体（重力 + 初速），
 * 落回水面或寿命到期就回收。池子 + 全局上限都卡住，不会因为连点把粒子堆爆。
 *
 * 复用实例化管线：几何是单位球（半径 1），每个粒子一个 mat4（含大小）——
 * 也就是额外 1 个 draw call，没有别的开销。
 */

import { compose, type Mat4 } from "./mat";
import { WATER_LEVEL } from "./geometries";

const MAX_PARTICLES = 120;
/** 粒子的重力（比投掷的轻，水花飘一点更自然） */
const GRAVITY = -13.5;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  seed: number;
}

export class SplashSystem {
  readonly particles: Particle[] = [];
  /** 交错实例缓冲，布局同 CoinField（20 float / 实例） */
  readonly data = new Float32Array(MAX_PARTICLES * 20);

  /**
   * 在落点炸一圈水花。
   * @param power 0..1，投得越猛水花越大
   */
  emit(x: number, z: number, power = 1) {
    const count = Math.round(6 + power * 10);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        /* 顶掉最老的 */
        this.particles.shift();
      }
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      /* 向外 + 向上：水花的形状就是这么来的 */
      const out = 0.9 + Math.random() * 1.5;
      const up = 2.4 + Math.random() * 2.2 * power;

      this.particles.push({
        x: x + Math.cos(a) * 0.05,
        y: WATER_LEVEL + 0.04,
        z: z + Math.sin(a) * 0.05,
        vx: Math.cos(a) * out * power,
        vy: up * power,
        vz: Math.sin(a) * out * power,
        age: 0,
        life: 0.5 + Math.random() * 0.45,
        size: 0.026 + Math.random() * 0.034,
        seed: Math.random(),
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life || p.y < WATER_LEVEL - 0.12) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      /* 空气阻力，免得水花飞得太远 */
      p.vx *= 1 - 2.4 * dt;
      p.vz *= 1 - 2.4 * dt;
    }
  }

  writeBuffers() {
    const d = this.data;
    const n = this.particles.length;
    const tmp: Mat4 = new Float32Array(16);

    for (let i = 0; i < n; i++) {
      const q = this.particles[i];
      const fade = 1 - q.age / q.life;
      const s = q.size * (0.5 + fade * 0.9);
      compose([q.x, q.y, q.z], 0, 0, s, tmp);

      const base = i * 20;
      d.set(tmp, base);
      d[base + 16] = 0;
      d[base + 17] = q.seed;
      d[base + 18] = fade * fade;
      d[base + 19] = 0;
    }
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    this.particles.length = 0;
  }
}
