/**
 * 许愿池 · 相机（受限轨道）
 *
 * 不给自由轨道：许愿池只有一个「对的」视角——略高于水平、俯视池面。
 * 所以把方位角/仰角/距离都夹在窄区间里，用户能转，但转不出难看的角度。
 * 空闲时给一点极慢的自漂移（±3°），画面就不会像一张静止的渲染图。
 *
 * 不引入逆矩阵：屏幕点求世界点用「相机基向量 + 视锥角」直接构造射线，
 * 比求 4×4 逆矩阵又快又稳。
 */
import { lookAt, multiply, perspective, type Mat4, type Vec3 } from "../gl/mat";

export interface CameraOptions {
  /** 观察目标点 */
  target?: Vec3;
  fov?: number;
  minAzimuth?: number;
  maxAzimuth?: number;
  minElevation?: number;
  maxElevation?: number;
  minDistance?: number;
  maxDistance?: number;
  /** 空闲自漂移的幅度（弧度） */
  idleDrift?: number;
  /** 是否允许自漂移（reduce-motion 时关掉） */
  drift?: boolean;
}

export class CameraRig {
  target: Vec3;
  fov: number;

  azimuth = -0.12;
  elevation = 0.6;
  distance = 12.6;

  private minAz: number;
  private maxAz: number;
  private minEl: number;
  private maxEl: number;
  private minDist: number;
  private maxDist: number;
  private idleDrift: number;
  private drift: boolean;

  width = 1;
  height = 1;

  readonly view: Mat4 = new Float32Array(16);
  readonly proj: Mat4 = new Float32Array(16);
  readonly viewProj: Mat4 = new Float32Array(16);
  eye: Vec3 = [0, 6, 12];

  private time = 0;

  constructor(opts: CameraOptions = {}) {
    this.target = opts.target ?? [0, 0.55, 0];
    this.fov = opts.fov ?? (42 * Math.PI) / 180;
    this.minAz = opts.minAzimuth ?? -0.52;
    this.maxAz = opts.maxAzimuth ?? 0.52;
    this.minEl = opts.minElevation ?? 0.3;
    this.maxEl = opts.maxElevation ?? 1.02;
    this.minDist = opts.minDistance ?? 9.4;
    this.maxDist = opts.maxDistance ?? 16.5;
    this.idleDrift = opts.idleDrift ?? 0.045;
    this.drift = opts.drift ?? true;
  }

  setDrift(v: boolean) {
    this.drift = v;
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
  }

  /** 用户拖拽：给的是像素增量 */
  orbitBy(dx: number, dy: number) {
    this.azimuth = Math.min(
      this.maxAz,
      Math.max(this.minAz, this.azimuth - dx * 0.0035),
    );
    this.elevation = Math.min(
      this.maxEl,
      Math.max(this.minEl, this.elevation + dy * 0.0028),
    );
  }

  zoomBy(delta: number) {
    this.distance = Math.min(
      this.maxDist,
      Math.max(this.minDist, this.distance + delta * 0.006),
    );
  }

  update(dt: number) {
    if (this.drift) this.time += dt;

    const drift = this.drift ? Math.sin(this.time * 0.16) * this.idleDrift : 0;
    const az = this.azimuth + drift;
    const el = this.elevation;

    const cosEl = Math.cos(el);
    this.eye = [
      this.target[0] + Math.sin(az) * cosEl * this.distance,
      this.target[1] + Math.sin(el) * this.distance,
      this.target[2] + Math.cos(az) * cosEl * this.distance,
    ];

    lookAt(this.eye, this.target, [0, 1, 0], this.view);
    perspective(
      this.fov,
      this.width / this.height,
      0.1,
      80,
      this.proj,
    );
    multiply(this.proj, this.view, this.viewProj);
  }

  /** 世界点 → 屏幕像素；在相机背后返回 null */
  worldToScreen(p: Vec3): { x: number; y: number; depth: number } | null {
    const m = this.viewProj;
    const x = p[0];
    const y = p[1];
    const z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-4) return null;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
    return {
      x: ((cx / w + 1) / 2) * this.width,
      y: ((1 - cy / w) / 2) * this.height,
      depth: cz / w,
    };
  }

  /** 屏幕像素 → 世界射线方向（单位向量） */
  private rayDirection(px: number, py: number): Vec3 {
    const ndcX = (px / this.width) * 2 - 1;
    const ndcY = 1 - (py / this.height) * 2;

    const fwd: Vec3 = [
      this.target[0] - this.eye[0],
      this.target[1] - this.eye[1],
      this.target[2] - this.eye[2],
    ];
    const fl = Math.hypot(...fwd) || 1;
    const f: Vec3 = [fwd[0] / fl, fwd[1] / fl, fwd[2] / fl];

    /* right = normalize(cross(forward, worldUp)) */
    const rRaw: Vec3 = [f[2], 0, -f[0]];
    const rl = Math.hypot(...rRaw) || 1;
    const r: Vec3 = [rRaw[0] / rl, rRaw[1] / rl, rRaw[2] / rl];

    /* up = cross(right, forward) */
    const u: Vec3 = [
      r[1] * f[2] - r[2] * f[1],
      r[2] * f[0] - r[0] * f[2],
      r[0] * f[1] - r[1] * f[0],
    ];

    const tanHalf = Math.tan(this.fov / 2);
    const aspect = this.width / this.height;

    const dir: Vec3 = [
      f[0] + r[0] * ndcX * tanHalf * aspect + u[0] * ndcY * tanHalf,
      f[1] + r[1] * ndcX * tanHalf * aspect + u[1] * ndcY * tanHalf,
      f[2] + r[2] * ndcX * tanHalf * aspect + u[2] * ndcY * tanHalf,
    ];
    const dl = Math.hypot(...dir) || 1;
    return [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  }

  /** 屏幕像素 → 与水平面 y = planeY 的交点（池面拾取用） */
  screenToPlane(
    px: number,
    py: number,
    planeY: number,
  ): { x: number; z: number } | null {
    const d = this.rayDirection(px, py);
    if (Math.abs(d[1]) < 1e-5) return null;
    const t = (planeY - this.eye[1]) / d[1];
    if (t <= 0) return null;
    return { x: this.eye[0] + d[0] * t, z: this.eye[2] + d[2] * t };
  }

  /** 屏幕像素 → 世界点（给定沿射线的距离） */
  screenToDistance(px: number, py: number, dist: number): Vec3 {
    const d = this.rayDirection(px, py);
    return [
      this.eye[0] + d[0] * dist,
      this.eye[1] + d[1] * dist,
      this.eye[2] + d[2] * dist,
    ];
  }
}
