/**
 * 仪式状态机：idle → ritual → report
 *
 * 三页共用同一段节奏 —— 选东西、等一会儿（2.4~4s 分期文案）、拿结果。
 * 二表哥是「把脉」，豆总是「推演」，小金子是「算账」，节奏与结构完全一样，
 * 所以定时器逻辑只写这一次，各页只交自己的皮肤和文案。
 *
 * 三条刻意的红线：
 * - `run()` 里**先清旧定时器**：连点两次不会留下两条并行的计时链。
 * - `prefers-reduced-motion` 下**直接落 report**，不让晕动用户干等 4 秒。
 * - 卸载时把没跑完的定时器全掐掉，否则切页之后还在背后改 state。
 *
 * ⚠️ `finish` 用 ref 存：调用方传进来的多半是个依赖当前 state 的闭包
 * （例如 `() => setReport(buildReport())`，buildReport 要读 `picked`）。
 * 如果每帧都换引用，hook 里的 timer 会捕获到旧闭包 —— 报告就会用上一次的选择。
 * 这里只取「调用那一刻」的引用，正好是要的语义。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export type RitualPhase = "idle" | "ritual" | "report";

export function useRitual() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<RitualPhase>("idle");
  const [step, setStep] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishRef = useRef<() => void>(() => {});

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  /**
   * @param duration 仪式总时长（毫秒）
   * @param steps    分期文案条数；最后一条落定即出结果
   * @param finish   落定时执行的副作用（生成结果）
   */
  const run = useCallback(
    (duration: number, steps: number, finish: () => void) => {
      clear();
      finishRef.current = finish;

      if (reduce) {
        finish();
        setPhase("report");
        return;
      }

      setPhase("ritual");
      setStep(0);

      const span = duration / Math.max(1, steps);
      for (let i = 1; i < steps; i += 1) {
        timers.current.push(setTimeout(() => setStep(i), span * i));
      }
      timers.current.push(
        setTimeout(() => {
          finishRef.current();
          setPhase("report");
        }, duration)
      );
    },
    [clear, reduce]
  );

  const reset = useCallback(() => {
    clear();
    setPhase("idle");
    setStep(0);
  }, [clear]);

  return { phase, step, run, reset, reduce, busy: phase === "ritual" };
}
