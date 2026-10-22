/**
 * 许愿池 · 4×4 矩阵（列主序，与 WebGL 的 uniformMatrix4fv 一致）
 *
 * 只实现这个场景真正用得到的部分，不搬一整个数学库进来。
 */

import type { Vec3 } from "../../../lib/wellMath";

export type Mat4 = Float32Array;
/* 全项目只有一份 Vec3 定义（元组形式，在 lib/wellMath.ts），这里只是转出来 */
export type { Vec3 };

export function identity(out: Mat4 = new Float32Array(16)): Mat4 {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

/** 透视投影。fovY 用弧度 */
export function perspective(
  fovy: number,
  aspect: number,
  near: number,
  far: number,
  out: Mat4 = new Float32Array(16),
): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

/**
 * 观察矩阵 = 相机世界矩阵的逆。
 * 这里直接按公式构造（先平移再旋转的逆），比求逆矩阵快且稳定。
 */
export function lookAt(
  eye: Vec3,
  center: Vec3,
  up: Vec3,
  out: Mat4 = new Float32Array(16),
): Mat4 {
  let z0 = eye[0] - center[0];
  let z1 = eye[1] - center[1];
  let z2 = eye[2] - center[2];
  let len = Math.hypot(z0, z1, z2) || 1;
  z0 /= len;
  z1 /= len;
  z2 /= len;

  /* x = normalize(cross(up, z)) */
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  len = Math.hypot(x0, x1, x2) || 1;
  x0 /= len;
  x1 /= len;
  x2 /= len;

  /* y = cross(z, x) */
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

/** out = a * b（列主序，等价于 gl-matrix 的 mat4.multiply） */
export function multiply(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4];
    const b1 = b[i * 4 + 1];
    const b2 = b[i * 4 + 2];
    const b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

/** 平移 + 缩放 + 绕 Y/X 旋转的合成（硬币/瓶子实例用） */
export function compose(
  pos: Vec3,
  rotY: number,
  rotX: number,
  scale: number | Vec3,
  out: Mat4 = new Float32Array(16),
): Mat4 {
  const sx = typeof scale === "number" ? scale : scale[0];
  const sy = typeof scale === "number" ? scale : scale[1];
  const sz = typeof scale === "number" ? scale : scale[2];

  /* ⚠️ 命名小心：cosY = cos(rotY)，kx = scale.x —— 别把 sin(rotX) 和 scale.x 都叫 sx */
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);

  /* M3 = Ry(rotY) · Rx(rotX) · diag(sx, sy, sz)，列主序展开 */
  out[0] = cosY * sx;
  out[1] = 0;
  out[2] = -sinY * sx;
  out[3] = 0;

  out[4] = sinY * sinX * sy;
  out[5] = cosX * sy;
  out[6] = cosY * sinX * sy;
  out[7] = 0;

  out[8] = sinY * cosX * sz;
  out[9] = -sinX * sz;
  out[10] = cosY * cosX * sz;
  out[11] = 0;

  out[12] = pos[0];
  out[13] = pos[1];
  out[14] = pos[2];
  out[15] = 1;
  return out;
}

/** 世界点 → NDC（不做透视除法后的屏幕换算） */
export function transformPoint(
  m: Mat4,
  p: Vec3,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const iw = w === 0 ? 1 : 1 / w;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw;
  return out;
}

/** 3×3 法线矩阵（模型只做刚体变换 + 等比缩放时 = 旋转部分，够用） */
export function normalMatrix3(m: Mat4, out = new Float32Array(9)): Float32Array {
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2];
  out[3] = m[4]; out[4] = m[5]; out[5] = m[6];
  out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
  return out;
}
