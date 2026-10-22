/**
 * 票面：一张**双面的实体票**
 *
 *   正面   抬头带（品牌 / 系列 / 最高奖金 / 面额角标）
 *          票名 + 印刷的一行玩法 + 中奖号码
 *          可刮区 —— 占票面 **69.8%**，四周一圈印刷边框 + 四角花
 *          底栏（保安区 / 票号 / 条码）
 *   背面   奖级与概率表 / 玩法 / 须知 / 保安区 / 票号 / 条码
 *
 * 为什么做成双面：
 *   真票就是双面的，而且背面本来就印着奖级表。做成能翻的实体，
 *   「凑近看正反面再决定刮不刮」这件事才成立（Cyrus 2026-10-18 的要求）。
 *
 * 为什么可刮区要到 69.8%：
 *   Cyrus 说「还是太窄太小」。上一版把中奖号码做成膜上方一整条横栏，
 *   等于用横条吃掉了膜的高度。这一版把中奖号码并进票名那一行，膜直接顶到票名下方。
 *
 * 同一个组件用在三个地方，尺寸全走 cqw，缩略票放大就是大票：
 *   · 架子上那张（variant="rack"）：没有格子，覆盖膜是一整片印刷膜
 *   · 拿在手上（variant="full"）：格子在膜底下，由 ScratchTicket 盖上 canvas
 *   · 背面（`flipped`）永远是印刷面，不参与刮
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  CARD_FACES,
  HIT_COUNT,
  ODDS,
  WIN_PERMILLE,
  formatOdds,
  type ScratchTicket as TicketData,
} from "../../lib/scratch";
import { scratchSection } from "../../content";

/** 款标：架子上的印刷面中央放大的那个符号 */
const faceGlyph = (key: string) =>
  CARD_FACES.find((f) => f.key === key)?.glyph ?? "★";

interface Props {
  ticket: TicketData;
  name: string;
  series: string;
  /** "rack" = 架子上那张（不露格子、不印刮开提示）；"full" = 拿在手上 */
  variant?: "rack" | "full";
  revealed?: boolean;
  started?: boolean;
  /** 翻到背面 */
  flipped?: boolean;
  /** 刮层 canvas，只有拿在手上那张才传 */
  overlay?: ReactNode;
  /** 印不印「刮开覆盖膜」——还没决定刮不刮的时候不该催 */
  tip?: boolean;
  /** 无障碍名称；架子上那张由外层按钮提供，传空 */
  label?: string;
}

export default function TicketCard({
  ticket,
  name,
  series,
  variant = "rack",
  revealed = false,
  started = false,
  flipped = false,
  overlay,
  tip,
  label,
}: Props) {
  const full = variant === "full";
  const showTip = tip ?? full;

  /* 镭射要跟着指尖滑 —— 每帧都写，走 CSS 变量，不 setState（重渲染扛不住）。
     ⚠️ 监听**必须挂在 window 上**，不能挂在 `.ticket-frame` 的 onPointerMove：
     `.ticket-frame` 带 `container-type: inline-size`，它自己根本不在命中链上
     （`elementsFromPoint` 会列出它的子元素，却不列它 —— 就是 §10.5 那个坑），
     而且「看」的阶段票面盖着 `.scratch-tap`、「刮」的阶段盖着 canvas，
     两者都是它的**兄弟**，事件压根冒泡不到它身上。
     实测：挂在 `.ticket-frame` 上，`--holo-hue` 永远是空字符串。 */
  const frameRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!full) return;
    const clear = (el: HTMLDivElement) => {
      el.style.removeProperty("--sheen-x");
      el.style.removeProperty("--sheen-y");
      el.style.removeProperty("--holo-hue");
    };
    const onMove = (event: PointerEvent) => {
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      if (px < -0.06 || px > 1.06 || py < -0.06 || py > 1.06) {
        clear(el);
        return;
      }
      el.style.setProperty("--sheen-x", `${px * 100}%`);
      el.style.setProperty("--sheen-y", `${py * 100}%`);
      /* 镭射的"角度"：左右横扫换色相。条纹只做平移的话，
         图案是周期性的，走一大段看着还是原样；换色相才像"烫金膜随视角变色"。 */
      el.style.setProperty("--holo-hue", `${(px * 220 - 110).toFixed(0)}deg`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frameRef.current) clear(frameRef.current);
    };
  }, [full]);

  return (
    <div className="ticket-frame" data-variant={variant} ref={frameRef}>
      <div className="ticket-3d" data-flipped={flipped ? "true" : "false"}>
        {/* 卡纸侧边：只有翻面转到侧面时看得见，但那一下正是"实体"的证据 */}
        <span className="ticket-edge ticket-edge-l" aria-hidden="true" />
        <span className="ticket-edge ticket-edge-r" aria-hidden="true" />

        {/* ---------------- 正面 ---------------- */}
        <div
          className="ticket-side ticket-front"
          aria-hidden={flipped ? "true" : undefined}
        >
          <div
            className="ticket"
            data-face={ticket.face}
            data-revealed={revealed ? "true" : "false"}
            data-started={started ? "true" : "false"}
            role={label ? "group" : undefined}
            aria-label={label}
          >
            {/* 款式的印刷纹样：不同款不一样，纯 CSS */}
            <span className="ticket-motif" aria-hidden="true" />

            <header className="ticket-head">
              <span className="ticket-brand">{scratchSection.brand}</span>
              <span className="ticket-series">{series}</span>
              <span className="ticket-jackpot">
                <i>{scratchSection.maxPrizeLabel}</i>
                <b>{scratchSection.tierLabels[1]}</b>
              </span>
              <span className="ticket-denom" aria-label={`面额 ${ticket.denom} 元`}>
                <i>¥</i>
                {ticket.denom}
              </span>
            </header>

            <div className="ticket-title">
              <span className="ticket-name">{name}</span>
              <span className="ticket-rule">{scratchSection.ruleShort}</span>
              <span className="ticket-match">
                <span className="ticket-match-label">{scratchSection.matchLabel}</span>
                <span className="ticket-match-glyphs">
                  {ticket.matchSymbols.map((symbol, i) => (
                    <span
                      key={`${ticket.id}-m${i}`}
                      className="ticket-match-glyph"
                      aria-hidden="true"
                    >
                      {symbol}
                    </span>
                  ))}
                </span>
              </span>
            </div>

            <div className="ticket-foil">
              {full ? (
                <ul className="ticket-cells" aria-hidden={revealed ? "false" : "true"}>
                  {ticket.cells.map((cell, i) => (
                    <li
                      key={`${ticket.id}-c${i}`}
                      className="ticket-cell"
                      data-hit={cell.hit ? "true" : "false"}
                    >
                      <span className="ticket-cell-symbol">{cell.symbol}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                /* 架子上那张：**只印卡面**，不摆膜也不摆格子。
                   Cyrus 2026-10-20：「未点开的时候只显示卡面设计与图案，
                   点击之后再拉近才显示可刮区域」。所以这里画的是
                   款式的纹样 + 款标 + 面额 —— 五款并排一眼分得清，
                   而不是五块一模一样的银色膜（那才叫"显示效果太差"）。 */
                <span className="ticket-art" aria-hidden="true">
                  <span className="ticket-art-glyph">{faceGlyph(ticket.face)}</span>
                </span>
              )}

              {overlay}

              {/* 印刷边框压在膜上面（真票是先印框再上膜，视觉上框在膜上沿之外） */}
              <span className="ticket-print" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>

              {showTip && (
                <span className="ticket-tip" aria-hidden="true">
                  {scratchSection.scratchTip}
                </span>
              )}
            </div>

            <footer className="ticket-foot">
              <span className="ticket-guard">
                <span className="ticket-guard-strip">
                  {scratchSection.guardLabel} · {scratchSection.guardHint}
                </span>
                <span className="ticket-guard-code">{ticket.guard}</span>
              </span>

              <span className="ticket-serial">
                <span className="ticket-serial-value">{ticket.id}</span>
                <span className="ticket-serial-label">{scratchSection.serialLabel}</span>
              </span>

              <span className="ticket-barcode" aria-hidden="true" />
            </footer>

            {/* ---- 只给「拿在手上」那张的两层光效 ----
                架上 15 张缩略票不挂：200px 上这点彩度只会是脏点，
                而且它俩是"凑近才看得见"的东西，和膜是同一个道理（§12.4）。 */}

            {/* 镭射：彩虹条纹，位置跟着指尖走 —— 手一动彩虹就滑过去。
                真票的镭射是烫在纸上的，所以它压在印刷面之上、指尖之下。 */}
            {full && <span className="ticket-holo" aria-hidden="true" />}

            {/* 流光：一条 112° 的斜高光，8.5 秒一轮慢慢扫过票面。
                没有它，卡面是"一张印好的纸"；有了它，才像"一张有涂层的卡"。 */}
            {full && <span className="ticket-shine" aria-hidden="true" />}
          </div>
        </div>

        {/* ---------------- 背面 ---------------- */}
        <div
          className="ticket-side ticket-back"
          aria-hidden={flipped ? undefined : "true"}
        >
          <div className="ticket ticket-reverse" data-face={ticket.face}>
            <span className="ticket-motif" aria-hidden="true" />

            <header className="back-head">
              <span className="back-brand">{scratchSection.brand}</span>
              <span className="back-name">
                {name}
                <i className="back-series">{series}</i>
              </span>
              <span className="back-denom">¥{ticket.denom}</span>
            </header>

            <section className="back-odds">
              <p className="back-h">{scratchSection.backTitle}</p>
              <table className="back-table">
                <thead>
                  <tr>
                    <th scope="col">{scratchSection.oddsColTier}</th>
                    <th scope="col">{scratchSection.oddsColNeed}</th>
                    <th scope="col">{scratchSection.oddsColChance}</th>
                  </tr>
                </thead>
                <tbody>
                  {ODDS.map((row) => (
                    <tr key={row.outcome} data-win={row.outcome === 0 ? "false" : "true"}>
                      <th scope="row">{scratchSection.tierLabels[row.outcome]}</th>
                      <td>
                        {row.outcome === 0
                          ? scratchSection.oddsNoTier
                          : scratchSection.oddsNeedTemplate.replace(
                              "{n}",
                              String(HIT_COUNT[row.outcome]),
                            )}
                      </td>
                      <td>{formatOdds(row.permille)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="back-copy">
              <p className="back-rule">
                <b>{scratchSection.backRuleTitle}</b>
                {scratchSection.rule}
              </p>
              <p className="back-notes-title">{scratchSection.backNotesTitle}</p>
              <ul className="back-notes">
                {scratchSection.backNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <footer className="back-foot">
              <span className="back-guard">
                <span className="back-guard-strip">
                  {scratchSection.guardLabel} · {scratchSection.guardHint}
                </span>
                <span className="back-guard-code">{ticket.guard}</span>
              </span>
              <span className="back-serial">
                {scratchSection.serialLabel} {ticket.id}
              </span>
              <span className="back-barcode" aria-hidden="true" />
            </footer>

            <p className="back-disclaimer">
              {scratchSection.disclaimer} ·{" "}
              {scratchSection.oddsTemplate.replace("{pct}", formatOdds(WIN_PERMILLE))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
