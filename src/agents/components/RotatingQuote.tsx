/**
 * 打字机轮播：一句打完停一会儿，再打下一句。
 *
 * 两页都要（二表哥的格言带、豆总的语录带），所以抽出来。
 * `key={index}` 让句子换的时候组件重建，从第一个字开始打。
 */
import { useEffect, useRef, useState } from "react";
import Typewriter from "./Typewriter";

export default function RotatingQuote({
  quotes,
  className = "",
  speed = 58,
  hold = 2400,
}: {
  quotes: string[];
  className?: string;
  speed?: number;
  hold?: number;
}) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const schedule = () => {
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % quotes.length), hold);
  };

  return (
    <p className={className}>
      <Typewriter key={index} text={quotes[index]} speed={speed} onDone={schedule} />
    </p>
  );
}
