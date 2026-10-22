/**
 * 三位 AI 个人主页 —— 共用类型
 *
 * 三页共用同一台「问诊机」：`ConsultConfig` 就是交给它的 schema。
 * 页面组件只负责渲染，所有文案都在 data/ 里。
 */

export type ActKey = "er" | "dou" | "jin";

/** 一组「症状 / 场景 / 输入项」以及它对应的内容池 */
export interface SymptomGroup {
  id: string;
  /** 选项上显示的那一行（带症状语气） */
  label: string;
  /** 报告里回显用的短名 */
  short: string;
  /** 关键发现池，每次抽 3 条 */
  findings: string[];
  /** 处方建议池，与发现同组，保证逻辑连贯 */
  advice: string[];
}

/** 难度档：只影响仪式时长与结语口径，不假装是「更准的分析」 */
export interface ConsultLevel {
  id: string;
  label: string;
  note: string;
  /** 仪式总时长（毫秒） */
  ritual: number;
}

export interface ConsultConfig {
  eyebrow: string;
  title: string;
  lead: string;
  /** 单子左上角的表头（不要再用 eyebrow，会和上面那行标题重复） */
  formTitle: string;
  symptomLabel: string;
  symptoms: SymptomGroup[];
  /** 多选提示 */
  hint: string;
  /** 主诉输入框 */
  input: { label: string; placeholder: string; optional: string };
  levelsLabel: string;
  levels: ConsultLevel[];
  startLabel: string;
  /** 仪式阶段文案，按顺序逐条出现 */
  ritual: string[];
  report: {
    title: string;
    stamp: string;
    /** 空态：报告单还没填时那两行 */
    idleTitle: string;
    idleNote: string;
    findingsLabel: string;
    adviceLabel: string;
    disclaimer: string;
    /** 疑难档追加的一句 */
    hardNote: string;
  };
  cta: {
    again: string;
    crossLabel: string;
    crossHref: string;
    contactLabel: string;
    /** 页内目标 section 的 id。**不能写成 #xxx**：裸 hash 在这个站点里是「首页锚点」，
        点了会跳回首页（见 lib/router.ts 的 parseHash），所以页内跳转一律用按钮 + scrollToId。 */
    contactTarget: string;
  };
}

/** 三巨头名片（三页共用一份，各自高亮自己） */
export interface TrioMember {
  slug: string;
  name: string;
  role: string;
  slogan: string;
  href: string;
}

/** 软木板上的案例档案 */
export interface CaseFile {
  code: string;
  title: string;
  question: string;
  verdict: string;
  /** 卡片轻微旋转，营造「钉上去的」手感 */
  tilt: number;
}

/* ==========================================================================
   豆总：决策推演（不是「抽签」，是「每个选项一套预设分析」）
   —— 这三页的核心互动看着像，其实语义不同：
      二表哥是「多选症状 → 从池子里轮转抽」；
      豆总是「选场景 → 选一个做法 → 这个做法有它自己的代价」。
   硬把它塞进 ConsultEngine 会得到一台四不像，所以这里是一份独立的 schema。
   ========================================================================== */

/** 选项的代价色彩，只影响配色，不影响内容 */
export type OptionTone = "value" | "risk" | "steady";

export interface DecisionOption {
  id: string;
  /** 用户会做的那个动作 */
  label: string;
  /** 一句话代价，直接印在按钮下面 */
  price: string;
  tone: OptionTone;
  /** 推演出的关键判断，固定 3 条 */
  findings: string[];
  /** 处方，固定 2 条 */
  advice: string[];
  /** 报告顶部那一句结论 */
  verdict: string;
}

export interface DecisionScenario {
  id: string;
  /** 场景选择按钮上的那一行 */
  label: string;
  /** 报告里回显的短名 */
  short: string;
  /** 选中场景后展开的情境描述 */
  brief: string;
  options: DecisionOption[];
}

/** 作战沙盘上的一个战区 */
export interface BattleZone {
  code: string;
  name: string;
  progress: number;
  status: "ok" | "watch" | "blocked";
  statusLabel: string;
  next: string;
  /** 沙盘里的等距坐标（viewBox 0 0 640 320） */
  x: number;
  y: number;
  goal: string;
  stage: string;
  /** 里程碑：done 的会点亮 */
  milestones: { label: string; done: boolean }[];
  team: { name: string; job: string }[];
  risk: string;
}

/** 能力雷达的一个维度 */
export interface RadarAxis {
  id: string;
  label: string;
  value: number;
  /** 悬停时的解释 */
  note: string;
  /** 一句话案例，别写成 KPI */
  case: string;
}
