/**
 * 许愿池 · 提交 + 乐观更新
 *
 * 提交流程（三步都不可省）：
 *   ① 本地先做校验（10–200 字、蜜罐、限流预览）——错误立刻反馈，不来回一趟
 *   ② store.submit()——目前是内存实现，将来换 HTTP 实现
 *   ③ 拿回带 ghost 的那一枚交给调用方 → 场上以半透明「幽灵物体」渲染，仅提交者可见
 *
 * 提交失败（限流等）时不做本地插入，把原因原样抛给 UI。
 */
import { useCallback, useRef, useState } from "react";
import type { Wish, WishDraft } from "../../../lib/wishTypes";
import { peekRate, type WishStore } from "../../../lib/wishStore";
import { playWellSound } from "../../../lib/wellAudio";
import { trackNow } from "../../../lib/track";

export interface SubmitResult {
  ok: boolean;
  wish?: Wish;
  /** 失败原因（可直接展示） */
  message?: string;
  /** 限流时还要等多少秒 */
  retryAfter?: number;
}

export interface WishSubmitState {
  submitting: boolean;
  last: SubmitResult | null;
  submit: (draft: WishDraft) => Promise<SubmitResult>;
  reset: () => void;
}

export interface SubmitLimits {
  minLength: number;
  maxLength: number;
  /** 错误文案 */
  messages: {
    tooShort: string;
    tooLong: string;
    rateLimited: string;
    failed: string;
  };
}

export function useWishSubmit(
  store: WishStore,
  limits: SubmitLimits,
): WishSubmitState {
  const [submitting, setSubmitting] = useState(false);
  const [last, setLast] = useState<SubmitResult | null>(null);
  const busy = useRef(false);

  const submit = useCallback(
    async (draft: WishDraft): Promise<SubmitResult> => {
      if (busy.current) return { ok: false, message: limits.messages.failed };
      busy.current = true;
      setSubmitting(true);

      const fail = (message: string, retryAfter?: number): SubmitResult => {
        const r: SubmitResult = { ok: false, message, retryAfter };
        setLast(r);
        trackNow("wish_submit", { type: draft.kind, ok: false });
        return r;
      };

      try {
        const text = draft.text.trim();
        if (text.length < limits.minLength) {
          return fail(limits.messages.tooShort);
        }
        if (text.length > limits.maxLength) {
          return fail(limits.messages.tooLong);
        }

        /* 限流提前拦一道（真正的强制在服务端） */
        const rate = peekRate();
        if (!rate.ok) {
          return fail(limits.messages.rateLimited, rate.retryAfter);
        }

        const wish = await store.submit({ ...draft, text });
        playWellSound("click");
        trackNow("wish_submit", { type: draft.kind, ok: true });

        const result: SubmitResult = { ok: true, wish };
        setLast(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        /* 内存实现用 "RATE:scope:seconds" 表达限流 */
        const m = /^RATE:(\w+):(\d+)$/.exec(msg);
        if (m) return fail(limits.messages.rateLimited, Number(m[2]));
        return fail(limits.messages.failed);
      } finally {
        busy.current = false;
        setSubmitting(false);
      }
    },
    [store, limits],
  );

  const reset = useCallback(() => setLast(null), []);

  return { submitting, last, submit, reset };
}
