/**
 * TODO: 首屏主视觉区
 * 素材需求：可选背景图/视频（当前用 CSS 渐变光斑 + 细网格占位）
 */
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { MousePointerClick } from "lucide-react";
import Container from "../components/Container";
import Button from "../components/Button";
import HeroVideo from "../components/HeroVideo";
import BannerCarousel from "../components/BannerCarousel";
import Reveal from "../components/Reveal";
import SplitStatement from "../components/SplitStatement";
import { HERO_DELAY } from "../lib/motion";
import { hero } from "../content";

/* 取景框的四个直角，顺序与样式类一一对应 */
const HUD_CORNERS = [
  "hero-corner-tl",
  "hero-corner-tr",
  "hero-corner-bl",
  "hero-corner-br",
];

/* 标语块的锚点 id：下方的按钮点了要把视线拉回标语，需要能定位到它 */
const STATEMENT_ID = "hero-statement";

export default function Hero() {
  /* 标语动效的播放次数。点标语、点下方按钮，都只是让它 +1，
     由 SplitStatement 换 key 重挂载来重播——单一数据源，两处入口不会打架。 */
  const [playKey, setPlayKey] = useState(0);

  /* reduce 模式下标语不再逐字（也不可点击），那个「点一下这句话」的
     引导按钮就失去了指向，一并隐藏——不做一个点了没反应的空按钮。 */
  const reduceMotion = useReducedMotion();

  const replayStatement = () => {
    setPlayKey((n) => n + 1);
    /* 窄屏上标语可能已经滚出视口，这时才需要把它拉回来；
       已经完整可见就不动，避免「点一下整页轻轻一跳」。 */
    const el = document.getElementById(STATEMENT_ID);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <section
      id="top"
      className="hero-min-h relative isolate flex items-center overflow-hidden"
    >
      {/* 背景层：光斑 + 细网格 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {/* 左上光斑 */}
        <div
          className="absolute -top-1/4 -left-1/4 h-[60vh] w-[60vh] animate-float rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, var(--c-accent) 0%, transparent 70%)",
          }}
        />
        {/* 右下光斑 */}
        <div
          className="absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] animate-float-slow rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, var(--c-accent-strong) 0%, transparent 70%)",
          }}
        />
        {/* 细网格：光斑是「软」的，铺一层网格把首屏的秩序感找回来。
            强度压到 7% 上下，只提供质感，不参与构图。 */}
        <div className="hero-grid absolute inset-0" />
      </div>

      <Container className="py-20 text-center">
        {/* 眉标：标语上方一行极小的字，定调性不承载信息 */}
        <Reveal delay={0}>
          <p className="flex items-center justify-center gap-2.5 text-caption tracking-[0.3em] text-muted">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rotate-45 bg-accent-bright"
            />
            {hero.eyebrow}
          </p>
        </Reveal>

        {/* 标语区：网格底纹 + 直角取景框 + 逐字浮现 + 扫描光带。
            整块可点：点一下会把这句逐字重写一遍。 */}
        <div
          id={STATEMENT_ID}
          className="relative mx-auto mt-8 max-w-5xl px-6 py-9 md:px-10 md:py-11"
        >
          <span aria-hidden="true" className="hero-grid absolute inset-0 -z-10" />
          {HUD_CORNERS.map((corner) => (
            <span
              key={corner}
              aria-hidden="true"
              className={`hero-corner ${corner}`}
            />
          ))}

          <SplitStatement
            text={hero.statement.text}
            highlight={hero.statement.highlight}
            delay={0.1}
            caret
            actionLabel={hero.statement.actionLabel}
            onActivate={replayStatement}
            playKey={playKey}
            className="hero-statement text-statement text-balance"
          />

          {/* 扫描光带：压在这一块的下缘，缓慢横掠一次再等下一轮。
              换 key 重挂载 → 点标语时它也跟着重扫一遍，是「重播」的视觉呼应收尾。 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 bottom-4 h-px overflow-hidden md:inset-x-10"
          >
            <span key={playKey} className="hero-scan block h-full w-full" />
          </span>
        </div>

        {/* 英文标语：与中文标语是同一件东西的两种写法，所以紧跟在它下面，
            小字、拉开的字距——是回声，不跟主标语抢。
            颜色走 `accent-text`（两个主题各自达标的那一支），不用 accent-bright：
            后者在浅底上只有 3.48:1。
            ⚠️ 字距在窄屏要收：0.3em 下这一串约 337px，360px 机器上放不下，会在
            「BEYOND / REALITY」中间断开——把一个语义单元拆成两行。收到 0.16em 就一行放得下。 */}
        <Reveal delay={HERO_DELAY.statementEn}>
          <p className="hero-statement-en mt-5 text-caption tracking-[0.16em] text-accent-text xs:tracking-[0.3em]">
            {hero.statement.en}
          </p>
        </Reveal>

        <Reveal delay={HERO_DELAY.subtitle}>
          <p className="mx-auto mt-6 max-w-2xl text-body-lg text-muted">
            {hero.subtitle}
          </p>
        </Reveal>

        {/* 首屏唯一的按钮：它不跳转，只把注意力引到上方的标语上 */}
        {!reduceMotion && (
          <Reveal delay={HERO_DELAY.actions}>
            <div className="mt-8 flex justify-center">
              <Button variant="primary" onClick={replayStatement}>
                <MousePointerClick size={18} strokeWidth={1.75} aria-hidden="true" />
                {hero.cta.label}
              </Button>
            </div>
          </Reveal>
        )}

        {/* 首页中心处的作品展示片 */}
        <Reveal delay={HERO_DELAY.media}>
          <div className="mx-auto mt-14 w-full max-w-4xl md:mt-16">
            <HeroVideo />
          </div>
        </Reveal>

        {/* 展示片下方的海报轮播：自动播放 + 手动切换（箭头 / 指示点 / 拖拽 / 方向键） */}
        <Reveal delay={HERO_DELAY.banner}>
          <div className="mt-16 md:mt-20">
            <BannerCarousel />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
