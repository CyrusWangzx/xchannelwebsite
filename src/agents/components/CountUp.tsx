/**
 * 数字滚动（countUp）
 *
 * 进入视口才开始数：不在首屏之外白跑 rAF。
 * `prefers-reduced-motion` 下直接落终值。
 *
 * 数字用等宽字体 + 千分位，位数变化时会跳宽——所以外面通常给一个
 * `min-w`/`tabular-nums` 的容器，别让「12 → 1,284」把整行推走。
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const EASE_OUT_CUBIC = (p: number) => 1 - Math.pow(1 - p, 3);

function format(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function CountUp({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  /* 进入视口一次就武装 */
  useEffect(() => {
    const el = ref.current;
    if (!el || armed) return;
    if (reduce) {
      setShown(value);
      fromRef.current = value;
      setArmed(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed, reduce, value]);

  /* 武装之后，value 一变就从当前值滚过去（实时数据条用得到） */
  useEffect(() => {
    if (!armed) return;
    if (reduce) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(from + (value - from) * EASE_OUT_CUBIC(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [armed, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(shown)}
      {suffix}
    </span>
  );
}
