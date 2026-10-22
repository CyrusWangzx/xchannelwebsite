/**
 * 决策推演台（豆总专属）
 *
 * 为什么不做成 ConsultEngine 的第二个配置：
 * 二表哥是「多选症状 → 从池子里轮转抽 3 条」，抽到什么看运气；
 * 豆总是「选场景 + 选一个做法 → 这个做法有它自己的一套代价」，
 * 结果**必须**由「场景 × 选项」唯一决定，不能抽。硬塞进同一个 schema 会得到四不像。
 * 真正共用的是节奏（见 `lib/useRitual`）与「诚实」这条线：
 * 每一份报告底下都印「预设推演，不是 AI 预测」。
 *
 * 交互：
 *   选场景（单选）→ 选做法（单选）→ 开始推演 → 3.6 秒分期推演 → 报告 → 换个场景
 * 单选控件用 `role="radiogroup"` + `role="radio"`，支持方向键 —— 这是单选，不是多选开关。
 */
import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import type { DecisionScenario } from "../types";
import { DUR, EASE_OUT } from "../../lib/motion";
import { scrollToId } from "../lib/scroll";
import { useRitual } from "../lib/useRitual";

interface Config {
  formTitle: string;
  scenarioLabel: string;
  hint: string;
  optionLabel: string;
  optionHint: string;
  startLabel: string;
  idleHint: string;
  pickedHint: string;
  sampleNote: string;
  ritual: string[];
  report: {
    title: string;
    stamp: string;
    idleTitle: string;
    idleNote: string;
    findingsLabel: string;
    adviceLabel: string;
    disclaimer: string;
  };
  cta: {
    again: string;
    crossLabel: string;
    crossHref: string;
    contactLabel: string;
    contactTarget: string;
  };
}

interface Report {
  id: string;
  scenario: string;
  option: string;
  verdict: string;
  findings: string[];
  advice: string[];
}

function reportId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `R-${ymd}-${String(Math.floor(Math.random() * 90) + 10)}`;
}

/** 方向键在单选组里挪焦点：Tab 只进组一次，之后靠方向键，和原生 radio 一致 */
function handleArrow(
  e: React.KeyboardEvent<HTMLButtonElement>,
  index: number,
  size: number,
  refs: React.MutableRefObject<(HTMLButtonElement | null)[]>
) {
  const step =
    e.key === "ArrowDown" || e.key === "ArrowRight"
      ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft"
        ? -1
        : 0;
  if (!step) return;
  e.preventDefault();
  const next = (index + step + size) % size;
  refs.current[next]?.focus();
  refs.current[next]?.click();
}

export default function DecisionSimulator({
  scenarios,
  config,
}: {
  scenarios: DecisionScenario[];
  config: Config;
}) {
  const ritual = useRitual();
  const { phase, step } = ritual;

  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null;
  const option = scenario?.options.find((o) => o.id === optionId) ?? null;

  const scenarioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  /* 报告出来之后把焦点交给它：读屏用户不会还停在「开始推演」上 */
  useEffect(() => {
    if (phase === "report" && reportRef.current) {
      reportRef.current.focus({ preventScroll: false });
    }
  }, [phase]);

  const build = (): Report => {
    if (!scenario || !option) throw new Error("推演前必须有场景与做法");
    return {
      id: reportId(),
      scenario: scenario.short,
      option: option.label,
      verdict: option.verdict,
      findings: option.findings,
      advice: option.advice,
    };
  };

  const start = () => {
    if (!scenario || !option || ritual.busy) return;
    ritual.run(3600, config.ritual.length, () => setReport(build()));
  };

  const reset = () => {
    ritual.reset();
    setReport(null);
    setOptionId(null);
    setScenarioId(null);
  };

  const ready = !!scenario && !!option;

  return (
    <div className="grid gap-6 tab:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] tab:gap-8">
      {/* ---------------- 左：推演台 ---------------- */}
      <div className="dou-hud rounded-panel p-5 md:p-7">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-accent-text/80">
          {config.formTitle}
        </p>

        {/* 第一步：场景 */}
        <fieldset disabled={ritual.busy} className="mt-4">
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-text">{config.scenarioLabel}</span>
            <span className="text-[11px] text-muted">{config.hint}</span>
          </legend>

          <div
            role="radiogroup"
            aria-label={config.scenarioLabel}
            className="mt-3 grid gap-2"
          >
            {scenarios.map((s, i) => {
              const on = s.id === scenarioId;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    scenarioRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={ritual.busy}
                  onClick={() => {
                    setScenarioId(s.id);
                    setOptionId(null);
                  }}
                  onKeyDown={(e) => handleArrow(e, i, scenarios.length, scenarioRefs)}
                  className={`min-h-[2.5rem] rounded-[3px] border px-3 py-2 text-left text-[13px] leading-snug transition duration-fast ease-ease disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    on
                      ? "border-[rgb(0_196_214_/_0.6)] bg-[rgb(0_196_214_/_0.12)] text-text"
                      : "border-hairline text-text/80 hover:border-accent/50 hover:bg-white/[0.03]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 情境描述：选了场景才出现，别让人先读五段背景 */}
        {scenario ? (
          <p className="mt-3 border-l-2 border-[rgb(0_196_214_/_0.45)] pl-3 text-[12.5px] leading-relaxed text-muted">
            {scenario.brief}
          </p>
        ) : null}

        {/* 第二步：做法 */}
        <fieldset disabled={ritual.busy || !scenario} className="mt-5">
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-text">{config.optionLabel}</span>
            <span className="text-[11px] text-muted">{config.optionHint}</span>
          </legend>

          {scenario ? (
            <div role="radiogroup" aria-label={config.optionLabel} className="mt-3 grid gap-2">
              {scenario.options.map((o, i) => {
                const on = o.id === optionId;
                return (
                  <button
                    key={o.id}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={ritual.busy}
                    onClick={() => setOptionId(o.id)}
                    onKeyDown={(e) => handleArrow(e, i, scenario.options.length, optionRefs)}
                    className={`rounded-[3px] border px-3 py-2.5 text-left transition duration-fast ease-ease disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      on
                        ? "border-[rgb(0_196_214_/_0.6)] bg-[rgb(0_196_214_/_0.12)]"
                        : "border-hairline hover:border-accent/50 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                          on ? "border-[rgb(0_229_255)]" : "border-hairline-strong"
                        }`}
                      >
                        {on ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(0_229_255)]" />
                        ) : null}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium leading-snug text-text">
                          {o.label}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                          {o.price}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-[3px] border border-dashed border-hairline px-3 py-4 text-[12px] text-muted">
              {config.idleHint}
            </p>
          )}
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={!ready || ritual.busy}
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-pill bg-[rgb(0_196_214)] px-6 text-[13.5px] font-semibold text-[rgb(6_20_32)] transition duration-fast ease-ease hover:bg-[rgb(0_214_232)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {ritual.busy ? "推演中…" : config.startLabel}
          </button>
          <span className="text-[12px] text-muted">
            {ready ? `${config.pickedHint} · ${option?.label}` : config.idleHint}
          </span>
        </div>
      </div>

      {/* ---------------- 右：推演读数 ---------------- */}
      <div
        ref={reportRef}
        tabIndex={-1}
        aria-live="polite"
        className="dou-readout flex min-h-[26rem] flex-col p-5 md:p-7 focus:outline-none"
      >
        {phase === "idle" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-accent-text/80">
                {config.report.title}
              </span>
              <span className="rounded-pill border border-hairline px-2 py-0.5 text-[10px] tracking-widest text-muted">
                {config.sampleNote}
              </span>
            </div>

            <p className="mt-4 text-[15px] font-medium text-text">{config.report.idleTitle}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {config.report.idleNote}
            </p>

            {/* 空态也给「结构」：两段虚线，写满了就是报告 */}
            <div aria-hidden="true" className="mt-6 space-y-5">
              {[config.report.findingsLabel, config.report.adviceLabel].map((label, gi) => (
                <div key={label}>
                  <p className="text-[11px] tracking-[0.22em] text-accent-text/60">{label}</p>
                  <ul className="mt-2 space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <li
                        key={i}
                        className="h-3 rounded-full bg-white/[0.06]"
                        style={{ width: `${84 - gi * 8 - i * 13}%` }}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mt-auto border-t border-hairline pt-3 text-[11px] leading-relaxed text-muted">
              {config.report.disclaimer}
            </p>
          </>
        ) : null}

        {phase === "ritual" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-accent-text/80">
                {config.report.title}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted">
                {String(step + 1).padStart(2, "0")} / {String(config.ritual.length).padStart(2, "0")}
              </span>
            </div>

            <div className="dou-readout-bar mt-5 overflow-hidden">
              <m.div
                initial={{ width: "3%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.6, ease: "linear" }}
                className="h-full rounded-pill bg-[rgb(0_229_255)]"
              />
            </div>

            <p className="mt-6 text-[15px] leading-relaxed text-text" aria-live="polite">
              {config.ritual[step]}
            </p>

            {/* 仪式期间那一小块「正在算」的矩阵：纯装饰，不进无障碍树 */}
            <div aria-hidden="true" className="mt-6 grid grid-cols-8 gap-1.5 opacity-60">
              {Array.from({ length: 32 }).map((_, i) => (
                <m.span
                  key={i}
                  initial={{ opacity: 0.15 }}
                  animate={{ opacity: [0.15, 0.7, 0.15] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: (i % 8) * 0.09 }}
                  className="h-2 rounded-[1px] bg-[rgb(0_196_214)]"
                />
              ))}
            </div>

            <p className="mt-auto text-[12px] text-muted">
              {option?.label} —— 正在把这个选择推到终点。
            </p>
          </>
        ) : null}

        {phase === "report" && report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-accent-text/80">
                {config.report.title}
              </span>
              <span className="font-mono text-[11px] tracking-wider text-muted">{report.id}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-pill border border-hairline px-2.5 py-1 text-[11px] text-text/75">
                {report.scenario}
              </span>
              <span className="rounded-pill border border-[rgb(0_196_214_/_0.5)] bg-[rgb(0_196_214_/_0.1)] px-2.5 py-1 text-[11px] text-accent-text">
                {report.option}
              </span>
            </div>

            <m.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, ease: [...EASE_OUT] }}
              className="mt-4 text-[15px] font-medium leading-relaxed text-text [text-wrap:pretty]"
            >
              {report.verdict}
            </m.p>

            <h4 className="mt-5 text-[11px] font-semibold tracking-[0.24em] text-accent-text/70">
              {config.report.findingsLabel}
            </h4>
            <ol className="mt-2 space-y-2">
              {report.findings.map((f, i) => (
                <m.li
                  key={f}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: DUR.base, ease: [...EASE_OUT], delay: 0.06 * i }}
                  className="flex gap-2 text-[13px] leading-relaxed text-text/90"
                >
                  <span className="font-mono text-[11px] text-accent-text/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{f}</span>
                </m.li>
              ))}
            </ol>

            <h4 className="mt-5 text-[11px] font-semibold tracking-[0.24em] text-accent-text/70">
              {config.report.adviceLabel}
            </h4>
            <ul className="mt-2 space-y-2">
              {report.advice.map((a, i) => (
                <m.li
                  key={a}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: DUR.base,
                    ease: [...EASE_OUT],
                    delay: 0.24 + 0.06 * i,
                  }}
                  className="flex gap-2 text-[13px] leading-relaxed text-text/90"
                >
                  <span aria-hidden="true" className="text-accent-text/80">
                    ›
                  </span>
                  <span>{a}</span>
                </m.li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              {config.report.disclaimer}
            </p>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={reset}
                className="min-h-[2.5rem] rounded-pill border border-hairline px-4 text-[13px] font-medium text-text/85 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {config.cta.again}
              </button>
              <a
                href={config.cta.crossHref}
                className="inline-flex min-h-[2.5rem] items-center rounded-pill border border-hairline px-4 text-[13px] font-medium text-text/85 transition duration-fast ease-ease hover:border-accent/60 hover:text-accent-text"
              >
                {config.cta.crossLabel}
              </a>
              <button
                type="button"
                onClick={() => scrollToId(config.cta.contactTarget)}
                className="inline-flex min-h-[2.5rem] items-center rounded-pill bg-[rgb(0_196_214)] px-4 text-[13px] font-semibold text-[rgb(6_20_32)] transition duration-fast ease-ease hover:bg-[rgb(0_214_232)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {config.cta.contactLabel}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
