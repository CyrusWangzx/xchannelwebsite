/**
 * X.游戏 —— 投币厅（#/games）
 *
 * Cyrus 的要求：**一台**霓虹街机，「点机器（侧视角）切到主视角，在主视角里选一款
 * 游戏游玩」，通关后从机身下面的**出球口滚出一颗球**，点球打开 Token 兑换码。
 * 机身要 3D 渲染、细节更多、赛博风格，并且要有「侧视 → 主视」的过渡动画。
 * **这一阶段只实现「拿到兑换码」**——兑换什么、跟什么绑定都还没接，也不落库
 * （刷新即失，面板里对用户明说了）。
 *
 * 三个视图（不是路由，是同一页里的状态机）：
 *   side  侧视角：一台机器拧成 3/4 侧面，屏幕里是引擎自己打的一局（待机演示）。
 *         点机器 → 机器**转正并朝你推近**（CSS 3D 过渡），进入 front。
 *   front 主视角·选单：机台正对你，屏幕上摆着三款游戏的「卡带」，选一款开打。
 *   play  主视角·游玩：那一款游戏接管屏幕，键盘/实体键操作，通关派球。
 *
 * 几条刻意的取舍：
 * 1. **3D 手搓、不引依赖**。项目长期约束是「不新增依赖」，所以箱体是
 *    `transform-style: preserve-3d` 拼出来的真六面体（前/后/左/右/顶/底），
 *    而不是 three.js。机身的灯箱、屏幕、操作台、出球口都是贴在正面的构件，
 *    侧板/顶板/背板各自成面，rotateY 一转就有真纵深。
 * 2. **游玩时屏幕必须是平的**。canvas 挂在带旋转的面上会被重采样（像素游戏最
 *    怕这个），所以「转正」这个动作在进 play 前就结束了——play 视图里机器
 *    rotateY=0，正面与视线垂直，canvas 是 1:1 缩放，像素不被糊。
 * 3. **出球口的球是真 3D 的**。球是 shell 的子元素，靠 translateZ 处在机身前方；
 *    进球动画从「出球口里面」（z 为负、被正面挡住）滚到「机身前面」（z 为正），
 *    preserve-3d 会按深度做遮挡，看起来就是「从出球口滚出来」。
 * 4. 待机演示不是另画的动画，而是引擎 `auto()` 自己打的一局——演示与正片同一套代码。
 * 5. 引擎只管数字与状态（lib/arcade.ts），文案全在 content.ts，颜色全在 index.css
 *    的 `--c-arcade-*` 令牌里。页面这边只做状态机与无障碍。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  DoorOpen,
  RotateCcw,
  Ticket,
  X,
} from "lucide-react";
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Reveal from "../components/Reveal";
import ScratchBooth from "../components/scratch/ScratchBooth";
import { arcadeGames, gamesSection } from "../content";
import {
  GRID_H,
  GRID_W,
  META,
  PIX,
  auto,
  blankInput,
  create,
  draw,
  step,
  type Control,
  type GameKey,
  type Input,
  type Palette,
  type Phase,
  type State,
} from "../lib/arcade";

type ArcadeGame = (typeof arcadeGames)[number];
/** 同一页里的三个视图：侧视 / 主视·选单 / 主视·游玩 */
type View = "side" | "front" | "play";

/** 固定步长：逻辑按 60Hz 走，与刷新率解耦（144Hz 上不会变快） */
const STEP = 1 / 60;

/** 一局赢一次 = 一颗球。托盘最多摆 8 颗，多的收成「另有 N 颗」。 */
const TRAY_MAX = 8;
/** 托盘里相邻两颗球的间距（px）——必须与 index.css 的 .arc3d-ball 排布一致 */
const BALL_GAP = 25;

/* ==========================================================================
   小工具
   ========================================================================== */

/** 每款游戏取哪一支霓虹令牌（与 .arc3d[data-game] 的映射一致） */
const NEON_VAR: Record<GameKey, string> = {
  catch: "--c-arcade-neon1-rgb",
  brick: "--c-arcade-neon2-rgb",
  snake: "--c-arcade-neon3-rgb",
};

/** 把 `--c-xxx-rgb` 那串「通道值」转成 canvas 认得着的颜色。
    颜色全部从令牌读——换肤仍然只需改 index.css 的 :root。 */
function tokenColor(el: HTMLElement, name: string, alpha = 1): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) {
    return `rgba(233, 245, 255, ${alpha})`;
  }
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function readPalette(el: HTMLElement, key: GameKey): Palette {
  return {
    bg: tokenColor(el, "--c-arcade-screen-rgb"),
    fg: tokenColor(el, "--c-arcade-pixel-rgb"),
    accent: tokenColor(el, NEON_VAR[key]),
    dim: tokenColor(el, "--c-arcade-pixel-rgb", 0.22),
  };
}

/* 兑换码字符集：去掉了 0/O、1/I/L 这些一眼分不清的字符（这个码是给人照着屏幕手抄的，
   抄错一位就等于废码）。
   ⚠️ 去掉之后只剩 31 个字符，**31 不整除 256**，`b % 31` 会让前 8 个字符的概率比其余高 3%
   （原本 32 个刚好整除才没有这个问题）。所以下面用拒绝采样：丢掉 ≥248 的字节再抽，
   分布才是平的。 */
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LIMIT = Math.floor(256 / CODE_CHARS.length) * CODE_CHARS.length; // 248

function makeCode(): string {
  const buf = new Uint8Array(16);
  let body = "";
  while (body.length < 8) {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    for (const b of buf) {
      if (b >= CODE_LIMIT) continue; // 拒绝，避免取模偏置
      body += CODE_CHARS[b % CODE_CHARS.length];
      if (body.length === 8) break;
    }
  }
  return `XCH-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Ball {
  id: string;
  game: GameKey;
  code: string;
}

/* ==========================================================================
   引擎挂载：一块画布 + 一个固定步长循环
   ========================================================================== */

function useArcade(key: GameKey, attract: boolean, active = true) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<Input>(blankInput());
  /* 「按过但还没被任何一拍看见」的输入。
     ⚠️ 引擎每拍只是**读一次**布尔值，所以「按下→抬起」如果落在同一帧内，这一下会被整个吞掉。
     真人快速点一下空格（发球）、或者手指快速碰一下屏幕上的方向键（贪吃蛇转向是离散的，
     点一下必须转），都会这样失灵 —— 验收脚本正是用 keyboard.press("Space") 抓出来的。
     锁存保证任何一次按下都会被至少一拍看见。 */
  const latchRef = useRef<Input>(blankInput());
  /* 引擎当前那一帧的状态。除了给下面的「验收入口」读，生产代码不碰它。
     （放进 ref 而不是 state：它每帧都变，绝不能触发 React 重渲染。） */
  const stateRef = useRef<State | null>(null);
  const meta = META[key];
  const [hud, setHud] = useState<{ score: number; lives: number; phase: Phase }>(() => ({
    score: 0,
    lives: meta.livesMax,
    phase: "playing",
  }));
  const [runId, setRunId] = useState(0);

  /** 页面侧唯一的输入写入口：按住的状态 + 锁存「按过」这个瞬间 */
  const press = useCallback((control: Control, value: boolean) => {
    inputRef.current[control] = value;
    if (value) latchRef.current[control] = true;
  }, []);

  const restart = useCallback(() => {
    inputRef.current = blankInput();
    latchRef.current = blankInput();
    setHud({ score: 0, lives: meta.livesMax, phase: "playing" });
    setRunId((n) => n + 1);
  }, [meta.livesMax]);

  useEffect(() => {
    /* `active` 是本页状态机的开关：侧视角/选单里不跑循环，也就不会白烧一块画布。
       active 一翻 true（进 play）就重跑一遍，此时 canvas 已挂上。 */
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = GRID_W * PIX;
    canvas.height = GRID_H * PIX;
    /* 配色读一次就够：三支霓虹令牌在两个主题里是同一支，屏幕色也不随主题变。
       真要在对局中途切主题，重开一局即可拿到新色。 */
    const palette = readPalette(canvas, key);

    let state: State = create(key);
    let raf = 0;
    let last = 0;
    let acc = 0;
    let seenPhase: Phase | null = null;
    let seenScore = -1;
    let seenLives = -1;
    /* 演示局的「无进展」计时：auto() 偶发会走进既不赢也不死的僵局（撞球来回磨、
       蛇绕圈够不着果子）。按「总时长」兜底会误杀本来就长的砖块局（40~68s），
       所以看的是**分数多久没动过**——一把正常的局，两次得分之间不会超过十几秒。 */
    let idleT = 0;
    let idleScore = 0;

    /* 待机画面是常驻的，滚出视口后就没必要继续算了，否则离开时会一直空转。
       主视角不挂这个观察器。 */
    let onScreen = true;
    let io: IntersectionObserver | null = null;
    if (attract && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting);
        },
        { rootMargin: "160px" }
      );
      io.observe(canvas);
    }

    /* 复用的喂给引擎的那个对象：每拍新建会产生没必要的垃圾 */
    const scratch = blankInput();
    const latch = latchRef.current;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      /* 切走标签页再回来时，别把中间那几分钟一次性补完 */
      if (document.hidden) return;
      if (dt > 0.25) dt = 0.25;
      if (!onScreen) return;

      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 8) {
        acc -= STEP;
        if (attract) {
          step(state, auto(state, blankInput()), STEP);
          if (state.score !== idleScore) {
            idleScore = state.score;
            idleT = 0;
          } else {
            idleT += STEP;
          }
          /* 演示局也会死，死了就悄悄重开一局，屏幕永远不会停在 Game Over */
          if (state.phase !== "playing" || idleT > 20) {
            state = create(key);
            idleT = 0;
            idleScore = 0;
            acc = 0;
            break;
          }
        } else {
          /* 按住的状态 ∪ 这一拍之前「按过」的输入 */
          const held = inputRef.current;
          scratch.left = held.left || latch.left;
          scratch.right = held.right || latch.right;
          scratch.up = held.up || latch.up;
          scratch.down = held.down || latch.down;
          scratch.action = held.action || latch.action;
          step(state, scratch, STEP);
          /* 消费掉锁存：只补这一拍；按住不放仍由 inputRef 每拍持续供给 */
          latch.left = false;
          latch.right = false;
          latch.up = false;
          latch.down = false;
          latch.action = false;
        }
      }

      draw(ctx, state, palette);
      stateRef.current = state;

      /* 只在「读数真的变了」时才回 React —— 每帧 setState 是不行的 */
      if (
        !attract &&
        (state.phase !== seenPhase ||
          state.score !== seenScore ||
          state.lives !== seenLives)
      ) {
        seenPhase = state.phase;
        seenScore = state.score;
        seenLives = state.lives;
        setHud({ score: state.score, lives: state.lives, phase: state.phase });
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [key, attract, runId, active]);

  return { canvasRef, hud, restart, stateRef, press };
}

/* ==========================================================================
   3D 机身：一台机器，三个视图共用
   ========================================================================== */

/** 待机演示：引擎自己打的一局，压暗一档铺在机台屏幕上 */
function AttractCanvas({ game }: { game: ArcadeGame }) {
  const { canvasRef } = useArcade(game.key, true, true);
  return (
    <>
      <canvas ref={canvasRef} className="arc3d-canvas" aria-hidden="true" />
      <span className="arc3d-scan" aria-hidden="true" />
      <span className="arc3d-glare" aria-hidden="true" />
    </>
  );
}

/** 主视角·选单：三款游戏摆在机台屏幕上，选一款开打 */
function GameSelector({ onPick }: { onPick: (key: GameKey) => void }) {
  return (
    <div className="arc3d-select">
      <p className="arc3d-select-head">{gamesSection.selectTitle}</p>
      <ul className="arc3d-carts">
        {arcadeGames.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              className="arc3d-cart"
              data-game={g.key}
              aria-label={gamesSection.selectLabel.replace("{name}", g.name)}
              onClick={() => onPick(g.key)}
            >
              <span className="arc3d-cart-dot" aria-hidden="true" />
              <span className="arc3d-cart-text">
                <span className="arc3d-cart-marquee">{g.marquee}</span>
                <span className="arc3d-cart-name">{g.name}</span>
              </span>
              <span className="arc3d-cart-go" aria-hidden="true">
                {gamesSection.selectBadge}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="arc3d-select-hint">{gamesSection.selectHint}</p>
      <span className="arc3d-glare" aria-hidden="true" />
    </div>
  );
}

function ArcadeMachine({
  view,
  game,
  canvasRef,
  phase,
  onEnter,
  onPick,
  onRestart,
  balls,
  arrivingId,
  openId,
  onBallClick,
}: {
  view: View;
  game: ArcadeGame;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  phase: Phase;
  onEnter: () => void;
  onPick: (key: GameKey) => void;
  onRestart: () => void;
  balls: { id: string; game: GameKey; code: string; index: number }[];
  arrivingId: string | null;
  openId: string | null;
  onBallClick: (id: string) => void;
}) {
  /* 灯箱：只有游玩时才写这款游戏的名字；侧视/选单是「这台机器」而不是某一款游戏 */
  const marqueeText =
    view === "play"
      ? game.marquee
      : view === "front"
        ? gamesSection.marqueeSelect
        : gamesSection.marqueeIdle;

  return (
    <div className="arc3d" data-view={view} data-game={game.key}>
      {/* 房间：脚下的网格 + 机器落下的一圈光晕 */}
      <span className="arc3d-floor" aria-hidden="true" />
      <span className="arc3d-aura" aria-hidden="true" />

      <div className="arc3d-machine">
        <div className="arc3d-shell">
          {/* ---- 箱体六面（真 3D）---- */}
          <div className="arc3d-face arc3d-face--back" aria-hidden="true" />
          <div className="arc3d-face arc3d-face--left" aria-hidden="true" />
          <div className="arc3d-face arc3d-face--right" aria-hidden="true" />
          <div className="arc3d-face arc3d-face--top" aria-hidden="true" />
          <div className="arc3d-face arc3d-face--bottom" aria-hidden="true" />

          {/* ---- 正面：灯箱 / 屏幕 / 操作台 / 基座出球口 ---- */}
          <div className="arc3d-face arc3d-face--front">
            <div className="arc3d-marquee" aria-hidden="true">
              <span className="arc3d-marquee-text">{marqueeText}</span>
              <span className="arc3d-marquee-glint" />
            </div>

            <div className="arc3d-screen">
              {view === "side" && <AttractCanvas game={game} />}
              {view === "front" && <GameSelector onPick={onPick} />}
              {view === "play" && (
                <>
                  <canvas
                    ref={canvasRef}
                    className="arc3d-canvas arc3d-canvas--play"
                    role="img"
                    aria-label={gamesSection.screenAlt.replace("{name}", game.name)}
                  />
                  <span className="arc3d-scan" aria-hidden="true" />
                  <span className="arc3d-glare" aria-hidden="true" />
                  {phase !== "playing" && (
                    <div className="arc3d-overlay" role="status">
                      <p className="arc3d-overlay-title">
                        {phase === "won" ? gamesSection.winTitle : gamesSection.loseTitle}
                      </p>
                      <p className="arc3d-overlay-text">
                        {phase === "won" ? gamesSection.winText : gamesSection.loseText}
                      </p>
                    </div>
                  )}
                </>
              )}
              <span className="arc3d-brackets" aria-hidden="true" />
              <span className="arc3d-bezel" aria-hidden="true" />
            </div>

            {/* 操作台：投币口 + 摇杆 + 三颗键 */}
            <div className="arc3d-deck" aria-hidden="true">
              <span className="arc3d-coin" />
              <span className="arc3d-stick" />
              <span className="arc3d-keys">
                <span className="arc3d-key" />
                <span className="arc3d-key" />
                <span className="arc3d-key" />
              </span>
            </div>

            {/* 基座：散热格栅 + 出球口 */}
            <div className="arc3d-plinth" aria-hidden="true">
              <span className="arc3d-vent" />
              <span className="arc3d-dispenser">
                <span className="arc3d-slot" />
              </span>
            </div>
          </div>

          {/* ---- 侧视角：整台机器就是「点击开始」的按钮 ---- */}
          {view === "side" && (
            <button
              type="button"
              className="arc3d-enter"
              onClick={onEnter}
              aria-label={gamesSection.enterLabel}
            >
              <span className="arc3d-standby" aria-hidden="true">
                {gamesSection.standbyLabel}
              </span>
            </button>
          )}

          {/* ---- 出球口托盘：球滚出来落在这儿 ---- */}
          <span className="arc3d-tray" aria-hidden="true" />

          {/* ---- 兑换球（真 3D：从出球口滚到机台前面）----
              横向位置走 transform 的 translateX（--dx），不是 left：
              这样「滚出动画」可以从出球口正中（dx=0）漂到自己的格位，
              同时整排球在增减时能平滑地重新居中。 */}
          {balls.map((ball, i) => (
            <button
              key={ball.id}
              type="button"
              className="arc3d-ball"
              data-game={ball.game}
              data-open={openId === ball.id ? "true" : "false"}
              data-arriving={arrivingId === ball.id ? "true" : "false"}
              style={
                {
                  "--dx": `${((i - (balls.length - 1) / 2) * BALL_GAP).toFixed(1)}px`,
                } as CSSProperties
              }
              aria-expanded={openId === ball.id}
              aria-label={(openId === ball.id
                ? gamesSection.ballCloseLabel
                : gamesSection.ballLabel
              )
                .replace("{n}", String(ball.index))
                .replace("{game}", arcadeGames.find((g) => g.key === ball.game)?.name ?? "")}
              onClick={() => onBallClick(ball.id)}
            >
              <span className="arc3d-ball-sphere" aria-hidden="true" />
              <span className="arc3d-ball-tag" aria-hidden="true">
                {ball.index}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   主视角：屏幕下方的实体按键
   ========================================================================== */

const PAD_ICON: Record<Exclude<Control, "action">, typeof ChevronLeft> = {
  left: ChevronLeft,
  right: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
};

/** 屏幕下方的实体按键。
    用 Pointer 事件而不是 onClick：按住在游戏里是「持续输入」，
    click 只有按下抬起的瞬间，玩不了。 */
function PadKey({
  control,
  label,
  down,
  onPress,
}: {
  control: Control;
  label: string;
  down: boolean;
  onPress: (control: Control, value: boolean) => void;
}) {
  const release = () => onPress(control, false);
  const Icon = control === "action" ? null : PAD_ICON[control];

  return (
    <button
      type="button"
      className={`arcade-knob${control === "action" ? " arcade-knob--action" : ""}`}
      data-down={down ? "true" : "false"}
      aria-label={label}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        onPress(control, true);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {Icon ? (
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

/* ==========================================================================
   页面
   ========================================================================== */

export default function Games() {
  const [view, setView] = useState<View>("side");
  const [activeKey, setActiveKey] = useState<GameKey>(arcadeGames[0].key);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "select" | "fail">(
    "idle"
  );
  const [held, setHeld] = useState<Partial<Record<Control, boolean>>>({});

  const activeGame = arcadeGames.find((g) => g.key === activeKey) ?? arcadeGames[0];
  const meta = META[activeKey];

  /* 游玩循环只在 play 视图里跑（active 开关）——侧视/选单时不烧画布 */
  const { canvasRef, hud, restart, stateRef, press: pressEngine } = useArcade(
    activeKey,
    false,
    view === "play"
  );

  const press = useCallback(
    (control: Control, value: boolean) => {
      pressEngine(control, value);
      setHeld((prev) => (prev[control] === value ? prev : { ...prev, [control]: value }));
    },
    [pressEngine]
  );

  /* ---- 视图切换 ---- */
  const enterHall = useCallback(() => {
    setOpenId(null);
    setView("front");
  }, []);

  const pickGame = useCallback((key: GameKey) => {
    setActiveKey(key);
    setView("play");
  }, []);

  const exitToSide = useCallback(() => {
    setOpenId(null);
    setHeld({});
    setView("side");
  }, []);

  const backToSelect = useCallback(() => {
    setHeld({});
    setView("front");
  }, []);

  /* 进主视角后把机器顶到视线里。`scroll-padding-top`（锁在 --nav-h）会让
     scrollIntoView 自动避开粘性导航。 */
  useEffect(() => {
    if (view === "side") return;
    document
      .getElementById("games-stage")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [view]);

  /* ---- 通关派奖：一次通关只派一次 ----
     ⚠️ 必须用 ref 记「这一局派过了」——React 18 的 StrictMode 会把 effect 跑两遍。 */
  const rewardedRef = useRef(false);
  useEffect(() => {
    if (hud.phase === "playing") {
      rewardedRef.current = false;
      return;
    }
    if (hud.phase === "won" && !rewardedRef.current) {
      rewardedRef.current = true;
      const ball: Ball = { id: makeId(), game: activeKey, code: makeCode() };
      setBalls((prev) => [...prev, ball]);
      setArrivingId(ball.id);
    }
  }, [hud.phase, activeKey]);

  /* ---- 键盘 ---- */
  /* 供监听读到「现在是不是还能操作」——不放进依赖，免得反复解绑重绑 */
  const phaseRef = useRef<Phase>(hud.phase);
  phaseRef.current = hud.phase;

  useEffect(() => {
    if (view !== "play") return;
    const MAP: Record<string, Control> = {
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
    };
    const controlOf = (event: KeyboardEvent): Control | null => {
      if (event.code === "Space" || event.key === "Enter") return "action";
      return MAP[event.key.toLowerCase()] ?? null;
    };
    const onDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        backToSelect();
        return;
      }
      const control = controlOf(event);
      if (!control) return;
      /* 盘面结算时不再拦截按键 —— 那时 Space/Enter 要能去按横幅上的按钮 */
      if (phaseRef.current !== "playing") return;
      event.preventDefault();
      press(control, true);
    };
    const onUp = (event: KeyboardEvent) => {
      const control = controlOf(event);
      if (control) press(control, false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [view, press, backToSelect]);

  /* 选单里 Esc 退回侧视角；看兑换码时 Esc 收起面板 */
  useEffect(() => {
    if (view === "play") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openId) setOpenId(null);
      else if (view === "front") setView("side");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openId]);

  useEffect(() => setCopyState("idle"), [openId]);

  /* ---- 兑换码 ---- */
  const openBall = useMemo(
    () => balls.find((b) => b.id === openId) ?? null,
    [balls, openId]
  );

  /* 兑换码那行本身。降级路径要把它整段选中，所以得拿到节点。 */
  const codeRef = useRef<HTMLParagraphElement | null>(null);

  /* 复制兑换码。
     正常路径只走 `navigator.clipboard.writeText`（异步、需安全上下文）。
     降级路径**不再用 `document.execCommand("copy")`**：它已被标记弃用，
     Chrome 会在控制台打一条「使用了已弃用的功能」告警 —— 站点自己给人
     添警告不合适。改成用 Selection API 把码整段选中，复制交给浏览器
     自己的快捷键（这条路径永远可用，也不需要任何权限）。 */
  const copyCode = useCallback(async (code: string) => {
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setCopyState("ok");
      return;
    }

    let selected = false;
    try {
      const node = codeRef.current;
      const sel = window.getSelection();
      if (node && sel) {
        const range = document.createRange();
        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
        selected = !sel.isCollapsed;
      }
    } catch {
      selected = false;
    }
    /* 选中了 ≠ 复制了，所以给的是第三种状态，不能报「已复制」 */
    setCopyState(selected ? "select" : "fail");
  }, []);

  /* ---- 托盘：最多摆 TRAY_MAX 颗，从最新往回取 ---- */
  const shown = balls.slice(-TRAY_MAX);
  const hiddenCount = balls.length - shown.length;
  const firstShown = balls.length - shown.length;
  const trayBalls = shown.map((ball, i) => ({ ...ball, index: firstShown + i + 1 }));

  const directions = useMemo(
    () => (["left", "right", "up", "down"] as Control[]).filter((c) => meta.controls.includes(c)),
    [meta.controls]
  );
  const hasAction = meta.controls.includes("action");

  /* ---- 仅开发期：给验收脚本留一个入口 ----
     验收脚本没法「用键盘玩到通关」（那要读屏幕里的像素位置），所以给它两件事：
     读引擎状态、把这一局直接判为通关。走的是**和真通关完全同一条链路**
     （引擎状态 → 每帧上报 → phase 变 won → effect 派球），只有「打到通关分」这一步被跳过。
     ⚠️ 生产构建里 import.meta.env.DEV 是 false，这整段会被摇掉，不进产物。 */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const host = window as unknown as { __xchannelArcade?: unknown };
    host.__xchannelArcade = {
      state: stateRef,
      view,
      win: () => {
        if (stateRef.current) stateRef.current.phase = "won";
      },
    };
    return () => {
      delete host.__xchannelArcade;
    };
  }, [stateRef, view]);

  return (
    <Section id="games" ariaLabelledBy="games-title" spacing="loose">
      <Container>
        <SectionTitle
          eyebrow={gamesSection.eyebrow}
          title={gamesSection.title}
          description={gamesSection.description}
          id="games-title"
          as="h1"
        />

        <Reveal>
          {/* 操作提示：不做成大按钮，只做一行克制的指引（与展示柜同一套语言） */}
          <p className="mb-6 flex items-center justify-center gap-2.5 text-caption tracking-[0.18em] text-muted">
            <span aria-hidden="true" className="hidden h-px w-6 bg-accent/50 xs:block" />
            {gamesSection.hint}
            <span aria-hidden="true" className="hidden h-px w-6 bg-accent/50 xs:block" />
          </p>

          <div
            id="games-stage"
            className="arcade-hue"
            data-game={activeKey}
            aria-label={gamesSection.caseLabel}
            role="group"
          >
            {/* 主视角顶栏：退出 + 机器名 + 操作说明 */}
            {view !== "side" && (
              <div className="arcade-play-bar">
                <button
                  type="button"
                  className="btn-reset inline-flex shrink-0 items-center gap-2 rounded-pill border border-hairline bg-surface/60 px-3.5 py-1.5 text-caption text-text transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                  onClick={exitToSide}
                >
                  <DoorOpen size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{gamesSection.exitLabel}</span>
                </button>
                <p className="text-h4">{activeGame.name}</p>
                <p className="text-caption text-muted">{activeGame.howTo}</p>
              </div>
            )}

            <ArcadeMachine
              view={view}
              game={activeGame}
              canvasRef={canvasRef}
              phase={hud.phase}
              onEnter={enterHall}
              onPick={pickGame}
              onRestart={restart}
              balls={trayBalls}
              arrivingId={arrivingId}
              openId={openId}
              onBallClick={(id) => setOpenId((prev) => (prev === id ? null : id))}
            />

            {/* 游玩时的读数与实体键 */}
            {view === "play" && (
              <>
                <div className="arcade-hud">
                  <p className="text-caption uppercase tracking-[0.18em] text-muted">
                    {gamesSection.goalLabel}{" "}
                    <span className="text-body font-semibold tabular-nums text-text">
                      {hud.score}
                    </span>
                    <span className="tabular-nums"> / {meta.goal}</span>
                  </p>
                  {meta.livesMax > 0 && (
                    <p className="arcade-lives">
                      <span className="sr-only">{`${gamesSection.lifeLabel} ${hud.lives}`}</span>
                      {Array.from({ length: meta.livesMax }, (_, i) => (
                        <span
                          key={i}
                          className="arcade-life"
                          data-spent={i >= hud.lives ? "true" : "false"}
                          aria-hidden="true"
                        />
                      ))}
                    </p>
                  )}
                </div>

                <div className="arcade-pad">
                  <div className="arcade-pad-group">
                    {directions.map((control) => (
                      <PadKey
                        key={control}
                        control={control}
                        label={gamesSection.controls[control]}
                        down={Boolean(held[control])}
                        onPress={press}
                      />
                    ))}
                  </div>
                  {hasAction && (
                    <PadKey
                      control="action"
                      label={gamesSection.controls.action}
                      down={Boolean(held.action)}
                      onPress={press}
                    />
                  )}
                </div>

                <div className="arcade-play-actions">
                  <button
                    type="button"
                    className="btn-reset inline-flex items-center gap-2 rounded-pill border border-hairline px-3.5 py-1.5 text-caption text-text transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                    onClick={restart}
                  >
                    <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
                    <span>{gamesSection.restartLabel}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-reset inline-flex items-center gap-2 rounded-pill border border-hairline px-3.5 py-1.5 text-caption text-text transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                    onClick={backToSelect}
                  >
                    <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
                    <span>{gamesSection.backToSelectLabel}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ---- 兑换球出口的台面：读屏与键盘的稳定入口 ---- */}
          <div className="arcade-tray">
            <p className="arcade-tray-head">
              <Ticket size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{gamesSection.trayTitle}</span>
              {balls.length > 0 && (
                <span className="arcade-tray-count tabular-nums">{balls.length}</span>
              )}
            </p>

            {balls.length === 0 ? (
              <p className="mt-3 text-caption text-muted">{gamesSection.trayEmpty}</p>
            ) : (
              <ul className="arcade-balls">
                {trayBalls.map((ball) => {
                  const isOpen = openId === ball.id;
                  const game = arcadeGames.find((g) => g.key === ball.game);
                  const label = (isOpen ? gamesSection.ballCloseLabel : gamesSection.ballLabel)
                    .replace("{n}", String(ball.index))
                    .replace("{game}", game?.name ?? "");
                  return (
                    <li key={ball.id}>
                      <button
                        type="button"
                        className="arcade-ball"
                        data-game={ball.game}
                        data-open={isOpen ? "true" : "false"}
                        aria-expanded={isOpen}
                        aria-label={label}
                        onClick={() => setOpenId(isOpen ? null : ball.id)}
                      >
                        <span className="arcade-ball-sphere" aria-hidden="true" />
                        <span className="arcade-ball-index">{ball.index}</span>
                      </button>
                    </li>
                  );
                })}
                {hiddenCount > 0 && (
                  <li className="arcade-ball-more">
                    {gamesSection.trayMoreTemplate.replace("{n}", String(hiddenCount))}
                  </li>
                )}
              </ul>
            )}

            {/* 兑换码面板：aria-live 保证读屏能念出码 */}
            <div aria-live="polite">
              {openBall && (
                <div className="arcade-code" data-game={openBall.game}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-caption uppercase tracking-[0.2em] text-muted">
                      <Ticket size={14} strokeWidth={1.75} aria-hidden="true" />
                      <span>{gamesSection.codeEyebrow}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-reset inline-flex items-center gap-1.5 rounded-pill border border-hairline px-3 py-1.5 text-caption text-text transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                        onClick={() => copyCode(openBall.code)}
                      >
                        {copyState === "ok" ? (
                          <Check size={14} strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                        )}
                        <span>
                          {copyState === "ok"
                            ? gamesSection.copiedLabel
                            : copyState === "select"
                              ? gamesSection.copySelectedLabel
                              : copyState === "fail"
                                ? gamesSection.copyFailedLabel
                                : gamesSection.copyLabel}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-reset inline-flex h-8 w-8 items-center justify-center rounded-pill border border-hairline text-muted transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright"
                        aria-label={gamesSection.closeLabel}
                        onClick={() => setOpenId(null)}
                      >
                        <X size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <p className="arcade-code-value" ref={codeRef}>
                    {openBall.code}
                  </p>
                  <p className="mt-3 text-caption text-muted">{gamesSection.codeNote}</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* 第二工位：赛博刮刮乐。同一个 X.游戏 区块里的第二件事，
            所以用工位牌（h2）而不是 SectionTitle —— 眉题与导航是一一对应的。 */}
        <Reveal>
          <ScratchBooth />
        </Reveal>
      </Container>
    </Section>
  );
}
