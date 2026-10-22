/**
 * 许愿池 · 投掷控制器
 *
 * 一枚物体从出手到落定的完整生命周期：
 *   fly（参数化抛物线）→ 入水（涟漪 + 水花）→ sink（硬币下沉到堆体 / 瓶子浮起）→ 落定
 *
 * 全程不发散：位置每一帧都由解析式算出，不做逐帧积分，所以不会漂。
 * 支持同时多枚在飞（连点也不会互相踩）。
 */
import {
  THROW_DURATION,
  throwArc,
  easeOutCubic,
  type Vec3,
} from "../../../lib/wellMath";
import { WATER_LEVEL } from "../gl/geometries";
import type { CoinInstance } from "../gl/coinField";
import type { BottleInstance } from "../gl/bottleField";
import type { SplashSystem } from "../gl/splashSystem";
import type { RippleSystem } from "../gl/rippleSystem";

export type FlightKind = "coin" | "bottle";

interface Flight {
  kind: FlightKind;
  start: Vec3;
  target: Vec3;
  t: number;
  phase: "fly" | "sink";
  /** 下沉进度（0..1），只有硬币用 */
  sink: number;
  power: number;
  instance: CoinInstance | BottleInstance;
}

/** 硬币下沉时长（秒） */
const SINK_DURATION = 0.62;

export class ThrowController {
  private flights: Flight[] = [];

  constructor(
    private ripples: RippleSystem,
    private splash: SplashSystem,
  ) {}

  get activeCount() {
    return this.flights.length;
  }

  /**
   * 发射一枚。
   * @param kind 硬币 / 瓶子
   * @param instance 对应的实例（其静止位姿就是落点）
   * @param start 出手点（世界坐标）
   * @param power 0..1，决定水花大小
   */
  launch(
    kind: FlightKind,
    instance: CoinInstance | BottleInstance,
    start: Vec3,
    power = 1,
  ) {
    const rest =
      kind === "coin"
        ? {
            x: (instance as CoinInstance).restX,
            y: (instance as CoinInstance).restY,
            z: (instance as CoinInstance).restZ,
          }
        : {
            x: instance.x,
            y: WATER_LEVEL,
            z: instance.z,
          };

    this.flights.push({
      kind,
      start,
      target: [rest.x, WATER_LEVEL + 0.03, rest.z],
      t: 0,
      phase: "fly",
      sink: 0,
      power,
      instance,
    });

    /* 交给飞行接管：硬币标记状态（floor pass 要排除它），瓶子标记 flying（起伏跳过它） */
    if (kind === "coin") (instance as CoinInstance).state = "flying";
    else (instance as BottleInstance).flying = true;
  }

  update(dt: number): number {
    let splashes = 0;

    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;

      if (f.phase === "fly") {
        const t = Math.min(f.t, THROW_DURATION);
        const p = throwArc(f.start, f.target, t);

        /* 硬币翻滚、瓶子轻微摇摆 */
        if (f.kind === "coin") {
          const c = f.instance as CoinInstance;
          c.x = p[0];
          c.y = p[1];
          c.z = p[2];
          c.scale = 1;
          /* 自旋速度随飞行推进变慢，像被抛出去的 */
          c.rotX = Math.PI / 2 + t * 26 * (1 - t / (THROW_DURATION * 4));
          c.rotY += dt * 9;
        } else {
          const b = f.instance as BottleInstance;
          b.x = p[0];
          b.y = p[1];
          b.z = p[2];
          b.rotX = 0.22 + Math.sin(t * 8) * 0.5;
        }

        if (f.t >= THROW_DURATION) {
          /* 入水：涟漪 + 水花 */
          f.phase = "sink";
          f.sink = 0;
          this.ripples.add(f.target[0], f.target[2], 1);
          this.splash.emit(f.target[0], f.target[2], f.power);
          splashes++;

          if (f.kind === "bottle") {
            const b = f.instance as BottleInstance;
            b.x = b.baseX;
            b.z = b.baseZ;
            b.flying = false;
            this.flights.splice(i, 1);
          }
        }
        continue;
      }

      /* 下沉：硬币从水面滑到堆体高度，末段带一点回弹 */
      const c = f.instance as CoinInstance;
      f.sink = Math.min(1, f.sink + dt / SINK_DURATION);
      const e = easeOutCubic(f.sink);
      const from = WATER_LEVEL;
      const to = c.restY;
      const bounce = Math.sin(f.sink * Math.PI) * 0.045;
      c.y = from + (to - from) * e + bounce;
      c.x += (c.restX - c.x) * Math.min(1, dt * 6);
      c.z += (c.restZ - c.z) * Math.min(1, dt * 6);
      c.rotX += (Math.PI / 2 - c.rotX) * Math.min(1, dt * 7);

      if (f.sink >= 1) {
        c.x = c.restX;
        c.y = c.restY;
        c.z = c.restZ;
        c.rotX = Math.PI / 2;
        c.state = "settled";
        this.flights.splice(i, 1);
        /* 落定再补一圈小涟漪，收尾更实 */
        this.ripples.add(c.restX, c.restZ, 0.45);
      }
    }

    return splashes;
  }

  /** 把一条抛物线投影成屏幕点列（画预览虚线用） */
  projectArc(
    kind: FlightKind,
    start: Vec3,
    target: { x: number; z: number },
    project: (p: Vec3) => { x: number; y: number } | null,
    steps = 22,
  ): { x: number; y: number }[] {
    const end: Vec3 = [target.x, WATER_LEVEL + 0.03, target.z];
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * THROW_DURATION;
      const p = throwArc(start, end, t);
      const s = project(p);
      if (s) out.push(s);
    }
    return out;
  }

  clear() {
    this.flights.length = 0;
  }
}
