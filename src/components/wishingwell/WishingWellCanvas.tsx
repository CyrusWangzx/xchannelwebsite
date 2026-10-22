/**
 * 许愿池 · 交互编排
 *
 * 组件本身不做渲染——渲染在 gl/engine.ts 里（手写 WebGL2）。
 * 这一层只干四件事：
 *   ① 管引擎的生命周期（懒加载后才建、离开视口就停、卸载就 dispose）
 *   ② 把指针事件翻译成「点物体看卡片 / 拖拽投掷 / 点击投掷」
 *   ③ 主题变化时让引擎重读令牌
 *   ④ 把 HTML 浮层（卡片 / 表单）钉在物体的 3D 投影位置上
 *
 * 坐标约定：舞台内 **CSS 像素**（引擎的相机就是这个空间），
 * 所以这里不用管 devicePixelRatio。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Coins, MoveUpRight, ScrollText, Volume2, VolumeX } from "lucide-react";
import { WellEngine, readPalette, type WellPick } from "./gl/engine";
import type { Wish, WishKind } from "../../lib/wishTypes";
import {
  audioSupported,
  isAudioEnabled,
  playWellSound,
  setAudioEnabled,
} from "../../lib/wellAudio";
import { track, trackNow } from "../../lib/track";
import { wishingWell as C } from "../../content";
import Counters from "./ui/Counters";
import ObjectCard from "./ui/ObjectCard";
import WishComposer, { type ComposerDraft } from "./ui/WishComposer";

type Phase = "idle" | "dragging" | "composing";

/** 开发期验收入口（生产会被摇掉） */
interface WellDevBridge {
  stats: () => ReturnType<WellEngine["getStats"]>;
  stageSize: () => { w: number; h: number };
  pickAt: (x: number, y: number) => WellPick | null;
  previewArc: (x: number, y: number) => { x: number; y: number }[];
  isOverPool: (x: number, y: number) => boolean;
  throwAt: (kind: WishKind, x: number, y: number) => string | null;
  promote: (tempId: string, realId: string) => void;
  discard: (id: string) => void;
  fastForward: (seconds: number) => void;
  /** 鱼群第一条的位姿：验收里断言「真的在游」（截图看不出「慢」和「停」） */
  fish: () => ReturnType<WellEngine["fishSample"]>;
  palette: () => ReturnType<typeof readPalette>;
  /** 开发期调参：只覆盖传入字段，返回合并后的整套调色板 */
  tune: (partial: Partial<ReturnType<typeof readPalette>>) => ReturnType<
    typeof readPalette
  >;
}

declare global {
  interface Window {
    __xchannelWell?: WellDevBridge;
  }
}

export interface CanvasSubmitDraft extends ComposerDraft {
  kind: WishKind;
}

interface WishingWellCanvasProps {
  wishes: Wish[];
  counts: { coins: number; bottles: number; implemented: number };
  submitting: boolean;
  submitError: string | null;
  onSubmit: (draft: CanvasSubmitDraft) => Promise<Wish | null>;
  onLike: (id: string) => void;
  onReport: (id: string) => void;
  likedIds: Set<string>;
  reportedIds: Set<string>;
  isMobile: boolean;
  /** 3D 起不来（无 WebGL2 / 上下文丢失 / shader 编译失败）→ 上层换成 2D */
  onFailed?: (message: string) => void;
}

export default function WishingWellCanvas({
  wishes,
  counts,
  submitting,
  submitError,
  onSubmit,
  onLike,
  onReport,
  likedIds,
  reportedIds,
  isMobile,
  onFailed,
}: WishingWellCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WellEngine | null>(null);

  /** 最新数据给引擎用（避免把 wishes 写进建引擎那个 effect 的依赖里） */
  const wishesRef = useRef(wishes);
  wishesRef.current = wishes;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [kind, setKind] = useState<WishKind>("coin");
  const [phase, setPhase] = useState<Phase>("idle");
  const [arc, setArc] = useState<{ x: number; y: number }[]>([]);
  /** 舞台的 CSS 像素尺寸：SVG 预览层的 viewBox 要用它（否则虚线会被拉伸） */
  const [stageSize, setStageSize] = useState({ w: 1, h: 1 });
  const [card, setCard] = useState<{ wish: Wish; x: number; y: number } | null>(
    null,
  );
  /** 正在填的那一枚（提交成功后用它把幽灵「转正」） */
  const pendingRef = useRef<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const reducedMotion = useReducedMotion();

  /* ------------------------------------------------------------ 引擎 */

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let engine: WellEngine;
    try {
      engine = new WellEngine({
        canvas,
        palette: readPalette(stage),
        reducedMotion: Boolean(reducedMotion),
        /* DPR 自适应：手机 1.5，桌面 2 —— 3D 场景不值得为 3 倍屏多烧 2.25 倍像素 */
        maxDpr: isMobile ? 1.5 : 2,
        hooks: {
          onReady: () => setReady(true),
          onError: (message) => {
            /* 帧循环里出错：一定要吼出来，否则表现为「静默降级成 2D」很难查 */
            console.error("[wishingwell] 渲染循环出错：", message);
            setFailed(message);
            onFailed?.(message);
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[wishingwell] 引擎初始化失败：", message);
      setFailed(message);
      onFailed?.(message);
      return;
    }

    engineRef.current = engine;
    engine.setWishes(wishesRef.current);
    engine.start();
    trackNow("wish_pool_view");

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 开发期验收入口。⚠️ 两个要点：
       ① 必须由 import.meta.env.DEV 守着 —— 生产构建里这段会被摇掉，
          产物中不会出现 __xchannelWell；
       ② 必须**排在建引擎那个 effect 之后**，否则首次运行时 engineRef 还是 null，
          桥就装不上了（effect 按声明顺序执行）。 */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const engine = engineRef.current;
    const stage = stageRef.current;
    if (!engine || !stage) return;

    window.__xchannelWell = {
      stats: () => engine.getStats(),
      stageSize: () => ({ w: stage.clientWidth, h: stage.clientHeight }),
      pickAt: (x: number, y: number) => engine.pickAt(x, y),
      previewArc: (x: number, y: number) =>
        engine.previewArc("coin", { x, y }, { x, y }),
      isOverPool: (x: number, y: number) => engine.isOverPool(x, y),
      throwAt: (kind: WishKind, x: number, y: number) =>
        engine.beginThrow(kind, { x, y }, 1, { x, y }),
      promote: (a: string, b: string) => engine.promote(a, b),
      discard: (id: string) => engine.discard(id),
      /** 推进若干秒的模拟时间（验收里不必真等 0.9s 的飞行） */
      fastForward: (seconds: number) => engine.fastForward(seconds),
      fish: () => engine.fishSample(),
      palette: () => readPalette(stage),
      /**
       * 开发期调参：只覆盖传入字段（specular / normalStrength / refractStrength /
       * rimStrength / bloomStrength / bloomThreshold / vignette / 各 RGB）。
       * 用来在浏览器控制台里二分定位观感问题，不必改 CSS 重跑。
       */
      tune: (partial: Parameters<WellEngine["patchPalette"]>[0]) =>
        engine.patchPalette(partial),
    };
    return () => {
      delete window.__xchannelWell;
    };
  }, [ready]);

  /* 主题切换 → 重读令牌（引擎不监听 CSS，由这里通知） */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sync = () => engineRef.current?.refreshPaletteFrom(stage);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  /* reduce-motion 变化 */
  useEffect(() => {
    engineRef.current?.setReducedMotion(Boolean(reducedMotion));
  }, [reducedMotion]);

  /* 舞台尺寸（给抛物线预览的 viewBox 用） */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () =>
      setStageSize({
        w: Math.max(1, stage.clientWidth),
        h: Math.max(1, stage.clientHeight),
      });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  /* 数据变化 → 同步到场里 */
  useEffect(() => {
    engineRef.current?.setWishes(wishes);
  }, [wishes]);

  /* 离开视口就停渲染（省电、省风扇） */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const engine = engineRef.current;
        if (!engine) return;
        if (entry.isIntersecting) engine.start();
        else engine.stop();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  /* ------------------------------------------------------- 指针交互 */

  const openCard = useCallback((pick: WellPick) => {
    const wish = wishesRef.current.find((w) => w.id === pick.id);
    if (!wish) return;
    playWellSound("click");
    trackNow("wish_object_click", { id: wish.id, kind: wish.kind });
    setCard({ wish, x: pick.x, y: pick.y });
  }, []);

  const localPoint = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const p = localPoint(e);

      /* 先看是不是点在某个物体上 —— 点物体永远优先「看内容」 */
      const pick = engine.pickAt(p.x, p.y);
      if (pick) {
        engine.setHover(pick);
        trackNow("wish_pool_interact", { action: "click" });
        openCard(pick);
        return;
      }

      /* 空白水面 → 起手瞄准 */
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setPhase("dragging");
      setCard(null);
      trackNow("wish_throw_start", { kind, mode: "drag" });
      setArc(engine.previewArc(kind, p, p));
    },
    [kind, localPoint, openCard],
  );

  const lastHoverAt = useRef(0);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const p = localPoint(e);

      if (phase === "dragging") {
        setArc(engine.previewArc(kind, p, p));
        return;
      }
      /* 悬停高亮（节流到 ~30fps 足够） */
      const now = performance.now();
      if (now - lastHoverAt.current < 33) return;
      lastHoverAt.current = now;
      engine.setHover(engine.pickAt(p.x, p.y));
    },
    [kind, localPoint, phase],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const engine = engineRef.current;
      if (!engine || phase !== "dragging") return;
      const p = localPoint(e);

      setArc([]);
      setPhase("idle");

      if (!engine.isOverPool(p.x, p.y)) {
        trackNow("wish_throw_abandon");
        return;
      }

      const power = kind === "coin" ? 1 : 0.75;
      const tempId = engine.beginThrow(kind, p, power, p);
      if (!tempId) return;
      pendingRef.current = tempId;
      playWellSound("throw");
      trackNow("wish_pool_interact", { action: "throw" });
      /* 落水后再弹表单：先有动作，再有话要说 */
      setPhase("composing");
    },
    [kind, localPoint, phase],
  );

  /** 点击投币（拖拽失败 / 触屏 / 键盘路径都走这里） */
  const quickThrow = useCallback(() => {
    const engine = engineRef.current;
    const stage = stageRef.current;
    if (!engine || !stage) return;
    const rect = stage.getBoundingClientRect();
    const center = { x: rect.width / 2, y: rect.height * 0.56 };
    const tempId = engine.beginThrow(kind, center, 0.9);
    if (!tempId) return;
    pendingRef.current = tempId;
    playWellSound("throw");
    trackNow("wish_throw_start", { kind, mode: "tap" });
    setPhase("composing");
  }, [kind]);

  /* --------------------------------------------------------- 提交 */

  const handleSubmit = useCallback(
    async (draft: ComposerDraft) => {
      const wish = await onSubmit({ ...draft, kind });
      if (wish) {
        /* 幽灵转正：那一枚的位置不动，只换 id 并标记为仅自己可见 */
        const temp = pendingRef.current;
        if (temp) engineRef.current?.promote(temp, wish.id);
        else engineRef.current?.addGhost(wish);
        pendingRef.current = null;
        setPhase("idle");
        playWellSound("splash");
      }
    },
    [kind, onSubmit],
  );

  const cancelCompose = useCallback(() => {
    const temp = pendingRef.current;
    if (temp) engineRef.current?.discard(temp);
    pendingRef.current = null;
    setPhase("idle");
    trackNow("wish_throw_abandon");
  }, []);

  /* --------------------------------------------------------- 音效 */

  const toggleSound = useCallback(() => {
    const next = !isAudioEnabled();
    setAudioEnabled(next);
    setSoundOn(next);
    if (next) playWellSound("click");
  }, []);

  const canSound = audioSupported();
  const isComposing = phase === "composing";

  return (
    <div>
      {/* 舞台 */}
      <div ref={stageRef} className="well-stage">
        <canvas
          ref={canvasRef}
          className="well-canvas"
          data-dragging={phase === "dragging"}
          /* 3D 画布对读屏是装饰：内容在下面的文字列表里有完整版本 */
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {!ready && !failed && <div className="well-skeleton" />}

        {failed && (
          <div className="absolute inset-0 z-[2] grid place-items-center px-6 text-center">
            <p className="text-caption text-muted">
              {C.fallback.notice}
              <span className="sr-only">（3D 不可用：{failed}）</span>
            </p>
          </div>
        )}

        {/* 抛物线预览 */}
        {arc.length > 1 && (
          <svg
            className="well-aim"
            viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
            preserveAspectRatio="none"
          >
            <polyline
              points={arc.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgb(var(--c-well-water-rim-rgb))"
              strokeWidth="1.5"
              strokeDasharray="5 6"
              strokeLinecap="round"
              opacity="0.85"
            />
            {arc.length > 0 && (
              <circle
                cx={arc[arc.length - 1].x}
                cy={arc[arc.length - 1].y}
                r="4"
                fill="rgb(var(--c-well-water-rim-rgb))"
              />
            )}
          </svg>
        )}

        {/* 物体卡片 */}
        {card && (
          <ObjectCard
            wish={
              wishes.find((w) => w.id === card.wish.id) ?? card.wish
            }
            x={card.x}
            y={card.y}
            liked={likedIds.has(card.wish.id)}
            reported={reportedIds.has(card.wish.id)}
            onClose={() => setCard(null)}
            onLike={onLike}
            onReport={onReport}
          />
        )}

        {/* 音效开关：右下角 */}
        {canSound && (
          <button
            type="button"
            className="btn-reset absolute bottom-3 right-3 z-[3] rounded-full border border-hairline bg-scrim/50 p-2.5 text-white/80 backdrop-blur transition duration-fast ease-ease hover:text-white"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? C.soundOff : C.soundOn}
          >
            {soundOn ? (
              <Volume2 size={16} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <VolumeX size={16} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* 控制条：选物 + 点击投币 + 计数 */}
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
            disabled={!ready || isComposing}
          >
            <MoveUpRight size={16} strokeWidth={2} aria-hidden="true" />
            {C.fallback.dropLabel}
          </button>
        </div>

        <p className="text-caption text-muted">
          {isMobile ? C.tapHint : C.dragHint}
          <span className="mx-2 opacity-40">·</span>
          {C.cameraHint}
        </p>

        <Counters
          coins={counts.coins}
          bottles={counts.bottles}
          implemented={counts.implemented}
        />
      </div>

      {/* 表单：投掷之后弹出，钉在池子下方（绝对定位在舞台上会挡视线） */}
      {isComposing && (
        <div className="mt-5">
          <WishComposer
            kind={kind}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
            onCancel={cancelCompose}
          />
        </div>
      )}
    </div>
  );
}
