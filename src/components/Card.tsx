/* 卡片容器：表面色 + 细描边 + 悬停抬升
   描边走 hairline（真实 8% 细线），抬升位移与阴影走 .lift 工具类。 */
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`lift rounded-card border border-hairline bg-surface shadow-card hover:border-accent/40 ${className}`}
    >
      {children}
    </div>
  );
}
