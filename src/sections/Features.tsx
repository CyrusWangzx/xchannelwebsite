/**
 * ⚠️ 当前未被引用（Cyrus 要求首页去掉「核心能力」区块）。
 * 组件与 content 里的 features 数据都保留着，需要恢复时在 App.tsx 的
 * 首页分支里把 <Features /> 加回来即可。
 *
 * TODO: 核心能力区块
 * 素材需求：若需自定义图标，替换 lucide 图标名（当前 sparkles/zap/layers/shield）
 * 每项标题建议 ≤ 10 字，描述建议 ≤ 30 字
 */
import { Sparkles, Zap, Layers, Shield } from "lucide-react";
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Card from "../components/Card";
import Reveal, { STAGGER } from "../components/Reveal";
import { features } from "../content";

/* 图标名 → lucide 组件映射 */
const iconMap = {
  sparkles: Sparkles,
  zap: Zap,
  layers: Layers,
  shield: Shield,
} as const;

export default function Features() {
  return (
    <Section id="features" ariaLabelledBy="features-title">
      {/* Section 只给垂直节奏，横向容器必须自己包，否则整块满宽贴边 */}
      <Container>
        <SectionTitle
          eyebrow="[占位] 核心能力"
          title="[占位] 我们能做什么"
          description="[占位] 简要描述你的核心能力或产品特性，建议不超过 40 字。"
          id="features-title"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = iconMap[f.icon];
            return (
              <Reveal key={f.title} delay={i * STAGGER}>
                <Card className="p-6">
                  <Icon size={28} className="text-accent" />
                  <h3 className="mt-4 text-h3">{f.title}</h3>
                  <p className="mt-2 text-muted">{f.desc}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
