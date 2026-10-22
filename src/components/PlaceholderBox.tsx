/* 图片占位块：令牌驱动的渐变表面 + 虚线边框，显示建议尺寸 */

/* 比例 → aspect class 映射 */
const ratioMap = {
  "16:9": { cls: "aspect-video", hint: "1920×1080" },
  "1:1": { cls: "aspect-square", hint: "800×800" },
  "4:3": { cls: "aspect-[4/3]", hint: "1200×900" },
} as const;

interface PlaceholderBoxProps {
  ratio: "16:9" | "1:1" | "4:3";
  label: string;
  className?: string;
}

export default function PlaceholderBox({
  ratio,
  label,
  className = "",
}: PlaceholderBoxProps) {
  const { cls, hint } = ratioMap[ratio];

  return (
    <div
      role="img"
      aria-label={`[占位] ${label} ${ratio}`}
      className={`surface-media flex flex-col items-center justify-center rounded-card border border-dashed border-hairline ${cls} ${className}`}
    >
      <span className="text-sm font-medium text-muted">[占位] {label}</span>
      <span className="mt-1 text-caption text-muted">
        {ratio} · 建议尺寸 {hint}
      </span>
    </div>
  );
}
