/**
 * 许愿池 · 拉数据
 *
 * 形态上等价于 SWR 的最小实现（数据 / loading / error / reload），
 * 但没有为此引一个库——这个组件只需要「拉一次 + 手动刷新」。
 * 换 B 端接口时，只把 store 换掉，这个 hook 不动。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Wish } from "../../../lib/wishTypes";
import { isVisible, type WishQuery, type WishStore } from "../../../lib/wishStore";

export interface WishDataState {
  wishes: Wish[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useWishData(
  store: WishStore,
  query: WishQuery = { status: "visible", sort: "latest", limit: 400 },
): WishDataState {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /* 用 ref 拿最新 query，避免把对象写进依赖数组导致每次渲染都重拉 */
  const queryRef = useRef(query);
  queryRef.current = query;

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    store
      .list(queryRef.current)
      .then((res) => {
        if (cancelled) return;
        setWishes(res.items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [store, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { wishes, loading, error, reload };
}

/** 计数：许愿数 / 建议数 / 已实现数（对外可见的才算） */
export function countWishes(wishes: Wish[]) {
  let coins = 0;
  let bottles = 0;
  let implemented = 0;
  for (const w of wishes) {
    if (!isVisible(w)) continue;
    if (w.kind === "coin") coins++;
    else bottles++;
    if (w.status === "implemented") implemented++;
  }
  return { coins, bottles, implemented, total: coins + bottles };
}
