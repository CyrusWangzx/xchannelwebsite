/**
 * 三巨头名片（三页共用）
 *
 * 中间永远是「本人」，两侧是另外两位——红绳从左拉到右，穿过三枚图钉。
 * 悬停任意一张：另外两张压暗、这张抬起；红绳同时亮一档。
 * 压暗用的是 `background`/`opacity` 过渡，不是位移放大，避免三张卡互相挤。
 *
 * 红绳是一整条 SVG，横跨三张卡（`preserveAspectRatio="none"` 拉伸），
 * 描边用 `vector-effect="non-scaling-stroke"` 保住 1.5px——
 * 不加这条，非等比缩放会把线拉成一条粗细不均的带子。
 */
import { m } from "framer-motion";
import type { TrioMember } from "../types";
import { HOVER_LIFT } from "../../lib/motion";

interface TrioLinksProps {
  items: TrioMember[];
  /** 本页主人，会被放到中间并高亮 */
  selfSlug: string;
  /** 中央卡片上的小标注 */
  selfBadge: string;
  openLabel: string;
}

export default function TrioLinks({
  items,
  selfSlug,
  selfBadge,
  openLabel,
}: TrioLinksProps) {
  const self = items.find((i) => i.slug === selfSlug);
  const others = items.filter((i) => i.slug !== selfSlug);
  /* 三张卡：别人 / 自己 / 别人 —— 自己永远在中间 */
  const ordered = [others[0], self, others[1]].filter(Boolean) as TrioMember[];

  return (
    <div className="trio relative">
      {/* 红绳：位置对齐到每张卡顶部的图钉（卡片上边距 0 处） */}
      <svg
        aria-hidden="true"
        viewBox="0 0 300 40"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full"
      >
        <path
          d="M50 3 C 85 21, 115 21, 150 3 C 185 21, 215 21, 250 3"
          fill="none"
          stroke="rgb(var(--act-rope-rgb) / 0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="trio-rope"
        />
      </svg>

      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {ordered.map((item) => {
          const isSelf = item.slug === selfSlug;
          return (
            <m.a
              key={item.slug}
              href={item.href}
              data-self={isSelf ? "true" : "false"}
              whileHover={isSelf ? undefined : HOVER_LIFT}
              /* 三张卡顶边必须齐平：图钉挂在卡片上沿，红绳按图钉的高度拉，
                 一旦有人 mt-2 就会有半根绳子悬在空中。
                 本人的强调走「描边 + 阴影 + 内边距」，不靠位移。 */
              className="trio-card er-hud relative flex flex-col rounded-panel p-5
                data-[self=true]:md:py-7"
              style={
                isSelf
                  ? {
                      borderColor: "rgb(var(--c-accent-rgb) / 0.5)",
                      boxShadow:
                        "0 0 0 1px rgb(var(--c-accent-rgb) / 0.1), 0 26px 48px -34px rgb(0 0 0 / 0.95)",
                    }
                  : undefined
              }
            >
              {/* 图钉：红绳就是挂在它上面的 */}
              <span
                aria-hidden="true"
                className="act-pin absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              />

              <div className="flex items-baseline gap-2">
                <span
                  className={`text-h4 font-semibold ${isSelf ? "text-accent-text" : "text-text"}`}
                >
                  {item.name}
                </span>
                <span className="text-caption text-muted">{item.role}</span>
              </div>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                「{item.slogan}」
              </p>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                <span className="text-caption tracking-widest text-accent-text/80">
                  {isSelf ? selfBadge : openLabel}
                </span>
                <span aria-hidden="true" className="text-caption text-muted">
                  {isSelf ? "—" : "→"}
                </span>
              </div>
            </m.a>
          );
        })}
      </div>
    </div>
  );
}
