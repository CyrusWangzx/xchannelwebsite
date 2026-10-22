/**
 * 赛博刮刮乐 · 拿在手上那张票（票面 + 刮层 + 进度）
 *
 * 票面本身由 `TicketCard` 画（它同时负责架子上那张缩略票、以及票背），
 * 这里只负责**刮**这一件事，然后把 canvas 当 `overlay` 塞进票面的可刮区里。
 * 拆开的好处：架子上的票不用带一个 canvas（五张票就是五个 canvas，白烧显存），
 * 而两张票的 DOM 结构完全一致 —— 抽卡动画才能从缩略票"接着"放大成大票。
 *
 * `live` 是「这一张已经决定要刮了」：
 *   false → 膜照样盖着（真票没刮之前也是盖着的），但 canvas 不接指针；
 *   true  → 正常刮。
 * 之所以不拆成两个组件：拆了就要重新画一遍膜，翻面回来会看到膜闪一下。
 *
 * 几条硬约束：
 * ① **刮层颜色不许写死**。金属灰、水印字、文字色全部从 `--c-scratch-foil-*`
 *    读（主题切换要跟着变）。所以挂载后、以及 `data-theme` 变的时候都要重画——
 *    但**只在还没开始刮的时候重画**，不然会把用户刮出来的洞一起抹掉。
 * ② **canvas 的位图尺寸跟 CSS 尺寸脱钩**：按 devicePixelRatio 放大，再把变换
 *    缩回去，否则高分屏上水印字是糊的。取尺寸用 `clientWidth/clientHeight`
 *    （布局尺寸），不用 `getBoundingClientRect`（会被入场动画的 scale 污染）。
 * ③ **touch-action: none** 写在 CSS 里。手指在刮层上拖动必须是「刮」，
 *    不能变成滚页面；这条一漏，手机上永远刮不开。
 * ④ 进度统计的笔刷半径要**分轴**给（`radius` / `radiusY`）：可刮区宽高比
 *    约 1.9:1，只给一个半径的话「画的是圆、算的是椭圆」，进度会跟眼睛吵架。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import TicketCard from "./TicketCard";
import {
  REVEAL_AT,
  ScratchProgress,
  type ScratchTicket as TicketData,
} from "../../lib/scratch";
import { playWellSound, isAudioEnabled, setAudioEnabled } from "../../lib/wellAudio";
import { scratchSection } from "../../content";

/** 进度统计的粗网格：44×22 = 968 格，够细，也不至于每帧扫太多 */
const FOIL_COLS = 44;
const FOIL_ROWS = 22;
/** 刮擦音节流：一秒钟最多约 11 声，再多就是白噪音 */
const SOUND_GAP = 90;

interface Props {
  ticket: TicketData;
  name: string;
  series: string;
  revealed: boolean;
  /** 已经决定要刮了：膜才开始接指针 */
  live: boolean;
  flipped: boolean;
  soundOn: boolean;
  onReveal: () => void;
  onProgress?: (pct: number) => void;
}

/* -------------------------------------------------------------------------
   刮层绘制
   ------------------------------------------------------------------------- */

interface FoilColors {
  base: string;
  hi: string;
  /** 高光的三元组（"r g b"），要用不同 alpha 叠光的时候拿它拼 */
  hiRgb: string;
  ink: string;
  /** 墨色的三元组（"r g b"）：压角暗部要用不同 alpha 拼，不能直接拼 rgb() 字符串 */
  inkRgb: string;
  inkAlpha: number;
  /** 这张票的色相三元组：刮层要跟着票走，五款才不是五块一模一样的灰板 */
  hueRgb: string;
}

function readVar(el: Element, name: string, fallback: string): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function readFoil(el: Element): FoilColors {
  const alphaRaw = getComputedStyle(el)
    .getPropertyValue("--c-scratch-foil-ink-alpha")
    .trim();
  const alpha = Number(alphaRaw);
  const hi = readVar(el, "--c-scratch-foil-2-rgb", "rgb(146, 155, 170)");
  const hue = readVar(el, "--scratch-hue", "rgb(29, 78, 216)");
  const ink = readVar(el, "--c-scratch-foil-ink-rgb", "rgb(46, 52, 62)");
  return {
    base: readVar(el, "--c-scratch-foil-rgb", "rgb(104, 112, 126)"),
    hi,
    hiRgb: (hi.match(/[\d.]+/g) ?? ["146", "155", "170"]).slice(0, 3).join(" "),
    ink,
    inkRgb: (ink.match(/[\d.]+/g) ?? ["46", "52", "62"]).slice(0, 3).join(" "),
    inkAlpha: Number.isFinite(alpha) ? alpha : 0.5,
    hueRgb: (hue.match(/[\d.]+/g) ?? ["29", "78", "216"]).slice(0, 3).join(" "),
  };
}

/** 画满一层刮层：金属斜光 + 色相斜带 + 花球 + 四角扇花 + 微缩字
 *
 *  这里的目标不是"一块银色"，是**一张印好的彩票覆盖膜**：
 *  体彩/福彩的膜上一定压着东西（花球、底纹、微缩字、四角花），
 *  只有一层渐变的话，刮之前那块区域读起来就是"页面没加载出来"。
 *  但也不能画热闹 —— 所有图案都走 ink 令牌 + 低 alpha，
 *  刮开之后票面立刻接管视觉，膜只该是一层"盖住答案的雾"。 */
function paintFoil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: FoilColors,
) {
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, c.base);
  grad.addColorStop(0.38, c.hi);
  grad.addColorStop(0.56, c.base);
  grad.addColorStop(0.78, c.hi);
  grad.addColorStop(1, c.base);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  /* 色相斜带：宽的、间隔大的斜条，把票的主题色渗进金属里。
     五款票的膜因此各不相同（蓝/青/绿/紫/橙），但仍然都是"膜"不是"彩纸"。
     ⚠️ alpha 只能给到 0.03 这一档。给 0.055 试过：橙款（星芒）的暖色叠在
     中性银上会直接把整块膜推成褐色，看着像旧纸不像刮层 —— 冷暖两款的耐受度不一样，
     取最差的那一款为准。 */
  ctx.save();
  ctx.fillStyle = `rgb(${c.hueRgb} / 0.032)`;
  const bandW = Math.max(10, h * 0.16);
  const bandGap = bandW * 2.6;
  for (let x = -h - bandW; x < w + h; x += bandGap) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.lineTo(x + h + bandW, 0);
    ctx.lineTo(x + bandW, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  /* 斜掠光：一条 45° 的窄高光带。
     没有它，整片膜就是一块死灰的板；有了它才读成"镀了一层金属"。
     颜色取 hi 令牌（不写死白）—— 浅色主题的白光会把浅银压成纯白。 */
  const sheen = ctx.createLinearGradient(0, h, w, 0);
  sheen.addColorStop(0, `rgb(${c.hiRgb} / 0)`);
  sheen.addColorStop(0.34, `rgb(${c.hiRgb} / 0.05)`);
  sheen.addColorStop(0.46, `rgb(${c.hiRgb} / 0.34)`);
  sheen.addColorStop(0.52, `rgb(${c.hiRgb} / 0.16)`);
  sheen.addColorStop(0.66, `rgb(${c.hiRgb} / 0.04)`);
  sheen.addColorStop(1, `rgb(${c.hiRgb} / 0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  /* 四角压暗：让膜有一点"被压进票面"的体积，边缘不至于和纸一样平 */
  const vig = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.35,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  vig.addColorStop(0, `rgb(${c.inkRgb} / 0)`);
  vig.addColorStop(1, `rgb(${c.inkRgb} / 0.16)`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  /* 细斜纹：金属拉丝的读感，宁可淡到几乎看不见，也不要织成一张网 */
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = c.hi;
  ctx.lineWidth = Math.max(1, h * 0.004);
  const step = Math.max(6, h * 0.07);
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.stroke();
  }
  ctx.restore();

  /* 微缩字：平铺的短标，像真票膜上印的那圈小字。
     字号压到「看得见轮廓、读不出内容」那一档 —— 它是肌理，不是信息。 */
  ctx.save();
  ctx.globalAlpha = c.inkAlpha * 0.3;
  ctx.fillStyle = c.ink;
  ctx.font = `500 ${Math.max(6, Math.round(h * 0.046))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gapX = w / 10;
  const gapY = h / 5.4;
  let row = 0;
  for (let y = h * 0.06; y < h; y += gapY, row++) {
    for (let x = gapX * (row % 2 === 0 ? 0.5 : 0.9); x < w; x += gapX) {
      ctx.fillText("X·C", x, y);
    }
  }
  ctx.restore();

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;

  /* 花球（guilloche）：这是钞票/彩票底纹的灵魂。
     三圈虚线 + 一圈"绕圈排的小圆" —— 小圆彼此咬合出来的就是那种蕾丝花球，
     比单纯画放射线像得多，而且只多 24 次 arc。
     半径按 min(w,h) 给：按宽度给会在扁长的膜上溢出成半个环。 */
  ctx.save();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(1, h * 0.005);
  ctx.globalAlpha = c.inkAlpha * 0.62;
  for (const [radius, dash] of [
    [r * 1.06, [h * 0.03, h * 0.026]],
    [r * 0.9, [h * 0.01, h * 0.019]],
  ] as const) {
    ctx.setLineDash([...dash]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.globalAlpha = c.inkAlpha * 0.34;
  ctx.lineWidth = Math.max(0.8, h * 0.0035);
  const petals = 24;
  const petalR = r * 0.148;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66, petalR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* 四角扇花：真票四角一定压着东西，压住四个"空角"，
     一整片膜才不会在四个角上塌掉。 */
  ctx.save();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(0.8, h * 0.004);
  ctx.globalAlpha = c.inkAlpha * 0.42;
  const fanR = Math.min(w, h) * 0.2;
  const corners = [
    [0, 0, Math.PI / 2],
    [w, 0, Math.PI / 2],
    [0, h, Math.PI / 2],
    [w, h, Math.PI / 2],
  ] as const;
  for (const [ox, oy] of corners) {
    for (const k of [1, 0.72, 0.46]) {
      ctx.beginPath();
      ctx.arc(ox, oy, fanR * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(a) * fanR * 0.46, oy + Math.sin(a) * fanR * 0.46);
      ctx.lineTo(ox + Math.cos(a) * fanR, oy + Math.sin(a) * fanR);
      ctx.stroke();
    }
  }
  ctx.restore();

  /* 主题色印刷边：膜的内圈压一道宽的票色带。
     这不是装饰 —— 五款票并排放在架子上时，全靠它一眼分得清是谁。
     宽度按**票宽**给（2.4%），CSS 那边是同一条 2.4cqw，两边才会一起缩。
     只给 1px 细线的话，缩到 200px 就退回"五块灰板"。 */
  ctx.save();
  ctx.strokeStyle = `rgb(${c.hueRgb} / 0.24)`;
  const hueBand = w * 0.024;
  ctx.lineWidth = hueBand * 2;
  ctx.strokeRect(-hueBand, -hueBand, w + hueBand * 2, h + hueBand * 2);
  ctx.restore();

  /* 色相内框：一圈很细的主题色线，把整块膜"装订"进票面。
     印刷规则里最容易读出"这是设计过的"的一笔就是它。 */
  ctx.save();
  ctx.strokeStyle = `rgb(${c.hueRgb} / 0.5)`;
  ctx.lineWidth = Math.max(1, h * 0.005);
  const inset = Math.max(3, h * 0.022);
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.restore();
}

/* -------------------------------------------------------------------------
   组件
   ------------------------------------------------------------------------- */

export default function ScratchTicket({
  ticket,
  name,
  series,
  revealed,
  live,
  flipped,
  soundOn,
  onReveal,
  onProgress,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef<ScratchProgress>(new ScratchProgress(FOIL_COLS, FOIL_ROWS));
  const paintingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const soundAtRef = useRef(0);
  const startedRef = useRef(false);
  const pctRef = useRef(0);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const [pct, setPct] = useState(0);
  const [started, setStarted] = useState(false);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    /* 布局尺寸（不含 transform），入场动画的 scale 不会污染位图比例 */
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 4 || h < 4) return;
    /* 最多按 2.5 倍采样：再高只是白烧显存，刮层不是照片 */
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFoil(ctx, w, h, readFoil(canvas));
  }, []);

  /* 换票就重置：进度、提示、刮层 */
  useEffect(() => {
    progressRef.current.reset();
    pctRef.current = 0;
    startedRef.current = false;
    setPct(0);
    setStarted(false);
    /* 等一帧：首帧尺寸可能还是 0 */
    const raf = requestAnimationFrame(() => repaint());
    return () => cancelAnimationFrame(raf);
  }, [ticket.id, repaint]);

  /* 尺寸变了要重画（否则位图被拉伸，字会糊）——只在还没开刮时做 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!startedRef.current) repaint();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [repaint]);

  /* 主题切换：深浅两套刮层颜色不同，得跟着重画（同样只在没开刮时） */
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(() => {
      if (!startedRef.current) repaint();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, [repaint]);

  /* ---- 指针 ---- */
  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      px: event.clientX - rect.left,
      py: event.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  };

  const stroke = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
  ) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const path = () => {
      ctx.beginPath();
      if (x0 === x1 && y0 === y1) {
        ctx.arc(x1, y1, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    };

    /* 两遍：外圈半透明，边缘不硬得像打孔 */
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = radius * 2.5;
    path();
    ctx.globalAlpha = 1;
    ctx.lineWidth = radius * 1.7;
    path();
    ctx.restore();
  };

  const maybeComplete = () => {
    const coverage = progressRef.current.coverage;
    const next = Math.min(100, Math.round(coverage * 100));
    if (next !== pctRef.current) {
      pctRef.current = next;
      setPct(next);
      onProgress?.(next);
    }
    if (coverage >= REVEAL_AT && !revealedRef.current) onReveal();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!live || revealed) return;
    /* 落笔这一下是货真价实的手势，AudioContext 在这里建得起来。
       不能只靠「抽卡」那一下去建 —— 键盘用户、或者直接进台面的情况就没有那一步。 */
    if (soundOn) {
      if (!isAudioEnabled()) setAudioEnabled(true);
      playWellSound("scratch");
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    paintingRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }
    const p = pointOf(event);
    lastRef.current = { x: p.x, y: p.y };
    const radius = Math.max(9, p.h * 0.13);
    stroke(p.px, p.py, p.px, p.py, radius);
    progressRef.current.erase(p.x, p.y, p.x, p.y, radius / p.w, radius / p.h);
    soundAtRef.current = performance.now();
    maybeComplete();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!live || !paintingRef.current || revealed) return;
    const last = lastRef.current;
    if (!last) return;
    const p = pointOf(event);
    const radius = Math.max(9, p.h * 0.13);
    const lastPx = { x: last.x * p.w, y: last.y * p.h };
    stroke(lastPx.x, lastPx.y, p.px, p.py, radius);
    progressRef.current.erase(last.x, last.y, p.x, p.y, radius / p.w, radius / p.h);
    lastRef.current = { x: p.x, y: p.y };

    const now = performance.now();
    if (now - soundAtRef.current > SOUND_GAP) {
      soundAtRef.current = now;
      if (soundRef.current) playWellSound("scratch");
    }
    maybeComplete();
  };

  const endStroke = () => {
    paintingRef.current = false;
    lastRef.current = null;
  };

  return (
    <>
      <TicketCard
        ticket={ticket}
        name={name}
        series={series}
        variant="full"
        revealed={revealed}
        started={started}
        flipped={flipped}
        tip={live}
        label={`${name} · 面额 ${ticket.denom} 元 · 票号 ${ticket.id}`}
        overlay={
          <canvas
            ref={canvasRef}
            className="ticket-foil-canvas"
            data-live={live ? "true" : "false"}
            data-revealed={revealed ? "true" : "false"}
            aria-hidden="true"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        }
      />

      {live && (
        <div className="scratch-progress">
          <span className="tabular-nums">
            {revealed
              ? scratchSection.revealedLabel
              : scratchSection.progressTemplate.replace("{pct}", String(pct))}
          </span>
          <span className="scratch-progress-bar" aria-hidden="true">
            <span
              className="scratch-progress-fill"
              style={{ width: `${revealed ? 100 : pct}%` }}
            />
          </span>
          {!revealed && (
            <button
              type="button"
              className="btn-reset text-caption text-muted underline-offset-4 hover:text-accent-bright hover:underline"
              onClick={onReveal}
            >
              {scratchSection.revealAllLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
