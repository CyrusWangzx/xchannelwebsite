/* 主题开关：深色 / 浅色互切
   状态由 src/lib/theme.ts 统一管理，配色本身仍来自 index.css 的变量覆盖。 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      /* 语义：这是一个开/关「深色模式」的切换按钮，按下态即深色生效 */
      aria-label="深色模式"
      aria-pressed={isDark}
      title={isDark ? "切换到浅色主题" : "切换到深色主题"}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-hairline bg-surface/40 text-muted transition duration-fast ease-ease hover:border-brand-edge/45 hover:text-brand-edge ${className}`}
    >
      {isDark ? (
        <Moon size={18} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Sun size={18} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
