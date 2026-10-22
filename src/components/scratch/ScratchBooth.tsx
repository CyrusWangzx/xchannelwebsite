/**
 * 赛博刮刮乐 · 工位（木托货架 + 拿在手上 + 概率表）
 *
 * 为什么是「工位」而不是又一个 <Section>：
 * X.游戏 只占顶部导航的一格，区块眉题与导航 label 是 1:1 对位的（5/5）。
 * 刮刮乐属于同一个区块的第二个工位，所以这里用 h2 工位牌，
 * 不再要一个 SectionTitle —— 否则眉题和导航就对不上了。
 *
 * 交互照路边彩票店（Cyrus 2026-10-18 的要求）：
 *   木托上插着一排票（3D，微微朝中间收）
 *     → 点一张：票被**抽出来**（translateZ）→ 460ms 后进「拿在手上」
 *     → 拿在手上**先不刮**：可以凑近看正面、翻到背面看奖级表，
 *       点票面也能翻（那个透明按钮就是干这个的）
 *     → 决定刮了，才按「刮开这张」，膜这时才开始接指针（`live`）
 *     → 刮完 / 随时按「放回架子」，票滑回格位。
 *
 * 为什么 `mode` 要和 `ticket` 分开：
 *   「拿到手」和「开始刮」是两件事。合在一起的话，用户刚把票拿起来，
 *   指头一碰就把膜划了一道 —— 那就没有"看准了再刮"这回事了。
 *
 * 状态全在这一层，票面组件只负责画和刮。理由：出票、限次、结果播报、
 * 音效开关是同一件事的四个面，拆开就要靠回调互相通知，反而更难读。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  FlipHorizontal2,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import ScratchTicket from "./ScratchTicket";
import TicketCard from "./TicketCard";
import { scratchFaces, scratchSection } from "../../content";
import {
  CARD_FACES,
  DENOMINATIONS,
  HIT_COUNT,
  ODDS,
  WIN_PERMILLE,
  createTicket,
  formatOdds,
  formatOneIn,
  makeSeed,
  sampleTicket,
  type Denomination,
  type ScratchTicket as TicketData,
} from "../../lib/scratch";
import { isAudioEnabled, playWellSound, setAudioEnabled } from "../../lib/wellAudio";

/** 每款每次会话能取几张 */
const PER_FACE = 3;
/** 抽卡动画时长：必须 ≥ CSS 里 `.stand-slot[data-pulled] .stand-card` 的 440ms */
const PULL_MS = 480;
/** 放回架子时，等架子淡入一点再让票滑回格位 */
const RETURN_MS = 320;

/** 拿在手上之后的两个阶段 */
type Mode = "inspect" | "scratch";

const faceName = (key: string) =>
  scratchFaces.find((f) => f.key === key)?.name ?? key;

const faceSeries = (key: string) =>
  scratchFaces.find((f) => f.key === key)?.series ?? "";

function initialLeft(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const face of CARD_FACES) out[face.key] = PER_FACE;
  return out;
}

export default function ScratchBooth() {
  const [denom, setDenomState] = useState<Denomination>(20);
  const [left, setLeft] = useState<Record<string, number>>(initialLeft);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  /** 正在被抽出来的那一款（null = 没有票在动） */
  const [pulled, setPulled] = useState<string | null>(null);
  /** 拿到手之后：先看（inspect），还是已经决定刮（scratch） */
  const [mode, setMode] = useState<Mode>("inspect");
  /** 手上这张翻到背面没有 */
  const [flipped, setFlipped] = useState(false);

  const deskRef = useRef<HTMLDivElement | null>(null);
  /* 刮开百分比只在验收桥里用，放 ref 免得每动一下就重渲染整块 */
  const progressRef = useRef(0);
  /* 开奖音效只能响一次（StrictMode 会把 effect 跑两遍） */
  const rangRef = useRef<string | null>(null);
  /* 抽卡动画期间挡住连点：连点会出两张票，第二张把第一张顶掉 */
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  /* 「当前票 + 是否已揭开」的同步副本：验收桥在 setState 之后立刻读，
     读 React state 是拿不到新值的（要等下一次渲染）。 */
  const liveRef = useRef<{
    ticket: TicketData | null;
    revealed: boolean;
    mode: Mode;
    flipped: boolean;
  }>({ ticket: null, revealed: false, mode: "inspect", flipped: false });
  const denomRef = useRef<Denomination>(20);
  denomRef.current = denom;
  /* 验收桥要读「此刻的」pulled / left，同样用 ref 副本 */
  const pulledStateRef = useRef<string | null>(null);
  pulledStateRef.current = pulled;
  const leftStateRef = useRef(left);
  leftStateRef.current = left;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    },
    [],
  );

  /* 架子上的样票：同一款同一面额永远是同一张，换面额才换票 */
  const rackTickets = useMemo(() => {
    const map: Record<string, TicketData> = {};
    for (const face of CARD_FACES) map[face.key] = sampleTicket(face.key, denom);
    return map;
  }, [denom]);

  /* ---- 出票 ---- */
  const issue = useCallback((faceKey: string, value: Denomination, seed: number) => {
    const next = createTicket(faceKey, value, seed);
    liveRef.current = { ticket: next, revealed: false, mode: "inspect", flipped: false };
    setTicket(next);
    setRevealed(false);
    setMode("inspect");
    setFlipped(false);
    /* 面额跟着票走：概率表的奖金列按当前票面额算，不能跟票对不上 */
    setDenomState(value);
    progressRef.current = 0;
    rangRef.current = null;
    return next;
  }, []);

  const reveal = useCallback(() => {
    liveRef.current.revealed = true;
    setRevealed(true);
  }, []);

  /** 从架子上抽一张：先动，再出票 */
  const pick = useCallback(
    (faceKey: string) => {
      if (busyRef.current || liveRef.current.ticket) return;
      if ((left[faceKey] ?? 0) <= 0) return;
      busyRef.current = true;
      setPulled(faceKey);
      /* 这一下是显式手势：把 AudioContext 建起来，后面刮才有声 */
      if (soundOn && !isAudioEnabled()) setAudioEnabled(true);

      later(() => {
        setLeft((prev) => ({
          ...prev,
          [faceKey]: Math.max(0, (prev[faceKey] ?? 0) - 1),
        }));
        issue(faceKey, denomRef.current, makeSeed());
        busyRef.current = false;
        /* 这里**不清 pulled**：架子此刻正在淡出，清了会看到票"跳回格位"。
           等放回架子时再清，那时票才是真的回到格子里。 */
      }, PULL_MS);
    },
    [issue, later, left, soundOn],
  );

  /** 「刮开这张」：从"看"切到"刮"，膜这时才接指针 */
  const startScratch = useCallback(() => {
    if (!liveRef.current.ticket) return;
    liveRef.current.mode = "scratch";
    liveRef.current.flipped = false;
    setMode("scratch");
    setFlipped(false);
    if (soundOn && !isAudioEnabled()) setAudioEnabled(true);
  }, [soundOn]);

  /* 点票面翻面：按下和抬起的位移超过 8px 就当"拖"，不翻。
     没有这条，用户在膜上试刮一下，票就翻过去了 —— 那不是他要的。 */
  const tapAtRef = useRef<{ x: number; y: number } | null>(null);

  /** 翻面：真票就是双面的，正反都能看 */
  const toggleFlip = useCallback(() => {
    if (!liveRef.current.ticket) return;
    const next = !liveRef.current.flipped;
    liveRef.current.flipped = next;
    setFlipped(next);
  }, []);

  /** 放回架子 */
  const closeDesk = useCallback(() => {
    liveRef.current = { ticket: null, revealed: false, mode: "inspect", flipped: false };
    setTicket(null);
    setRevealed(false);
    setFlipped(false);
    setMode("inspect");
    progressRef.current = 0;
    rangRef.current = null;
    /* 架子先淡进来，票再滑回格位 —— 顺序反了会看到票在半空消失 */
    later(() => setPulled(null), RETURN_MS);
  }, [later]);

  const again = useCallback(() => {
    if (!ticket) return;
    if ((left[ticket.face] ?? 0) <= 0) return;
    setLeft((prev) => ({
      ...prev,
      [ticket.face]: Math.max(0, (prev[ticket.face] ?? 0) - 1),
    }));
    issue(ticket.face, ticket.denom, makeSeed());
  }, [issue, left, ticket]);

  /* 台面出现时轻滚一下 —— 换票时台面本来就在眼前，再滚很晃 */
  const hadTicket = useRef(false);
  useEffect(() => {
    if (ticket && !hadTicket.current) {
      deskRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    hadTicket.current = Boolean(ticket);
  }, [ticket]);

  /* ---- 开奖音效 ---- */
  useEffect(() => {
    if (!revealed || !ticket) return;
    if (rangRef.current === ticket.id) return;
    rangRef.current = ticket.id;
    if (soundOn) playWellSound(ticket.outcome === 0 ? "click" : "prize");
  }, [revealed, ticket, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setAudioEnabled(next);
    if (next) playWellSound("click");
  };

  /* ---- 开发期验收桥 ----
     验收脚本用 draw() 指定种子出确定性票，用 state() 读结果。
     `import.meta.env.DEV` 在生产构建里是死代码，会被摇掉。 */
  const issueRef = useRef(issue);
  issueRef.current = issue;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const closeRef = useRef(closeDesk);
  closeRef.current = closeDesk;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const startRef = useRef(startScratch);
  startRef.current = startScratch;
  const flipRef = useRef(toggleFlip);
  flipRef.current = toggleFlip;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const host = window as unknown as { __xchannelScratch?: unknown };
    host.__xchannelScratch = {
      /* 指定种子出票：验收要确定性，不能靠真随机（跳过抽卡动画）。
         出票后停在「拿在手上·看」这个真实阶段 —— 想刮由脚本再调 start()，
         否则验出来的就不是用户走的那条路。 */
      draw: (faceKey: string, value: Denomination, seed: number) => {
        setPulled(null);
        return issueRef.current(faceKey, value, seed).id;
      },
      /* 走真实交互（含抽卡动画）——用来验 3D 那一段真的动了 */
      pick: (faceKey: string) => pickRef.current(faceKey),
      start: () => startRef.current(),
      flip: () => flipRef.current(),
      reveal: () => revealRef.current(),
      close: () => closeRef.current(),
      state: () => ({
        ticket: liveRef.current.ticket,
        revealed: liveRef.current.revealed,
        denom: denomRef.current,
        pct: progressRef.current,
        view: liveRef.current.ticket ? liveRef.current.mode : "rack",
        mode: liveRef.current.mode,
        flipped: liveRef.current.flipped,
        pulled: pulledStateRef.current,
        left: leftStateRef.current,
      }),
    };
    return () => {
      delete host.__xchannelScratch;
    };
  }, []);

  /* 这款还有额度才给「再来一张」 */
  const canAgain = ticket ? (left[ticket.face] ?? 0) > 0 : false;
  const atRack = !ticket;
  const scratching = Boolean(ticket) && mode === "scratch";

  return (
    <div className="scratch-booth" aria-labelledby="scratch-title">
      {/* ---- 工位牌 ---- */}
      <div className="scratch-head">
        <div className="min-w-0">
          {/* 常驻文字走 accent-text：accent-bright 在浅色主题只有 3.48:1，不够 AA */}
          <p
            className="text-caption uppercase tracking-[0.2em] text-accent-text"
            data-role="eyebrow"
          >
            {scratchSection.eyebrow}
          </p>
          <h2 className="scratch-title" id="scratch-title">
            {scratchSection.title}
          </h2>
          <p className="scratch-sub">{scratchSection.description}</p>
          <p className="mt-1.5 text-caption text-muted">{scratchSection.hint}</p>
        </div>
        <button
          type="button"
          className="scratch-sound"
          data-on={soundOn ? "true" : "false"}
          aria-pressed={soundOn}
          title={scratchSection.soundHint}
          onClick={toggleSound}
        >
          {soundOn ? (
            <Volume2 size={14} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <VolumeX size={14} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span>{soundOn ? scratchSection.soundOnLabel : scratchSection.soundOffLabel}</span>
        </button>
      </div>

      {/* ---- 面额 ---- */}
      <div className="scratch-bar">
        <div
          className="scratch-denoms"
          role="group"
          aria-label={scratchSection.denomLabel}
        >
          {DENOMINATIONS.map((value) => (
            <button
              key={value}
              type="button"
              className="scratch-denom"
              aria-pressed={denom === value}
              onClick={() => setDenomState(value)}
            >
              ¥{value}
            </button>
          ))}
        </div>
        <p className="scratch-bar-note">{scratchSection.denomNote}</p>
      </div>

      {/* ---- 舞台：货架与台面叠在同一格里，切换时页面高度不跳 ---- */}
      <div className="scratch-stage">
        {/* ===== 木托货架 ===== */}
        <div
          className="rack-stage"
          data-shown={atRack ? "true" : "false"}
          aria-hidden={atRack ? undefined : "true"}
        >
          <div className="stand">
            {/* 木头底座：台面 + 前立面两片平面拼出厚度 */}
            <span className="stand-deck" aria-hidden="true" />
            <span className="stand-lip" aria-hidden="true" />

            {/* 镀铬边框：立柱 / 横杆 / 斜撑。纯装饰，不吃指针。 */}
            <div className="stand-frame" aria-hidden="true">
              <span className="stand-ramp stand-ramp-l" />
              <span className="stand-ramp stand-ramp-r" />
              <span className="stand-post stand-post-l" />
              <span className="stand-post stand-post-r" />
              <span className="stand-rail" data-tier="0" />
              <span className="stand-rail" data-tier="1" />
              <span className="stand-rail" data-tier="2" />
            </div>

            <ul className="stand-slots">
              {CARD_FACES.map((face) => {
                const rest = left[face.key] ?? 0;
                const sold = rest <= 0;
                const sample = rackTickets[face.key];
                return (
                  <li
                    key={face.key}
                    className="stand-slot"
                    data-face={face.key}
                    data-sold={sold ? "true" : "false"}
                    data-pulled={pulled === face.key ? "true" : "false"}
                  >
                    {/* 后排两张是「库存」：只负责让架子看起来是满的。
                        真按钮永远在最前面那张 —— 按下去抓到的必须是它。 */}
                    {[2, 1].map((tier) => (
                      <div
                        key={tier}
                        className="stand-copy"
                        data-tier={String(tier)}
                        aria-hidden="true"
                      >
                        <TicketCard
                          ticket={sample}
                          name={faceName(face.key)}
                          series={faceSeries(face.key)}
                          variant="rack"
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      className="stand-card"
                      disabled={sold || !atRack}
                      aria-label={
                        sold
                          ? `${faceName(face.key)} · ${scratchSection.soldOut}`
                          : scratchSection.pickLabelTemplate
                              .replace("{name}", faceName(face.key))
                              .replace("{denom}", String(denom))
                      }
                      onClick={() => pick(face.key)}
                    >
                      <TicketCard
                        ticket={sample}
                        name={faceName(face.key)}
                        series={faceSeries(face.key)}
                        variant="rack"
                      />
                      <span className="stand-shade" aria-hidden="true">
                        {scratchSection.soldOut}
                      </span>
                    </button>

                    {/* 名牌：**票名只在这里出现一次**。
                        缩略票上已经撤掉了票名那一行 —— 同一款压三张，票名会
                        重复三遍，200px 宽里就是三道横杠（Cyrus 2026-10-20：
                        「缩略图就不显示彩票名称了，在一组彩票前面单独摆一个
                        架子来显示，要不然太拥挤了」）。
                        立牌比票窄一圈、往后退的票面碰不到它，读起来才是
                        "一组票前面立着一块牌子"，而不是"第四条横杠"。 */}
                    <span className="stand-plate">
                      <span className="stand-plate-name">{faceName(face.key)}</span>
                      <span className="stand-plate-meta">
                        <b>¥{denom}</b>
                        <i>
                          {sold
                            ? scratchSection.soldOut
                            : scratchSection.remainingTemplate.replace(
                                "{n}",
                                String(rest),
                              )}
                        </i>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="rack-restock">{scratchSection.rackRestock}</p>
        </div>

        {/* ===== 拿在手上 ===== */}
        {ticket && (
          <div className="scratch-view" data-face={ticket.face}>
            <div className="scratch-desk" ref={deskRef}>
              {/* 抬头：手上是哪张票 + 翻面 + 随时能放回去（不必先刮完） */}
              <div className="scratch-desk-head">
                <p className="scratch-desk-name">
                  <span className="scratch-desk-series">
                    {faceSeries(ticket.face)}
                  </span>
                  <span className="scratch-desk-title">{faceName(ticket.face)}</span>
                  <span className="scratch-desk-price">¥{ticket.denom}</span>
                </p>
                <div className="scratch-desk-tools">
                  <button
                    type="button"
                    className="scratch-flip"
                    data-flipped={flipped ? "true" : "false"}
                    aria-pressed={flipped}
                    onClick={toggleFlip}
                  >
                    <FlipHorizontal2 size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      {flipped
                        ? scratchSection.flipToFrontLabel
                        : scratchSection.flipToBackLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="scratch-back"
                    onClick={closeDesk}
                  >
                    <ArrowLeft size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span>{scratchSection.backLabel}</span>
                  </button>
                </div>
              </div>

              <div className="scratch-desk-main">
                {/* 拿在手上时点票面就能翻 —— 那个透明按钮只管这一件事 */}
                <div className="scratch-hold">
                  <ScratchTicket
                    ticket={ticket}
                    name={faceName(ticket.face)}
                    series={faceSeries(ticket.face)}
                    revealed={revealed}
                    live={scratching}
                    flipped={flipped}
                    soundOn={soundOn}
                    onReveal={reveal}
                    onProgress={(pct) => {
                      progressRef.current = pct;
                    }}
                  />
                  {!scratching && (
                    <button
                      type="button"
                      className="scratch-tap"
                      aria-label={
                        flipped
                          ? scratchSection.flipToFrontLabel
                          : scratchSection.flipToBackLabel
                      }
                      onPointerDown={(event) => {
                        tapAtRef.current = { x: event.clientX, y: event.clientY };
                      }}
                      onClick={(event) => {
                        const from = tapAtRef.current;
                        tapAtRef.current = null;
                        if (
                          from &&
                          Math.hypot(event.clientX - from.x, event.clientY - from.y) > 8
                        ) {
                          return;
                        }
                        toggleFlip();
                      }}
                    />
                  )}
                </div>

                {/* 还没决定刮：先把话说清楚，再给一个明确的入口 */}
                {!scratching && (
                  <div className="scratch-cues">
                    <button
                      type="button"
                      className="scratch-now"
                      onClick={startScratch}
                    >
                      <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
                      <span>{scratchSection.scratchNowLabel}</span>
                    </button>
                    <p className="scratch-cue-note">{scratchSection.inspectHint}</p>
                  </div>
                )}

                <div aria-live="polite">
                  {revealed && (
                    <div
                      className="scratch-result"
                      data-win={ticket.outcome === 0 ? "false" : "true"}
                    >
                      <p className="scratch-result-label">
                        <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
                        <span>{scratchSection.resultEyebrow}</span>
                      </p>
                      <p className="scratch-result-title">
                        {ticket.outcome === 0
                          ? scratchSection.loseTitle
                          : scratchSection.winTitle}
                        {ticket.outcome !== 0 && (
                          <span className="scratch-result-tier">
                            {scratchSection.tierLabels[ticket.outcome]}
                          </span>
                        )}
                      </p>
                      <p className="scratch-result-note">
                        {ticket.outcome === 0
                          ? scratchSection.loseNote
                          : scratchSection.winNote}
                      </p>
                      <p className="sr-only">
                        {ticket.outcome === 0
                          ? scratchSection.announceLose
                          : scratchSection.announceWinTemplate.replace(
                              "{tier}",
                              scratchSection.tierLabels[ticket.outcome],
                            )}
                      </p>
                      <div className="scratch-actions">
                        {/* 这一款取完了就不再给「再来一张」——按了没反应的
                            按钮比没有按钮更糟 */}
                        {canAgain && (
                          <button
                            type="button"
                            className="btn-reset inline-flex items-center gap-2 rounded-pill border border-hairline px-3.5 py-1.5 text-caption text-text transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                            onClick={again}
                          >
                            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                            <span>{scratchSection.againLabel}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- 概率表：Cyrus 要求概率明示，摆在同一屏，不藏进折叠 ---- */}
      <div className="scratch-odds">
        <p className="flex flex-wrap items-center justify-between gap-2 text-caption uppercase tracking-[0.18em] text-muted">
          <span>{scratchSection.oddsTitle}</span>
          <span className="tabular-nums text-accent-text" data-role="winrate">
            {scratchSection.oddsTemplate.replace("{pct}", formatOdds(WIN_PERMILLE))}
          </span>
        </p>

        <table className="scratch-odds-table">
          <thead>
            <tr>
              <th scope="col">{scratchSection.oddsColTier}</th>
              <th scope="col">{scratchSection.oddsColNeed}</th>
              <th scope="col">{scratchSection.oddsColChance}</th>
              <th scope="col">{scratchSection.oddsColOneIn}</th>
            </tr>
          </thead>
          <tbody>
            {ODDS.map((row) => (
              <tr
                key={row.outcome}
                data-win={row.outcome === 0 ? "false" : "true"}
                data-empty={row.outcome === 0 ? "true" : "false"}
                /* 揭开之后把「这一张中的是哪一行」标出来 */
                data-mine={revealed && ticket?.outcome === row.outcome ? "true" : "false"}
              >
                <td>{scratchSection.tierLabels[row.outcome]}</td>
                <td>
                  {row.outcome === 0
                    ? scratchSection.oddsNoTier
                    : scratchSection.oddsNeedTemplate.replace(
                        "{n}",
                        String(HIT_COUNT[row.outcome]),
                      )}
                </td>
                <td>{formatOdds(row.permille)}</td>
                <td>{formatOneIn(row.permille)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="scratch-odds-note">{scratchSection.oddsNote}</p>
      </div>
    </div>
  );
}
