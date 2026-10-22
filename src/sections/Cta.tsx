/**
 * 行动号召区块
 *
 * 结构（自上而下）：组织 logo → 标题 → 副标题 → 「加入我们」引导 → 关注我们。
 * 原来的「立即联系」按钮已按 Cyrus 要求去掉。
 *
 * 「加入我们」点开后展开一块内容面板，当前刻意留白（等加入流程 / 招募入口到位）。
 * 展开动效走 CSS 的 grid-template-rows 0fr→1fr，不用 framer：
 * 高度 auto 的动画需要一个测量过程，而这条纯 CSS 的路子零依赖、不掉帧，
 * 内容多长都能正确展开。
 *
 * 社交账号：官方 logo 素材还没到，先用「品牌色圆点 + 平台名」的文字徽章过渡。
 * 圆点带一圈白色内描边——X 的品牌色几乎全黑，在深色主题上不加描边会看不见。
 */
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Section from "../components/Section";
import Container from "../components/Container";
import Button from "../components/Button";
import Logo from "../components/Logo";
import Reveal from "../components/Reveal";
import { cta } from "../content";

export default function Cta() {
  const [open, setOpen] = useState(false);
  /* 展开面板的 id：用 useId 生成，避免将来页面上出现第二个 CTA 时撞 id */
  const panelId = useId();

  return (
    <Section id="cta" ariaLabelledBy="cta-title">
      <Container>
        <Reveal>
          <div
            className="rounded-panel border border-accent/30 px-6 py-12 text-center shadow-glow md:px-12 md:py-16"
            style={{
              background:
                "linear-gradient(to bottom right, color-mix(in srgb, var(--c-accent) 12%, transparent), transparent)",
            }}
          >
            {/* 组织 logo */}
            <div className="flex justify-center">
              <Logo loading="lazy" className="h-9 md:h-11" />
            </div>

            <h2 id="cta-title" className="mt-8 text-h2">
              {cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-body-lg text-muted">
              {cta.subtitle}
            </p>

            {/* 加入引导 */}
            <div className="mt-8">
              <Button
                variant="primary"
                onClick={() => setOpen((v) => !v)}
                ariaExpanded={open}
                ariaControls={panelId}
              >
                {open ? cta.join.collapseLabel : cta.join.label}
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={`transition-transform duration-base ease-ease ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>

            {/* 展开区：当前留白，等内容到位 */}
            <div
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-base ease-ease ${
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mx-auto mt-6 max-w-2xl rounded-card border border-dashed border-hairline-strong bg-surface/30 px-6 py-10">
                  <p className="font-medium">{cta.join.emptyTitle}</p>
                  <p className="mt-2 text-sm text-muted">{cta.join.emptyText}</p>
                </div>
              </div>
            </div>

            {/* 关注我们 */}
            <div className="mt-12 border-t border-hairline pt-8">
              <p className="text-caption uppercase tracking-[0.24em] text-muted">
                {cta.social.heading}
              </p>
              <ul className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {cta.social.accounts.map((account) => {
                  const inner = (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-white/30"
                        style={{ backgroundColor: account.accent }}
                      />
                      {account.label}
                    </>
                  );
                  const cls =
                    "inline-flex items-center gap-2.5 rounded-pill border border-hairline bg-surface/50 px-4 py-2 text-sm text-muted transition duration-fast ease-ease";

                  return (
                    <li key={account.key}>
                      {account.href ? (
                        <a
                          href={account.href}
                          className={`${cls} hover:-translate-y-0.5 hover:border-accent/50 hover:text-text`}
                        >
                          {inner}
                        </a>
                      ) : (
                        /* 还没有主页地址：只展示，不做成假链接 */
                        <span className={cls}>{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
