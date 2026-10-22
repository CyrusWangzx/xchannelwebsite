/**
 * X.媒体 · 作品封面卡
 *
 * 一张卡 = 一个人 + 一份作品，封面直接用他的 AI 形象（`/persona/*-portrait.webp`，
 * 600×800 透明底立绘），不再另做一套封面图 —— 素材本来就是我们自己产出的。
 *
 * 两个刻意的地方：
 * 1. **覆盖式链接（stretched link）**：整张卡可点，但 HTML 里 `<a>` 不能嵌套，
 *    所以外链是一条 `absolute inset-0` 的透明 `<a>`，而底部「看这个人」那条
 *    站内链接浮在它上面（`z-30` + `pointer-events-auto`）。
 * 2. **没有 href 就不渲染链接**：只显示「链接待补」角标。
 *    网址还没给的时候，宁可看起来"没开门"，也不要放一个点了没反应的假按钮。
 *
 * 布局：4:3 横版，形象靠右下、文字压左下 —— 和 X.形象 那套 3:4 竖版卡片刻意错开，
 * 免得两个页面看起来是同一块东西换了个标题。
 */
import { m } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { MediaWork } from "../content";
import { memberHref } from "../lib/router";
import { DUR, EASE_OUT } from "../lib/motion";

interface MediaWorkCardProps {
  index: number;
  work: MediaWork;
  portrait: string;
  ink?: boolean;
  labels: { worksLabel: string; linkReady: string; linkPending: string; profileLabel: string };
}

export default function MediaWorkCard({
  index,
  work,
  portrait,
  ink,
  labels,
}: MediaWorkCardProps) {
  const hasLink = Boolean(work.href);
  const name = work.alias ? `${work.name}（${work.alias}）` : work.name;

  return (
    <m.article
      whileHover={{ y: -5 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT }}
      className="group relative overflow-hidden rounded-card border border-hairline bg-surface shadow-card hover:border-accent/40"
    >
      {/* 底色：取自形象主色的一团柔光，落在右上 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(115% 88% at 82% 4%, rgb(${work.tint} / 0.24), transparent 62%)`,
        }}
      />
      {/* 网点：印刷质感，往左下淡出（不盖住脸） */}
      <span aria-hidden="true" className="media-dots pointer-events-none absolute inset-0 text-text opacity-[0.06]" />

      {/* 地面光：让形象「站」住而不是飘着 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-5 right-[6%] h-6 w-[46%] rounded-[50%] blur-[3px]"
        style={{
          background: `radial-gradient(50% 50% at 50% 50%, rgb(${work.tint} / 0.42), transparent 72%)`,
        }}
      />

      {/* AI 形象：透明底立绘，contain 保证整只都在框里。
          外层只负责「贴右下 + 往右探出一点」：立绘自己是 600×800 的画布，
          人物只占画布中间一条，画布齐右边时人物反而显得偏左。 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-[92%] w-[55%] translate-x-[5%]"
      >
        <img
          src={portrait}
          alt={`${work.name}的 AI 形象`}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-contain object-right-bottom transition-transform duration-slow ease-ease group-hover:-translate-y-1.5 group-hover:scale-[1.03] ${
            ink ? "portrait-ink" : ""
          }`}
        />
      </span>

      {/* 文案：撑起卡片高度（4:3），文字压在左下。
          ⚠️ 这个容器的 z 必须**高于**覆盖式外链：它自己带 z-index 就形成了层叠上下文，
          里面那条 z-30 的站内链接逃不出父级，父级压不过外链时它就点不到。
          容器 pointer-events-none → 点文字穿到外链；站内链接 pointer-events-auto → 只挡自己那一小块。 */}
      <div className="pointer-events-none relative z-20 flex aspect-[4/3] flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-muted">
              {String(index).padStart(2, "0")}
            </span>
            <span className="text-[10.5px] font-semibold tracking-[0.24em] text-accent-text/80">
              {labels.worksLabel}
            </span>
          </span>

          {hasLink ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10.5px] font-medium text-accent-text">
              {labels.linkReady}
              <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden="true" />
            </span>
          ) : (
            <span className="rounded-pill border border-dashed border-hairline px-2.5 py-1 text-[10.5px] text-muted">
              {labels.linkPending}
            </span>
          )}
        </div>

        <div className="mt-auto max-w-[45%]">
          <h3 className="text-h3 leading-tight break-words">{name}</h3>
          <p className="mt-1.5 text-[13px] leading-snug text-muted">{work.work}</p>
          {work.kind ? (
            <p className="mt-1 text-caption tracking-wide text-muted">{work.kind}</p>
          ) : null}

          {/* 站内：这个人的主页。触屏也要能点，所以不做 hover 才显示 */}
          <a
            href={memberHref(work.slug)}
            className="pointer-events-auto relative z-30 mt-3 inline-flex items-center gap-1 rounded-pill border border-hairline px-2.5 py-1 text-[11.5px] text-text/85 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {labels.profileLabel}
            <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* 覆盖式外链：整张卡可点，新标签页打开。
          z-10 < 文字容器 z-20 —— 反过来就会把站内链接吃掉（见上）。 */}
      {hasLink ? (
        <a
          href={work.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${name} 的作品（在新标签页打开）`}
          className="absolute inset-0 z-10 rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        />
      ) : null}
    </m.article>
  );
}
