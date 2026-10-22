/* 内容居中容器——宽度与内边距均走令牌 */
import type { ReactNode } from "react";

type ContainerSize = "content" | "wide";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  /** content = 1200px（默认，适合正文叙事）｜ wide = 1440px（适合高密度网格） */
  size?: ContainerSize;
}

const sizes: Record<ContainerSize, string> = {
  content: "max-w-content",
  wide: "max-w-wide",
};

export default function Container({
  children,
  className = "",
  size = "content",
}: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full ${sizes[size]} px-4 xs:px-5 md:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
