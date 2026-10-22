/**
 * 豆总的个人主页（#/member/douzong）——「创业指挥中心」
 *
 * 六屏：01 指挥中心 / 02 指挥官档案 / 03 作战沙盘 / 04 决策推演 / 05 三巨头 / 06 通讯台
 * 全部文案来自 `data/dou.ts`，这里只管排版与那点状态。
 *
 * 两处刻意的取舍：
 * - **指挥台不做真 3D 箱体**：只有地板用 `perspective()` 的单独变换（自包含，不需要
 *   preserve-3d），三块屏是普通 2D 面板。屏里要放文字和 CountUp，进了 3D 会被重采样发糊；
 *   而且父层任何 `filter` / `opacity<1` 都会把 3D 拍平（展示柜踩过两次）。
 * - **首屏不锁 100vh**：站点顶部已有会收缩的固定导航，再锁满屏会让 1440×900 的机器
 *   第一眼看不到 CTA。按内容自然高度走，反而更好滚。
 */
import { useState } from "react";
import { Mail, Megaphone, Radio, Satellite } from "lucide-react";
import Container from "../components/Container";
import Reveal from "../components/Reveal";
import Section from "../components/Section";
import BattleMap from "./components/BattleMap";
import CountUp from "./components/CountUp";
import RadarChart from "./components/RadarChart";
import RotatingQuote from "./components/RotatingQuote";
import TrioLinks from "./components/TrioLinks";
import Typewriter from "./components/Typewriter";
import { AgentFootNav, AgentTopBar } from "./AgentShell";
import DecisionSimulator from "./decide/DecisionSimulator";
import { douPage, douRadar, douScenarios, douZones } from "./data/dou";
import { trio } from "./data/trio";
import { scrollToId } from "./lib/scroll";

const CHANNEL_ICON = {
  radio: Radio,
  mail: Mail,
  satellite: Satellite,
  broadcast: Megaphone,
} as const;

const STATUS_COLOR: Record<string, string> = {
  ok: "rgb(0 214 143)",
  watch: "rgb(255 217 61)",
  blocked: "rgb(255 92 138)",
};

/* 「在推项目」那块屏里的三条迷你进度条（数据来自沙盘，别在这里另写一套数字） */
function MiniProjects() {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {douZones.map((z) => (
        <li key={z.code} className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">{z.code}</span>
          <span className="dou-track h-[3px] flex-1">
            <span style={{ width: `${z.progress}%`, background: STATUS_COLOR[z.status] }} />
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">
            {z.progress}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/* 「团队能量」：三段堆叠条，比例来自 caption 里的 6 / 8 / 2 */
function TeamEnergy() {
  const segs = [
    { key: "in", ratio: 6, color: "rgb(0 214 143)" },
    { key: "ok", ratio: 8, color: "rgb(0 196 214)" },
    { key: "warn", ratio: 2, color: "rgb(255 217 61)" },
  ];
  return (
    <div className="mt-2.5 flex h-[6px] gap-1" aria-hidden="true">
      {segs.map((s) => (
        <span
          key={s.key}
          className="h-full rounded-[1px]"
          style={{ flex: s.ratio, background: s.color, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}

export default function DouHome() {
  const p = douPage;
  const [filter, setFilter] = useState("all");
  const [zoneCode, setZoneCode] = useState(douZones[0].code);

  const visible = filter === "all" ? douZones : douZones.filter((z) => z.status === filter);
  /* 选了筛选之后原来那块可能被过滤掉 —— 一律以「当前可见的第一块」为准，
     别让沙盘高亮一个已经不在图上的战区 */
  const zone = visible.find((z) => z.code === zoneCode) ?? visible[0] ?? null;

  return (
    <main id="main" data-act={p.act} className="dou-stage">
      <AgentTopBar
        back={{ label: p.nav.back, href: p.nav.backHref }}
        switchLabel={p.nav.switchLabel}
        sections={p.nav.sections}
        items={trio}
        selfSlug="douzong"
      />

      {/* ---------------- 01 指挥中心 ---------------- */}
      <section className="relative pb-14 pt-8 md:pb-20 md:pt-12">
        <Container>
          <div className="mx-auto grid max-w-[1180px] items-center gap-10 tab:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] tab:gap-14">
            <div>
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-[3px] border border-hairline px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-accent-text">
                    <span className="dou-dot text-[rgb(0_214_143)]" aria-hidden="true" />
                    {p.hero.status}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
                    {p.hero.holo.code}
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.04}>
                <h1 className="mt-5 font-serif text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.16] tracking-tight text-text [text-wrap:balance]">
                  <Typewriter text={p.hero.title} speed={64} startDelay={220} />
                </h1>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
                  {p.hero.sub}
                </p>
              </Reveal>

              <Reveal delay={0.16}>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => scrollToId(p.hero.ctaTarget)}
                    className="inline-flex min-h-[2.9rem] items-center justify-center rounded-pill bg-[rgb(0_196_214)] px-6 text-[14px] font-semibold tracking-wide text-[rgb(6_20_32)] transition duration-fast ease-ease hover:-translate-y-0.5 hover:bg-[rgb(0_214_232)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {p.hero.cta}
                  </button>
                  <span className="text-[12px] tracking-wide text-muted">{p.hero.note}</span>
                </div>
              </Reveal>

              <Reveal delay={0.22}>
                <p className="mt-6 inline-flex items-center gap-2 rounded-[3px] border border-[rgb(0_196_214_/_0.4)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-accent-text">
                  {p.hero.role}
                </p>
              </Reveal>
            </div>

            {/* 全息头像 */}
            <Reveal delay={0.08}>
              <div className="dou-holo mx-auto w-full max-w-[19rem]">
                <div className="dou-holo-frame h-[330px] tab:h-[392px]">
                  <img
                    src="/persona/douzong-portrait.webp"
                    alt="豆总的数字全息投影"
                    className="dou-holo-img"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="dou-holo-tint" aria-hidden="true" />
                  <span className="dou-holo-scan" aria-hidden="true" />
                  <span className="dou-holo-beam" aria-hidden="true" />
                </div>
                <div className="dou-holo-base" aria-hidden="true" />
                <p className="mt-1 text-center font-mono text-[10px] tracking-[0.22em] text-muted">
                  {p.hero.holo.label}
                </p>
              </div>
            </Reveal>
          </div>

          {/* 指挥台：三块屏 + 底部数据条 */}
          <Reveal delay={0.1} className="mt-10">
            <div className="dou-hud mx-auto max-w-[1180px] rounded-panel p-4 md:p-6">
              <div className="dou-console">
                <div className="dou-console-floor" aria-hidden="true" />

                <div className="relative grid gap-3 md:grid-cols-3 md:gap-4">
                  {p.hero.screens.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollToId(s.target)}
                      className="dou-screen px-3.5 py-3"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[10.5px] font-semibold tracking-[0.18em] text-accent-text/85">
                          {s.title}
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          {s.caption}
                        </span>
                      </span>

                      <span className="mt-1.5 flex items-baseline gap-1">
                        <span className="font-mono text-[26px] leading-none tabular-nums text-text">
                          <CountUp value={s.value} />
                        </span>
                        <span className="font-mono text-[11px] text-muted">{s.unit}</span>
                      </span>

                      {s.id === "health" ? (
                        <span className="dou-track mt-2.5 block">
                          <span style={{ width: `${s.value}%` }} />
                        </span>
                      ) : null}
                      {s.id === "projects" ? <MiniProjects /> : null}
                      {s.id === "team" ? <TeamEnergy /> : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* 实时数据条：**虚构业绩，必须挂「示例数据」** */}
              <div className="mt-5 border-t border-hairline pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold tracking-[0.24em] text-accent-text/70">
                    {p.hero.plaque}
                  </span>
                  <span className="rounded-pill border border-hairline px-2 py-0.5 text-[10px] tracking-widest text-muted">
                    {p.hero.sampleTag}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
                  {p.hero.kpi.map((k) => (
                    <div key={k.id} title={k.hint}>
                      <dd className="flex items-baseline gap-0.5 font-mono text-[22px] leading-none tabular-nums text-text">
                        <CountUp value={k.value} />
                        <span className="text-[11px] text-muted">{k.suffix}</span>
                      </dd>
                      <dt className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                        {k.id === "risk" ? (
                          <span
                            className="dou-dot text-[rgb(255_138_61)]"
                            data-tone="watch"
                            aria-hidden="true"
                          />
                        ) : null}
                        {k.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ---------------- 02 指挥官档案 ---------------- */}
      <Section id="dou-archive" ariaLabelledBy="dou-archive-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.archive.eyebrow}
            </p>
            <h2
              id="dou-archive-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.archive.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.archive.lead}</p>
          </header>

          <div className="mt-9 grid gap-6 tab:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] tab:gap-8">
            {/* 档案卡：军官档案的版式，等宽字打头 */}
            <Reveal>
              <div className="dou-hud flex h-full flex-col rounded-panel p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-2xl font-semibold text-text">
                      {p.archive.card.name}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.16em] text-accent-text/85">
                      {p.archive.card.rank}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9.5px] tracking-[0.2em] text-muted">
                      {p.archive.card.codeLabel}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] tracking-[0.08em] text-text/80">
                      {p.archive.card.code}
                    </p>
                  </div>
                </div>

                <p className="mt-4 border-t border-hairline pt-3.5 text-[12.5px] leading-relaxed text-text/75">
                  {p.archive.card.bio}
                </p>

                <dl className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[11px] tracking-[0.18em] text-muted">
                      {p.archive.card.yearsLabel}
                    </dt>
                    <dd className="font-mono text-[12.5px] text-text/90">
                      {p.archive.card.years}
                    </dd>
                  </div>
                </dl>

                <p className="mt-5 text-[10px] tracking-[0.2em] text-muted">
                  {p.archive.card.tagsLabel}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {p.archive.card.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-[2px] border border-hairline px-2 py-1 text-[11px] text-text/75"
                    >
                      #{t}
                    </li>
                  ))}
                </ul>

                {/* 档案卡底部那条拉长的条形码：纯装饰，别拿去做别的含义 */}
                <p className="mt-5 text-[10px] tracking-[0.2em] text-muted">
                  {p.archive.card.recordLabel}
                </p>
                <ol className="mt-2 space-y-2">
                  {p.archive.card.record.map((r) => (
                    <li key={r.year} className="flex gap-2.5">
                      <span className="shrink-0 font-mono text-[11px] text-accent-text/80">
                        {r.year}
                      </span>
                      <span className="text-[11.5px] leading-relaxed text-text/70">{r.text}</span>
                    </li>
                  ))}
                </ol>

                {/* 外框单独给高度：h-5 + pt-5 会算出 0 内容高，条形码直接消失（踩过） */}
                <div aria-hidden="true" className="mt-auto pt-6">
                  <div className="flex h-5 items-stretch gap-[2px] opacity-40">
                    {Array.from({ length: 44 }).map((_, i) => (
                      <span
                        key={i}
                        className="flex-1 bg-[rgb(126_231_245)]"
                        style={{ opacity: i % 3 === 0 ? 0.9 : i % 3 === 1 ? 0.4 : 0.65 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 能力雷达 */}
            <Reveal delay={0.06}>
              <div className="dou-hud h-full rounded-panel p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold tracking-[0.26em] text-accent-text/85">
                    {p.archive.radarTitle}
                  </span>
                  <span className="text-[10.5px] text-muted">{p.archive.radarHint}</span>
                </div>

                <div className="mt-4">
                  <RadarChart axes={douRadar} />
                </div>

                <p className="mt-4 border-t border-hairline pt-3 text-[10.5px] text-muted">
                  {p.archive.radarFoot}
                </p>
              </div>
            </Reveal>
          </div>

          {/* 语录带 */}
          <Reveal delay={0.1}>
            <div className="dou-hud mt-6 rounded-panel px-5 py-5 md:px-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold tracking-[0.26em] text-accent-text/85">
                  {p.archive.quotesTitle}
                </span>
                <span className="rounded-pill border border-hairline px-2 py-0.5 text-[10px] tracking-widest text-muted">
                  {p.archive.statsNote}
                </span>
              </div>
              <RotatingQuote
                quotes={p.archive.quotes}
                speed={52}
                hold={2600}
                className="mt-3 min-h-[3.2rem] font-serif text-lg leading-relaxed text-text md:text-xl"
              />
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ---------------- 03 作战沙盘 ---------------- */}
      <Section id="dou-sandbox" ariaLabelledBy="dou-sandbox-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <header className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
                {p.sandbox.eyebrow}
              </p>
              <h2
                id="dou-sandbox-title"
                className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
              >
                {p.sandbox.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.sandbox.lead}</p>
            </header>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="筛选战区">
              {p.sandbox.filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-[2.1rem] rounded-pill border px-3 text-[12px] transition duration-fast ease-ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    filter === f.id
                      ? "border-[rgb(0_196_214_/_0.6)] bg-[rgb(0_196_214_/_0.14)] text-accent-text"
                      : "border-hairline text-muted hover:border-accent/50 hover:text-text"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Reveal className="mt-4">
            <div className="dou-hud rounded-panel p-3 md:p-5">
              <p className="mb-2 text-center text-[10px] tracking-[0.24em] text-muted">
                {p.sandbox.mapLabel}
              </p>

              {visible.length ? (
                <BattleMap
                  zones={visible}
                  activeCode={zone?.code ?? null}
                  onSelect={setZoneCode}
                />
              ) : (
                <p className="py-16 text-center text-[13px] text-muted">{p.sandbox.empty}</p>
              )}
            </div>
          </Reveal>

          {/* 战区详情 */}
          {zone ? (
            <Reveal className="mt-5">
              <div className="grid gap-6 rounded-panel border border-hairline p-5 md:grid-cols-[1.05fr_0.95fr] md:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-muted">
                      {zone.code}
                    </span>
                    <h3 className="font-serif text-xl font-semibold text-text">{zone.name}</h3>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-pill border border-hairline px-2 py-0.5 text-[10.5px]"
                      style={{ color: STATUS_COLOR[zone.status] }}
                    >
                      <span
                        className="dou-dot"
                        data-tone={zone.status === "watch" ? "watch" : undefined}
                        aria-hidden="true"
                      />
                      {zone.statusLabel}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-3">
                    <div>
                      <dt className="text-[10px] tracking-[0.2em] text-muted">
                        {p.sandbox.detailLabels.goal}
                      </dt>
                      <dd className="mt-1 text-[13px] leading-relaxed text-text/90">
                        {zone.goal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] tracking-[0.2em] text-muted">
                        {p.sandbox.detailLabels.stage}
                      </dt>
                      <dd className="mt-1 text-[13px] leading-relaxed text-text/90">
                        {zone.stage}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] tracking-[0.2em] text-muted">
                        {p.sandbox.detailLabels.risk}
                      </dt>
                      <dd className="mt-1 border-l-2 border-[rgb(255_138_61_/_0.55)] pl-3 text-[13px] leading-relaxed text-text/80">
                        {zone.risk}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid gap-5">
                  <div>
                    <p className="text-[10px] tracking-[0.2em] text-muted">
                      {p.sandbox.detailLabels.milestones}
                    </p>
                    <ol className="mt-2 space-y-2">
                      {zone.milestones.map((ms) => (
                        <li key={ms.label} className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                              ms.done
                                ? "border-[rgb(0_214_143_/_0.8)] bg-[rgb(0_214_143_/_0.18)] text-[rgb(0_214_143)]"
                                : "border-hairline text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span
                            className={`text-[12.5px] leading-relaxed ${
                              ms.done ? "text-text/85" : "text-muted"
                            }`}
                          >
                            {ms.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="text-[10px] tracking-[0.2em] text-muted">
                      {p.sandbox.detailLabels.team}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {zone.team.map((t) => (
                        <li
                          key={t.name}
                          className="rounded-[2px] border border-hairline px-2 py-1 text-[11.5px] text-text/80"
                        >
                          <span className="font-medium">{t.name}</span>
                          <span className="text-muted"> · {t.job}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-[11.5px] text-muted">
                    {p.sandbox.detailLabels.next}：<span className="text-accent-text">{zone.next}</span>
                  </p>
                </div>
              </div>
            </Reveal>
          ) : null}
        </Container>
      </Section>

      {/* ---------------- 04 决策推演 ---------------- */}
      <Section id="dou-decide" ariaLabelledBy="dou-decide-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.decide.eyebrow}
            </p>
            <h2
              id="dou-decide-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.decide.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.decide.lead}</p>
          </header>

          <Reveal className="mt-8">
            <DecisionSimulator scenarios={douScenarios} config={p.decide} />
          </Reveal>
        </Container>
      </Section>

      {/* ---------------- 05 三巨头 ---------------- */}
      <Section id="dou-trio" ariaLabelledBy="dou-trio-title">
        <Container>
          <header className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
              {p.trioSection.eyebrow}
            </p>
            <h2
              id="dou-trio-title"
              className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
            >
              {p.trioSection.title}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.trioSection.lead}</p>
          </header>

          <Reveal className="mt-10">
            <TrioLinks
              items={trio}
              selfSlug="douzong"
              selfBadge={p.trioSection.selfBadge}
              openLabel={p.trioSection.openLabel}
            />
          </Reveal>
        </Container>
      </Section>

      {/* ---------------- 06 通讯台 ---------------- */}
      <Section id="dou-contact" ariaLabelledBy="dou-contact-title">
        <Container>
          <div className="grid gap-8 tab:grid-cols-[0.94fr_1.06fr] tab:items-center">
            {/* 频道面板：结构先立住，账号到位再点亮 */}
            <Reveal>
              <div className="dou-hud rounded-panel p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold tracking-[0.26em] text-accent-text/85">
                    {p.contact.panelTitle}
                  </span>
                  <span className="font-mono text-[10px] tracking-widest text-muted">
                    {p.contact.channelState}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {p.contact.channels.map((c) => {
                    const Icon = CHANNEL_ICON[c.icon as keyof typeof CHANNEL_ICON];
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-[3px] border border-hairline px-3 py-2.5"
                      >
                        <Icon
                          size={15}
                          strokeWidth={1.7}
                          aria-hidden="true"
                          className="shrink-0 text-accent-text/70"
                        />
                        <span className="flex-1 text-[12.5px] text-text/80">{c.label}</span>
                        <span className="rounded-[2px] bg-white/[0.06] px-1.5 py-0.5 text-[10px] tracking-wider text-muted">
                          {p.contact.channelState}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-muted">
                  {p.contact.channelNote}
                </p>
              </div>
            </Reveal>

            <div>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-accent-text/80">
                {p.contact.eyebrow}
              </p>
              <h2
                id="dou-contact-title"
                className="mt-3 font-serif text-h2 font-semibold text-text [text-wrap:balance]"
              >
                {p.contact.title}
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">
                {p.contact.lead}
              </p>

              <p className="mt-6 text-[11px] tracking-[0.2em] text-muted">
                {p.contact.actionsTitle}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {p.contact.actions.map((a, i) => (
                  <a
                    key={a.href}
                    href={a.href}
                    className={
                      i === 0
                        ? "inline-flex min-h-[2.75rem] items-center rounded-pill bg-[rgb(0_196_214)] px-5 text-[13.5px] font-semibold text-[rgb(6_20_32)] transition duration-fast ease-ease hover:-translate-y-0.5 hover:bg-[rgb(0_214_232)]"
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
        selfSlug="douzong"
      />
    </main>
  );
}
