/**
 * 动效令牌（JS 通道）
 *
 * 为什么单独开一个模块：Framer Motion 消费的是 JS 数值对象，
 * 无法读取 CSS 自定义属性。因此动效参数在 TS 侧集中定义，
 * 与 index.css 的 --dur-* / --ease-out 保持同一套节奏，
 * 组件只引用常量、不写字面值。
 */
import type { Transition, Variants } from "framer-motion";

/** 统一缓动曲线，与 --ease-out 同源 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 时长（秒），与 --dur-fast/base/slow 同源 */
export const DUR = {
  fast: 0.2,
  base: 0.3,
  slow: 0.5,
} as const;

/** 柔和弹簧：用于导航收缩等需要「手感」的场景 */
export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

/** 列表项交错延迟步长 */
export const STAGGER = 0.08;

/** 逐字步长。比列表更密——一句话几十个字，按 0.08 走要等两秒多 */
export const CHAR_STAGGER = 0.035;

/**
 * 首屏节奏：标题是逐字浮现的，后面的内容必须等它基本落定再上，
 * 否则文字还在一个字一个字蹦、副标题已经淡入了，会显得散。
 *
 * 时间线（以当前 9 个字符的标语「认真的玩 假装创业」、步长 0.035、
 * 整句 delayChildren 0.1、单字 charReveal 0.5s 计）：
 *   首字起 0.10s → 末字起 0.38s → 末字落定约 0.88s
 * 所以：英文标语取 0.48s（末字起之后，中文说完就接上它的英文）；
 *       副标题取 0.62s（英文落定后）；按钮与下方内容依次顺延。
 * 2026-10-22 标语从 16 字缩到 9 字，整条链按同一套比例重算过一遍
 * （英文 = 末字起 +0.10s，其后每级 +0.10~0.14s），不是随手往前挪。
 * ⚠️ 改标语字数（或增删这一组里的行）要回来重算这条链——它是有依赖顺序的。
 */
export const HERO_DELAY = {
  /* 标语下方的英文版（与中文标语同属一件东西，所以紧跟着它） */
  statementEn: 0.48,
  subtitle: 0.62,
  actions: 0.72,
  media: 0.82,
  banner: 0.92,
} as const;

/** 滚动显现的统一视口判定 */
export const VIEWPORT = { once: true, margin: "-64px" } as const;

/* 展开为可变 4 元组：framer 的 ease 只接受 [n,n,n,n]，不能是 number[] */
const ease = () => [...EASE_OUT];

/** 淡入上移 */
export const fadeUp = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: ease(), delay },
  },
});

/** 纯淡入 */
export const fadeIn = (delay = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DUR.slow, ease: ease(), delay },
  },
});

/** 轻微缩放浮现，用于封面 / 徽章 */
export const scaleIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.slow, ease: ease(), delay },
  },
});

/** 父容器：统一控制子项交错节奏 */
export const staggerContainer = (stagger: number = STAGGER): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

/** 悬浮反馈：轻微上浮 */
export const HOVER_LIFT = {
  y: -4,
  transition: { duration: DUR.fast, ease: ease() },
};

/**
 * 科技感标题的逐字浮现。
 * 带一点纵深模糊（每字各自 6px → 0），比单纯的上移更像「显影 / 对上焦」，
 * 是这类科幻标题最省力也最有效的做法。blur 值刻意压小：
 * 每个字都是一个独立滤镜层，值一大在移动端会明显掉帧。
 */
export const charReveal: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DUR.slow, ease: ease() },
    /* 动画一结束就把 filter 摘掉。留着一个 blur(0px) 看着无害，
       实则让每个字都永久持有独立合成层——标语每个字都是一层，
       长页面滚动时会白白掉帧。transitionEnd 是不带动画地直接落值。 */
    transitionEnd: { filter: "none" },
  },
};
