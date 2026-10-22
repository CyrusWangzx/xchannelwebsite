/**
 * X.形象 · 成员花名册（独立页面 #/persona）
 *
 * 11 位成员各占一张卡，点开进入个人主页（主页内容留空，见 MemberPage）。
 * 网格：手机 2 列 → md 3 列 → tab 4 列。
 *
 * 这一块现在是**整页内容**，所以标题按页面主标题渲染（h1）。
 */
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import MemberCard from "../components/MemberCard";
import Reveal, { STAGGER } from "../components/Reveal";
import { members, personaSection } from "../content";

export default function Persona() {
  return (
    <Section id="persona" ariaLabelledBy="persona-title">
      <Container>
        <SectionTitle
          eyebrow={personaSection.eyebrow}
          title={personaSection.title}
          description={personaSection.description}
          id="persona-title"
          as="h1"
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 tab:grid-cols-4 tab:gap-6">
          {members.map((member, i) => (
            /* 交错延迟按「列」循环，而不是按总序号累加：
               11 个成员如果线性累加，最后一张要等将近 1 秒才出现。 */
            <Reveal key={member.slug} delay={(i % 4) * STAGGER}>
              <MemberCard
                slug={member.slug}
                name={member.name}
                role={member.role}
                portrait={member.portrait}
                ink={member.ink}
              />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
