/**
 * 顶部导航
 *
 * 五个板块：X.形象 / X.媒体 / X.游戏 / X.Token / X.收藏，**各自是独立页面**（#/persona 这类路由），
 * 点哪一项就整页切到哪一项；与成员主页的 `#/member/<slug>` 同属一套路由（见 lib/router.ts）。
 * 注意别再写成 `#persona` 那种首页锚点——那套已被路由接管（旧地址仍会升级到对应页面）。
 *
 * 液态玻璃：整条导航始终是一块玻璃（而不是「滚动了才变玻璃」），
 * 这样在首屏就能看到它压着 Hero 的光斑做背景模糊——那才是玻璃的观感来源。
 * 滚动后只做两件事：高度收缩到 --nav-h-compact、阴影加深。
 *
 * 视觉（Cyrus 反馈「上方的 UI 栏设计感太差」，要求按 X.物料的设计风格重做）：
 *   旧版是「细网格 + 蓝色底线 + 一片同灰度的文字」——没有焦点，眼睛落不下去。
 *   这一版直接借用物料上已经成立的印刷语言：
 *     1. 网点底纹 .nav-dots —— 物料实拍里铺得最满的纹理（品牌黄，45° 网屏）
 *     2. 底边线 .nav-edge-bottom —— 一道黄胶带边，代替原来的蓝线
 *     3. 五个入口各一枚「印刷专色」——颜色的出场面积随交互长大：
 *        默认态只有一枚 5px 圆点（+ lg 以上的编号），悬停透出本色淡底，
 *        当前页整枚铺成本色的贴纸胶囊。色值分配见 index.css 的
 *        `.nav-item[data-key=…]`，令牌是 :root 的 --c-nav1..5。
 *   原来的「[占位] 开始」CTA 按钮已按要求去掉，主题开关保留。
 *
 * 响应式取舍：窄屏放不下「字标 + 5 个入口 + 主题开关」。
 * 所以 <md 用纯标记（Logo mark）顶掉字标，入口字号与内边距逐档放大。
 * 专色圆点只在 xs–tab 出现（≤360 收掉、lg 以上让位给编号），
 * 因此窄屏的「放得下」结论仍然成立（六档实测无横向溢出）。
 * 不收起任何导航入口——导航是这一版的主体，不能被折叠掉。
 */
import { useEffect, useState } from "react";
import Container from "../components/Container";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import { navLinks } from "../content";
import { homeHref, useHashRoute } from "../lib/router";

export default function Nav() {
  const route = useHashRoute();
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== "undefined" ? window.scrollY > 0 : false
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* 已经在首页时点 Logo，hash 不变、不会触发 hashchange，
     所以这里补一次「回顶」，否则用户会觉得点了没反应。 */
  const onLogoClick = () => {
    if (route.name === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      aria-label="主导航"
      className={`glass-liquid glass-liquid-strong sticky top-0 z-50 transition-[height,box-shadow] duration-base ease-ease ${
        scrolled ? "h-[var(--nav-h-compact)] shadow-card" : "h-[var(--nav-h)]"
      }`}
    >
      {/* 装饰层：物料网点的底纹 + 黄胶带边。都在内容之下、不参与交互。 */}
      <span aria-hidden="true" className="nav-dots" />
      <span aria-hidden="true" className="nav-edge-bottom" />

      <Container className="relative z-10 flex h-full items-center justify-between gap-2">
        {/* 品牌标志：回首页 */}
        <a
          href={homeHref}
          onClick={onLogoClick}
          aria-label="返回首页"
          className="shrink-0 rounded-sm transition duration-fast ease-ease hover:opacity-90"
        >
          <Logo variant="mark" className="h-6 xs:h-7 md:hidden" />
          <Logo variant="lockup" className="hidden h-8 md:block" />
        </a>

        {/* 五个板块入口（各自独立页面）——每个入口一枚「印刷专色」，
            颜色的出场面积随交互长大：默认态只有一枚圆点，悬停透出本色淡底，
            当前页整枚铺成本色的贴纸。色值分配见 index.css 的 .nav-item[data-key=…]。 */}
        <nav aria-label="板块导航" className="flex items-center gap-0.5 md:gap-1">
          {navLinks.map((link, index) => {
            const active = route.name === link.key;
            return (
              <a
                key={link.key}
                href={link.href}
                data-key={link.key}
                aria-current={active ? "page" : undefined}
                className={`nav-item group relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-1.5 py-1.5 text-[11px] font-medium xs:px-2 xs:text-xs md:gap-2 md:px-3 md:text-sm ${
                  active ? "nav-item-active" : "text-muted hover:text-text"
                }`}
              >
                {/* 专色圆点：默认态唯一常驻的颜色。
                    窄屏（≤360）收掉——那五枚圆点会把 360 的版面顶出去；
                    lg 以上编号出现，圆点退场，避免同一行两枚同色标记。 */}
                <span
                  aria-hidden="true"
                  className="nav-dot hidden shrink-0 xs:block lg:hidden"
                />

                {/* 入口编号：纯装饰，lg 以上才出现。颜色同样吃这枚专色。 */}
                <span
                  aria-hidden="true"
                  className="nav-index hidden font-mono text-[10px] tabular-nums tracking-widest lg:inline"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                {link.label}
              </a>
            );
          })}
        </nav>

        {/* 主题开关（原来的 CTA 按钮已去掉） */}
        <ThemeToggle />
      </Container>
    </header>
  );
}
