/**
 * X.媒体（独立页面 #/media）
 *
 * 两块内容：
 *   01 参与作品 —— 四个人各一张作品封面，封面用他们的 AI 形象；整卡可点，跳外部作品页。
 *   02 更多作品 —— 原来那三张 [占位] 卡，位置保留（内容没到之前不假装有）。
 *
 * 这一块现在是**整页内容**，所以标题按页面主标题渲染（h1）；
 * 「参与作品 / 更多作品」是页内的小节，用 h2，不跟导航的 5 个 label 抢位置。
 */
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Card from "../components/Card";
import PlaceholderBox from "../components/PlaceholderBox";
import MediaWorkCard from "../components/MediaWorkCard";
import Reveal, { STAGGER } from "../components/Reveal";
import { mediaSection, mediaWorks, members, showcase } from "../content";

export default function Showcase() {
  /* 形象从花名册里取 —— 同一个人只维护一份素材，媒体页不再存一份封面 */
  const works = mediaWorks
    .map((w) => ({ work: w, member: members.find((m) => m.slug === w.slug) }))
    .filter((x): x is { work: (typeof mediaWorks)[number]; member: (typeof members)[number] } =>
      Boolean(x.member)
    );

  return (
    <Section id="media" ariaLabelledBy="media-title">
      <Container>
        <SectionTitle
          eyebrow={mediaSection.eyebrow}
          title={mediaSection.title}
          description={mediaSection.description}
          id="media-title"
          as="h1"
        />

        {/* ---- 01 参与作品 ---- */}
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {works.map(({ work, member }, i) => (
            <Reveal key={work.slug} delay={(i % 2) * STAGGER}>
              <MediaWorkCard
                index={i + 1}
                work={work}
                portrait={member.portrait}
                ink={member.ink}
                labels={{
                  worksLabel: mediaSection.worksLabel,
                  linkReady: mediaSection.linkReady,
                  linkPending: mediaSection.linkPending,
                  profileLabel: mediaSection.profileLabel,
                }}
              />
            </Reveal>
          ))}
        </div>

        {/* ---- 02 更多作品（占位） ---- */}
        <section aria-labelledby="media-more-title" className="mt-16 md:mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-hairline pt-6">
            <h2 id="media-more-title" className="text-h3">
              {mediaSection.moreTitle}
            </h2>
            <p className="text-body text-muted">{mediaSection.moreNote}</p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {showcase.map((item, i) => (
              <Reveal key={item.title} delay={i * STAGGER}>
                <Card className="overflow-hidden">
                  <PlaceholderBox ratio={item.ratio} label={item.title} />
                  <div className="p-5">
                    <h3 className="text-h4">{item.title}</h3>
                    <p className="mt-2 text-caption text-muted">{item.desc}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      </Container>
    </Section>
  );
}
