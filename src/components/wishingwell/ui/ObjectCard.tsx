/**
 * 许愿池 · 物体卡片
 *
 * 点池子里的硬币 / 漂流瓶后，在它的 3D 坐标处浮起一张卡：
 * 正文、共鸣数、官方回复（已回应 / 已实现）。
 * 位置由引擎投影得到（像素坐标），这里只负责画。
 *
 * 无障碍：这是一个 dialog 语义的浮层，但在页面上又不是模态——
 * 所以给 role="dialog" + aria-label，并把焦点收到关闭键上，
 * 让键盘用户 Tab 进来就能关掉，不至于被卡在卡片里。
 */
import { useEffect, useRef } from "react";
import { Check, Heart, Send, Sparkles, X } from "lucide-react";
import type { Wish } from "../../../lib/wishTypes";
import { wishingWell as C } from "../../../content";

interface ObjectCardProps {
  wish: Wish;
  /** 卡片锚点在舞台内的像素坐标（物体投影位置） */
  x: number;
  y: number;
  liked: boolean;
  reported: boolean;
  onClose: () => void;
  onLike: (id: string) => void;
  onReport: (id: string) => void;
}

export default function ObjectCard({
  wish,
  x,
  y,
  liked,
  reported,
  onClose,
  onLike,
  onReport,
}: ObjectCardProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [wish.id]);

  const implemented = wish.status === "implemented";
  const ghost = Boolean(wish.ghost);

  const statusLabel = ghost
    ? C.card.ghostLabel
    : implemented
      ? C.card.implementedLabel
      : wish.status === "pending"
        ? C.card.pendingLabel
        : C.card.approvedLabel;

  return (
    <div
      className="well-card glass-liquid rounded-card p-4 text-left shadow-elevated"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="dialog"
      aria-label={wish.author}
    >
      {/* 头部：类型徽章 + 昵称 + 状态 + 关闭 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-pill px-2.5 py-0.5 text-caption ${
              wish.kind === "coin"
                ? "bg-well-gold/15 text-well-gold"
                : "bg-well-glass/15 text-well-glass"
            }`}
          >
            {wish.kind === "coin" ? C.list.coinTag : C.list.bottleTag}
          </span>
          <span className="text-caption text-muted">{wish.author}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption ${
              implemented
                ? "bg-well-highlight/15 text-well-highlight"
                : ghost
                  ? "border border-dashed border-hairline-strong text-muted"
                  : "bg-accent/10 text-accent-text"
            }`}
          >
            {implemented && (
              <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
            )}
            {statusLabel}
          </span>
        </div>

        <button
          ref={closeRef}
          type="button"
          className="btn-reset -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted transition duration-fast ease-ease hover:bg-surface/60 hover:text-text"
          onClick={onClose}
          aria-label={C.card.close}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* 正文。幽灵没有正文 */}
      {wish.text ? (
        <p className="mt-3 text-sm leading-relaxed text-text">{wish.text}</p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {C.card.ghostLabel}
        </p>
      )}

      {/* 官方回复 */}
      {wish.reply && (
        <div className="mt-3 rounded-card border border-hairline bg-surface/40 p-3">
          <p className="flex items-center gap-1.5 text-caption text-accent-text">
            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
            {C.card.replyTitle}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {wish.reply.text}
          </p>
          <p className="mt-1 text-caption text-muted/70">— {wish.reply.by}</p>
        </div>
      )}

      {/* 操作条 */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm tabular-nums text-well-gold">
            {wish.likes + (liked ? 1 : 0)}
          </span>
          <span className="text-caption text-muted">{C.card.likes}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn-reset inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption transition duration-fast ease-ease ${
              liked
                ? "bg-well-highlight/15 text-well-highlight"
                : "text-muted hover:bg-surface/60 hover:text-text"
            }`}
            onClick={() => onLike(wish.id)}
            disabled={liked || ghost}
            aria-pressed={liked}
          >
            <Heart
              size={13}
              strokeWidth={2}
              aria-hidden="true"
              fill={liked ? "currentColor" : "none"}
            />
            {liked ? C.card.liked : C.card.likeAction}
          </button>

          {!ghost && (
            <button
              type="button"
              className="btn-reset inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption text-muted transition duration-fast ease-ease hover:bg-surface/60 hover:text-text"
              onClick={() => onReport(wish.id)}
              disabled={reported}
            >
              <Send size={12} strokeWidth={2} aria-hidden="true" />
              {reported ? C.card.reported : C.card.report}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
