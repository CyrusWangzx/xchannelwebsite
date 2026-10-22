/**
 * 主题令牌
 *
 * 配色与字体栈全部集中在 index.css 的 :root / [data-theme="light"]；
 * 这里只负责 <html data-theme> 的读取、切换与持久化。
 * 首屏防闪烁由 index.html 的内联脚本完成，本模块保持同一 storage key。
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** 必须与 index.html 内联脚本中的 key 保持一致 */
export const THEME_STORAGE_KEY = "xchannel-theme";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  /* 内联脚本已把最终主题写到 data-theme，直接读它即可避免二次闪烁 */
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** 应用主题，并同步浏览器 UI 主题色（取值来自 CSS 变量，不写死色值） */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue("--c-bg").trim();
    if (bg) meta.setAttribute("content", bg);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* 隐私模式 / 禁用存储时静默降级 */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
