/**
 * ⚠️ 当前未被引用（Cyrus 要求首页去掉「数据」区块）。
 * 组件与 content 里的 stats 数据都保留着，需要恢复时在 App.tsx 的
 * 首页分支里把 <Stats /> 加回来即可。
 *
 * TODO: 数据统计区块
 * Phase 2 可加入 count-up 数字滚动动画
 * 每项数值建议 ≤ 6 字符（含单位），标签建议 ≤ 6 字
 */
import Section from "../components/Section";
import Container from "../components/Container";
import Reveal, { STAGGER } from "../components/Reveal";
import { stats } from "../content";

export default function Stats() {
  return (
    <Section id="stats" ariaLabelledBy="stats-title">
      {/* Section 只给垂直节奏，横向容器必须自己包，否则数字会贴到视口边缘 */}
      <Container>
        <h2 id="stats-title" className="sr-only">[占位] 数据统计</h2>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * STAGGER} className="text-center">
              <div className="text-h2 text-accent">{s.value}</div>
              <div className="mt-2 text-muted">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
