/**
 * 页内跳转
 *
 * ⚠️ 这套站点的 hash 有两套语义：以 `/` 开头的是路由，其余是**首页锚点**。
 * 所以个人主页里的「跳到第 3 屏」绝不能写成 `<a href="#er-consult">`——
 * 那个 hash 会被 parseHash 判定成首页锚点，一点就跳回首页了。
 * 这里统一用 scrollIntoView，配合全局 `scroll-padding-top: var(--nav-h)`，
 * 滚到位时不会被固定导航盖住。
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  el.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });

  /* 焦点一起带过去：键盘用户按了「跳到报告」之后，Tab 不该还从页面顶上开始 */
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
