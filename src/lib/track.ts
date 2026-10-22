/**
 * 许愿池 · 埋点
 *
 * 现阶段只把事件送到一个可观察的出口（开发期挂到 window，验收脚本能断言），
 * 不引任何分析 SDK —— 接入真实平台时只改这一个文件。
 *
 * 事件名与 spec 一致：
 *   wish_pool_view / wish_pool_interact / wish_throw_start / wish_throw_abandon
 *   wish_submit {type} / wish_object_click {id}
 */

export type WishKindLabel = "coin" | "bottle";

export type TrackEvent =
  | { name: "wish_pool_view"; at: number }
  | { name: "wish_pool_interact"; at: number; action: "throw" | "click" | "hover" }
  | { name: "wish_throw_start"; at: number; kind: WishKindLabel; mode: "drag" | "tap" }
  | { name: "wish_throw_abandon"; at: number }
  | { name: "wish_submit"; at: number; type: WishKindLabel; ok: boolean }
  | { name: "wish_object_click"; at: number; id: string; kind: WishKindLabel };

/** 环形缓冲，只留最近若干条（验收脚本读它） */
const BUFFER_MAX = 200;
const buffer: TrackEvent[] = [];

interface TrackBridge {
  events: TrackEvent[];
  names: () => string[];
  reset: () => void;
}

declare global {
  interface Window {
    __xchannelTrack?: TrackBridge;
  }
}

function ensureBridge(): TrackBridge | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  if (!window.__xchannelTrack) {
    window.__xchannelTrack = {
      events: buffer,
      names: () => buffer.map((e) => e.name),
      reset: () => {
        buffer.length = 0;
      },
    };
  }
  return window.__xchannelTrack;
}

export function track(event: TrackEvent): void {
  buffer.push(event);
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);

  if (import.meta.env.DEV) {
    ensureBridge();
    /* 开发期让事件在控制台可见，但用 debug 级别，不污染报错计数 */
    // eslint-disable-next-line no-console
    console.debug("[track]", event.name, event);
  }
  /* 生产：这里接真实分析平台。当前留空，不做任何网络请求。 */
}

/** 语法糖，省得每处都写 at: Date.now() */
export function trackNow<E extends TrackEvent["name"]>(
  name: E,
  payload: Omit<Extract<TrackEvent, { name: E }>, "name" | "at"> = {} as never,
): void {
  track({ name, at: Date.now(), ...payload } as TrackEvent);
}
