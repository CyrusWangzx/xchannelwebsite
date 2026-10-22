/* 按钮组件：primary / secondary 两种变体，支持 href 渲染为 <a>
   色彩、圆角、位移全部来自令牌。

   对比度说明：primary 使用 accent-strong（#2563EB）承载白字，
   实测 4.83:1，达 WCAG AA；accent（#3B82F6）承白字仅 3.68:1，故不用于按钮底色。 */
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant: ButtonVariant;
  /** sm 用于导航等紧凑场景（仍保证 44px 触控高度）｜ md 为默认 */
  size?: ButtonSize;
  href?: string;
  /** 无 href 时的点击回调；有 href 时不生效（那是一个链接，不是按钮） */
  onClick?: () => void;
  /** 展开/收起类按钮的状态，透传给底层元素（Button 不自己管理状态） */
  ariaExpanded?: boolean;
  ariaControls?: string;
  children: ReactNode;
  className?: string;
}

const base =
  "inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-pill font-medium " +
  "transition duration-fast ease-ease " +
  "hover:[transform:translateY(var(--lift-sm))] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent-strong text-white shadow-card hover:shadow-glow",
  secondary:
    "border border-hairline bg-surface/40 text-text hover:border-accent/60 hover:text-accent",
};

export default function Button({
  variant,
  size = "md",
  href,
  onClick,
  ariaExpanded,
  ariaControls,
  children,
  className = "",
}: ButtonProps) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={cls}
    >
      {children}
    </button>
  );
}
