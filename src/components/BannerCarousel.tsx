/**
 * 首屏海报轮播（作品展示片下方）
 *
 * 版面参照 Steam 的「精选和推荐」聚光灯式轮播：
 *   深色面板 + 顶部标题栏 + 中央大舞台 + 两侧露出相邻海报的窄条 + 边缘大箭头 + 底部指示点。
 * 素材是三张竖版活动海报（两张 3:4、一张 1:1），每张都已是完整成品
 * ——标题、日期、场地、版式都在画面里。因此这个组件仍然「不往海报上盖任何文案」，
 * 只在面板自己的区域内放标题与控件。
 *
 * 四个关键取舍：
 *
 * 1. 舞台固定高度 + object-contain。
 *    三张海报比例并不统一，用 contain 保证任何一张都不被裁切；
 *    比例对不上的那张会多出留白，留白落在深色舞台上几乎看不出来，
 *    比统一裁成同一比例（会切掉海报边缘的日期、场地等文字）安全得多。
 *
 * 2. 两侧窄条是「被裁切的相邻海报」而不是另一张缩略图：
 *    窄条 overflow-hidden，内部图片按舞台整高渲染、贴右/贴左对齐，
 *    于是露出来的正是相邻海报靠中心那一侧的局部——和真实滚动轨道露边一致。
 *
 * 3. 自动 + 手动 + 触摸滑动三通道并存，并额外给一个显式的播放/暂停开关。
 *    显式开关不是锦上添花，是 WCAG 2.2.2 的硬性要求：
 *    自动更新的内容必须提供暂停机制。
 *
 * 4. 滑动换页用原生 Pointer 事件手写，而不是 framer-motion 的 drag。
 *    原因是 drag 需要 domMax 特性包（比当前 domAnimation 多约 10KB 且全站加载），
 *    而原生实现只要二十来行、行为完全可控。
 *
 * 自动播放的暂停条件只有四个：显式关闭 / 正在拖拽 / 页面切到后台 / 用户偏好减少动效。
 * 刻意不做「悬停暂停」——鼠标随便停在图上就停，会让自动播放看起来像坏了。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { bannerCarousel as C, bannerSlides } from "../content";
import { DUR, EASE_OUT } from "../lib/motion";

/** 自动播放间隔（毫秒）——引擎参数，不属于文案，故不进 content.ts */
const AUTOPLAY_MS = 5000;

/** 触发换页的拖拽位移阈值（像素） */
const SWIPE_PX = 48;

/** 非当前帧的横向让位距离（像素），让切换带一点方向感 */
const OFFSET_PX = 28;

export default function BannerCarousel() {
  /* MotionConfig(reducedMotion="user") 会自动压掉 transform/opacity 动画，
     但它管不到 JS 计时器——自动播放必须自己判断。 */
  const prefersReduced = useReducedMotion() ?? false;
  const total = bannerSlides.length;

  const [index, setIndex] = useState(0);
  const [autoOn, setAutoOn] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);

  const startX = useRef<number | null>(null);

  /* 环形取模：从最后一张继续往后走就回到第一张 */
  const go = useCallback(
    (n: number) => setIndex(((n % total) + total) % total),
    [total],
  );

  /* 切到后台就停表，否则切回来会连着跳好几张 */
  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running = autoOn && !prefersReduced && !dragging && pageVisible;

  /* index 一变就重建计时器，所以手动切换之后会重新计时，而不是被上一轮追着跳 */
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [running, index, go]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  };

  /* ---------- 触摸 / 鼠标拖拽换页 ----------
     监听挂在 window 上而不是元素上：手指/鼠标拖出舞台再松开时，
     元素收不到 pointerup，dragging 会一直停在 true、自动播放再也起不来。
     这里刻意不用 setPointerCapture——它会把 pointerup 重定向到舞台，
     导致两侧窄条按钮的 click 不再触发。 */

  const beginDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    /* 窄条按钮上的按下不算拖拽，否则会白白打断一次自动播放 */
    if ((e.target as HTMLElement).closest("button")) return;
    /* 只接受主键，避免右键 / 中键把轮播带歪 */
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      if (startX.current === null) return;
      /* 乘 0.85 加一点阻尼，拖到头也不会滑得太远 */
      setDragX((e.clientX - startX.current) * 0.85);
    };

    const onRelease = (e: PointerEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      setDragging(false);
      setDragX(0);
      if (delta <= -SWIPE_PX) go(index + 1);
      else if (delta >= SWIPE_PX) go(index - 1);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
    };
  }, [dragging, index, go]);

  const status = C.slideStatus
    .replace("{n}", String(index + 1))
    .replace("{total}", String(total));

  /* 只有 1 张时没有相邻项可露，两侧窄条整体隐藏 */
  const hasPeek = total > 1;
  const prevSlide = bannerSlides[(index - 1 + total) % total];
  const nextSlide = bannerSlides[(index + 1) % total];

  /* 两侧窄条共用的外壳：定位在舞台左右边缘、盖在舞台之上 */
  const peekCls =
    "absolute inset-y-0 z-[2] overflow-hidden focus-visible:outline focus-visible:outline-2 " +
    "focus-visible:-outline-offset-2 focus-visible:outline-accent";

  /* 窄条上的暗化层与箭头都跟着主题走：
     深色主题把相邻海报压暗、用亮箭头；浅色主题把它冲淡、用深箭头。
     这样两个主题下都保持「相邻项退到后面」的层次，而不会在浅色版面上压出两道黑条。 */
  const peekVeilCls =
    "absolute inset-0 bg-bg/70 transition-colors duration-base ease-ease group-hover:bg-bg/55";
  const peekIconCls =
    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text drop-shadow-md";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={C.regionLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="group relative mx-auto w-full max-w-3xl overflow-hidden rounded-panel border border-hairline bg-surface p-3 text-left shadow-card md:p-4"
    >
      {/* ---------- 顶部：面板标题 + 计数 + 播放开关 ---------- */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h3 className="text-h4">{C.title}</h3>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className="text-caption tabular-nums text-muted"
            aria-hidden="true"
          >
            {index + 1} / {total}
          </span>

          {/* 减少动效时自动播放本就关闭，开关也就没有存在意义 */}
          {!prefersReduced && (
            <button
              type="button"
              onClick={() => setAutoOn((v) => !v)}
              aria-pressed={autoOn}
              aria-label={autoOn ? C.pauseLabel : C.playLabel}
              className="media-control inline-flex h-8 w-8 items-center justify-center rounded-pill transition duration-fast ease-ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {autoOn ? (
                <Pause size={13} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Play size={13} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ---------- 舞台 ---------- */}
      <div
        onPointerDown={beginDrag}
        /* touch-pan-y：横向归轮播、纵向仍交给页面滚动，不劫持手势 */
        className="relative h-[300px] w-full touch-pan-y cursor-grab select-none overflow-hidden rounded-card bg-bg-deep active:cursor-grabbing xs:h-[340px] md:h-[420px] tab:h-[480px]"
      >
        {/* 拖拽位移加在这一层：松手后由 CSS 过渡平滑归位 */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging
              ? "none"
              : "transform var(--dur-base) var(--ease-out)",
          }}
        >
          {bannerSlides.map((slide, i) => {
            const active = i === index;
            return (
              <m.img
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                draggable={false}
                /* 首张参与首屏加载，其余等真正需要时再取 */
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                initial={false}
                animate={{
                  opacity: active ? 1 : 0,
                  x: active ? 0 : i < index ? -OFFSET_PX : OFFSET_PX,
                }}
                transition={{ duration: DUR.slow, ease: EASE_OUT }}
                aria-hidden={!active}
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  zIndex: active ? 1 : 0,
                  /* opacity:0 仍然会吃掉点击，必须显式关掉非当前帧的命中 */
                  pointerEvents: active ? "auto" : "none",
                }}
              />
            );
          })}
        </div>

        {/* 左侧窄条：相邻海报贴右对齐，露出它靠近中心的那一侧 */}
        {hasPeek && (
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={C.prevLabel}
            className={`${peekCls} left-0 w-12 xs:w-16 md:w-24`}
          >
            <img
              src={prevSlide.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading="lazy"
              decoding="async"
              className="absolute inset-y-0 right-0 h-full w-auto max-w-none object-cover"
            />
            {/* 暗化窄条，把注意力压回中央舞台（与参照图同一处理，只是跟随主题变通） */}
            <span aria-hidden="true" className={peekVeilCls} />
            <ChevronLeft
              size={36}
              strokeWidth={2.25}
              aria-hidden="true"
              className={peekIconCls}
            />
          </button>
        )}

        {/* 右侧窄条：镜像 */}
        {hasPeek && (
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={C.nextLabel}
            className={`${peekCls} right-0 w-12 xs:w-16 md:w-24`}
          >
            <img
              src={nextSlide.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading="lazy"
              decoding="async"
              className="absolute inset-y-0 left-0 h-full w-auto max-w-none object-cover"
            />
            <span aria-hidden="true" className={peekVeilCls} />
            <ChevronRight
              size={36}
              strokeWidth={2.25}
              aria-hidden="true"
              className={peekIconCls}
            />
          </button>
        )}
      </div>

      {/* ---------- 底部指示点（小方块，参照图同款） ---------- */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {bannerSlides.map((slide, i) => {
          const active = i === index;
          return (
            <button
              key={slide.src}
              type="button"
              onClick={() => go(i)}
              aria-label={C.dotLabel.replace("{n}", String(i + 1))}
              aria-current={active}
              className={
                "h-1 rounded-[2px] transition-all duration-base ease-ease " +
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                (active
                  ? "w-8 bg-accent-bright"
                  : "w-4 bg-hairline-strong hover:bg-muted")
              }
            />
          );
        })}
      </div>

      {/* 自动播放进度条：贴在面板底边，深色轨道保证浅色海报上也能看清 */}
      {running && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[3] h-[3px]"
          style={{ backgroundColor: "rgb(var(--c-scrim-rgb) / 0.5)" }}
        >
          <m.span
            key={index}
            className="block h-full origin-left bg-accent-bright"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
          />
        </div>
      )}

      {/* 换页时向读屏播报当前进度 */}
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
