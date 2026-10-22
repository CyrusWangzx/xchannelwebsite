/**
 * 极简哈希路由（零依赖）
 *
 * 为什么手写而不是装 react-router：
 * 站点只有这些视图——首页、五个功能页（X.形象 / X.媒体 / X.游戏 / X.Token / X.收藏）、
 * 以及成员个人主页。为这点需求引一个路由库不划算，而且项目有「不新增依赖」的长期约束。
 *
 * 两套 hash 必须严格分开：
 *   路由   `#/`、`#/persona`、`#/media`、`#/games`、`#/token`、`#/materials`、`#/member/<slug>`
 *   锚点   `#cta`、`#top` —— 只在首页内部滚动
 * 规则：以 `/` 开头的一律当路由；其余当锚点，并归属到首页。
 * 唯一的例外是五个板块的旧锚点（`#persona` 等）会被升级成对应页面，
 * 这样上一版留下的深链接不会失效。
 */
import { useEffect, useState } from "react";

/** 五个有独立页面的功能板块 */
export type PageName = "persona" | "media" | "games" | "token" | "materials";

export type RouteName = "home" | PageName | "member";

export interface Route {
  name: RouteName;
  /** 仅 member 路由有值 */
  slug?: string;
  /** 仅首页路由有值：页内锚点 */
  anchor?: string;
}

const PAGE_NAMES: PageName[] = [
  "persona",
  "media",
  "games",
  "token",
  "materials",
];
const SLUG_RE = /^[A-Za-z0-9_-]+$/;

/* 「中性锚点」：这些 id 在每个页面上都存在（跳转链接的 #main、页脚上方的 #thanks），
   点它们不应该换页。但纯函数没法定「当前在哪一页」，
   所以由调用方把当前路由名传进来兜底，让锚点落在原页面上。 */
const NEUTRAL_ANCHORS = new Set(["main", "thanks"]);

/** 旧版把功能板块做成首页锚点，这里做一次兼容升级 */
function asLegacyPage(anchor: string): PageName | null {
  return (PAGE_NAMES as string[]).includes(anchor) ? (anchor as PageName) : null;
}

export function parseHash(hash: string, fallback: RouteName = "home"): Route {
  const bare = (hash || "").replace(/^#/, "");

  if (bare.startsWith("/")) {
    const seg = bare.slice(1).split("/").filter(Boolean);
    if (seg.length === 0) return { name: "home" };

    if (seg[0] === "member") {
      return seg[1] && SLUG_RE.test(seg[1])
        ? { name: "member", slug: seg[1] }
        : { name: "home" };
    }

    if ((PAGE_NAMES as string[]).includes(seg[0])) {
      return { name: seg[0] as PageName };
    }

    return { name: "home" };
  }

  if (bare) {
    const legacy = asLegacyPage(bare);
    if (legacy) return { name: legacy };
    if (NEUTRAL_ANCHORS.has(bare)) return { name: fallback, anchor: bare };
  }

  return { name: "home", anchor: bare || undefined };
}

/** 成员个人主页地址 */
export function memberHref(slug: string): string {
  return `#/member/${slug}`;
}

/** 首页地址 */
export const homeHref = "#/";

/** 五个功能页的地址 */
export function pageHref(name: PageName): string {
  return `#/${name}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash)
  );

  useEffect(() => {
    /* 旧锚点被升级成页面后，把地址栏也一并纠正，
       否则 URL 停在 #persona 而页面已是 /persona，刷新与分享都会对不上。
       replaceState 不触发 hashchange，不会造成循环。 */
    const upgradeLegacyHash = () => {
      const bare = window.location.hash.replace(/^#/, "");
      const legacy = !bare.startsWith("/") && bare ? asLegacyPage(bare) : null;
      if (legacy) window.history.replaceState(null, "", pageHref(legacy));
    };

    const onChange = () =>
      setRoute((current) => parseHash(window.location.hash, current.name));

    upgradeLegacyHash();
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

/**
 * 路由切换后的滚动处理。
 *
 * - 首页 + 锚点 → 等一帧再滚到那个区块。
 *   必须等：hashchange 那一刻新页面还没挂载，getElementById 拿不到元素，
 *   锚点会静默失效、停在页面顶部。
 * - 其余情况（进成员页或四个功能页）→ 滚到顶，否则会停在上一页的滚动位置。
 */
export function useRouteScroll(route: Route): void {
  useEffect(() => {
    const { anchor } = route;

    if (!anchor) {
      /* 换页必须瞬时归顶：全局 scroll-behavior 是 smooth，
         用 auto 会变成「一路滚上去」的动画，页面切换会很怪。 */
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }

    const raf = requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [route]);
}

/** 浏览器标签页标题：由路由统一决定，避免各页面各写一份 useEffect 互相覆盖 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
