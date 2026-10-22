/**
 * 特别鸣谢（页面最下方，页脚之上的最后一块内容）
 *
 * 只放合作方 logo，不写感谢词——鸣谢理由尚未确定，编一句反而是负担。
 * logo 素材出自合作方给的截图，已经裁切去底（详见 public/thanks-*.webp）。
 *
 * 版面：眉题 + 一行说明保持与其他区块同源；logo 居中、可横向换行，
 * 之后要加第二、第三个合作方，只需要往 content.ts 的 partners 里追加。
 */
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Reveal, { STAGGER } from "../components/Reveal";
import { specialThanks } from "../content";

export default function SpecialThanks() {
  const { eyebrow, title, partners, logoAltTemplate } = specialThanks;

  return (
    <Section id="thanks" spacing="compact" ariaLabelledBy="thanks-title">
      <Container>
        <SectionTitle
          eyebrow={eyebrow}
          title={title}
          id="thanks-title"
        />

        <ul className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {partners.map((partner, i) => {
            /* 素材自带白色底板；圆角裁的是图本身，不需要再套一层卡片。
               高度默认 h-12/md:h-14，个别方形图标可用 content.ts 的
               `heightClass` 单独调大一档（w-auto / rounded-lg 始终保留）。 */
            const plate = (
              <img
                src={partner.logo}
                alt={logoAltTemplate.replace("{name}", partner.name)}
                loading="lazy"
                decoding="async"
                className={`w-auto rounded-lg ${
                  partner.heightClass ?? "h-12 md:h-14"
                }`}
              />
            );

            return (
              <li key={partner.name}>
                <Reveal delay={i * STAGGER}>
                  {partner.href ? (
                    <a
                      href={partner.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-lg transition duration-base ease-ease hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      {plate}
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded-lg">
                      {plate}
                    </span>
                  )}
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
