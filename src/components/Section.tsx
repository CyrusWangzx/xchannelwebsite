/* 通用区块容器，带 id 用于锚点跳转。
   注意：本组件只负责语义外壳与垂直节奏，不含横向容器——
   需要在内部自行包 <Container>，以便不同区块自行选择 content / wide 宽度。 */
import type { ReactNode } from "react";

type SectionSpacing = "compact" | "default" | "loose";

interface SectionProps {
  id: string;
  children: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
  /** 叙事节奏档位，避免各处 ad-hoc 写 py-* */
  spacing?: SectionSpacing;
}

const spacings: Record<SectionSpacing, string> = {
  compact: "py-14 md:py-20",
  default: "py-20 md:py-28",
  loose: "py-24 md:py-36",
};

export default function Section({
  id,
  children,
  className = "",
  ariaLabelledBy,
  spacing = "default",
}: SectionProps) {
  return (
    <section
      id={id}
      className={`${spacings[spacing]} ${className}`}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </section>
  );
}
