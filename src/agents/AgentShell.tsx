/**
 * 三位 AI 主页的「壳」：顶部条 + 页脚导航
 *
 * 为什么不做 sticky 子导航：站点顶部已经有一条会收缩/隐藏的固定导航
 * （`--nav-h` 4.5rem → compact 3.5rem）。再叠一条 sticky 会在滚动时打架，
 * 而且两层固定条会吃掉本来就紧张的移动端首屏高度。所以这里是一条普通顶栏。
 *
 * ⚠️ 页内跳转一律用按钮 + `scrollToId`，**不能写 `<a href="#er-consult">`**：
 * 裸 hash 在这套路由里等于「首页锚点」，点一下会跳到首页去（见 lib/router.ts）。
 */
import { ArrowLeft } from "lucide-react";
import Container from "../components/Container";
import type { TrioMember } from "./types";
import { scrollToId } from "./lib/scroll";

interface AgentShellProps {
  back: { label: string; href: string };
  switchLabel: string;
  sections: { id: string; label: string }[];
  items: TrioMember[];
  selfSlug: string;
}

export function AgentTopBar({
  back,
  switchLabel,
  sections,
  items,
  selfSlug,
}: AgentShellProps) {
  const others = items.filter((i) => i.slug !== selfSlug);

  return (
    <div className="relative z-10 border-b border-hairline">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-3.5 md:py-4">
        <a
          href={back.href}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted transition duration-fast ease-ease hover:text-accent-text"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          {back.label}
        </a>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] tracking-[0.28em] text-muted md:inline">
            {switchLabel}
          </span>
          {others.map((o) => (
            <a
              key={o.slug}
              href={o.href}
              className="inline-flex min-h-[2.25rem] items-center rounded-pill border border-hairline px-3 text-[13px] text-text/85 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text"
            >
              {o.name}
            </a>
          ))}
        </div>
      </Container>

      {/* 页内目录：桌面端才有，窄屏交给滚动 */}
      <Container className="hidden items-center gap-1 pb-3 md:flex">
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToId(s.id)}
            className="inline-flex items-baseline gap-1.5 rounded-pill px-2.5 py-1 text-[12px] text-muted transition duration-fast ease-ease hover:bg-accent/10 hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="font-mono text-[10px] text-accent-text/70">
              {String(i + 2).padStart(2, "0")}
            </span>
            {s.label}
          </button>
        ))}
      </Container>
    </div>
  );
}

interface AgentFootNavProps {
  note: string;
  copyright: string;
  backLabel: string;
  backHref: string;
  switchLabel: string;
  items: TrioMember[];
  selfSlug: string;
}

export function AgentFootNav({
  note,
  copyright,
  backLabel,
  backHref,
  switchLabel,
  items,
  selfSlug,
}: AgentFootNavProps) {
  return (
    <div className="relative z-10 mt-16 border-t border-hairline md:mt-24">
      <Container className="flex flex-col gap-5 py-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-text">{note}</p>
          <p className="mt-1 text-caption tracking-wide text-muted">{copyright}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={backHref}
            className="inline-flex min-h-[2.25rem] items-center rounded-pill border border-hairline px-3 text-[13px] text-muted transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text"
          >
            {backLabel}
          </a>
          <span className="mx-1 text-[11px] tracking-[0.24em] text-muted">
            {switchLabel}
          </span>
          {items
            .filter((i) => i.slug !== selfSlug)
            .map((i) => (
              <a
                key={i.slug}
                href={i.href}
                className="inline-flex min-h-[2.25rem] items-center rounded-pill border border-hairline px-3 text-[13px] text-text/85 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text"
              >
                {i.name}
              </a>
            ))}
        </div>
      </Container>
    </div>
  );
}
