/**
 * 首页 · 3D 许愿池（区块）
 *
 * 位置：Hero（结尾是轮播图）与 Cta（加入我们）之间。
 *
 * 这一层负责「数据 + 外壳 + 降级决策」，具体渲染交给下面两个实现：
 *   · components/wishingwell/WishingWellCanvas.tsx  手写 WebGL2 的 3D 版
 *   · components/wishingwell/fallback/WishingWell2D.tsx  CSS/2D 降级版
 *
 * 三条工程纪律：
 *   ① **首屏不加载 3D**：IntersectionObserver 进入视口才挂载画布
 *   ② **无后端**：数据走 lib/wishStore 的内存实现，提交只进内存；
 *      接 B 端时换掉 store 的实现即可，这里一行不用改
 *   ③ 画布 aria-hidden，旁边必须有一份**纯文本等价物**（下面的 <details>）
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, ListChecks, Sparkles } from "lucide-react";
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Reveal from "../components/Reveal";
import WishingWellCanvas, {
  type CanvasSubmitDraft,
} from "../components/wishingwell/WishingWellCanvas";
import WishingWell2D from "../components/wishingwell/fallback/WishingWell2D";
import {
  countWishes,
  useWishData,
} from "../components/wishingwell/hooks/useWishData";
import { useWishSubmit } from "../components/wishingwell/hooks/useWishSubmit";
import { useLowEndDetect } from "../components/wishingwell/hooks/useLowEndDetect";
import { useInView } from "../components/wishingwell/hooks/useInView";
import { getWishStore } from "../lib/wishStore";
import type { Wish } from "../lib/wishTypes";
import { wishSeed, wishingWell as C } from "../content";

/** 移动端判定（与项目的 md=768 断点一致） */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

export default function WishingWell() {
  const store = useMemo(
    () => getWishStore(wishSeed, C.composer.anonymous),
    [],
  );

  const { wishes, error } = useWishData(store);
  const { submitting, last, submit } = useWishSubmit(store, {
    minLength: 10,
    maxLength: 200,
    messages: {
      tooShort: C.composer.errors.tooShort,
      tooLong: C.composer.errors.tooLong,
      rateLimited: C.composer.errors.rateLimited,
      failed: C.composer.errors.failed,
    },
  });

  /* 本会话自己投的「幽灵物体」：只在自己这边可见，刷新即散 */
  const [ghosts, setGhosts] = useState<Wish[]>([]);
  const allWishes = useMemo(() => [...ghosts, ...wishes], [ghosts, wishes]);
  const counts = useMemo(() => countWishes(wishes), [wishes]);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const isMobile = useIsMobile();
  const low = useLowEndDetect();
  const { ref: lazyRef, inView } = useInView<HTMLDivElement>();
  /** 3D 起不来时切 2D */
  const [engineFailed, setEngineFailed] = useState(false);

  const use2D = (low.checked && low.low) || engineFailed;
  const showInteractive = inView && low.checked;

  const handleSubmit = useCallback(
    async (draft: CanvasSubmitDraft): Promise<Wish | null> => {
      const res = await submit({
        kind: draft.kind,
        text: draft.text,
        author: draft.author,
        contact: draft.contact,
      });
      if (!res.ok || !res.wish) return null;
      setGhosts((g) => [res.wish as Wish, ...g]);
      return res.wish;
    },
    [submit],
  );

  const onLike = useCallback(
    (id: string) => {
      setLikedIds((s) => new Set(s).add(id));
      void store.like(id);
    },
    [store],
  );

  const onReport = useCallback(
    (id: string) => {
      setReportedIds((s) => new Set(s).add(id));
      void store.report(id);
    },
    [store],
  );

  /* 限流倒计时文案：{n} 由这里替换 */
  const submitError = useMemo(() => {
    if (!last || last.ok || !last.message) return null;
    const retry = last.retryAfter ?? 0;
    return last.message.replace("{n}", String(retry));
  }, [last]);

  const interactiveProps = {
    wishes: allWishes,
    counts,
    submitting,
    submitError,
    onSubmit: handleSubmit,
    onLike,
    onReport,
    likedIds,
    reportedIds,
    isMobile,
  };

  return (
    <Section id="wishing-well" ariaLabelledBy="wishing-well-title">
      <Container>
        <SectionTitle
          id="wishing-well-title"
          eyebrow={C.eyebrow}
          title={C.title}
          description={C.description}
        />

        <Reveal>
          <div ref={lazyRef} className="mx-auto w-full max-w-wide">
            {!showInteractive ? (
              /* 还没进视口 / 还没判定完：给一层骨架，绝不提前建 WebGL */
              <div className="well-stage" aria-hidden="true">
                <div className="well-skeleton" />
              </div>
            ) : use2D ? (
              <WishingWell2D
                {...interactiveProps}
                reason={engineFailed ? "engine-failed" : low.reason}
              />
            ) : (
              <WishingWellCanvas {...interactiveProps} onFailed={() => setEngineFailed(true)} />
            )}

            {error && (
              <p className="mt-3 text-center text-caption text-muted">
                {C.fallback.notice}
              </p>
            )}
          </div>
        </Reveal>

        {/* 纯文本等价物：读屏 / 键盘 / 不想开 3D 的人都能拿到全部内容 */}
        <Reveal>
          <details className="mx-auto mt-8 w-full max-w-wide rounded-card border border-hairline bg-surface/30">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-muted">
              <ListChecks size={16} strokeWidth={1.8} aria-hidden="true" />
              {C.list.title}
              <span className="text-caption opacity-70">
                {C.list.countLabel.replace("{n}", String(counts.total))}
              </span>
            </summary>

            <div className="border-t border-hairline px-4 py-4">
              {allWishes.length === 0 ? (
                <p className="text-sm text-muted">{C.list.empty}</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {allWishes.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-card border border-hairline bg-surface/40 p-3"
                    >
                      <p className="flex flex-wrap items-center gap-2 text-caption text-muted">
                        <span
                          className={
                            w.kind === "coin"
                              ? "text-well-gold"
                              : "text-well-glass"
                          }
                        >
                          {w.kind === "coin" ? C.list.coinTag : C.list.bottleTag}
                        </span>
                        <span>{w.author}</span>
                        {w.status === "implemented" && (
                          <span className="inline-flex items-center gap-1 text-well-highlight">
                            <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
                            {C.card.implementedLabel}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Heart size={11} strokeWidth={2} aria-hidden="true" />
                          {w.likes}
                        </span>
                        {w.ghost && <span>· {C.card.ghostLabel}</span>}
                      </p>
                      {w.text && (
                        <p className="mt-1.5 text-sm leading-relaxed text-text">
                          {w.text}
                        </p>
                      )}
                      {w.reply && (
                        <p className="mt-1.5 text-caption text-muted">
                          {C.card.replyTitle}：{w.reply.text}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </Reveal>
      </Container>
    </Section>
  );
}
