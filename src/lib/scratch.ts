/**
 * 赛博刮刮乐 · 纯逻辑层（#/games 的「刮刮乐」工位）
 *
 * 这一版是**照真实票面重做**的（Cyrus 2026-10-18 的要求）：
 *   ① 票面结构按市售真票来 —— 票名、玩法、中奖号码、可刮区、保安区、票号；
 *   ② 面额按店里最常见的 **20 / 30 / 50** 元；
 *   ③ 可刮区面积按 20~50 元「大票」的比例（≈60%），不是小票的九宫格。
 *
 * 玩法（照抄市面上最常见的「对号」票）：
 *   票面印 **2 个中奖符号**，可刮区是 4×3 十二格，每格「符号 + 金额」。
 *   刮出的符号与任一中奖符号相同 → 该格中奖，奖金 = 该格金额，累计。
 *   **结果在出票时就定了**，刮只是揭示 —— 概率表因此可以明示。
 *
 * 奖级与命中数一一对应（命中越多奖越高），这条同时是自我校验：
 *   `evaluate()` 从可见符号反推奖级，必须恒等于出票时定的 outcome。
 *
 * 本文件不碰 DOM、不碰时间、不碰随机源（随机数由外部种子决定），
 * 同一个 seed 必然出同一张票 —— 验收脚本靠这个做确定性断言。
 */

/** 5 款 = 5 色（一款一色，一款一套符号 + 一套纹样） */
export type ScratchColor = "orange" | "cyan" | "mint" | "rose" | "violet";

/** 3 种面额（元）：店里最常见的三档 */
export type Denomination = 20 | 30 | 50;

/** 5 个奖级：1 = 一等奖 */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** 0 = 未中奖 */
export type Outcome = 0 | Tier;

/** 一款票的结构定义（不含文案，文案在 content.ts） */
export interface ScratchFace {
  key: string;
  color: ScratchColor;
  /** 票面角标上的款标 */
  glyph: string;
  /**
   * 本款使用的符号组（5 个，互不重复）。
   * 全部取自**各平台都有的几何符号**，刻意不用 emoji：
   * emoji 带彩色字形，落在票面上会破坏油墨感，各平台字形差异也太大。
   */
  symbols: readonly string[];
}

/**
 * 5 款 = 5 色（一款一色，一款一套符号 + 一套纹样）。
 *
 * 符号池的硬规则：**同一款里不许出现「实心/空心」那种近似对**。
 * 真票不会在同一个游戏里同时印 ★ 和 ☆ —— 玩家会以为自己中了。
 * 所以每款的 5 个符号形状两两可辨，绝不靠填充与否区分。
 */
export const CARD_FACES: readonly ScratchFace[] = [
  { key: "star", color: "orange", glyph: "★", symbols: ["★", "✚", "△", "○", "◈"] },
  { key: "weave", color: "cyan", glyph: "◎", symbols: ["●", "◆", "△", "☆", "▣"] },
  { key: "matrix", color: "mint", glyph: "▣", symbols: ["■", "◆", "✕", "○", "▲"] },
  { key: "signal", color: "rose", glyph: "✕", symbols: ["✕", "▲", "●", "◈", "☆"] },
  { key: "prism", color: "violet", glyph: "◈", symbols: ["◇", "○", "▲", "✚", "▣"] },
] as const;

export const DENOMINATIONS: readonly Denomination[] = [20, 30, 50] as const;

/** 可刮区：4 列 × 3 行 = 12 格（20/30/50 元大票常见规模） */
export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const GRID_CELLS = GRID_COLS * GRID_ROWS;

/** 票面印几个中奖符号（真票常见 2 个） */
export const MATCH_SYMBOLS = 2;

/**
 * 概率表（千分比，合计必须 = ODDS_TOTAL）。
 * 用整数千分比而不是小数百分比：0.1% 写成 1 是精确的，0.001 累加会漂。
 * 票面旁边原样展示这张表 —— Cyrus 要求「概率明示」。
 */
export interface OddRow {
  outcome: Outcome;
  permille: number;
}

export const ODDS: readonly OddRow[] = [
  { outcome: 1, permille: 1 },
  { outcome: 2, permille: 9 },
  { outcome: 3, permille: 40 },
  { outcome: 4, permille: 150 },
  { outcome: 5, permille: 200 },
  { outcome: 0, permille: 600 },
] as const;

export const ODDS_TOTAL = 1000;

/** 整体中奖率（千分比）：1 - 未中奖那一档。票面印的「中奖率」用这个算，不写死。 */
export const WIN_PERMILLE =
  ODDS_TOTAL - (ODDS.find((row) => row.outcome === 0)?.permille ?? 0);

/** 该奖级要刮出几个中奖符号（越多奖越高） */
export const HIT_COUNT: Record<Tier, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

/**
 * 中奖格的**单格**金额 = 面额 × 这个倍数。
 * 量级照真实大票：¥20 票的一等奖约 ¥20 万（5 格 × ¥4 万）。
 *
 * ⚠️ **这套数字只做内部账，一个都不许渲染。**
 * Cyrus 2026-10-21：「由于不能出现具体金额，所以去除实际的金额，只保留奖级」。
 * 所以票面 / 奖级表 / 结果面板上只印「一等奖…五等奖」，
 * 金额留在数据层，是因为**奖级判定、离线单测、以及"面额 × 倍数"的一致性**
 * 都靠它保证（改倍数会让 63 条离线断言立刻发现）。
 * 想在 UI 里再用它 —— 先问 Cyrus。
 */
export const CELL_MULTIPLIER: Record<Tier, number> = {
  1: 2000,
  2: 250,
  3: 50,
  4: 10,
  5: 5,
};

/** 整票奖金 = 面额 × 这个倍数（= 命中数 × 单格倍数，见单测） */
export const TOTAL_MULTIPLIER: Record<Tier, number> = {
  1: 10000,
  2: 1000,
  3: 150,
  4: 20,
  5: 5,
};

/**
 * 未中奖格的「诱饵」金额倍数。只从小档里取 —— 真实票面确实靠「差一点」的格子
 * 勾人，所以允许诱饵比实际奖金大（单测只约束它落在阶梯上，不约束大小）。
 */
const DECOY_STEPS: readonly number[] = [1, 1, 2, 2, 5, 10] as const;

/** 刮开比例达到这个值就自动揭开（跟真票「刮开一大半就全亮」的手感一致） */
export const REVEAL_AT = 0.55;

export interface ScratchCell {
  symbol: string;
  /** 该格印的金额（元） */
  amount: number;
  /** 是否命中（渲染用；判定永远以 symbol 比对为准，见 evaluate） */
  hit: boolean;
}

export interface ScratchTicket {
  /** 票号：16 位数字，四组四位（票面底部印的那串） */
  id: string;
  /** 保安区码：8 位大写字母数字 */
  guard: string;
  face: string;
  color: ScratchColor;
  denom: Denomination;
  seed: number;
  /** 票面「中奖号码」（2 个） */
  matchSymbols: string[];
  /** 出票时就定下的结果 */
  outcome: Outcome;
  cells: ScratchCell[];
}

/* -------------------------------------------------------------------------
   随机
   ------------------------------------------------------------------------- */

/** mulberry32：32 位种子 → 确定性序列。够用、够短、无依赖。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSeed(): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] === 0 ? 0x9e3779b9 : buf[0];
  }
  return ((Math.random() * 0xffffffff) >>> 0) || 0x9e3779b9;
}

/* -------------------------------------------------------------------------
   出票
   ------------------------------------------------------------------------- */

export function faceOf(key: string): ScratchFace {
  return CARD_FACES.find((f) => f.key === key) ?? CARD_FACES[0];
}

/** 按 ODDS 抽一个结果（千分比累加，落在哪一格就是哪一档） */
export function pickOutcome(rng: () => number): Outcome {
  const roll = Math.floor(rng() * ODDS_TOTAL);
  let acc = 0;
  for (const row of ODDS) {
    acc += row.permille;
    if (roll < acc) return row.outcome;
  }
  return ODDS[ODDS.length - 1].outcome;
}

export function hitCountOf(outcome: Outcome): number {
  return outcome === 0 ? 0 : HIT_COUNT[outcome];
}

export function prizeOf(ticket: ScratchTicket): number {
  return ticket.cells.reduce((sum, c) => sum + (c.hit ? c.amount : 0), 0);
}

export function prizeFor(denom: Denomination, outcome: Outcome): number {
  return outcome === 0 ? 0 : denom * TOTAL_MULTIPLIER[outcome];
}

/** 票面「最高奖金」那条：一等奖的整票奖金 */
export function maxPrize(denom: Denomination): number {
  return prizeFor(denom, 1);
}

const GUARD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * 出票。**先定结果，再布符号**——顺序反了就没法控制概率。
 * 布符号时把十二格位置洗一遍，命中格散开，不会堆在角落。
 */
export function createTicket(
  faceKey: string,
  denom: Denomination,
  seed: number,
): ScratchTicket {
  const face = faceOf(faceKey);
  const rng = mulberry32(seed);

  const outcome = pickOutcome(rng);

  /* 2 个中奖符号（互不重复），剩下 3 个用来铺未中奖格 */
  const pool = face.symbols.slice();
  const matchSymbols: string[] = [];
  for (let i = 0; i < MATCH_SYMBOLS; i++) {
    const idx = Math.floor(rng() * pool.length);
    matchSymbols.push(pool[idx]);
    pool.splice(idx, 1);
  }
  const others = pool.length > 0 ? pool : face.symbols.slice();

  const hits = hitCountOf(outcome);
  const cellAmount = outcome === 0 ? 0 : denom * CELL_MULTIPLIER[outcome];

  /* 洗位置：Fisher–Yates，前 hits 个位置放中奖符号 */
  const slots: number[] = [];
  for (let i = 0; i < GRID_CELLS; i++) slots.push(i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = slots[i];
    slots[i] = slots[j];
    slots[j] = tmp;
  }
  const hitAt = new Set(slots.slice(0, hits));

  const cells: ScratchCell[] = [];
  for (let i = 0; i < GRID_CELLS; i++) {
    const hit = hitAt.has(i);
    cells.push({
      symbol: hit
        ? matchSymbols[Math.floor(rng() * matchSymbols.length)] ?? matchSymbols[0]
        : others[Math.floor(rng() * others.length)] ?? face.symbols[0],
      amount: hit
        ? cellAmount
        : denom * (DECOY_STEPS[Math.floor(rng() * DECOY_STEPS.length)] ?? 1),
      hit,
    });
  }

  return {
    id: ticketId(seed, denom),
    guard: guardCode(seed, denom),
    face: face.key,
    color: face.color,
    denom,
    seed,
    matchSymbols,
    outcome,
    cells,
  };
}

/**
 * 票号：16 位数字，四组四位。同一张票（同 seed 同面额）永远是同一串。
 * 面额要搅进来 —— 否则同种子不同面额的两张票会印同一个票号，
 * 而票号在真票上是「这张票」的唯一标识。
 */
export function ticketId(seed: number, denom: Denomination = 20): string {
  const rng = mulberry32((seed ^ (0x5bf03635 + denom * 131)) >>> 0);
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    groups.push(String(Math.floor(rng() * 10000)).padStart(4, "0"));
  }
  return groups.join(" ");
}

/** 保安区码：8 位，避开易混的 0/O/1/I */
export function guardCode(seed: number, denom: Denomination = 20): string {
  const rng = mulberry32((seed ^ (0x27d4eb2f + denom * 977)) >>> 0);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += GUARD_CHARS[Math.floor(rng() * GUARD_CHARS.length)];
  }
  return out;
}

/**
 * 从**票面可见符号**反推结果（不信 `cell.hit`，那只是渲染标记）。
 * 命中 0 → 0；命中 n → 奖级 6-n（5 个命中是一等奖）。
 */
export function evaluate(ticket: ScratchTicket): Outcome {
  let hits = 0;
  for (const cell of ticket.cells) {
    if (ticket.matchSymbols.includes(cell.symbol)) hits += 1;
  }
  if (hits === 0) return 0;
  return (6 - Math.min(5, hits)) as Tier;
}

/** 架子上摆的样票：固定种子，同一款同一面额永远是同一张 */
export function sampleTicket(faceKey: string, denom: Denomination): ScratchTicket {
  const idx = Math.max(0, CARD_FACES.findIndex((f) => f.key === faceKey));
  return createTicket(faceKey, denom, 0x7a11ce + idx * 977 + denom * 31);
}

/* -------------------------------------------------------------------------
   刮开的进度
   ------------------------------------------------------------------------- */

/**
 * 刮开面积统计：把可刮区当成 cols×rows 的粗网格，笔刷扫过就把格子点亮。
 * 纯几何，不做 `getImageData` 回读 —— 每帧回读整张画布在手机上会掉帧，
 * 而「刮掉多少」本来只需要一个近似值。
 */
export class ScratchProgress {
  readonly cols: number;
  readonly rows: number;
  private readonly hit: Uint8Array;
  private filled = 0;

  constructor(cols = 48, rows = 24) {
    this.cols = Math.max(1, Math.floor(cols));
    this.rows = Math.max(1, Math.floor(rows));
    this.hit = new Uint8Array(this.cols * this.rows);
  }

  reset(): void {
    this.hit.fill(0);
    this.filled = 0;
  }

  /**
   * 坐标与半径都是**归一化**的（0..1）。
   * `radius` 按宽度归一、`radiusY` 按高度归一 —— 可刮区不是正方形
   * （96% 宽 × 38/60 高那条带子，宽高比约 2.5:1），只给一个半径的话，
   * 画出来是「圆」但统计出来是「椭圆」，进度会跟眼睛看到的不一致。
   */
  erase(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    radiusY = radius,
  ): void {
    const rx = Math.max(1e-5, radius);
    const ry = Math.max(1e-5, radiusY);
    /* 步长按「半径」为单位算：相邻两个笔刷圆有重叠，不会漏格子 */
    const span = Math.hypot((x1 - x0) / rx, (y1 - y0) / ry);
    const steps = Math.max(1, Math.ceil(span / 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rx, ry);
    }
  }

  private stamp(x: number, y: number, radius: number, radiusY: number): void {
    const rx = radius * this.cols;
    const ry = radiusY * this.rows;
    if (rx <= 0 || ry <= 0) return;
    const cx = x * this.cols;
    const cy = y * this.rows;
    const i0 = Math.max(0, Math.floor(cx - rx));
    const i1 = Math.min(this.cols - 1, Math.ceil(cx + rx));
    const j0 = Math.max(0, Math.floor(cy - ry));
    const j1 = Math.min(this.rows - 1, Math.ceil(cy + ry));
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5 - cy) / ry;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5 - cx) / rx;
        if (dx * dx + dy * dy > 1) continue;
        const idx = j * this.cols + i;
        if (this.hit[idx]) continue;
        this.hit[idx] = 1;
        this.filled += 1;
      }
    }
  }

  /** 0..1 */
  get coverage(): number {
    return this.filled / (this.cols * this.rows);
  }
}

/** 金额格式化：¥20 / ¥200,000 */
export function formatAmount(value: number): string {
  return `¥${Math.round(value).toLocaleString("en-US")}`;
}

/** 千分比 → 展示用的百分数（0.1% / 5% / 60%），去掉无意义的 .0 */
export function formatOdds(permille: number): string {
  const pct = permille / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** 千分比 → 1/N（概率明示用，比百分数更直观） */
export function formatOneIn(permille: number): string {
  if (permille <= 0) return "—";
  return `1 / ${Math.round(ODDS_TOTAL / permille)}`;
}
