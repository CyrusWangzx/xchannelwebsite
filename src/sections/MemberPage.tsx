/**
 * 成员个人主页
 *
 * 目前所有成员的主页都还没建设，所以内容区**按 X.Token 的占位模式来**
 * （Cyrus 2026-10-21）：液态玻璃空面板里只放一句「XX 偷懒啦，主页还没建设好~」，
 * 下面跟一个「一键催促」按钮。
 *
 * 催促按钮是**纯点击反馈**：只在本组件里累加计数并换一句文案，
 * 不发请求、不落库、不假装「已通知本人」——刷新即归零。
 * 等真实主页做好后，把这块换成真内容即可（memberPage 的 lazyText 一并删掉）。
 *
 * 关键实现：必须支持「从 X.形象 点进某个成员」和「直接打开带 hash 的链接」两条路径，
 * 后者的滚动位置由 useRouteScroll 处理（否则会停在上一页的滚动位置）。
 * 标签页标题由 App 统一按路由设置，这里不再自己改 document.title。
 */
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Button from "../components/Button";
import Container from "../components/Container";
import Reveal from "../components/Reveal";
import DouHome from "../agents/DouHome";
import ErHome from "../agents/ErHome";
import { memberPage, members } from "../content";
import { pageHref } from "../lib/router";

interface MemberPageProps {
  slug: string;
}

export default function MemberPage({ slug }: MemberPageProps) {
  const member = members.find((m) => m.slug === slug);
  /* 催促次数：0 表示还没点过（按钮显示「一键催促」） */
  const [urgeCount, setUrgeCount] = useState(0);

  /* 已经有专属主页的成员（目前只有二表哥）直接交给 agents/ 那一套渲染。
     hooks 必须在前，所以这个分支放在 useCount 之后 —— 不能放函数最开头。 */
  if (member?.home === "er") return <ErHome />;
  if (member?.home === "dou") return <DouHome />;

  return (
    <main id="main" className="min-h-[60svh]">
      <Container className="py-12 md:py-20">
        <Reveal>
          <a
            href={pageHref("persona")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition duration-fast ease-ease hover:text-accent"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
            {memberPage.backLabel}
          </a>
        </Reveal>

        {member ? (
          <>
            {/* 身份卡 */}
            <Reveal delay={0.08}>
              <div className="glass-liquid mt-6 flex flex-col items-center gap-5 rounded-panel p-8 text-center md:flex-row md:items-center md:gap-8 md:p-10 md:text-left">
                <img
                  src={member.avatar}
                  alt={memberPage.avatarAltTemplate.replace("{name}", member.name)}
                  width={128}
                  height={128}
                  className={`h-28 w-28 shrink-0 rounded-pill ${member.ink ? "portrait-ink" : ""}`}
                />
                <div className="min-w-0">
                  <h1 className="text-h1">
                    {memberPage.title.replace("{name}", member.name)}
                  </h1>
                  {member.role ? <p className="mt-2 text-muted">{member.role}</p> : null}
                </div>
              </div>
            </Reveal>

            {/* 内容区：未建设 → 与 X.Token 同款的空面板 + 一键催促
                宽度跟上面的身份卡对齐（Token 那边面板是 max-w-2xl，因为整页只有它一块；
                这里是身份卡下面的第二块，窄一圈会显得飘） */}
            <Reveal delay={0.16}>
              <div className="glass-liquid mt-6 flex min-h-[16rem] flex-col items-center justify-center gap-5 rounded-panel p-8 text-center">
                <p className="text-muted">
                  {memberPage.lazyText.replace("{name}", member.name)}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setUrgeCount((n) => n + 1)}
                >
                  {urgeCount === 0 ? memberPage.urgeLabel : memberPage.urgeDoneLabel}
                </Button>
                {/* aria-live：读屏用户点完也能听到反馈。
                    min-h 占位，避免文案出现时面板高度跳动。 */}
                <p
                  aria-live="polite"
                  className="min-h-[1.25rem] text-caption text-muted"
                >
                  {urgeCount > 0
                    ? memberPage.urgeFeedback
                        .replace("{count}", String(urgeCount))
                        .replace("{name}", member.name)
                    : ""}
                </p>
              </div>
            </Reveal>
          </>
        ) : (
          <Reveal delay={0.08}>
            <div className="glass-liquid mt-6 flex min-h-[18rem] flex-col items-center justify-center rounded-panel p-8 text-center">
              <h1 className="text-h2">{memberPage.notFoundTitle}</h1>
              <p className="mt-3 max-w-xl text-muted">{memberPage.notFoundText}</p>
            </div>
          </Reveal>
        )}
      </Container>
    </main>
  );
}
