/**
 * 问诊机（ConsultEngine）—— 三页共用的一台状态机
 *
 * 三份 PRD 的「核心互动」其实是同一件事：
 *   ① 豆总：选场景 → 选做法 → 推演 → 决策报告
 *   ② 小金子：填 4 个资产数字 → 算账 → 审计报告
 *   ③ 二表哥：选症状 + 写主诉 → 把脉 → 诊断报告
 * 所以状态机只写一次，各页只交一份 schema（见 types.ts 的 ConsultConfig）。
 *
 *   idle ──(至少选 1 个症状)──▶ ritual ──(2.4~4s 分期文案)──▶ report ──(再来一次)──▶ idle
 *
 * 几条刻意的红线：
 * - **不发任何网络请求**。没有后端，也绝不假装接了 AI：报告底部固定一行
 *   「快速初诊，仅供参考」。用户点两次发现内容会变，是这个池子（30 + 20 条）的功劳，
 *   不是模型的功劳——这一点必须诚实。
 * - **多选真的会影响结果**：抽签按「轮转」从各选中症状的池子里各取一条，
 *   选三个症状不会只出第一个症状的内容。
 * - 仪式阶段可被 `prefers-reduced-motion` 直接跳过，不让晕动用户干等 4 秒。
 * - 报告出来后把焦点移到报告容器（`tabIndex=-1`），读屏用户不会还停在按钮上。
 */
import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import type { ConsultConfig } from "../types";
import { DUR, EASE_OUT } from "../../lib/motion";
import { scrollToId } from "../lib/scroll";
import { useRitual } from "../lib/useRitual";

interface Report {
  id: string;
  hard: boolean;
  symptoms: string[];
  findings: string[];
  advice: string[];
}

/* 洗牌：Fisher–Yates。抽签必须真随机，否则连点两次会看到同一份报告 */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 从多组池子里**轮转**抽取：A、B、C、A、B… 直到凑够 n 条。
 * 这样多选时每个症状都有份额，而不是「第一个症状的全集 + 别人的残渣」。
 */
function pickRoundRobin(groups: string[][], n: number): string[] {
  const pools = groups.map((g) => shuffle(g));
  const out: string[] = [];
  let i = 0;
  while (out.length < n && pools.some((p) => p.length > 0)) {
    const pool = pools[i % pools.length];
    const next = pool.shift();
    if (next && !out.includes(next)) out.push(next);
    i += 1;
  }
  return out;
}

function reportId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const seq = String(Math.floor(Math.random() * 90) + 10);
  return `D-${ymd}-${seq}`;
}

interface ConsultEngineProps {
  config: ConsultConfig;
}

export default function ConsultEngine({ config }: ConsultEngineProps) {
  /* 节奏交给共用状态机（见 lib/useRitual.ts）：这里只管「选了什么」和「报告长什么样」 */
  const ritual = useRitual();
  const { phase, step } = ritual;
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [levelId, setLevelId] = useState(config.levels[1]?.id ?? config.levels[0].id);
  const [report, setReport] = useState<Report | null>(null);

  const level = config.levels.find((l) => l.id === levelId) ?? config.levels[0];
  const levelIndex = Math.max(
    0,
    config.levels.findIndex((l) => l.id === level.id)
  );

  const reportRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const buildReport = (): Report => {
    const groups = config.symptoms.filter((s) => picked.includes(s.id));
    return {
      id: reportId(),
      hard: level.id === "hard",
      symptoms: groups.map((g) => g.short),
      findings: pickRoundRobin(
        groups.map((g) => g.findings),
        3
      ),
      advice: pickRoundRobin(
        groups.map((g) => g.advice),
        3
      ),
    };
  };

  const start = () => {
    if (picked.length === 0 || ritual.busy) return;
    ritual.run(level.ritual, config.ritual.length, () => setReport(buildReport()));
  };

  const reset = () => {
    ritual.reset();
    setReport(null);
  };

  /* 报告出来之后把焦点交给它：读屏用户不会还停在「开始诊断」上 */
  useEffect(() => {
    if (phase === "report" && reportRef.current) {
      reportRef.current.focus({ preventScroll: false });
    }
  }, [phase]);

  return (
    <div className="grid gap-6 tab:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] tab:gap-8">
      {/* ---------------- 左：填单 ---------------- */}
      <div className="er-paper relative rounded-panel p-5 md:p-7">
        {/* 纸张顶部的胶带 */}
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-[-1.5deg] rounded-[1px] bg-[rgb(214_188_140_/_0.75)] shadow-sm"
        />

        <fieldset disabled={phase === "ritual"}>
          <legend className="text-[11px] font-semibold tracking-[0.28em] text-[rgb(120_96_66)]">
            {config.formTitle}
          </legend>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-serif text-xl font-semibold md:text-2xl">
              {config.symptomLabel}
            </h3>
            <p className="text-[12px] text-[rgb(120_100_74)]">{config.hint}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {config.symptoms.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  disabled={phase === "ritual"}
                  className={`rounded-pill border px-3 py-2 text-left text-[13px] leading-snug transition duration-fast ease-ease disabled:opacity-50 ${
                    on
                      ? "border-[rgb(120_96_66)] bg-[rgb(56_43_30)] text-[rgb(240_232_220)]"
                      : "border-[rgb(140_116_86_/_0.45)] bg-transparent text-[rgb(70_54_38)] hover:border-[rgb(120_96_66)]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* 主诉 */}
          <div className="mt-6">
            <label
              htmlFor="er-note"
              className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-[rgb(70_54_38)]"
            >
              {config.input.label}
              <span className="text-[11px] font-normal text-[rgb(120_100_74)]">
                {config.input.optional}
              </span>
            </label>
            <textarea
              id="er-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={phase === "ritual"}
              placeholder={config.input.placeholder}
              className="mt-2 w-full resize-y rounded-[4px] border border-[rgb(140_116_86_/_0.5)] bg-[rgb(255_252_244_/_0.55)] px-3 py-2 text-[13px] leading-relaxed text-[rgb(56_43_30)] placeholder:text-[rgb(140_120_92)] focus:border-[rgb(120_96_66)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[rgb(120_96_66)]"
            />
          </div>

          {/* 难度：原生 range，键盘可达，不用自绘滑块 */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-[rgb(70_54_38)]">
                {config.levelsLabel}
              </span>
              <span className="text-[12px] text-[rgb(120_100_74)]">{level.note}</span>
            </div>
            <input
              type="range"
              min={0}
              max={config.levels.length - 1}
              step={1}
              value={levelIndex}
              disabled={phase === "ritual"}
              aria-label={config.levelsLabel}
              aria-valuetext={level.label}
              onChange={(e) => setLevelId(config.levels[Number(e.target.value)].id)}
              className="er-range mt-3 w-full"
            />
            <div className="mt-1 flex justify-between text-[11px] text-[rgb(120_100_74)]">
              {config.levels.map((l) => (
                <span key={l.id}>{l.label}</span>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={picked.length === 0 || phase === "ritual"}
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-pill bg-[rgb(56_43_30)] px-6 font-medium text-[rgb(240_232_220)] transition duration-fast ease-ease hover:bg-[rgb(72_56_40)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(120_96_66)]"
          >
            {phase === "ritual" ? "把脉中…" : config.startLabel}
          </button>
          {picked.length === 0 ? (
            <span className="text-[12px] text-[rgb(120_100_74)]">
              先点一个症状
            </span>
          ) : (
            <span className="text-[12px] text-[rgb(120_100_74)]">
              已选 {picked.length} 项
            </span>
          )}
        </div>
      </div>

      {/* ---------------- 右：报告 ---------------- */}
      <div
        ref={reportRef}
        tabIndex={-1}
        aria-live="polite"
        className="er-paper relative flex min-h-[26rem] flex-col rounded-panel p-5 md:p-7 focus:outline-none"
      >
        {phase === "idle" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-[rgb(120_96_66)]">
                {config.report.title}
              </span>
              <span className="er-stamp rounded-[3px] px-2 py-1 text-[11px] font-semibold">
                {config.report.stamp}
              </span>
            </div>

            <p className="mt-4 font-serif text-[15px] font-semibold text-[rgb(56_43_30)]">
              {config.report.idleTitle}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[rgb(120_100_74)]">
              {config.report.idleNote}
            </p>

            {/* 空报告单也要有「表格结构」：两个小节各几条虚线，写着写着就填满了。
                纯装饰，不进无障碍树。 */}
            <div aria-hidden="true" className="mt-6 space-y-5">
              {[config.report.findingsLabel, config.report.adviceLabel].map(
                (label, gi) => (
                  <div key={label}>
                    <p className="text-[11px] tracking-[0.22em] text-[rgb(120_96_66)]">
                      {label}
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {[0, 1, 2].map((i) => (
                        <li
                          key={i}
                          className="h-3 rounded-full bg-[rgb(120_96_66_/_0.13)]"
                          style={{ width: `${86 - gi * 6 - i * 12}%` }}
                        />
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>

            {/* mt-auto：把免责声明压到纸的底边，空态才不会在下面留一大块白 */}
            <p className="mt-auto border-t border-[rgb(140_116_86_/_0.3)] pt-3 text-[11px] leading-relaxed text-[rgb(120_100_74)]">
              {config.report.disclaimer}
            </p>
          </>
        ) : null}

        {phase === "ritual" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-[rgb(120_96_66)]">
                {config.report.title}
              </span>
              <span className="text-[11px] text-[rgb(120_100_74)]">
                {String(step + 1).padStart(2, "0")} / {String(config.ritual.length).padStart(2, "0")}
              </span>
            </div>

            {/* 进度条：宽度靠 CSS transition 走完 duration，不用 rAF */}
            <div className="mt-6 h-1 w-full overflow-hidden rounded-pill bg-[rgb(120_96_66_/_0.2)]">
              <m.div
                initial={{ width: "4%" }}
                animate={{ width: "100%" }}
                transition={{ duration: level.ritual / 1000, ease: "linear" }}
                className="h-full rounded-pill bg-[rgb(120_96_66)]"
              />
            </div>

            <p className="mt-6 font-serif text-lg" aria-live="polite">
              {config.ritual[step]}
            </p>

            <div aria-hidden="true" className="er-ruled mt-6 h-32 opacity-50" />
            <p className="text-[12px] text-[rgb(120_100_74)]">
              听诊器已经搭上去了，别催。
            </p>
          </>
        ) : null}

        {phase === "report" && report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-[rgb(120_96_66)]">
                {config.report.title}
              </span>
              <span className="font-mono text-[11px] tracking-wider text-[rgb(120_100_74)]">
                {report.id}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {report.symptoms.map((s) => (
                <span
                  key={s}
                  className="rounded-pill border border-[rgb(140_116_86_/_0.5)] px-2.5 py-1 text-[11px] text-[rgb(90_70_48)]"
                >
                  {s}
                </span>
              ))}
            </div>

            <m.h4
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, ease: [...EASE_OUT] }}
              className="mt-5 font-serif text-base font-semibold text-[rgb(56_43_30)]"
            >
              {config.report.findingsLabel}
            </m.h4>
            <ol className="mt-2 space-y-2">
              {report.findings.map((f, i) => (
                <m.li
                  key={f}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: DUR.base,
                    ease: [...EASE_OUT],
                    delay: 0.06 * i,
                  }}
                  className="flex gap-2 text-[13px] leading-relaxed"
                >
                  <span className="font-mono text-[11px] text-[rgb(120_96_66)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{f}</span>
                </m.li>
              ))}
            </ol>

            <m.h4
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.base, ease: [...EASE_OUT], delay: 0.24 }}
              className="mt-5 font-serif text-base font-semibold text-[rgb(56_43_30)]"
            >
              {config.report.adviceLabel}
            </m.h4>
            <ul className="mt-2 space-y-2">
              {report.advice.map((a, i) => (
                <m.li
                  key={a}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: DUR.base,
                    ease: [...EASE_OUT],
                    delay: 0.3 + 0.06 * i,
                  }}
                  className="flex gap-2 text-[13px] leading-relaxed"
                >
                  <span aria-hidden="true" className="text-[rgb(120_96_66)]">
                    +
                  </span>
                  <span>{a}</span>
                </m.li>
              ))}
            </ul>

            {report.hard ? (
              <p className="mt-4 border-l-2 border-[rgb(155_59_47_/_0.6)] pl-3 text-[12px] leading-relaxed text-[rgb(120_80_60)]">
                {config.report.hardNote}
              </p>
            ) : null}

            <p className="mt-4 text-[11px] leading-relaxed text-[rgb(120_100_74)]">
              {config.report.disclaimer}
            </p>

            {/* 章：压下去的一瞬间有一下缩放，像真盖上去 */}
            <m.span
              aria-hidden="true"
              initial={{ scale: 1.8, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 0.85, rotate: -7 }}
              transition={{ duration: 0.34, ease: [...EASE_OUT], delay: 0.5 }}
              className="er-stamp pointer-events-none absolute bottom-5 right-5 rounded-[3px] px-2.5 py-1 text-[11px] font-semibold"
            >
              {config.report.stamp}
            </m.span>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-[rgb(140_116_86_/_0.35)] pt-4">
              <button
                type="button"
                onClick={reset}
                className="min-h-[2.5rem] rounded-pill border border-[rgb(120_96_66_/_0.55)] px-4 text-[13px] font-medium text-[rgb(70_54_38)] transition duration-fast ease-ease hover:bg-[rgb(120_96_66_/_0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(120_96_66)]"
              >
                {config.cta.again}
              </button>
              <a
                href={config.cta.crossHref}
                className="inline-flex min-h-[2.5rem] items-center rounded-pill bg-[rgb(56_43_30)] px-4 text-[13px] font-medium text-[rgb(240_232_220)] transition duration-fast ease-ease hover:bg-[rgb(72_56_40)]"
              >
                {config.cta.crossLabel}
              </a>
              <button
                type="button"
                onClick={() => scrollToId(config.cta.contactTarget)}
                className="inline-flex min-h-[2.5rem] items-center rounded-pill border border-[rgb(120_96_66_/_0.55)] px-4 text-[13px] font-medium text-[rgb(70_54_38)] transition duration-fast ease-ease hover:bg-[rgb(120_96_66_/_0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(120_96_66)]"
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
