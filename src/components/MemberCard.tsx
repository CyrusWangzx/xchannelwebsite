/**
 * X.形象 · 成员卡片
 *
 * 点击进入该成员的个人主页（内容留空，见 MemberPage）。
 *
 * 视觉上的两个关键决定：
 * 1. 肖像用 object-contain 放在固定 3:4 的深色底上。
 *    11 张素材的比例差别很大（白熊、小金子坐姿很宽，豆总、落叶很瘦高），
 *    用 cover 会裁掉角色，contain 才能保证每个角色都完整、且视觉重量一致。
 * 2. 悬停时肖像轻微放大 + 背后透出一团主题色柔光，
 *    玻璃卡片本身靠 .glass-liquid-hover 变厚，三层反馈叠在一起。
 */
import { m } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { personaSection } from "../content";
import { memberHref } from "../lib/router";
import { DUR, EASE_OUT } from "../lib/motion";

interface MemberCardProps {
  slug: string;
  name: string;
  /** 可选：真实身份没到位时不传，卡片就只显示名字（不再用「[占位] 身份」凑数） */
  role?: string;
  portrait: string;
  /** 白墨线稿（默子）：浅色主题下由 .portrait-ink 反相成黑墨 */
  ink?: boolean;
}

export default function MemberCard({ slug, name, role, portrait, ink }: MemberCardProps) {
  return (
    <m.a
      href={memberHref(slug)}
      whileHover={{ y: -6 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT }}
      className="glass-liquid glass-liquid-hover group block overflow-hidden rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {/* 角色背后的主题色柔光，悬停时增强 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-base ease-ease group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(58% 42% at 50% 62%, rgb(var(--c-accent-rgb) / 0.22), transparent 72%)",
          }}
        />
        <img
          src={portrait}
          alt={personaSection.portraitAlt.replace("{name}", name)}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full scale-100 object-contain p-3 transition-transform duration-slow ease-ease group-hover:scale-[1.04] ${
            ink ? "portrait-ink" : ""
          }`}
        />
        {/* 右上角箭头：暗示可以点进去 */}
        <span
          aria-hidden="true"
          className="media-control absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-pill opacity-0 transition-opacity duration-fast ease-ease group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <ArrowUpRight size={15} strokeWidth={2} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-3">
        <div className="min-w-0">
          {/* 名字**不截断**：「默子要早睡」在 390 宽的两列里只有 ~110px 可用，
              truncate 会把它切成「默子要…」。宁可折行也不切名字。 */}
          <h3 className="text-h4 leading-snug break-words">{name}</h3>
          {role ? <p className="truncate text-caption text-muted">{role}</p> : null}
        </div>
        {/* 「查看主页」是悬停提示：触屏没有 hover，占着位置只会挤名字，所以窄屏直接不渲染 */}
        <span className="hidden shrink-0 text-caption text-muted opacity-0 transition-opacity duration-fast ease-ease group-hover:opacity-100 md:inline">
          {personaSection.openHint}
        </span>
      </div>
    </m.a>
  );
}
