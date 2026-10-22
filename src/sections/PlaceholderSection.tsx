/**
 * 占位页面（X.游戏 #/games / X.Token #/token 复用）
 *
 * 这两个板块目前只有导航入口、还没有内容，所以刻意做成一个「明确的空面板」，
 * 而不是塞编造的内容。面板本身走液态玻璃，视觉上与已完成的区块同源。
 *
 * 这一块现在是**整页内容**，所以标题按页面主标题渲染（h1）。
 */
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Reveal from "../components/Reveal";

interface PlaceholderSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  emptyText: string;
}

export default function PlaceholderSection({
  id,
  eyebrow,
  title,
  description,
  emptyText,
}: PlaceholderSectionProps) {
  return (
    <Section id={id} ariaLabelledBy={`${id}-title`}>
      <Container>
        <SectionTitle
          eyebrow={eyebrow}
          title={title}
          description={description}
          id={`${id}-title`}
          as="h1"
        />
        <Reveal>
          <div className="glass-liquid mx-auto flex min-h-[12rem] max-w-2xl items-center justify-center rounded-panel p-8 text-center">
            <p className="text-muted">{emptyText}</p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
