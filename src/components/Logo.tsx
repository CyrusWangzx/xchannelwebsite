/**
 * 品牌标志
 *
 * 素材来源与处理：官方 logo 渲染图是「深色底 + 发光」的 3D 图，已按亮度通道抠像
 * 导出为带透明通道的 PNG / WebP（见 public/logo-*）。
 * 由于光晕在浅色底上会形成深色描边、白色字标也会失去对比度，
 * 浅色主题下由 .logo-plate 自动套一层深色容器以保证可读性
 * （容器只增加内边距，标志本身尺寸在两个主题下保持一致）。
 *
 * width / height 显式声明原始像素尺寸，用于占位防布局偏移（CLS）。
 */
import { brand } from "../content";

type LogoVariant = "lockup" | "mark";

interface LogoProps {
  /** lockup = 标记 + 字标（导航 / 页脚）｜ mark = 仅标记（窄屏 / 图标位） */
  variant?: LogoVariant;
  /** 图片加载策略：导航用 eager（首屏关键），页脚可传 lazy */
  loading?: "eager" | "lazy";
  /** 尺寸类名，作用在 <img> 上，例如 "h-8" */
  className?: string;
}

/* 原始像素尺寸，供 aspect-ratio 使用 */
const sources = {
  lockup: { w: 640, h: 161, base: "/logo-lockup" },
  mark: { w: 320, h: 330, base: "/logo-mark" },
} as const;

export default function Logo({
  variant = "lockup",
  loading = "eager",
  className = "",
}: LogoProps) {
  const { w, h, base } = sources[variant];

  return (
    <picture className="logo-plate inline-flex items-center">
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img
        src={`${base}.png`}
        alt={brand.name}
        width={w}
        height={h}
        loading={loading}
        decoding="async"
        className={`w-auto ${className}`}
      />
    </picture>
  );
}
