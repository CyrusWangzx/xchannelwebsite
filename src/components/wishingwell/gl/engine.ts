/**
 * 许愿池 · 渲染引擎（手写 WebGL2，零依赖）
 *
 * 一帧的四个 pass：
 *   ① 池底 pass   → floorTex      池底石材 + 已落底的硬币 + **水下的鱼**
 *   ② 主场景 pass → sceneTex      池壁 / 池沿 / 水面 / 漂流瓶 / 在飞的硬币 / 水花
 *   ③ 泛光 pass   → bloomA        亮部提取 + 两轮可分离高斯（半分辨率）
 *   ④ 合成 pass   → 屏幕          scene + bloom，叠暗角
 *
 * 水面着色器自己去采样 floorTex 做折射，所以「透过水看池底的硬币」是
 * 真·折射采样，不是两层半透明叠在一起。鱼也因此画在 ① 里而不是独立一层：
 * 它自动被水色吸收、被涟漪扭曲，且没有透明排序问题。
 *
 * 性能三条：
 *   · 硬币 1 次 drawElementsInstanced（上限 1000），瓶子 1 次，水花 1 次，鱼 1 次
 *   · 硬币数 > 800 时，池底 pass 的产物**烘成纹理复用**，不再每帧重画
 *     （WebGL2 没有 baseInstance，所以落底的与在飞的拆两条缓冲）
 *     ⚠️ 但鱼在动 ⇒ 只要鱼在游，池底就必须每帧重画，烘焙自动让位
 *   · 画布分辨率按 DPR 自适应，上限由外部传入
 */
import {
  ATTRIB,
  bindTarget,
  createGL,
  createProgram,
  createTarget,
  disposeTarget,
  type Program,
  type RenderTarget,
} from "./glutil";
import {
  BOTTLE_HEIGHT,
  POOL_RADIUS,
  RIM_HEIGHT,
  WATER_LEVEL,
  disposeGeometry,
  makeBottle,
  makeCoin,
  makeDisc,
  makeFish,
  makePoolOuter,
  makePoolWall,
  makeQuad,
  makeRim,
  makeSphere,
  uploadInstancedGeometry,
  uploadStaticGeometry,
  INSTANCE_STRIDE_FLOATS,
  type UploadedGeometry,
} from "./geometries";
import {
  BOTTLE_FS,
  COIN_FS,
  FISH_FS,
  FISH_VS,
  FLOOR_FS,
  INSTANCED_VS,
  SPLASH_FS,
  STATIC_VS,
  WALL_FS,
} from "./materials";
import { WATER_FS, WATER_VS } from "./water";
import { BLUR_FS, BRIGHT_FS, COMPOSITE_FS, POST_VS } from "./post";
import { CoinField, MAX_AIRBORNE, MAX_COINS } from "./coinField";
import { BottleField, MAX_BOTTLES } from "./bottleField";
import { FishField, MAX_FISH } from "./fishField";
import { RippleSystem } from "./rippleSystem";
import { SplashSystem } from "./splashSystem";
import { CameraRig } from "../scene/cameraRig";
import { ThrowController, type FlightKind } from "../scene/throwController";
import { MAX_RIPPLES } from "../../../lib/wellMath";
import type { Wish } from "../../../lib/wishTypes";

/* ------------------------------------------------------------- 配色 */

export type RGB = [number, number, number];

export interface WellPalette {
  waterDeep: RGB;
  waterShallow: RGB;
  waterRim: RGB;
  stone: RGB;
  stoneDeep: RGB;
  grout: RGB;
  gold: RGB;
  goldDeep: RGB;
  highlight: RGB;
  glass: RGB;
  glassDeep: RGB;
  paper: RGB;
  splash: RGB;
  splashTip: RGB;
  /** 水下的鱼：背部主色 / 斑纹暗部 / 腹部 / 鳍 */
  fish: RGB;
  fishDeep: RGB;
  fishBelly: RGB;
  fishFin: RGB;
  lightDir: RGB;
  specular: number;
  /** 水面法线扰动的放大倍数（作用在高度场的**解析世界空间梯度**上） */
  normalStrength: number;
  /** 折射偏移（0.01–0.03） */
  refractStrength: number;
  /** 掠射角边光强度 */
  rimStrength: number;
  bloomStrength: number;
  bloomThreshold: number;
  vignette: number;
}

/** 令牌读不到时的兜底（正常不会用到，令牌在 index.css 里） */
const FALLBACK: WellPalette = {
  waterDeep: [0.02, 0.08, 0.14],
  waterShallow: [0.06, 0.24, 0.32],
  waterRim: [0.42, 0.76, 0.95],
  stone: [0.16, 0.17, 0.2],
  stoneDeep: [0.07, 0.08, 0.1],
  grout: [0.36, 0.38, 0.42],
  gold: [1, 0.82, 0.38],
  goldDeep: [0.72, 0.5, 0.14],
  highlight: [1, 0.93, 0.66],
  glass: [0.42, 0.72, 0.78],
  glassDeep: [0.18, 0.42, 0.5],
  paper: [0.94, 0.9, 0.78],
  splash: [0.72, 0.88, 1],
  splashTip: [1, 1, 1],
  fish: [0.89, 0.45, 0.25],
  fishDeep: [0.59, 0.24, 0.16],
  fishBelly: [0.96, 0.91, 0.82],
  fishFin: [0.84, 0.69, 0.55],
  lightDir: [-0.42, 0.82, 0.38],
  specular: 0.5,
  normalStrength: 1.6,
  refractStrength: 0.02,
  rimStrength: 0.42,
  bloomStrength: 0.6,
  bloomThreshold: 0.78,
  vignette: 0.34,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function readTriple(
  style: CSSStyleDeclaration,
  name: string,
  fallback: RGB,
): RGB {
  const raw = style.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return fallback;
  return [
    clamp01(parts[0] / 255),
    clamp01(parts[1] / 255),
    clamp01(parts[2] / 255),
  ];
}

/**
 * 读一个「有符号向量」令牌。
 * ⚠️ 方向向量不是颜色：**不能除以 255，也不能 clamp 到 [0,1]**。
 * 早先误用 readTriple 读 --well-light-rgb，负分量被 clamp 成 0、
 * 正分量被压到 0.003，归一化后光变成「几乎正上方」，明暗关系整个错掉。
 */
function readSigned(style: CSSStyleDeclaration, name: string, fallback: RGB): RGB {
  const raw = style.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return fallback;
  return [parts[0], parts[1], parts[2]];
}

function readNum(
  style: CSSStyleDeclaration,
  name: string,
  fallback: number,
): number {
  const raw = style.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * 从 CSS 令牌读出整套配色。
 * 这样「换配色」仍然只有 index.css 一个入口，引擎这边不写死任何颜色。
 */
export function readPalette(el: HTMLElement): WellPalette {
  const style = getComputedStyle(el);
  return {
    waterDeep: readTriple(style, "--c-well-water-deep-rgb", FALLBACK.waterDeep),
    waterShallow: readTriple(
      style,
      "--c-well-water-shallow-rgb",
      FALLBACK.waterShallow,
    ),
    waterRim: readTriple(style, "--c-well-water-rim-rgb", FALLBACK.waterRim),
    stone: readTriple(style, "--c-well-stone-rgb", FALLBACK.stone),
    stoneDeep: readTriple(style, "--c-well-stone-deep-rgb", FALLBACK.stoneDeep),
    grout: readTriple(style, "--c-well-grout-rgb", FALLBACK.grout),
    gold: readTriple(style, "--c-well-gold-rgb", FALLBACK.gold),
    goldDeep: readTriple(style, "--c-well-gold-deep-rgb", FALLBACK.goldDeep),
    highlight: readTriple(style, "--c-well-highlight-rgb", FALLBACK.highlight),
    glass: readTriple(style, "--c-well-glass-rgb", FALLBACK.glass),
    glassDeep: readTriple(style, "--c-well-glass-deep-rgb", FALLBACK.glassDeep),
    paper: readTriple(style, "--c-well-paper-rgb", FALLBACK.paper),
    splash: readTriple(style, "--c-well-splash-rgb", FALLBACK.splash),
    splashTip: readTriple(style, "--c-well-splash-tip-rgb", FALLBACK.splashTip),
    fish: readTriple(style, "--c-well-fish-rgb", FALLBACK.fish),
    fishDeep: readTriple(style, "--c-well-fish-deep-rgb", FALLBACK.fishDeep),
    fishBelly: readTriple(style, "--c-well-fish-belly-rgb", FALLBACK.fishBelly),
    fishFin: readTriple(style, "--c-well-fish-fin-rgb", FALLBACK.fishFin),
    lightDir: readSigned(style, "--well-light-rgb", FALLBACK.lightDir),
    specular: readNum(style, "--well-specular", FALLBACK.specular),
    normalStrength: readNum(
      style,
      "--well-normal-strength",
      FALLBACK.normalStrength,
    ),
    refractStrength: readNum(
      style,
      "--well-refract-strength",
      FALLBACK.refractStrength,
    ),
    rimStrength: readNum(style, "--well-rim-strength", FALLBACK.rimStrength),
    bloomStrength: readNum(style, "--well-bloom-strength", FALLBACK.bloomStrength),
    bloomThreshold: readNum(
      style,
      "--well-bloom-threshold",
      FALLBACK.bloomThreshold,
    ),
    vignette: readNum(style, "--well-vignette", FALLBACK.vignette),
  };
}

/* ------------------------------------------------------- 池底烘焙决策 */

/** 超过这个数量才启用池底烘焙 */
export const BAKE_COIN_THRESHOLD = 800;
/** 即便没有变化，也最多缓存这么久就重烘一次 */
export const BAKE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 池底要不要重画？（纯函数，离线单测直接覆盖）
 *   · 硬币不多 → 每帧重画（不烘）
 *   · 硬币很多 → 只在「有变化」或「超过 5 分钟」时重烘
 */
export function shouldBakeFloor(
  coinCount: number,
  nowMs: number,
  lastBakeMs: number,
  dirty: boolean,
): boolean {
  if (coinCount <= BAKE_COIN_THRESHOLD) return false;
  if (dirty) return true;
  return nowMs - lastBakeMs >= BAKE_INTERVAL_MS;
}

/* ------------------------------------------------------------- 引擎 */

export interface WellPick {
  id: string;
  kind: FlightKind;
  /** 命中时物体的屏幕位置（HTML 卡片要浮在这里） */
  x: number;
  y: number;
}

export interface EngineHooks {
  onPick?(pick: WellPick | null): void;
  onHover?(pick: WellPick | null): void;
  /** 有东西落水 */
  onSplash?(kind: FlightKind): void;
  /** 首帧画完（用来关掉 loading 骨架） */
  onReady?(): void;
  onError?(message: string): void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  palette?: WellPalette;
  hooks?: EngineHooks;
  reducedMotion?: boolean;
  maxDpr?: number;
}

export interface WellStats {
  coins: number;
  bottles: number;
  fish: number;
  ripples: number;
  particles: number;
  flights: number;
  drawCalls: number;
  settledInstances: number;
  airborneInstances: number;
  floorBaked: boolean;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  reducedMotion: boolean;
  ready: boolean;
}

const BLEND_STRAIGHT = (gl: WebGL2RenderingContext) => {
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
};

export class WellEngine {
  readonly camera: CameraRig;
  readonly coins = new CoinField();
  readonly bottles = new BottleField();
  readonly fish = new FishField();
  readonly ripples = new RippleSystem(POOL_RADIUS);
  readonly splash = new SplashSystem();
  readonly thrower: ThrowController;

  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private hooks: EngineHooks;
  private palette: WellPalette;
  private maxDpr: number;
  private reducedMotion = false;

  /* programs */
  private progStatic!: Program;
  private progWall!: Program;
  private progFloor!: Program;
  private progWater!: Program;
  private progCoin!: Program;
  private progBottle!: Program;
  private progFish!: Program;
  private progSplash!: Program;
  private progBright!: Program;
  private progBlur!: Program;
  private progComposite!: Program;

  /* geometry */
  private gFloor!: UploadedGeometry;
  private gWall!: UploadedGeometry;
  private gOuter!: UploadedGeometry;
  private gRim!: UploadedGeometry;
  private gWater!: UploadedGeometry;
  private gQuad!: UploadedGeometry;
  private gCoinFloor!: UploadedGeometry;
  private gCoinAir!: UploadedGeometry;
  private gBottle!: UploadedGeometry;
  private gFish!: UploadedGeometry;
  private gSplash!: UploadedGeometry;

  /* instance buffers */
  private coinBuf!: WebGLBuffer;
  private airBuf!: WebGLBuffer;
  private bottleBuf!: WebGLBuffer;
  private fishBuf!: WebGLBuffer;
  private splashBuf!: WebGLBuffer;

  /* targets */
  private floorTex!: RenderTarget;
  private sceneTex!: RenderTarget;
  private bloomA!: RenderTarget;
  private bloomB!: RenderTarget;

  /* state */
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;
  private elapsed = 0;
  private raf = 0;
  private lastTime = 0;
  private running = false;
  private ready = false;
  private drawCalls = 0;
  private floorBaked = false;
  private floorDirty = true;
  private lastBakeAt = 0;
  private hoveredId: string | null = null;
  private pendingSeq = 0;
  private disposed = false;

  constructor(opts: EngineOptions) {
    const gl = createGL(opts.canvas);
    if (!gl) throw new Error("WEBGL2_UNAVAILABLE");
    this.gl = gl;
    this.canvas = opts.canvas;
    this.hooks = opts.hooks ?? {};
    this.palette = opts.palette ?? FALLBACK;
    this.maxDpr = opts.maxDpr ?? 2;
    this.reducedMotion = Boolean(opts.reducedMotion);

    this.camera = new CameraRig({ drift: !this.reducedMotion });
    this.thrower = new ThrowController(this.ripples, this.splash);

    this.initPrograms();
    this.initGeometry();
    this.initBuffers();
    this.initTargets(1, 1);

    gl.disable(gl.CULL_FACE); /* 池壁内外两侧都要画，见 geometries 注释 */
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  private initPrograms() {
    const gl = this.gl;
    this.progStatic = createProgram(gl, STATIC_VS, WALL_FS, "wall");
    this.progFloor = createProgram(gl, STATIC_VS, FLOOR_FS, "floor");
    this.progWater = createProgram(gl, WATER_VS, WATER_FS, "water");
    this.progCoin = createProgram(gl, INSTANCED_VS, COIN_FS, "coin");
    this.progBottle = createProgram(gl, INSTANCED_VS, BOTTLE_FS, "bottle");
    this.progFish = createProgram(gl, FISH_VS, FISH_FS, "fish");
    this.progSplash = createProgram(gl, INSTANCED_VS, SPLASH_FS, "splash");
    this.progBright = createProgram(gl, POST_VS, BRIGHT_FS, "bright");
    this.progBlur = createProgram(gl, POST_VS, BLUR_FS, "blur");
    this.progComposite = createProgram(gl, POST_VS, COMPOSITE_FS, "composite");
  }

  private initGeometry() {
    const gl = this.gl;
    /* ⚠️ 池底圆盘要比池子**大一圈**（这里是 1.7×）。
       池底 pass 的产物只被水面着色器采样（主 pass 不画池底，池底是被池壁挡住的），
       而水面是斜着看的：远侧那条水线沿视线穿下去会落到池**外**（现实中那里被
       池壁挡住、看不到池底）。圆盘按真实半径 5 画，那片区域就是透明 → 水面折射
       采样到 rgb=0 → 糊出硬边黑块。放大圆盘之后，折射永远采得到石材。
       图案本身仍按 uPoolRadius=5 排布，所以池内看起来没有任何变化。 */
    this.gFloor = uploadStaticGeometry(
      gl,
      makeDisc(POOL_RADIUS * 1.7, 0, 96),
    );
    this.gWall = uploadStaticGeometry(gl, makePoolWall());
    this.gOuter = uploadStaticGeometry(gl, makePoolOuter());
    this.gRim = uploadStaticGeometry(gl, makeRim());
    this.gWater = uploadStaticGeometry(
      gl,
      makeDisc(POOL_RADIUS - 0.02, WATER_LEVEL, 96),
      true,
    );
    this.gQuad = uploadStaticGeometry(gl, makeQuad(), true);

    /* 硬币几何挂两条缓冲：落底的 / 在飞的 */
    const coinGeo = makeCoin();
    this.coinBuf = this.createInstanceBuffer(MAX_COINS);
    this.airBuf = this.createInstanceBuffer(MAX_AIRBORNE);
    this.gCoinFloor = uploadInstancedGeometry(gl, coinGeo, this.coinBuf);
    this.gCoinAir = uploadInstancedGeometry(gl, coinGeo, this.airBuf);

    this.bottleBuf = this.createInstanceBuffer(MAX_BOTTLES);
    this.gBottle = uploadInstancedGeometry(gl, makeBottle(), this.bottleBuf);

    /* 鱼：几何自带 uv（uv.x 是材质槽：0=身 1=鳍），所以最后一个参数是 true */
    this.fishBuf = this.createInstanceBuffer(MAX_FISH);
    this.gFish = uploadInstancedGeometry(gl, makeFish(), this.fishBuf, true);

    this.splashBuf = this.createInstanceBuffer(120);
    this.gSplash = uploadInstancedGeometry(gl, makeSphere(), this.splashBuf);
  }

  private initBuffers() {
    /* 在 initGeometry 里按需创建，这里只做兜底断言 */
  }

  private createInstanceBuffer(maxInstances: number): WebGLBuffer {
    const gl = this.gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      maxInstances * INSTANCE_STRIDE_FLOATS * 4,
      gl.DYNAMIC_DRAW,
    );
    return buf;
  }

  private initTargets(w: number, h: number) {
    this.disposeTargets();
    const gl = this.gl;
    this.floorTex = createTarget(gl, w, h, true);
    this.sceneTex = createTarget(gl, w, h, true);
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));
    this.bloomA = createTarget(gl, hw, hh, false);
    this.bloomB = createTarget(gl, hw, hh, false);
    this.floorBaked = false;
    this.floorDirty = true;
  }

  private disposeTargets() {
    const gl = this.gl;
    for (const t of [this.floorTex, this.sceneTex, this.bloomA, this.bloomB]) {
      if (t) disposeTarget(gl, t);
    }
  }

  /* ------------------------------------------------------------ 对外 */

  setPalette(p: WellPalette) {
    this.palette = p;
  }

  /**
   * 开发期「调参入口」：只覆盖传入的几个字段，其余保持不变，返回合并后的整套。
   * 用来在浏览器里二分定位水面/泛光的观感问题（`__xchannelWell.tune({...})`），
   * 不用每次改 index.css 再等重跑。生产包里没有这个入口（桥本身被 DEV 挡着）。
   */
  patchPalette(partial: Partial<WellPalette>): WellPalette {
    this.palette = { ...this.palette, ...partial };
    return this.palette;
  }

  /** 从元素身上重新读一遍令牌（主题切换后调用） */
  refreshPaletteFrom(el: HTMLElement) {
    this.palette = readPalette(el);
  }

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
    this.camera.setDrift(!v);
  }

  /** 数据源变化 → 重建硬币/瓶子场 */
  setWishes(wishes: Wish[]) {
    this.coins.sync(wishes);
    this.bottles.sync(wishes);
    this.floorDirty = true;
  }

  /** 乐观插入一个幽灵（提交成功时） */
  addGhost(wish: Wish) {
    if (wish.kind === "coin") this.coins.addGhost(wish.id);
    else this.bottles.addGhost(wish.id);
    this.floorDirty = true;
  }

  /** 幽灵转正：把投掷时用的临时 id 换成真实 id */
  promote(tempId: string, realId: string) {
    if (this.coins.rename(tempId, realId)) return;
    this.bottles.rename(tempId, realId);
  }

  /** 放弃（关掉表单没提交）：把那一枚撤掉 */
  discard(id: string) {
    if (!this.coins.remove(id)) this.bottles.remove(id);
    this.floorDirty = true;
  }

  removeById(id: string) {
    this.discard(id);
  }

  /**
   * 出手点。默认在相机前方偏下（从池子前下方飞进去，最像「投」）；
   * 如果给了 startScreen（拖拽起始的屏幕位置），就沿那条视线取，
   * 这样拖拽时抛物线是从手指那一点起飞的。
   */
  private throwStart(
    kind: FlightKind,
    water: { x: number; z: number } | null,
    startScreen?: { x: number; y: number },
  ): [number, number, number] {
    if (startScreen) {
      const p = this.camera.screenToDistance(startScreen.x, startScreen.y, 9.4);
      return [p[0], Math.max(1.4, p[1]), p[2]];
    }
    const side = water && Math.abs(water.x) > 0.4 ? Math.sign(water.x) : 1;
    return kind === "coin" ? [side * 2.4, 2.9, 8.6] : [side * 2.9, 3.3, 9.0];
  }

  /**
   * 投一枚。
   * @param kind 硬币 / 瓶子
   * @param screen 屏幕坐标（落点）
   * @param power 0..1，水花大小
   * @param startScreen 拖拽起始点（可选）
   * @returns 临时 id（提交前用它引用这一枚）
   */
  beginThrow(
    kind: FlightKind,
    screen: { x: number; y: number },
    power = 1,
    startScreen?: { x: number; y: number },
  ): string | null {
    const id = `pending:${++this.pendingSeq}`;
    const inst =
      kind === "coin" ? this.coins.addGhost(id) : this.bottles.addGhost(id);
    if (!inst) return null;

    const water = this.camera.screenToPlane(screen.x, screen.y, WATER_LEVEL);
    this.thrower.launch(kind, inst, this.throwStart(kind, water, startScreen), power);
    this.floorDirty = true;
    return id;
  }

  /** 拖拽时的抛物线预览（屏幕点列，交给 SVG 覆盖层画虚线） */
  previewArc(
    kind: FlightKind,
    screen: { x: number; y: number },
    startScreen?: { x: number; y: number },
  ): { x: number; y: number }[] {
    const water = this.camera.screenToPlane(screen.x, screen.y, WATER_LEVEL);
    if (!water) return [];
    return this.thrower.projectArc(
      kind,
      this.throwStart(kind, water, startScreen),
      water,
      (p) => this.camera.worldToScreen(p),
      22,
    );
  }

  /** 屏幕点是否落在池子内（决定「投出去」还是「作废」） */
  isOverPool(px: number, py: number): boolean {
    const water = this.camera.screenToPlane(px, py, WATER_LEVEL);
    if (!water) return false;
    return Math.hypot(water.x, water.z) <= POOL_RADIUS * 0.96;
  }

  /** 屏幕坐标命中哪一枚（把物体中心投影到屏幕做最近邻，不用 GPU 拾取） */
  pickAt(px: number, py: number): WellPick | null {
    const cam = this.camera;
    let best: WellPick | null = null;
    let bestDist = Infinity;

    const consider = (
      id: string,
      kind: FlightKind,
      wx: number,
      wy: number,
      wz: number,
      radius: number,
    ) => {
      const s = cam.worldToScreen([wx, wy, wz]);
      if (!s) return;
      const edge = cam.worldToScreen([wx + radius, wy, wz]);
      const rpx = edge ? Math.max(9, Math.min(64, Math.abs(edge.x - s.x) * 1.7)) : 14;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d <= rpx && d < bestDist) {
        bestDist = d;
        best = { id, kind, x: s.x, y: s.y };
      }
    };

    for (const c of this.coins.instances) {
      consider(c.id, "coin", c.x, c.y + 0.12, c.z, 0.16);
    }
    for (const b of this.bottles.instances) {
      consider(b.id, "bottle", b.x, b.y + BOTTLE_HEIGHT * 0.5, b.z, 0.14);
    }

    return best;
  }

  /** 悬停高亮（物体轻微放大） */
  setHover(pick: WellPick | null) {
    const id = pick?.id ?? null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.hooks.onHover?.(pick);
  }

  /** 鼠标按下命中（返回是否命中物体，用于决定「点物体看卡片」还是「投掷」） */
  clickAt(px: number, py: number): WellPick | null {
    const pick = this.pickAt(px, py);
    this.hooks.onPick?.(pick);
    return pick;
  }

  orbitBy(dx: number, dy: number) {
    this.camera.orbitBy(dx, dy);
  }

  zoomBy(delta: number) {
    this.camera.zoomBy(delta);
  }

  setMaxDpr(v: number) {
    this.maxDpr = v;
  }

  /**
   * 把模拟推进若干秒（不依赖 rAF）。
   * 验收脚本用它跳过 0.9 秒的飞行/0.6 秒的下沉，不必真的 sleep 等动画。
   * 走的是和帧循环完全相同的更新顺序，所以状态是一致的。
   */
  fastForward(seconds: number) {
    const step = 1 / 60;
    let left = Math.max(0, seconds);
    while (left > 0) {
      const dt = Math.min(step, left);
      this.elapsed += dt;
      this.bottles.update(this.elapsed);
      this.fish.update(this.elapsed, this.reducedMotion);
      this.thrower.update(dt);
      this.splash.update(dt);
      this.ripples.update(dt);
      left -= dt;
    }
    this.floorDirty = true;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      try {
        this.frame(dt, now);
      } catch (err) {
        this.hooks.onError?.(err instanceof Error ? err.message : String(err));
        this.stop();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /* ------------------------------------------------------------ 帧 */

  private resizeIfNeeded(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height) {
      this.dpr = dpr;
      this.viewW = rect.width;
      this.viewH = rect.height;
      return false;
    }
    this.dpr = dpr;
    this.viewW = Math.max(1, rect.width);
    this.viewH = Math.max(1, rect.height);
    this.canvas.width = w;
    this.canvas.height = h;
    /* 相机用 **CSS 像素**空间：指针事件给的就是 CSS 像素，
       这样 screenToPlane / worldToScreen 可以直接吃事件坐标，不用再换算 dpr。
       帧缓冲仍然用设备像素（见 bindTarget 的 viewport）。 */
    this.camera.setSize(this.viewW, this.viewH);
    this.initTargets(w, h);
    return true;
  }

  private uploadInstanced(
    buf: WebGLBuffer,
    data: Float32Array,
    count: number,
  ) {
    if (count <= 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * INSTANCE_STRIDE_FLOATS);
  }

  private frame(dt: number, now: number) {
    if (this.disposed) return;
    this.resizeIfNeeded();

    /* 动效关闭时：时间仍然推进（涟漪/水波要有个静态解），但不做飞行 */
    this.elapsed += dt;
    this.camera.update(dt);

    this.bottles.update(this.elapsed);
    this.fish.update(this.elapsed, this.reducedMotion);
    this.thrower.update(dt);
    this.splash.update(dt);
    this.ripples.update(dt);

    /* 悬停缓动 */
    for (const c of this.coins.instances) {
      const target = c.id === this.hoveredId ? 1 : 0;
      c.hover += (target - c.hover) * Math.min(1, dt * 9);
    }
    for (const b of this.bottles.instances) {
      const target = b.id === this.hoveredId ? 1 : 0;
      b.hover += (target - b.hover) * Math.min(1, dt * 9);
    }

    this.coins.writeBuffers(this.elapsed);
    this.bottles.writeBuffers();
    this.fish.writeBuffers(this.reducedMotion ? 3.1 : this.elapsed);
    this.splash.writeBuffers();

    this.uploadInstanced(this.coinBuf, this.coins.data, this.coins.settledCount);
    this.uploadInstanced(this.airBuf, this.coins.airData, this.coins.airCount);
    this.uploadInstanced(this.bottleBuf, this.bottles.data, this.bottles.count);
    this.uploadInstanced(this.fishBuf, this.fish.data, this.fish.count);
    this.uploadInstanced(this.splashBuf, this.splash.data, this.splash.count);

    this.drawCalls = 0;

    /* ① 池底
       ⚠️ 鱼在水下、画在池底 pass 里，只要鱼在动，这张纹理就必须每帧重画 ——
       否则鱼会定格（硬币的烘焙复用与鱼的动画天然互斥）。reduce-motion 下
       鱼是静止的，烘焙照旧生效。 */
    const bakeActive = this.coins.count > BAKE_COIN_THRESHOLD;
    const fishMoving = this.fish.count > 0 && !this.reducedMotion;
    const repaintFloor =
      fishMoving ||
      !bakeActive ||
      !this.floorBaked ||
      shouldBakeFloor(
        this.coins.count,
        now,
        this.lastBakeAt,
        this.floorDirty,
      );
    if (repaintFloor) {
      this.renderFloorPass();
      this.floorBaked = bakeActive && !fishMoving;
      this.lastBakeAt = now;
      this.floorDirty = false;
    }

    /* ② 主场景 */
    this.renderMainPass();

    /* ③④ 泛光 + 合成 */
    this.renderPost();

    if (!this.ready) {
      this.ready = true;
      this.hooks.onReady?.();
    }
  }

  private useStatic(p: Program, vp: Float32Array) {
    const gl = this.gl;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.u("uViewProj"), false, vp);
  }

  private drawStatic(g: UploadedGeometry) {
    const gl = this.gl;
    gl.bindVertexArray(g.vao);
    gl.drawElements(gl.TRIANGLES, g.count, g.indexType, 0);
    this.drawCalls++;
  }

  private drawInstanced(g: UploadedGeometry, count: number) {
    if (count <= 0) return;
    const gl = this.gl;
    gl.bindVertexArray(g.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, g.count, g.indexType, 0, count);
    this.drawCalls++;
  }

  private renderFloorPass() {
    const gl = this.gl;
    const vp = this.camera.viewProj;

    bindTarget(gl, this.floorTex, this.canvas.width, this.canvas.height);    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    BLEND_STRAIGHT(gl);

    /* 池底石材 */
    const f = this.progFloor;
    this.useStatic(f, vp);
    gl.uniform3fv(f.u("uStone"), this.palette.stone);
    gl.uniform3fv(f.u("uStoneDeep"), this.palette.stoneDeep);
    gl.uniform3fv(f.u("uGrout"), this.palette.grout);
    gl.uniform1f(f.u("uPoolRadius"), POOL_RADIUS);
    gl.uniform3fv(f.u("uLightDir"), this.lightVector());
    gl.uniform3fv(f.u("uCameraPos"), this.camera.eye);
    gl.uniform1f(f.u("uTime"), this.elapsed);
    this.drawStatic(this.gFloor);

    /* 已落底的硬币 */
    const c = this.progCoin;
    gl.useProgram(c.program);
    gl.uniformMatrix4fv(c.u("uViewProj"), false, vp);
    gl.uniform3fv(c.u("uGold"), this.palette.gold);
    gl.uniform3fv(c.u("uGoldDeep"), this.palette.goldDeep);
    gl.uniform3fv(c.u("uHighlight"), this.palette.highlight);
    gl.uniform3fv(c.u("uLightDir"), this.lightVector());
    gl.uniform3fv(c.u("uCameraPos"), this.camera.eye);
    gl.uniform1f(c.u("uCoinRadius"), 0.16);
    gl.uniform1f(c.u("uCoinThick"), 0.046);
    gl.uniform1f(c.u("uTime"), this.elapsed);
    this.drawInstanced(this.gCoinFloor, this.coins.settledCount);

    /* 水下的鱼：画在这里（而不是主 pass），水面折射时才会把它们一起「泡」进水里。
       放在硬币之后 —— 鱼浮在池底硬币上方，先画的先被覆盖，深度测试也是对的。 */
    const fp = this.progFish;
    gl.useProgram(fp.program);
    gl.uniformMatrix4fv(fp.u("uViewProj"), false, vp);
    gl.uniform3fv(fp.u("uFish"), this.palette.fish);
    gl.uniform3fv(fp.u("uFishDeep"), this.palette.fishDeep);
    gl.uniform3fv(fp.u("uFishBelly"), this.palette.fishBelly);
    gl.uniform3fv(fp.u("uFishFin"), this.palette.fishFin);
    gl.uniform3fv(fp.u("uLightDir"), this.lightVector());
    gl.uniform3fv(fp.u("uCameraPos"), this.camera.eye);
    this.drawInstanced(this.gFish, this.fish.count);
  }

  private lightVector(): Float32Array {
    const l = this.palette.lightDir;
    const len = Math.hypot(l[0], l[1], l[2]) || 1;
    return new Float32Array([l[0] / len, l[1] / len, l[2] / len]);
  }

  private renderMainPass() {
    const gl = this.gl;
    const vp = this.camera.viewProj;

    bindTarget(gl, this.sceneTex, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* 池壁（内外两侧） */
    const w = this.progStatic;
    this.useStatic(w, vp);
    gl.uniform3fv(w.u("uStone"), this.palette.stone);
    gl.uniform3fv(w.u("uStoneDeep"), this.palette.stoneDeep);
    gl.uniform3fv(w.u("uGrout"), this.palette.grout);
    gl.uniform1f(w.u("uRimHeight"), RIM_HEIGHT);
    gl.uniform3fv(w.u("uLightDir"), this.lightVector());
    gl.uniform3fv(w.u("uCameraPos"), this.camera.eye);
    this.drawStatic(this.gWall);
    this.drawStatic(this.gOuter);
    this.drawStatic(this.gRim);

    /* 水面（自己采样池底纹理做折射） */
    const wt = this.progWater;
    this.useStatic(wt, vp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.floorTex.tex);
    gl.uniform1i(wt.u("uFloorTex"), 0);
    gl.uniform2f(wt.u("uResolution"), this.canvas.width, this.canvas.height);
    gl.uniform1f(wt.u("uPoolRadius"), POOL_RADIUS);
    gl.uniform1f(wt.u("uTime"), this.elapsed);
    gl.uniform4fv(wt.u("uRipple"), this.ripples.uniforms);
    gl.uniform1f(wt.u("uNormalStrength"), this.palette.normalStrength);
    gl.uniform1f(wt.u("uRefractStrength"), this.palette.refractStrength);
    gl.uniform3fv(wt.u("uShallow"), this.palette.waterShallow);
    gl.uniform3fv(wt.u("uDeep"), this.palette.waterDeep);
    gl.uniform3fv(wt.u("uRimColor"), this.palette.waterRim);
    gl.uniform1f(wt.u("uRimStrength"), this.palette.rimStrength);
    gl.uniform3fv(wt.u("uLightDir"), this.lightVector());
    gl.uniform1f(wt.u("uSpecular"), this.palette.specular);
    this.drawStatic(this.gWater);

    /* 以下都要混合 */
    BLEND_STRAIGHT(gl);

    /* 漂流瓶 */
    const bp = this.progBottle;
    gl.useProgram(bp.program);
    gl.uniformMatrix4fv(bp.u("uViewProj"), false, vp);
    gl.uniform3fv(bp.u("uGlass"), this.palette.glass);
    gl.uniform3fv(bp.u("uGlassDeep"), this.palette.glassDeep);
    gl.uniform3fv(bp.u("uPaper"), this.palette.paper);
    gl.uniform3fv(bp.u("uHighlight"), this.palette.highlight);
    gl.uniform1f(bp.u("uBottleHeight"), BOTTLE_HEIGHT);
    gl.uniform1f(bp.u("uTime"), this.elapsed);
    gl.uniform3fv(bp.u("uLightDir"), this.lightVector());
    gl.uniform3fv(bp.u("uCameraPos"), this.camera.eye);
    this.drawInstanced(this.gBottle, this.bottles.count);

    /* 在飞的（水面之上的）硬币 */
    const c = this.progCoin;
    gl.useProgram(c.program);
    gl.uniformMatrix4fv(c.u("uViewProj"), false, vp);
    gl.uniform3fv(c.u("uGold"), this.palette.gold);
    gl.uniform3fv(c.u("uGoldDeep"), this.palette.goldDeep);
    gl.uniform3fv(c.u("uHighlight"), this.palette.highlight);
    gl.uniform3fv(c.u("uLightDir"), this.lightVector());
    gl.uniform3fv(c.u("uCameraPos"), this.camera.eye);
    gl.uniform1f(c.u("uCoinRadius"), 0.16);
    gl.uniform1f(c.u("uCoinThick"), 0.046);
    gl.uniform1f(c.u("uTime"), this.elapsed);
    this.drawInstanced(this.gCoinAir, this.coins.airCount);

    /* 水花 */
    const sp = this.progSplash;
    gl.useProgram(sp.program);
    gl.uniformMatrix4fv(sp.u("uViewProj"), false, vp);
    gl.uniform3fv(sp.u("uSplash"), this.palette.splash);
    gl.uniform3fv(sp.u("uSplashTip"), this.palette.splashTip);
    gl.uniform3fv(sp.u("uCameraPos"), this.camera.eye);
    this.drawInstanced(this.gSplash, this.splash.count);
  }

  private renderPost() {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;

    gl.disable(gl.DEPTH_TEST);

    /* 亮部提取 → bloomA */
    bindTarget(gl, this.bloomA, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.progBright.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex.tex);
    gl.uniform1i(this.progBright.u("uScene"), 0);
    gl.uniform1f(this.progBright.u("uThreshold"), this.palette.bloomThreshold);
    gl.uniform1f(this.progBright.u("uSoftKnee"), 0.35);
    gl.disable(gl.BLEND);
    this.drawStatic(this.gQuad);

    /* 两轮「横 + 竖」高斯 */
    const blur = this.progBlur;
    gl.useProgram(blur.program);
    gl.uniform1i(blur.u("uSource"), 0);

    const texel = new Float32Array([1 / this.bloomA.width, 1 / this.bloomA.height]);
    for (let i = 0; i < 2; i++) {
      /* 横：bloomA → bloomB */
      bindTarget(gl, this.bloomB, W, H);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
      gl.uniform2fv(blur.u("uTexel"), texel);
      gl.uniform2f(blur.u("uDirection"), 1, 0);
      this.drawStatic(this.gQuad);

      /* 竖：bloomB → bloomA */
      bindTarget(gl, this.bloomA, W, H);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomB.tex);
      gl.uniform2f(blur.u("uDirection"), 0, 1);
      this.drawStatic(this.gQuad);
    }

    /* 合成到屏幕 */
    bindTarget(gl, null, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.progComposite.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex.tex);
    gl.uniform1i(this.progComposite.u("uScene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
    gl.uniform1i(this.progComposite.u("uBloom"), 1);
    gl.uniform1f(
      this.progComposite.u("uBloomStrength"),
      this.palette.bloomStrength,
    );
    gl.uniform1f(this.progComposite.u("uVignette"), this.palette.vignette);
    gl.uniform2f(this.progComposite.u("uResolution"), W, H);
    gl.disable(gl.BLEND);
    this.drawStatic(this.gQuad);

    gl.enable(gl.DEPTH_TEST);
  }

  /* ------------------------------------------------------------ 统计 */

  /** 验收用：鱼群第一条的位姿。比截图更直接（能断言「真的在动」） */
  fishSample() {
    return this.fish.sample();
  }

  getStats(): WellStats {
    return {
      coins: this.coins.count,
      bottles: this.bottles.count,
      fish: this.fish.count,
      ripples: this.ripples.count,
      particles: this.splash.count,
      flights: this.thrower.activeCount,
      drawCalls: this.drawCalls,
      settledInstances: this.coins.settledCount,
      airborneInstances: this.coins.airCount,
      floorBaked: this.floorBaked,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      dpr: this.dpr,
      reducedMotion: this.reducedMotion,
      ready: this.ready,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    const gl = this.gl;
    for (const g of [
      this.gFloor,
      this.gWall,
      this.gOuter,
      this.gRim,
      this.gWater,
      this.gQuad,
      this.gCoinFloor,
      this.gCoinAir,
      this.gBottle,
      this.gFish,
      this.gSplash,
    ]) {
      if (g) disposeGeometry(gl, g);
    }
    for (const b of [
      this.coinBuf,
      this.airBuf,
      this.bottleBuf,
      this.fishBuf,
      this.splashBuf,
    ]) {
      if (b) gl.deleteBuffer(b);
    }
    this.disposeTargets();
    for (const p of [
      this.progStatic,
      this.progFloor,
      this.progWater,
      this.progCoin,
      this.progBottle,
      this.progFish,
      this.progSplash,
      this.progBright,
      this.progBlur,
      this.progComposite,
    ]) {
      if (p) gl.deleteProgram(p.program);
    }

    /* ⚠️ 这里**绝对不能**调 WEBGL_lose_context.loseContext()。
       本项目开着 <StrictMode>，开发期 effect 会「挂载 → 清理 → 再挂载」跑两遍；
       而一个 canvas 一辈子只能有一个 WebGL context —— 一旦把它 lose 掉，
       第二次挂载时 getContext("webgl2") 拿回来的还是**同一个已死的对象**
       （isContextLost() === true），表现为「shader 编译失败但信息日志是空的」，
       然后静默掉进 2D 降级，非常难查。
       只要把资源删干净就够了，context 会随 canvas 一起被 GC。 */
  }
}

/** 供验收脚本读取属性槽位（确认显式绑定生效） */
export const ENGINE_ATTRIB = ATTRIB;
