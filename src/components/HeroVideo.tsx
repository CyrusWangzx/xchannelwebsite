/**
 * 首屏作品展示片 + 播放器
 *
 * 素材：64 秒 / 1280×720 / 约 13MB，带音轨的作品展示片（不是可循环的背景素材）。
 *
 * 加载策略（保持既有取舍）：`preload="none"` + 海报。
 * 页面加载时**零字节**下载视频，13MB 不进首屏。
 * 代价是「未播放前拿不到 duration」，所以进度条在首次交互时才去取元数据
 * （见 ensureMetadata）：只改 preload 为 metadata 并 load()，
 * 因为有 faststart，moov 在文件头部，这一次只拉一个很小的 range。
 *
 * 播放器三件套：
 * 1. 播放 / 暂停 —— 大字封面按钮（未播放过时）+ 控制条按钮；点画面也能切换
 * 2. 进度条 —— 可点、可拖、可键盘操作（←/→ ±5s，Home/End 首尾）
 * 3. 静音开关
 *
 * 声音默认打开：这次播放是用户主动点的，默认静音会让人以为片子没声音。
 * 想改成静音自动循环，给 <video> 加 autoPlay muted loop 即可。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { heroMedia } from "../content";

/** 键盘方向键的步长（秒） */
const KEY_STEP = 5;

/** 控制条按钮：压在海报/画面上，所以走恒定深底白字的媒体浮层，不随主题反相 */
const btnCls =
  "media-control inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill " +
  "transition duration-fast ease-ease " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false); // 是否播放过（用来收起大字封面）
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  /** 首次碰进度条时再取元数据，替代把 preload 提前到 metadata */
  const ensureMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el || el.duration) return;
    el.preload = "metadata";
    el.load();
  }, []);

  const seekTo = useCallback((sec: number) => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const t = Math.min(el.duration, Math.max(0, sec));
    el.currentTime = t;
    setCurrent(t);
  }, []);

  const ratioAt = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  /* ---------- 拖动进度条 ----------
     监听挂 window：手指/鼠标拖出进度条再松开时元素收不到 pointerup，
     scrubbing 会永久卡住、timeupdate 再也不刷新进度。 */
  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ensureMetadata();
    if (!videoRef.current?.duration) return;
    e.preventDefault();
    setScrubbing(true);
    seekTo(ratioAt(e.clientX) * (videoRef.current?.duration ?? 0));
  };

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => {
      const el = videoRef.current;
      if (!el?.duration) return;
      setCurrent(ratioAt(e.clientX) * el.duration);
    };
    const onUp = (e: PointerEvent) => {
      setScrubbing(false);
      seekTo(ratioAt(e.clientX) * (videoRef.current?.duration ?? 0));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [scrubbing, seekTo]);

  const onBarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(el.currentTime - KEY_STEP);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(el.currentTime + KEY_STEP);
    } else if (e.key === "Home") {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      seekTo(el.duration || 0);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePlay();
    }
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-panel border border-hairline bg-bg-deep shadow-card">
      <video
        ref={videoRef}
        /* aspect-video 在 metadata 到达前就占好位，避免布局偏移 */
        className="block aspect-video w-full cursor-pointer"
        poster={heroMedia.poster}
        preload="none"
        playsInline
        muted={muted}
        aria-label={heroMedia.label}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          if (!scrubbing) setCurrent(e.currentTarget.currentTime);
        }}
        onProgress={(e) => {
          const el = e.currentTarget;
          if (el.buffered.length > 0) {
            setBuffered(el.buffered.end(el.buffered.length - 1));
          }
        }}
      >
        <source src={heroMedia.src} type="video/mp4" />
      </video>

      {/* 未播放过：整个画面都是播放按钮，点击区域最大化 */}
      {!started && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={heroMedia.playLabel}
          className="absolute inset-0 z-10 flex items-center justify-center transition duration-base ease-ease hover:bg-white/[0.04]"
        >
          <span className="media-control flex h-16 w-16 items-center justify-center rounded-pill shadow-card">
            <Play size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      )}

      {/* 控制条：底部渐隐渐变保证任何画面上都读得清 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-24"
        style={{
          background:
            "linear-gradient(to top, rgb(var(--c-scrim-rgb) / 0.62), transparent)",
        }}
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 px-3 py-3 md:gap-4 md:px-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? heroMedia.pauseLabel : heroMedia.playLabel}
          className={btnCls}
        >
          {playing ? (
            <Pause size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {/* 进度条：点、拖、键盘三种操作都支持 */}
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label={heroMedia.progressLabel}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${fmt(current)} / ${fmt(duration)}`}
          onPointerDown={onBarDown}
          onKeyDown={onBarKey}
          onFocus={ensureMetadata}
          onPointerEnter={ensureMetadata}
          className="group/bar relative flex h-11 flex-1 cursor-pointer items-center rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="relative h-1.5 w-full overflow-hidden rounded-pill bg-hairline-strong">
            {/* 已缓冲 */}
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-muted/50"
              style={{ width: `${bufPct}%` }}
            />
            {/* 已播放 */}
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-accent-bright"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* 滑块把手 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-pill bg-accent-bright shadow-card transition-transform duration-fast ease-ease group-hover/bar:scale-125"
            style={{ left: `calc(${pct}% - 0.4375rem)` }}
          />
        </div>

        <span className="shrink-0 text-caption tabular-nums text-white/90">
          {fmt(current)} / {fmt(duration)}
        </span>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? heroMedia.unmuteLabel : heroMedia.muteLabel}
          className={btnCls}
        >
          {muted ? (
            <VolumeX size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
