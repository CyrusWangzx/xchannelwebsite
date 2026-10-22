/**
 * 许愿池 · 数据层接缝
 *
 * ┌─ 现在 ────────────────────────────────────────────────────────────────┐
 * │ 「只做展示」：种子数据只读；提交进会内内存（刷新即散），不落库。       │
 * │ 频率限制在本地模拟（真实强制必须在服务端，客户端限流只是体验）。      │
 * └──────────────────────────────────────────────────────────────────────┘
 * ┌─ 将来（B 端页面/接口就绪）───────────────────────────────────────────┐
 * │ 实现 createHttpStore(baseUrl) 满足同一个 WishStore 接口：             │
 * │   POST /api/wishes                → submit                            │
 * │   GET  /api/wishes?status=&sort=&cursor= → list                       │
 * │   POST /api/wishes/:id/like       → like                              │
 * │   POST /api/wishes/:id/report     → report                            │
 * │ 然后把 getWishStore() 的返回值换掉即可，组件层零改动。                │
 * └──────────────────────────────────────────────────────────────────────┘
 */
import type { Wish, WishDraft, WishReply, WishStatus } from "./wishTypes";

export interface WishQuery {
  /** visible = approved + implemented（对外可见的那些） */
  status?: WishStatus | "visible";
  sort?: "latest" | "popular";
  cursor?: string;
  limit?: number;
}

export interface WishListResult {
  items: Wish[];
  nextCursor?: string;
}

export interface WishStore {
  list(q?: WishQuery): Promise<WishListResult>;
  /** 提交。返回的对象带 ghost=true（乐观渲染的幽灵物体） */
  submit(draft: WishDraft): Promise<Wish>;
  /** 共鸣。返回新的共鸣数 */
  like(id: string): Promise<number>;
  report(id: string, reason?: string): Promise<void>;
}

/* ---------------------------------------------------------------- 工具 */

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 对外可见 = 通过审核 或 已实现 */
export function isVisible(w: Wish): boolean {
  return w.status === "approved" || w.status === "implemented";
}

/** 昵称：空 → 匿名（文案从 content 传入，避免这里写死中文） */
function normalizeAuthor(raw: string | undefined, anonymous: string): string {
  const s = (raw ?? "").trim();
  return s.length ? s.slice(0, 16) : anonymous;
}

/* ------------------------------------------------------- 频率限制（本地模拟） */

const RATE_KEY = "xchannel-wish-rate";
/** 1 次 / 分钟，5 次 / 天 */
export const RATE_PER_MINUTE = 1;
export const RATE_PER_DAY = 5;

interface RateLog {
  /** 毫秒时间戳列表 */
  hits: number[];
}

function readRateLog(now: number): RateLog {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) return { hits: [] };
    const parsed = JSON.parse(raw) as RateLog;
    /* 只留最近 24h，避免无限增长 */
    const hits = Array.isArray(parsed.hits)
      ? parsed.hits.filter((t) => typeof t === "number" && now - t < 86_400_000)
      : [];
    return { hits };
  } catch {
    return { hits: [] };
  }
}

function writeRateLog(log: RateLog) {
  try {
    localStorage.setItem(RATE_KEY, JSON.stringify(log));
  } catch {
    /* 隐私模式等写不进去：不影响主流程，只是限流失效 */
  }
}

export interface RateVerdict {
  ok: boolean;
  /** 不通过时，还要等多少秒 */
  retryAfter: number;
  /** 触到了哪一档 */
  scope?: "minute" | "day";
}

/** 查当前是否还能提交（不改状态）。用于把按钮提前置灰 */
export function peekRate(now = Date.now()): RateVerdict {
  const { hits } = readRateLog(now);
  const lastMinute = hits.filter((t) => now - t < 60_000);
  if (lastMinute.length >= RATE_PER_MINUTE) {
    const oldest = Math.min(...lastMinute);
    return {
      ok: false,
      retryAfter: Math.ceil((60_000 - (now - oldest)) / 1000),
      scope: "minute",
    };
  }
  if (hits.length >= RATE_PER_DAY) {
    const oldest = Math.min(...hits);
    return {
      ok: false,
      retryAfter: Math.ceil((86_400_000 - (now - oldest)) / 1000),
      scope: "day",
    };
  }
  return { ok: true, retryAfter: 0 };
}

/** 记一次提交（通过后才记） */
export function commitRate(now = Date.now()) {
  const log = readRateLog(now);
  log.hits.push(now);
  writeRateLog(log);
}

/* ------------------------------------------------------------ 内存实现 */

export interface MemoryStoreOptions {
  seed: Wish[];
  /** 缺省昵称的文案 */
  anonymous: string;
  /** 模拟网络延迟（ms），让乐观渲染的过渡看得见 */
  latency?: number;
  /** 是否启用本地限流 */
  rateLimit?: boolean;
}

export function createMemoryStore(opts: MemoryStoreOptions): WishStore {
  const { seed, anonymous, latency = 320, rateLimit = true } = opts;

  /** 只读种子 + 本会话提交（幽灵）。提交者自己能看到自己的幽灵 */
  const mine: Wish[] = [];
  const likes = new Map<string, number>();

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const withLikes = (w: Wish): Wish => {
    const extra = likes.get(w.id);
    return extra === undefined ? w : { ...w, likes: w.likes + extra };
  };

  return {
    async list(q = {}) {
      await wait(latency * 0.6);
      const { status = "visible", sort = "latest", limit = 400 } = q;

      let items = [...seed, ...mine].filter((w) => w.ghost || isVisible(w));
      if (status !== "visible") items = items.filter((w) => w.status === status);

      items.sort((a, b) =>
        sort === "popular"
          ? b.likes - a.likes
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );

      return { items: items.slice(0, limit).map(withLikes) };
    },

    async submit(draft) {
      /* 蜜罐：字段有值 = 机器人。装作成功，但不入库（让它以为提交成功了） */
      if (draft.trap) {
        await wait(latency);
        return {
          id: newId(),
          kind: draft.kind,
          author: anonymous,
          status: "pending" as WishStatus,
          likes: 0,
          createdAt: new Date().toISOString(),
          ghost: true,
        };
      }

      if (rateLimit) {
        const v = peekRate();
        if (!v.ok) throw new Error(`RATE:${v.scope}:${v.retryAfter}`);
      }

      await wait(latency);

      const wish: Wish = {
        id: newId(),
        kind: draft.kind,
        text: draft.text.trim(),
        author: normalizeAuthor(draft.author, anonymous),
        status: "pending",
        likes: 0,
        createdAt: new Date().toISOString(),
        /* 幽灵：半透明、无文字、仅提交者可见 */
        ghost: true,
      };
      /* 注意：draft.contact **不落内存**。它只应该加密送到后台，
         展示层连碰都不碰——所以这里刻意不保存。 */
      mine.push(wish);
      if (rateLimit) commitRate();
      return wish;
    },

    async like(id) {
      await wait(90);
      const next = (likes.get(id) ?? 0) + 1;
      likes.set(id, next);
      const base =
        seed.find((w) => w.id === id) ?? mine.find((w) => w.id === id);
      return (base?.likes ?? 0) + next;
    },

    async report() {
      /* 展示阶段：只吞掉调用，真实举报要靠后台 */
      await wait(80);
    },
  };
}

/* ------------------------------------------------------------ 单例 */

let store: WishStore | null = null;

/** 全局单例。将来换 B 端时，改这里一行 */
export function getWishStore(seed: Wish[], anonymous: string): WishStore {
  if (!store) store = createMemoryStore({ seed, anonymous });
  return store;
}

/** 测试/换肤时重置 */
export function resetWishStore() {
  store = null;
}

/** 官方回复的便捷构造（面板里用） */
export function makeReply(text: string, by: string): WishReply {
  return { text, by };
}
