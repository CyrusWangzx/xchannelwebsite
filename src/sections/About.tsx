/**
 * ⚠️ 当前未被引用（Cyrus 要求首页去掉「关于我们」区块）。
 * 组件与 content 里的 about 数据都保留着，需要恢复时在 App.tsx 的
 * 首页分支里把 <About /> 加回来即可。
 *
 * TODO: 关于我们区块
 * 素材需求：1 张 4:3 团队/产品照片（建议 1200×900，WebP 格式）
 * 眉题建议 ≤ 6 字，标题建议 ≤ 15 字，每段正文建议 50-80 字
 */
import Section from "../components/Section";
import Container from "../components/Container";
import PlaceholderBox from "../components/PlaceholderBox";
import Reveal, { STAGGER } from "../components/Reveal";
import { about } from "../content";

export default function About() {
  return (
    <Section id="about" ariaLabelledBy="about-title">
      {/* Section 只给垂直节奏，横向容器必须自己包，否则整块满宽贴边 */}
      <Container>
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* 图片占位 */}
          <Reveal delay={0}>
            <PlaceholderBox ratio="4:3" label="[占位] 团队/产品照片" />
          </Reveal>

          {/* 文字内容 */}
          <div>
            <Reveal delay={STAGGER}>
              <span className="mb-3 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
                {about.eyebrow}
              </span>
              <h2 id="about-title" className="text-h2">
                {about.title}
              </h2>
            </Reveal>

            {about.paragraphs.map((p, i) => (
              <Reveal key={i} delay={STAGGER * (i + 2)}>
                <p className="mt-4 text-body-lg text-muted">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
