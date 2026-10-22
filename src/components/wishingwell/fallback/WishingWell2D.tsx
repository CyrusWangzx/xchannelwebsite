/**
 * 许愿池 · 2D 降级版
 *
 * 低端设备（无 WebGL2 / 核心数少 / 内存小）或 3D 初始化失败时启用。
 * 功能**必须与 3D 版一致**：投币、涟漪、点开卡片、提交表单、计数。
 * 只是没有真 3D、没有水面 shader、没有泛光。
 *
 * 实现走 CSS + 二维圆点：
 *   · 池子是一圈 CSS 径向渐变（.well2d-pool）
 *   · 硬币 / 瓶子是绝对定位的小圆点，位置由「下标 + 黄金角」稳定推算
 *   · 投掷 = 一个 keyframe 抛物线从池口飞到落点，落点炸一圈 .well2d-ripple
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Coins, MoveUpRight, ScrollText } from "lucide-react";
import type { Wish, WishKind } from "../../../lib/wishTypes";
import { trackNow } from "../../../lib/track";
import { wishingWell as C } from "../../../content";
import Counters from "../ui/Counters";
import ObjectCard from "../ui/ObjectCard";
import WishComposer, { type ComposerDraft } from "../ui/WishComposer";
import type { CanvasSubmitDraft } from "../WishingWellCanvas";

interface WishingWell2DProps {
  wishes: Wish[];
  counts: { coins: number; bottles: number; implemented: number };
  submitting: boolean;
  submitError: string | null;
  onSubmit: (draft: CanvasSubmitDraft) => Promise<Wish | null>;
  onLike: (id: string) => void;
  onReport: (id: string) => void;
  likedIds: Set<string>;
  reportedIds: Set<string>;
  /** 降级原因，写进 data 属性（验收脚本会读） */
  reason: string;
  isMobile: boolean;
}

interface Placed {
  id: string;
  kind: WishKind;
  /** 池内百分比坐标 */
  x: number;
  y: number;
  ghost: boolean;
  implemented: boolean;
}

/** 由下标稳定推算池内落点（黄金角螺旋，与 3D 版同一套思路） */
function place(index: number, kind: WishKind): { x: number; y: number } {
  const r = Math.sqrt(((index % 160) + 0.5) / 160) * 40;
  const t = index * 2.39996323 + (kind === "bottle" ? 1.2 : 0);
  return { x: 50 + Math.cos(t) * r, y: 50 + Math.sin(t) * r * 0.92 };
}

export default function WishingWell2D({
  wishes,
  counts,
  submitting,
  submitError,
  onSubmit,
  onLike,
  onReport,
  likedIds,
  reportedIds,
  reason,
  isMobile,
}: WishingWell2DProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  /** 本会话自己投的（幽灵，仅自己可见） */
  const [ghosts, setGhosts] = useState<Placed[]>([]);
  const [kind, setKind] = useState<WishKind>("coin");
  const [composing, setComposing] = useState(false);
  const [card, setCard] = useState<{ wish: Wish; x: number; y: number } | null>(
    null,
  );
  /** 正在飞的那一枚：{到点, 目标} */
  const [flying, setFlying] = useState<{
    kind: WishKind;
    to: { x: number; y: number };
    key: number;
  } | null>(null);
  const flyKey = useRef(0);

  const placed = useMemo<Placed[]>(() => {
    const fromData = wishes
      .filter((w) => w.status !== "rejected")
      .slice(0, 260)
      .map((w, i) => ({
        id: w.id,
        kind: w.kind,
        ...place(i, w.kind),
        ghost: Boolean(w.ghost),
        implemented: w.status === "implemented",
      }));
    return [...fromData, ...ghosts];
  }, [wishes, ghosts]);

  const throwTo = useCallback(
    (x: number, y: number) => {
      flyKey.current += 1;
      setFlying({ kind, to: { x, y }, key: flyKey.current });
      trackNow("wish_throw_start", { kind, mode: "tap" });
      /* 飞行动画走 CSS，落地后弹表单 */
      window.setTimeout(() => {
        setFlying(null);
        setComposing(true);
      }, 620);
    },
    [kind],
  );

  const onStageClick = useCallback(
    (e: React.MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      if (Math.hypot(x - 50, y - 50) > 34) return; /* 点在池外不投 */
      throwTo(x, y);
    },
    [throwTo],
  );

  const handleSubmit = useCallback(
    async (draft: ComposerDraft) => {
      const wish = await onSubmit({ ...draft, kind });
      if (!wish) return;
      const p = place(placed.length, kind);
      setGhosts((g) => [
        ...g,
        { id: wish.id, kind, x: p.x, y: p.y, ghost: true, implemented: false },
      ]);
      setComposing(false);
      trackNow("wish_pool_interact", { action: "throw" });
    },
    [kind, onSubmit, placed.length],
  );

  const quickThrow = useCallback(() => {
    throwTo(50 + (Math.random() - 0.5) * 26, 50 + (Math.random() - 0.5) * 26);
  }, [throwTo]);

  const isComposing = composing;

  return (
    <div data-fallback={reason}>
      <div className="mb-3 flex items-center justify-center">
        <p className="rounded-pill border border-hairline px-3 py-1 text-caption text-muted">
          {C.fallback.notice}
        </p>
      </div>

      <div ref={stageRef} className="well-stage" onClick={onStageClick}>
        <div className="well2d">
          <div className="well2d-pool">
            {placed.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn-reset absolute grid h-4 w-4 place-items-center rounded-full transition-transform duration-fast ease-ease hover:scale-125 focus-visible:scale-125"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  translate: "-50% -50%",
                  background:
                    p.kind === "coin"
                      ? "radial-gradient(circle at 34% 30%, rgb(var(--c-well-highlight-rgb)), rgb(var(--c-well-gold-rgb)) 62%, rgb(var(--c-well-gold-deep-rgb)))"
                      : "radial-gradient(circle at 34% 30%, rgb(var(--c-well-paper-rgb)), rgb(var(--c-well-glass-rgb)) 60%, rgb(var(--c-well-glass-deep-rgb)))",
                  opacity: p.ghost ? 0.42 : 1,
                  boxShadow: p.implemented
                    ? "0 0 0 3px rgb(var(--c-well-highlight-rgb) / 0.35)"
                    : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const wish = wishes.find((w) => w.id === p.id);
                  if (!wish) return;
                  trackNow("wish_object_click", { id: wish.id, kind: wish.kind });
                  setCard({
                    wish,
                    x: (p.x / 100) * (stageRef.current?.clientWidth ?? 0),
                    y: (p.y / 100) * (stageRef.current?.clientHeight ?? 0),
                  });
                }}
                aria-label={`${p.kind === "coin" ? C.list.coinTag : C.list.bottleTag}`}
              />
            ))}

            {/* 正在飞的那一枚 + 落点涟漪 */}
            {flying && (
              <>
                <span
                  key={`fly-${flying.key}`}
                  className="pointer-events-none absolute h-4 w-4 rounded-full"
                  style={{
                    left: `${flying.to.x}%`,
                    top: `${flying.to.y}%`,
                    translate: "-50% -50%",
                    background:
                      flying.kind === "coin"
                        ? "radial-gradient(circle at 34% 30%, rgb(var(--c-well-highlight-rgb)), rgb(var(--c-well-gold-rgb)))"
                        : "radial-gradient(circle at 34% 30%, rgb(var(--c-well-paper-rgb)), rgb(var(--c-well-glass-rgb)))",
                    animation: "well2d-fly 600ms cubic-bezier(0.3, 1.4, 0.6, 1)",
                  }}
                />
                <span
                  className="well2d-ripple"
                  style={{
                    left: `${flying.to.x}%`,
                    top: `${flying.to.y}%`,
                    translate: "-50% -50%",
                    animationDelay: "520ms",
                  }}
                />
              </>
            )}
          </div>
        </div>

        {card && (
          <ObjectCard
            wish={wishes.find((w) => w.id === card.wish.id) ?? card.wish}
            x={card.x}
            y={card.y}
            liked={likedIds.has(card.wish.id)}
            reported={reportedIds.has(card.wish.id)}
            onClose={() => setCard(null)}
            onLike={onLike}
            onReport={onReport}
          />
        )}

        {/* 2D 版的抛物线：用 CSS 从池口斜抛进来 */}
        <style>{`
          @keyframes well2d-fly {
            0%   { transform: translate(-50%, -50%) translate(-140%, -220px) scale(0.7); opacity: 0.6; }
            55%  { transform: translate(-50%, -50%) translate(-45%, -150px) scale(1.05); opacity: 1; }
            100% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      <div className="mt-5 flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {(
            [
              { k: "coin" as const, icon: Coins, label: C.chooseCoin },
              { k: "bottle" as const, icon: ScrollText, label: C.chooseBottle },
            ]
          ).map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              type="button"
              className={`btn-reset inline-flex min-h-[2.5rem] items-center gap-2 rounded-pill border px-4 py-2 text-sm transition duration-fast ease-ease ${
                kind === k
                  ? k === "coin"
                    ? "border-well-gold/60 bg-well-gold/12 text-well-gold"
                    : "border-well-glass/60 bg-well-glass/12 text-well-glass"
                  : "border-hairline text-muted hover:border-accent/40 hover:text-text"
              }`}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </button>
          ))}

          <button
            type="button"
            className="btn-reset inline-flex min-h-[2.5rem] items-center gap-2 rounded-pill bg-accent-strong px-4 py-2 text-sm font-medium text-white transition duration-fast ease-ease hover:shadow-glow disabled:opacity-60"
            onClick={quickThrow}
            disabled={isComposing}
          >
            <MoveUpRight size={16} strokeWidth={2} aria-hidden="true" />
            {C.fallback.dropLabel}
          </button>
        </div>

        <p className="text-caption text-muted">
          {C.tapHint}
          <span className="mx-2 opacity-40">·</span>
          {isMobile ? C.tapHint : C.cameraHint}
        </p>

        <Counters
          coins={counts.coins}
          bottles={counts.bottles}
          implemented={counts.implemented}
        />
      </div>

      {isComposing && (
        <div className="mt-5">
          <WishComposer
            kind={kind}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
            onCancel={() => setComposing(false)}
          />
        </div>
      )}
    </div>
  );
}
