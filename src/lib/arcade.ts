/**
 * X.游戏 —— 三款像素小游戏的引擎（零依赖，纯 Canvas 2D）
 *
 * 为什么不装引擎：三款都是「方格 + 固定步长」级别的玩意儿，引 phaser / three
 * 是拿大炮打蚊子，也违背项目「不新增依赖」的长期约束。整个引擎不到 400 行。
 *
 * 四条约定：
 * 1. **逻辑分辨率固定 32×24 格**，每格 4 设备像素 → 后备画布 128×96，
 *    再由 CSS 放大。像素边缘靠两件事保住：`image-rendering: pixelated`，
 *    以及下面那个 `snap()`（所有坐标吸附到 1/4 格，也就是整数设备像素）——
 *    不吸附的话，板子停在 12.3 格上会被抗锯齿糊成两排灰边。
 * 2. 坐标一律用「格」，物理量用「格/秒」，由外部按**固定步长 1/60s** 驱动
 *    （累加器在 Games.tsx）。这样 144Hz 屏上不会变快，掉帧也不会变慢。
 * 3. 文案、颜色都不在这里：配色走 index.css 的 `--c-arcade-*` 令牌（调用方读出来传进 draw），
 *    文案走 content.ts。引擎只吐数字与状态。
 * 4. 每款游戏都要能**自己玩**（`auto()`）——游戏机的待机画面就是引擎自己打的一局，
 *    不用另写一套演示动画。
 */

export const GRID_W = 32;
export const GRID_H = 24;
export const PIX = 4;

export type GameKey = "catch" | "brick" | "snake";
export type Phase = "playing" | "won" | "lost";
export type Control = "left" | "right" | "up" | "down" | "action";

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
}

/** 每次喂给 step/auto 的都必须是新对象：auto 会就地写它 */
export function blankInput(): Input {
  return { left: false, right: false, up: false, down: false, action: false };
}

/** 颜色都从 CSS 令牌读出来，见 Games.tsx 的 readPalette */
export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  dim: string;
}

interface Base {
  key: GameKey;
  phase: Phase;
  score: number;
  lives: number;
  livesMax: number;
  /** 本局已进行的秒数（auto 用来做「等一会儿再发球」这类判断） */
  t: number;
}

export interface CatchState extends Base {
  key: "catch";
  paddle: number;
  drops: { x: number; y: number }[];
  spawn: number;
}

export interface BrickState extends Base {
  key: "brick";
  paddle: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  launched: boolean;
  bricks: boolean[];
}

export interface SnakeState extends Base {
  key: "snake";
  body: { x: number; y: number }[];
  dir: { x: number; y: number };
  pellet: { x: number; y: number };
  acc: number;
}

export type State = CatchState | BrickState | SnakeState;

export interface GameMeta {
  /** 通关条件（得分上限）——HUD 的「得分 X / 上限」用 */
  goal: number;
  /** 容错次数；0 = 没有「剩余机会」这个概念（贪吃蛇一撞就结束） */
  livesMax: number;
  /** 这台机器需要哪些操作键——决定屏幕上摆几颗键 */
  controls: Control[];
}

export const META: Record<GameKey, GameMeta> = {
  /* 漏三个方块结束；接满 12 个通关 */
  catch: { goal: 12, livesMax: 3, controls: ["left", "right"] },
  /* 24 块砖全打掉通关；球掉下去三次结束（空格发球） */
  brick: { goal: 24, livesMax: 3, controls: ["left", "right", "action"] },
  /* 吃满 8 颗信号通关；撞墙或咬到自己立刻结束 */
  snake: { goal: 8, livesMax: 0, controls: ["left", "right", "up", "down"] },
};

/* ==========================================================================
   像素对齐
   ========================================================================== */

/** 吸附到 1/4 格 = 1 设备像素，杜绝抗锯齿把像素糊掉 */
function snap(v: number): number {
  return Math.round(v * PIX) / PIX;
}

function cell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), snap(w), snap(h));
}

/** 清屏并把坐标系切换到「格」——每帧调用，不假设上一帧留下的变换 */
function begin(ctx: CanvasRenderingContext2D, p: Palette): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, GRID_W * PIX, GRID_H * PIX);
  ctx.setTransform(PIX, 0, 0, PIX, 0, 0);
}

/** 场地装饰：一圈虚线边框 + 底部地平线，三款游戏共用 */
function field(ctx: CanvasRenderingContext2D, p: Palette): void {
  for (let x = 0; x < GRID_W; x += 2) {
    cell(ctx, x, 0, 1, 0.5, p.dim);
    cell(ctx, x, GRID_H - 0.5, 1, 0.5, p.dim);
  }
  for (let y = 1; y < GRID_H - 1; y += 2) {
    cell(ctx, 0, y, 0.5, 1, p.dim);
    cell(ctx, GRID_W - 0.5, y, 0.5, 1, p.dim);
  }
}

/* ==========================================================================
   一、浓度收集（catch）—— 左右移动接住落下的方块
   ========================================================================== */

const CATCH = {
  paddleW: 6,
  paddleSpeed: 27,
  paddleRow: GRID_H - 2,
  dropW: 2,
  dropSpeed: 6.4,
  dropGap: 0.82,
  firstDrop: 0.7,
};

function newCatch(): CatchState {
  return {
    key: "catch",
    phase: "playing",
    score: 0,
    lives: META.catch.livesMax,
    livesMax: META.catch.livesMax,
    t: 0,
    paddle: (GRID_W - CATCH.paddleW) / 2,
    drops: [],
    spawn: CATCH.firstDrop,
  };
}

function stepCatch(s: CatchState, input: Input, dt: number): void {
  s.t += dt;

  if (input.left) s.paddle -= CATCH.paddleSpeed * dt;
  if (input.right) s.paddle += CATCH.paddleSpeed * dt;
  const max = GRID_W - CATCH.paddleW;
  if (s.paddle < 0) s.paddle = 0;
  if (s.paddle > max) s.paddle = max;

  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn = CATCH.dropGap;
    const span = GRID_W - 2 - CATCH.dropW;
    s.drops.push({ x: 1 + Math.random() * span, y: -CATCH.dropW });
  }

  for (let i = s.drops.length - 1; i >= 0; i--) {
    const d = s.drops[i];
    d.y += CATCH.dropSpeed * dt;
    if (d.y + CATCH.dropW >= CATCH.paddleRow) {
      /* 判定用「方块中心落在板上」，比边缘相交宽容一点（体感更准） */
      const center = d.x + CATCH.dropW / 2;
      if (center > s.paddle && center < s.paddle + CATCH.paddleW) s.score++;
      else s.lives--;
      s.drops.splice(i, 1);
    }
  }

  if (s.score >= META.catch.goal) s.phase = "won";
  else if (s.lives <= 0) s.phase = "lost";
}

function drawCatch(ctx: CanvasRenderingContext2D, s: CatchState, p: Palette): void {
  cell(ctx, 0, CATCH.paddleRow + 1.5, GRID_W, 0.5, p.dim);
  for (const d of s.drops) {
    cell(ctx, d.x, d.y, CATCH.dropW, CATCH.dropW, p.accent);
    cell(ctx, d.x, d.y, CATCH.dropW, 0.5, p.fg);
  }
  cell(ctx, s.paddle, CATCH.paddleRow, CATCH.paddleW, 1, p.fg);
}

function autoCatch(s: CatchState, input: Input): void {
  if (!s.drops.length) return;
  /* 追最近的（跑得最下面的）那一颗 */
  let best = s.drops[0];
  for (const d of s.drops) if (d.y > best.y) best = d;
  const want = best.x + CATCH.dropW / 2 - CATCH.paddleW / 2;
  input.left = s.paddle > want + 0.5;
  input.right = s.paddle < want - 0.5;
}

/* ==========================================================================
   二、砖块清屏（brick）—— 打砖块
   ========================================================================== */

/* 四行 32 块砖实测要 160 秒才清完，比 catch(13s)/snake(20s) 差一个数量级——
   落地页上的休闲小游戏不该让人耗 2 分半。降到 3 行 24 块、球速提到 24、板子加宽一格，
   把单局压到 1 分钟量级。 */
const BRICK = {
  cols: 8,
  rows: 3,
  brickW: 3,
  pitch: 4,
  top: 2,
  rowGap: 2,
  paddleW: 9,
  paddleSpeed: 27,
  paddleRow: GRID_H - 2,
  ballSpeed: 24,
};

function newBrick(): BrickState {
  const bricks: boolean[] = [];
  for (let i = 0; i < BRICK.cols * BRICK.rows; i++) bricks.push(true);
  const paddle = (GRID_W - BRICK.paddleW) / 2;
  return {
    key: "brick",
    phase: "playing",
    score: 0,
    lives: META.brick.livesMax,
    livesMax: META.brick.livesMax,
    t: 0,
    paddle,
    ballX: paddle + BRICK.paddleW / 2 - 0.5,
    ballY: BRICK.paddleRow - 1,
    vx: 0,
    vy: 0,
    launched: false,
    bricks,
  };
}

function brickAt(s: BrickState, col: number, row: number): number {
  if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return -1;
  for (let r = 0; r < BRICK.rows; r++) {
    const y = BRICK.top + r * BRICK.rowGap;
    if (row !== y) continue;
    const c = Math.floor((col - 0) / BRICK.pitch);
    if (c < 0 || c >= BRICK.cols) return -1;
    if (col - c * BRICK.pitch >= BRICK.brickW) return -1;
    const i = r * BRICK.cols + c;
    return s.bricks[i] ? i : -1;
  }
  return -1;
}

function launchBall(s: BrickState): void {
  const speed = BRICK.ballSpeed;
  const dir = Math.random() < 0.5 ? -1 : 1;
  s.vx = speed * 0.52 * dir;
  s.vy = -speed * 0.854;
  s.launched = true;
}

function stepBrick(s: BrickState, input: Input, dt: number): void {
  s.t += dt;

  if (input.left) s.paddle -= BRICK.paddleSpeed * dt;
  if (input.right) s.paddle += BRICK.paddleSpeed * dt;
  const max = GRID_W - BRICK.paddleW;
  if (s.paddle < 0) s.paddle = 0;
  if (s.paddle > max) s.paddle = max;

  if (!s.launched) {
    /* 未发球时球跟着板走；动作键发球 */
    s.ballX = s.paddle + BRICK.paddleW / 2 - 0.5;
    s.ballY = BRICK.paddleRow - 1;
    if (input.action) launchBall(s);
  } else {
    const prevX = s.ballX;
    const prevY = s.ballY;

    /* 分轴推进：先走 x 再走 y，撞墙/撞砖时只需翻转一个分量（经典做法） */
    let nx = s.ballX + s.vx * dt;
    if (nx < 0) {
      nx = 0;
      s.vx = Math.abs(s.vx);
    } else if (nx > GRID_W - 1) {
      nx = GRID_W - 1;
      s.vx = -Math.abs(s.vx);
    }
    s.ballX = nx;

    let ny = s.ballY + s.vy * dt;
    if (ny < 0) {
      ny = 0;
      s.vy = Math.abs(s.vy);
    }
    s.ballY = ny;

    /* 砖：看这一格是不是砖，是的话按「从哪边进来的」决定翻哪个分量 */
    const hit = brickAt(s, Math.floor(s.ballX), Math.floor(s.ballY));
    if (hit >= 0) {
      s.bricks[hit] = false;
      s.score++;
      const fromSide =
        brickAt(s, Math.floor(prevX), Math.floor(s.ballY)) < 0 &&
        Math.floor(prevX) !== Math.floor(s.ballX);
      const fromTop =
        brickAt(s, Math.floor(s.ballX), Math.floor(prevY)) < 0 &&
        Math.floor(prevY) !== Math.floor(s.ballY);
      if (fromSide) s.vx = -s.vx;
      else if (fromTop) s.vy = -s.vy;
      else {
        s.vx = -s.vx;
        s.vy = -s.vy;
      }
    }

    /* 板：只在下落时判定，并按落点偏移改变出球角度（经典的「打在边缘角度更斜」） */
    if (
      s.vy > 0 &&
      s.ballY + 1 >= BRICK.paddleRow &&
      s.ballY + 1 <= BRICK.paddleRow + 1.2 &&
      s.ballX + 1 > s.paddle &&
      s.ballX < s.paddle + BRICK.paddleW
    ) {
      const off =
        (s.ballX + 0.5 - (s.paddle + BRICK.paddleW / 2)) / (BRICK.paddleW / 2);
      const clamped = Math.max(-1, Math.min(1, off));
      s.ballY = BRICK.paddleRow - 1;
      let vx = clamped * BRICK.ballSpeed * 0.7;
      /* 打死不垂直：正中心回球会得到 vx≈0，球就在同一列里上下磨——既无聊又白耗时间。
         给一个最小水平分量，保证球总会横扫过砖阵。 */
      const minVx = BRICK.ballSpeed * 0.4;
      if (Math.abs(vx) < minVx) {
        const dir = clamped !== 0 ? Math.sign(clamped) : Math.random() < 0.5 ? -1 : 1;
        vx = minVx * dir;
      }
      s.vx = vx;
      const remain = BRICK.ballSpeed * BRICK.ballSpeed - vx * vx;
      s.vy = -Math.sqrt(Math.max(remain, 1));
    }

    /* 掉出底线 */
    if (s.ballY + 1 > GRID_H) {
      s.lives--;
      s.launched = false;
      s.ballX = s.paddle + BRICK.paddleW / 2 - 0.5;
      s.ballY = BRICK.paddleRow - 1;
      s.vx = 0;
      s.vy = 0;
    }
  }

  if (s.score >= META.brick.goal) s.phase = "won";
  else if (s.lives <= 0 && !s.launched) s.phase = "lost";
}

function drawBrick(ctx: CanvasRenderingContext2D, s: BrickState, p: Palette): void {
  for (let r = 0; r < BRICK.rows; r++) {
    const y = BRICK.top + r * BRICK.rowGap;
    for (let c = 0; c < BRICK.cols; c++) {
      if (!s.bricks[r * BRICK.cols + c]) continue;
      cell(ctx, c * BRICK.pitch, y, BRICK.brickW, 1, r % 2 ? p.fg : p.accent);
      cell(ctx, c * BRICK.pitch, y + 0.75, BRICK.brickW, 0.25, p.dim);
    }
  }
  cell(ctx, s.paddle, BRICK.paddleRow, BRICK.paddleW, 1, p.fg);
  cell(ctx, s.ballX, s.ballY, 1, 1, p.fg);
}

function autoBrick(s: BrickState, input: Input): void {
  const want = s.ballX + 0.5 - BRICK.paddleW / 2;
  input.left = s.paddle > want + 0.4;
  input.right = s.paddle < want - 0.4;
  if (!s.launched && s.t > 0.7) input.action = true;
}

/* ==========================================================================
   三、信号贪吃蛇（snake）
   ========================================================================== */

const SNAKE = { step: 0.135 };

function newSnake(): SnakeState {
  return {
    key: "snake",
    phase: "playing",
    score: 0,
    lives: 0,
    livesMax: META.snake.livesMax,
    t: 0,
    body: [
      { x: 16, y: 12 },
      { x: 15, y: 12 },
      { x: 14, y: 12 },
    ],
    dir: { x: 1, y: 0 },
    pellet: { x: 22, y: 12 },
    acc: 0,
  };
}

function respawnPellet(s: SnakeState): void {
  for (let guard = 0; guard < 240; guard++) {
    const p = {
      x: Math.floor(Math.random() * GRID_W),
      y: Math.floor(Math.random() * GRID_H),
    };
    if (!s.body.some((c) => c.x === p.x && c.y === p.y)) {
      s.pellet = p;
      return;
    }
  }
}

function stepSnake(s: SnakeState, input: Input, dt: number): void {
  s.t += dt;

  /* 方向在每一拍上重取，且禁止 180° 掉头（那是「咬自己」） */
  const want: { x: number; y: number } | null = input.left
    ? { x: -1, y: 0 }
    : input.right
      ? { x: 1, y: 0 }
      : input.up
        ? { x: 0, y: -1 }
        : input.down
          ? { x: 0, y: 1 }
          : null;
  if (want && !(want.x === -s.dir.x && want.y === -s.dir.y)) s.dir = want;

  s.acc += dt;
  let guard = 0;
  while (s.acc >= SNAKE.step && guard++ < 8) {
    s.acc -= SNAKE.step;
    const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= GRID_W || head.y >= GRID_H) {
      s.phase = "lost";
      return;
    }
    /* 尾巴那一格不算（它这一步就让开了） */
    for (let i = 0; i < s.body.length - 1; i++) {
      if (s.body[i].x === head.x && s.body[i].y === head.y) {
        s.phase = "lost";
        return;
      }
    }

    s.body.unshift(head);
    if (head.x === s.pellet.x && head.y === s.pellet.y) {
      s.score++;
      respawnPellet(s);
    } else {
      s.body.pop();
    }
  }

  if (s.score >= META.snake.goal) s.phase = "won";
}

function drawSnake(ctx: CanvasRenderingContext2D, s: SnakeState, p: Palette): void {
  cell(ctx, s.pellet.x, s.pellet.y, 1, 1, p.accent);
  cell(ctx, s.pellet.x + 0.25, s.pellet.y + 0.25, 0.5, 0.5, p.fg);
  s.body.forEach((c, i) => {
    cell(ctx, c.x, c.y, 1, 1, i === 0 ? p.fg : p.accent);
    if (i !== 0) cell(ctx, c.x, c.y, 1, 0.25, p.bg);
  });
}

/* 待机演示全靠这个：一开始写的是「朝果子直着走」的贪心，实测 12 局里死 3 局——
   它会把脖子拐进自己圈出来的死角。改成会保命的版本：
   ① 只走不会立刻撞墙/咬身体的格子（尾巴那一格不算，它这一步就让开了）；
   ② 优先走「走完还能追到自己尾巴」的格子（能追到尾巴 = 没把自己关死），在这批里挑离果子最近的；
   ③ 实在都被堵死（尾巴不可达）时，退而求其次挑空地最大的那格，尽量多活几拍等局面松动。 */
function autoSnake(s: SnakeState, input: Input): void {
  const h = s.body[0];
  const tail = s.body[s.body.length - 1];

  const isBody = (x: number, y: number): boolean => {
    for (let i = 0; i < s.body.length - 1; i++) {
      if (s.body[i].x === x && s.body[i].y === y) return true;
    }
    return false;
  };
  const free = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && !isBody(x, y);

  const DIRS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  /** 从 (sx,sy) 到目标的步数；到不了返回 Infinity。场地小（768 格），每拍跑一次无所谓 */
  const bfsTo = (sx: number, sy: number, tx: number, ty: number): number => {
    const seen = new Set<number>([sx * GRID_W + sy]);
    let frontier = [{ x: sx, y: sy }];
    let dist = 0;
    while (frontier.length) {
      dist++;
      const next: { x: number; y: number }[] = [];
      for (const c of frontier) {
        for (const d of DIRS) {
          const nx = c.x + d.x;
          const ny = c.y + d.y;
          if (!free(nx, ny)) continue;
          if (nx === tx && ny === ty) return dist;
          const id = nx * GRID_W + ny;
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({ x: nx, y: ny });
        }
      }
      frontier = next;
    }
    return Infinity;
  };

  /** 从 (sx,sy) 能踏到的空地格数——走投无路时按这个挑最宽敞的出口 */
  const floodArea = (sx: number, sy: number): number => {
    if (!free(sx, sy)) return 0;
    const seen = new Set<number>([sx * GRID_W + sy]);
    const stack = [{ x: sx, y: sy }];
    let n = 0;
    while (stack.length) {
      const c = stack.pop() as { x: number; y: number };
      n++;
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        if (!free(nx, ny)) continue;
        const id = nx * GRID_W + ny;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push({ x: nx, y: ny });
      }
    }
    return n;
  };

  interface Cand {
    x: number;
    y: number;
    step: number;
    tailDist: number;
    area: number;
  }
  const cands: Cand[] = [];
  for (const d of DIRS) {
    if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
    const nx = h.x + d.x;
    const ny = h.y + d.y;
    if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
    if (isBody(nx, ny)) continue;
    cands.push({
      x: d.x,
      y: d.y,
      step: Math.abs(nx - s.pellet.x) + Math.abs(ny - s.pellet.y),
      tailDist: bfsTo(nx, ny, tail.x, tail.y),
      area: 0,
    });
  }
  if (!cands.length) return;

  const safe = cands.filter((c) => c.tailDist !== Infinity);
  let pick: Cand;
  if (safe.length) {
    safe.sort((a, b) => a.step - b.step);
    pick = safe[0];
  } else {
    for (const c of cands) c.area = floodArea(h.x + c.x, h.y + c.y);
    cands.sort((a, b) => b.area - a.area);
    pick = cands[0];
  }

  input.left = pick.x < 0;
  input.right = pick.x > 0;
  input.up = pick.y < 0;
  input.down = pick.y > 0;
}

/* ==========================================================================
   对外接口
   ========================================================================== */

export function create(key: GameKey): State {
  if (key === "catch") return newCatch();
  if (key === "brick") return newBrick();
  return newSnake();
}

export function step(s: State, input: Input, dt: number): void {
  if (s.phase !== "playing") return;
  if (s.key === "catch") stepCatch(s, input, dt);
  else if (s.key === "brick") stepBrick(s, input, dt);
  else stepSnake(s, input, dt);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  s: State,
  p: Palette
): void {
  begin(ctx, p);
  field(ctx, p);
  if (s.key === "catch") drawCatch(ctx, s, p);
  else if (s.key === "brick") drawBrick(ctx, s, p);
  else drawSnake(ctx, s, p);
}

/** 待机画面的自动输入。传进来的 input 会被就地改写，别复用同一个对象。 */
export function auto(s: State, input: Input): Input {
  if (s.key === "catch") autoCatch(s, input);
  else if (s.key === "brick") autoBrick(s, input);
  else autoSnake(s, input);
  return input;
}
