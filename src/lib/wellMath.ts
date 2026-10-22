/**
 * 许愿池 · 抛体与缓动数学
 *
 * 刻意不引物理引擎：投掷就是一条**参数化抛物线**——给定起点、落点、时长，
 * 横向匀速插值，纵向叠一个重力项。完全确定性，可预览、可回放、零累积误差。
 */

/**
 * 三维向量。**全项目只有这一份定义**（元组形式）：
 * gl/mat.ts 的矩阵函数、scene/cameraRig.ts 的投影、抛体运算都用它。
 * 元组而不是 {x,y,z}，是因为这些值每帧都要塞进 Float32Array 喂给 GPU，
 * 对象形式每处都要拆包，元组可以直接下标取。
 */
export type Vec3 = [number, number, number];

/** 投掷的重力（世界单位 / 秒²）。只影响抛物线的「弓高」，不参与碰撞 */
export const THROW_GRAVITY = -9.8;
/** 飞行时长（秒）。太长会显得飘，太短看不清抛物线 */
export const THROW_DURATION = 0.9;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * 参数化抛物线。
 *
 * y 那一项是关键：`0.5 * g * p * (duration - t)`
 * —— t=0 与 t=duration 时都归零，所以起点/落点**精确命中**，
 * 中间被抬起的量正比于 g 与飞行时间，抛物线是解析解而不是逐帧积分。
 *
 * @param start 出手点（世界坐标）
 * @param target 落点（世界坐标）
 * @param t 已飞行时间（秒）
 */
export function throwArc(start: Vec3, target: Vec3, t: number): Vec3 {
  const duration = THROW_DURATION;
  const p = clamp(t / duration, 0, 1);

  return [
    lerp(start[0], target[0], p),
    /* 纵向：线性插值 + 一个在两端归零的抛物线抬高项 */
    start[1] +
      (target[1] - start[1]) * p +
      0.5 * THROW_GRAVITY * p * (duration - t),
    lerp(start[2], target[2], p),
  ];
}

/** 抛物线当前的切线方向（做硬币自旋/朝向用），用有限差分求，够用且不用推导 */
export function throwTangent(start: Vec3, target: Vec3, t: number): Vec3 {
  const dt = 0.008;
  const a = throwArc(start, target, Math.max(0, t - dt));
  const b = throwArc(start, target, Math.min(THROW_DURATION, t + dt));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return [dx / len, dy / len, dz / len];
}

/** 抛物线在屏幕空间的整条采样（画预览虚线用），返回归一化到 [0,1] 的点列 */
export function sampleArc(
  start: Vec3,
  target: Vec3,
  steps = 24,
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    out.push(throwArc(start, target, (i / steps) * THROW_DURATION));
  }
  return out;
}

/* --------------------------------------------------------- 涟漪参数 */

/** 同屏最多几圈涟漪同时参与 shader（shader 里也是 8 个槽位） */
export const MAX_RIPPLES = 8;
/** 涟漪寿命（秒）——到点后强度归零、槽位回收 */
export const RIPPLE_LIFE = 2.2;

export interface Ripple {
  /** 世界坐标（xz 平面），y 恒为水面高度 */
  x: number;
  z: number;
  /** 已经活了多久（秒） */
  age: number;
  /** 初始强度 */
  strength: number;
}

/** 涟漪强度包络：随时间衰减（与 shader 里的 exp(-age*2.0) 对齐，用于 CPU 侧剔除） */
export function rippleStrength(r: Ripple): number {
  if (r.age >= RIPPLE_LIFE) return 0;
  return r.strength * Math.exp(-r.age * 2);
}
