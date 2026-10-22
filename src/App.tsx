/**
 * 应用外壳 + 极简哈希路由
 *
 * 视图：
 *   home            首页（首屏 + 行动号召）
 *   persona/media/games/token/materials
 *                   导航上那五个板块，**各自独立成页**
 *                   （materials 是抽屉展览馆，见 sections/Materials.tsx）
 *   member          某个成员的个人主页（内容留空）
 *
 * 注意 <main id="main"> 只由这里渲染一次：
 * MemberPage 自己就是一个 <main>，所以两条分支互斥，不能再套一层。
 *
 * 首页曾经还有「核心能力 / 数据 / 关于我们」三个区块，Cyrus 要求去掉，
 * 组件与数据仍留在仓库里（sections/Features|Stats|About.tsx + content 里的
 * features/stats/about），需要恢复时把 import 与渲染加回来即可。
 */
import Nav from "./sections/Nav";
import Hero from "./sections/Hero";
import Persona from "./sections/Persona";
import Showcase from "./sections/Showcase";
import PlaceholderSection from "./sections/PlaceholderSection";
import Materials from "./sections/Materials";
import Games from "./sections/Games";
import WishingWell from "./sections/WishingWell";
import Cta from "./sections/Cta";
import MemberPage from "./sections/MemberPage";
import SpecialThanks from "./sections/SpecialThanks";
import Footer from "./sections/Footer";
import {
  brand,
  memberPage,
  members,
  navLinks,
  tokenSection,
} from "./content";
import { useDocumentTitle, useHashRoute, useRouteScroll, type Route } from "./lib/router";

/** 标签页标题：由路由统一决定，避免各页面各写一份 useEffect 互相覆盖 */
function titleForRoute(route: Route): string {
  if (route.name === "member") {
    const member = members.find((m) => m.slug === route.slug);
    return member
      ? `${member.name} · ${brand.name}`
      : `${memberPage.notFoundTitle} · ${brand.name}`;
  }

  if (route.name === "home") return brand.name;

  const link = navLinks.find((l) => l.key === route.name);
  return link ? `${link.label} · ${brand.name}` : brand.name;
}

export default function App() {
  const route = useHashRoute();
  useRouteScroll(route);
  useDocumentTitle(titleForRoute(route));

  const page = (() => {
    switch (route.name) {
      case "member":
        return <MemberPage slug={route.slug ?? ""} />;

      case "persona":
        return (
          <main id="main">
            <Persona />
          </main>
        );

      case "media":
        return (
          <main id="main">
            <Showcase />
          </main>
        );

      case "games":
        return (
          <main id="main">
            <Games />
          </main>
        );

      case "token":
        return (
          <main id="main">
            <PlaceholderSection id="token" {...tokenSection} />
          </main>
        );

      case "materials":
        return (
          <main id="main">
            <Materials />
          </main>
        );

      default:
        return (
          <main id="main">
            <Hero />
            {/* 许愿池：夹在 Hero 末尾的轮播图与 Cta（加入我们）之间。
                3D 是懒加载的，首屏不会为它建 WebGL context。 */}
            <WishingWell />
            <Cta />
          </main>
        );
    }
  })();

  return (
    <>
      {/* 跳转链接：无障碍 */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        跳到主要内容
      </a>

      <Nav />

      {/* 水印层：整块包住主内容与页脚，让平铺连续、不在区块交界处出现接缝 */}
      <div className="watermark">
        {page}
        {/* 特别鸣谢放在页脚之上，作为页面最下方的最后一块内容 */}
        <SpecialThanks />
        <Footer />
      </div>
    </>
  );
}
