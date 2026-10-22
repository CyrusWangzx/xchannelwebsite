/* 滚动进入视口时淡入上移动画，基于 framer-motion whileInView。
   动效数值全部来自 src/lib/motion.ts，组件内不写字面值。 */
import type { ReactNode } from "react";
import { m } from "framer-motion";
import { EASE_OUT, STAGGER, VIEWPORT, fadeUp } from "../lib/motion";

/* 向后兼容：原有区块从本模块引入 STAGGER / EASE */
export const EASE = EASE_OUT;
export { STAGGER };

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: RevealProps) {
  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={{ ...VIEWPORT }}
      variants={fadeUp(delay)}
      className={className}
    >
      {children}
    </m.div>
  );
}
