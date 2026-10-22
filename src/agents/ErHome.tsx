/**
 * 二表哥的个人主页（#/member/erbiaoge）——「数据诊断室」
 *
 * 五屏：01 大门 / 02 诊断室 / 03 把脉 / 04 三巨头 / 05 联系
 * 全部文案来自 `data/er.ts`，这里只管排版。
 *
 * 🔴 首屏的门**不能包在 `Reveal` 里**：Reveal 用 whileInView 做 opacity 0→1，
 *    而 `.er-door-scene` 的祖先一旦 opacity<1 就会开新的包含块，`preserve-3d`
 *    直接被拍平成两层平面 —— 门就变成「一张图往左滑」。这是展示柜与投币厅都踩过的坑。
 *    所以首屏只给文案做淡入，门保持「一开始就在」。
 */
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Phone } from "lucide-react";
import Container from "../components/Container";
import Reveal from "../components/Reveal";
import Section from "../components/Section";
import CountUp from "./components/CountUp";
import DoorStage from "./components/DoorStage";
import RotatingQuote from "./components/RotatingQuote";
import TrioLinks from "./components/TrioLinks";
import Typewriter from "./components/Typewriter";
import { AgentFootNav, AgentTopBar } from "./AgentShell";
import ConsultEngine from "./consult/ConsultEngine";
import { erPage, erCases } from "./data/er";
import { trio } from "./data/trio";
import { scrollToId } from "./lib/scroll";

export default function ErHome() {
  const p = erPage;
  const reduce = useReducedMotion();
  const [stats, setStats] = useState(p.about.stats);

  /* 「实时」数据条：只是让它活着，不是真的在拉数据。旁边有「示例数据」标签。 */
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      setStats((prev) =>
        prev.map((s) => {
          if (s.id === "queue") {
            const delta = Math.random() < 0.5 ? -1 : 1;
            const next = Math.min(48, Math.max(28, s.value + delta));
            return { ...s, value: next };
          }
          return s;
        })
      );
    }, 6000);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <main id="main" data-act={p.act} className="er-stage">
      <AgentTopBar
        back={{ label: p.nav.back, href: p.nav.backHref }}
        switchLabel={p.nav.switchLabel}
        sections={p.nav.sections}
        items={trio}
        selfSlug="erbiaoge"
      />

      {/* ---------------- 01 大门 ---------------- */}
      <section className="relative pb-14 pt-8 md:pb-20 md:pt-12">
        <Container>
          {/* 首屏收窄到 1120：1440 宽下按容器走，文案右侧会空出一大块 */}
          <div className="mx-auto grid max-w-[1120px] items-center gap-10 tab:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] tab:gap-16">
            {/* 门 */}
            <div>
              {/* 移动端：只有门楣与铜牌（PRD 明确不做全屏开门，免得用户不知道能滚） */}
              <div className="md:hidden">
                <div className="er-wood flex items-center justify-center rounded-[4px] px-3 py-6">
                  <div className="er-brass rounded-[4px] px-3 py-2 text-center">
                    <span className="text-[11px] font-semibold tracking-[0.14em]">
                      {p.hero.plaque}
                    </span>
                  </div>
                </div>
              </div>

              {/* 桌面端：真的能推开的门 */}
              <div className="hidden md:block">
                <DoorStage
                  plaque={p.hero.plaque}
                  roomCaption={p.hero.roomCaption}
                  ariaLabel={p.hero.doorAria}
                  hint={p.hero.doorHint}
                  openedText={p.hero.doorOpened}
                />
              </div>
            </div>

            {/* 文案 */}
            <div>
              <Reveal>
                {/* 门旁那张泛黄告示 */}
                <div className="er-paper inline-block max-w-[17rem] -rotate-2 rounded-[2px] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(155_59_47)]"
                    />
                    <span className="text-[11px] font-semibold tracking-[0.22em] text-[rgb(120_96_66)]">
                      {p.hero.notice.title}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {p.hero.notice.lines.map((line) => (
                      <li
                        key={line}
                        className="text-[12px] leading-relaxed text-[rgb(70_54_38)]"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 border-t border-[rgb(140_116_86_/_0.35)] pt-1.5 text-[10px] tracking-wide text-[rgb(140_120_92)]">
                    {p.hero.notice.footer}
                  </p>
                </div>
              </Reveal>

              <Reveal delay={0.03}>
                <p className="mt-6 inline-flex items-center gap-2 rounded-[3px] border border-[rgb(198_155_92_/_0.45)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-accent-text">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[rgb(198_155_92)]" />
                  {p.hero.role}
                </p>
              </Reveal>

              <Reveal delay={0.06}>
                <h1 className="mt-3 font-serif text-[clamp(2.1rem,4.4vw,3.4rem)] font-bold leading-[1.14] tracking-tight text-text [text-wrap:balance]">
                  <Typewriter text={p.hero.title} speed={72} startDelay={240} />
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
                  {p.hero.sub}
                </p>
              </Reveal>

              <Reveal delay={0.18}>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => scrollToId(p.hero.ctaTarget)}
                    className="er-brass inline-flex min-h-[2.9rem] items-center justify-center rounded-pill px-6 text-[14px] font-semibold tracking-wide transition duration-fast ease-ease hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {p.hero.cta}
                  </button>
                  <span className="text-[12px] tracking-wide text-muted">
                    {p.hero.note}
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- 02 诊断室 ---------------- */}
      <Section id="er-about" ariaLabelledBy="er-about-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.about.eyebrow}
            </p>
            <h2
              id="er-about-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.about.title}
            </h2>
          </header>

          <div className="mt-9 grid gap-6 tab:grid-cols-[1.06fr_0.94fr] tab:gap-8">
            {/* 软木板 + 三张档案 */}
            <Reveal>
              <div
                className="relative overflow-hidden rounded-panel p-4 md:p-6"
                style={{
                  backgroundColor: "rgb(122 92 62)",
                  backgroundImage:
                    "radial-gradient(rgb(0 0 0 / 0.34) 0.6px, transparent 0.7px), linear-gradient(180deg, rgb(255 220 170 / 0.1), rgb(0 0 0 / 0.28))",
                  backgroundSize: "4px 4px, 100% 100%",
                  boxShadow:
                    "inset 0 2px 0 rgb(255 224 180 / 0.16), inset 0 -4px 16px rgb(0 0 0 / 0.5), 0 26px 50px -40px rgb(0 0 0 / 0.9)",
                }}
              >
                {/* 板子四角的木框 */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-panel ring-1 ring-inset ring-[rgb(60_40_24_/_0.55)]"
                />

                <div className="relative flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.26em] text-[rgb(255_232_200_/_0.85)]">
                      {p.about.boardTitle}
                    </p>
                    <p className="mt-1 text-[12px] text-[rgb(255_232_200_/_0.62)]">
                      {p.about.boardHint}
                    </p>
                  </div>
                  <span className="rounded-pill bg-[rgb(40_26_16_/_0.35)] px-2 py-0.5 text-[10px] tracking-widest text-[rgb(255_232_200_/_0.75)]">
                    {p.labels.boardCount}
                  </span>
                </div>

                <ul className="relative mt-6 space-y-5">
                  {erCases.map((c) => (
                    <li
                      key={c.code}
                      className="er-paper relative rounded-[2px] px-4 py-3.5"
                      style={{ transform: `rotate(${c.tilt}deg)` }}
                    >
                      <span
                        aria-hidden="true"
                        className="act-pin absolute left-5 top-0 -translate-y-1/2"
                      />
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[10px] tracking-[0.18em] text-[rgb(120_96_66)]">
                          {c.code}
                        </span>
                        <span className="text-[10px] tracking-widest text-[rgb(140_120_92)]">
                          {p.labels.closed}
                        </span>
                      </div>
                      <h3 className="mt-1 font-serif text-[17px] font-semibold text-[rgb(56_43_30)]">
                        {c.title}
                      </h3>
                      <p className="mt-0.5 text-[12.5px] italic text-[rgb(96_74_50)]">
                        {c.question}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-[rgb(66_50_34)]">
                        {c.verdict}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* 关于我 + 诊断台 + 格言 */}
            <div className="space-y-5">
              <Reveal delay={0.06}>
                <div className="er-paper rounded-[3px] px-5 py-5">
                  <p className="text-[13px] leading-[1.85] text-[rgb(66_50_34)]">
                    <Typewriter
                      text={p.about.intro}
                      speed={26}
                      startDelay={200}
                      caret={false}
                    />
                  </p>
                  <p className="mt-3 border-t border-[rgb(140_116_86_/_0.35)] pt-2 text-right text-[11px] tracking-wide text-[rgb(126_104_76)]">
                    {p.about.introFoot}
                  </p>
                </div>
              </Reveal>

              <Reveal delay={0.12}>
                <div className="er-hud rounded-panel p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold tracking-[0.26em] text-accent-text/85">
                      {p.about.statsTitle}
                    </span>
                    <span className="rounded-pill border border-hairline px-2 py-0.5 text-[10px] tracking-widest text-muted">
                      {p.about.statsNote}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    {stats.map((s) => (
                      <div key={s.id}>
                        <dd className="font-mono text-[26px] leading-none tabular-nums text-cyan">
                          <CountUp value={s.value} suffix={s.suffix} />
                        </dd>
                        <dt className="mt-1.5 text-[11px] leading-snug text-muted">
                          {s.label}
                        </dt>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>

              <Reveal delay={0.18}>
                <div className="er-hud rounded-panel p-5">
                  <span className="text-[11px] font-semibold tracking-[0.26em] text-accent-text/85">
                    {p.about.quotesTitle}
                  </span>
                  <RotatingQuote
                    quotes={p.about.quotes}
                    className="mt-3 min-h-[3.5rem] font-serif text-lg leading-relaxed text-text"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------------- 03 把脉 ---------------- */}
      <Section id="er-consult" ariaLabelledBy="er-consult-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.consult.eyebrow}
            </p>
            <h2
              id="er-consult-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.consult.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              {p.consult.lead}
            </p>
          </header>

          <Reveal className="mt-8">
            <ConsultEngine config={p.consult} />
          </Reveal>
        </Container>
      </Section>

      {/* ---------------- 04 三巨头 ---------------- */}
      <Section id="er-trio" ariaLabelledBy="er-trio-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.trioSection.eyebrow}
            </p>
            <h2
              id="er-trio-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.trioSection.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              {p.trioSection.lead}
            </p>
          </header>

          <Reveal className="mt-10">
            <TrioLinks
              items={trio}
              selfSlug="erbiaoge"
              selfBadge={p.trioSection.selfBadge}
              openLabel={p.trioSection.openLabel}
            />
          </Reveal>
        </Container>
      </Section>

      {/* ---------------- 05 联系 ---------------- */}
      <Section id="er-contact" ariaLabelledBy="er-contact-title">
        <Container>
          <div className="grid gap-8 tab:grid-cols-[0.82fr_1.18fr] tab:items-center">
            {/* 桌上那张名片 */}
            <Reveal>
              <div className="er-paper max-w-[22rem] -rotate-1 rounded-[3px] px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-xl font-semibold text-[rgb(56_43_30)]">
                      {p.contact.cardName}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.16em] text-[rgb(126_104_76)]">
                      {p.contact.cardRole}
                    </p>
                  </div>
                  <Phone
                    size={18}
                    strokeWidth={1.6}
                    aria-hidden="true"
                    className="mt-1 text-[rgb(140_116_86)]"
                  />
                </div>
                <ul className="mt-4 space-y-1 border-t border-[rgb(140_116_86_/_0.35)] pt-3">
                  {p.contact.cardLines.map((line) => (
                    <li
                      key={line}
                      className="text-[12px] leading-relaxed text-[rgb(80_60_40)]"
                    >
                      「{line}」
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <div>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
                {p.contact.eyebrow}
              </p>
              <h2
                id="er-contact-title"
                className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
              >
                {p.contact.title}
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">
                {p.contact.lead}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {p.contact.actions.map((a, i) => (
                  <a
                    key={a.href}
                    href={a.href}
                    className={
                      i === 0
                        ? "er-brass inline-flex min-h-[2.75rem] items-center rounded-pill px-5 text-[13.5px] font-semibold transition duration-fast ease-ease hover:-translate-y-0.5"
                        : "inline-flex min-h-[2.75rem] items-center rounded-pill border border-hairline px-5 text-[13.5px] font-medium text-text/90 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text"
                    }
                  >
                    {a.label}
                  </a>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollToId(p.contact.retryTarget)}
                className="mt-4 text-[12px] tracking-wide text-muted underline decoration-hairline underline-offset-4 transition duration-fast ease-ease hover:text-accent-text"
              >
                {p.contact.retryLabel}
              </button>
            </div>
          </div>
        </Container>
      </Section>

      <AgentFootNav
        note={p.footer.note}
        copyright={p.footer.copyright}
        backLabel={p.footer.backLabel}
        backHref={p.footer.backHref}
        switchLabel={p.footer.switchLabel}
        items={trio}
        selfSlug="erbiaoge"
      />
    </main>
  );
}
