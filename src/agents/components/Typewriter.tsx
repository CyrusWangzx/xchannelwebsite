/**
 * 打字机
 *
 * 逐字打出（`Array.from` 按码点切，中文与 emoji 都不会被劈成半个），
 * 打完之后**光标一直闪**——这是打字机该有的样子，不是「打完了就完事」。
 * `prefers-reduced-motion` 下直接整句显示：对晕动敏感的用户来说，
 * 一个字一个字蹦出来是很折磨的。
 *
 * `loop` 打开时用于格言轮播：打完停 `holdMs`，再从头打一遍。
 * 轮播靠 `round` 计数重开一轮，而不是在定时器里嵌套定时器——
 * 后者清理起来很容易漏一个，切页之后背后还在打。
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface TypewriterProps {
  text: string;
  /** 每字间隔（毫秒） */
  speed?: number;
  /** 开打前的等待 */
  startDelay?: number;
  /** 打完后的停顿（仅 loop 时有意义） */
  holdMs?: number;
  loop?: boolean;
  caret?: boolean;
  className?: string;
  onDone?: () => void;
}

export default function Typewriter({
  text,
  speed = 42,
  startDelay = 0,
  holdMs = 2400,
  loop = false,
  caret = true,
  className = "",
  onDone,
}: TypewriterProps) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  const [count, setCount] = useState(reduce ? chars.length : 0);
  const [round, setRound] = useState(0);

  /* 回调放 ref：父组件每次渲染都会造一个新函数，进依赖数组会让字打成一顿一顿的 */
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduce) {
      setCount(chars.length);
      return;
    }

    setCount(0);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let hold: ReturnType<typeof setTimeout> | undefined;

    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= chars.length) {
          if (interval) clearInterval(interval);
          doneRef.current?.();
          if (loop) hold = setTimeout(() => setRound((r) => r + 1), holdMs);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
      if (hold) clearTimeout(hold);
    };
    /* chars.length 而非 chars：数组每次渲染都是新引用 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay, holdMs, loop, reduce, round]);

  return (
    <span className={className}>
      <span aria-hidden="true">{chars.slice(0, count).join("")}</span>
      {/* 完整句子留给读屏：逐字播报是噪音 */}
      <span className="sr-only">{text}</span>
      {caret ? <span className="act-caret" aria-hidden="true" /> : null}
    </span>
  );
}
