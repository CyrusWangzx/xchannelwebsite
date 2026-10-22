/* 区块标题组件：眉题 + 标题 + 描述
   标题层级可切换：首页各区块用 h2（默认）；
   四个功能页把自己的标题当作页面主标题，传 as="h1"。 */
import Reveal from "./Reveal";

interface SectionTitleProps {
  eyebrow: string;
  title: string;
  description?: string;
  id?: string;
  /** 可选：让标题块左对齐，用于非居中叙事区块 */
  align?: "center" | "left";
  /** 标题层级。独立页面应传 "h1"，首页区块保持默认 "h2" */
  as?: "h1" | "h2";
}

export default function SectionTitle({
  eyebrow,
  title,
  description,
  id,
  align = "center",
  as: Heading = "h2",
}: SectionTitleProps) {
  const centered = align === "center";

  return (
    <Reveal className={`mb-12 ${centered ? "text-center" : "text-left"}`}>
      {/* 眉题小标签 */}
      <span className="mb-3 inline-block rounded-pill bg-accent/10 px-3 py-1 text-caption font-semibold uppercase tracking-widest text-accent-bright">
        {eyebrow}
      </span>
      <Heading id={id} className="text-h2">
        {title}
      </Heading>
      {description && (
        <p
          className={`mt-4 max-w-2xl text-body-lg text-muted ${
            centered ? "mx-auto" : ""
          }`}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
