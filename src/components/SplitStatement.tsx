/**
 * 首屏标语：逐字浮现，并且可以「重播」。
 *
 * 为什么逐字而不是整句淡入：整句淡入在视觉上只是「出现了」，
 * 而一个字一个字显影、并各自从 6px 的模糊里对上焦，读起来像
 * 「这句话正在被写出来」——首屏唯一一次值得花这个时间的动效。
 *
 * 三个实现要点：
 * 1. 每个字是 inline-block，中文才能在字间正常折行。
 * 2. 空格也要占一个 span 并保留宽度（whitespace-pre），
 *    否则 inline-block 会把它吃掉，" AI" 会贴到前一个字上。
 * 3. 无障碍：逐字 span 对读屏是灾难（会被拆成单字朗读），
 *    因此它们在无障碍树上整体隐藏，由 h1 的 aria-label 给出完整句子。
 *
 * 可点击：传了 actionLabel 就把内容包进一个 <button>。
 * 放在 h1 里面是合法的——h1 的内容模型是 phrasing content，button 也是。
 * 这样标题语义和点击目标都保住了，比给 h1 挂 role="button" 干净得多
 * （后者会把 heading 语义整个顶掉）。
 *
 * 重播用「换 key 重挂载」而不是动画控制器：十来个 span 重建的代价可以忽略，
 * 换来的是行为完全可预测——不会出现控制器状态残留导致第二次播不出来的情况。
 */
import type { Variants } from "framer-motion";
import { m, useReducedMotion } from "framer-motion";
import { CHAR_STAGGER, charReveal, fadeIn } from "../lib/motion";

interface SplitStatementProps {
  /** 完整标语。同时用作 h1 的无障碍名称，务必包含标点 */
  text: string;
  /** 需要在句中被高亮的片段（如 "AI"），按首次出现定位 */
  highlight?: string;
  /** 整句开始逐字之前的等待时间（秒） */
  delay?: number;
  /** 末尾是否跟一枚闪烁的终端光标 */
  caret?: boolean;
  /** 传了就变成可点击，值是按钮的无障碍名称（如「重读这句话」） */
  actionLabel?: string;
  /** 标语被点击时的回调（Hero 用它联动扫光带） */
  onActivate?: () => void;
  /** 变化即重播逐字动效 —— 父组件用它驱动「再来一次」 */
  playKey?: number;
  /** 挂在 h1 上的类名（字号 / 光晕 / 平衡折行） */
  className?: string;
  /** 高亮片段的类名 */
  highlightClassName?: string;
}

/* 终端光标。外层管「什么时候出现」（framer 淡入），内层交给 CSS 关键帧闪烁——
   两者必须分属不同元素：framer 淡入结束后会留下 opacity 的行内样式，
   而行内样式的优先级高于 CSS 动画，同元素叠加会把闪烁整个吃掉。
   高度取 0.84em：中文方块字字面高约 0.86em，跟到这个量级才与汉字并排不显矮。 */
const CARET_CLS =
  "hero-caret inline-block h-[0.84em] w-[0.09em] translate-y-[0.08em] bg-accent-bright";

export default function SplitStatement({
  text,
  highlight = "",
  delay = 0,
  caret = false,
  actionLabel,
  onActivate,
  playKey = 0,
  className = "",
  highlightClassName = "hero-hl",
}: SplitStatementProps) {
  /* 逐字显影对前庭敏感的用户并不友好——每个字挨个抖着对焦，
     在「减少动效」偏好下属于该被砍掉的那类动效。直接整句呈现，
     高亮与光标照常保留（它们是信息，不是动效）。 */
  const reduceMotion = useReducedMotion();

  /* 高亮区间：用 indexOf 定位首次出现，不做全局替换——
     标语里如果两次出现同一个词，高亮整句会失去重心。 */
  const hlStart = highlight ? text.indexOf(highlight) : -1;
  const hlEnd = hlStart >= 0 ? hlStart + highlight.length : -1;

  /* 用 Array.from 而非 split("")：后者会把 emoji / 罕见汉字
     这类代理对切成两个残码，逐字渲染成乱码方块。 */
  const chars = Array.from(text);

  /* 父容器只管节奏：逐字步长 + 整句延迟 */
  const container: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: CHAR_STAGGER, delayChildren: delay },
    },
  };

  const content = reduceMotion ? (
    <>
      {hlStart >= 0 ? text.slice(0, hlStart) : text}
      {hlStart >= 0 && (
        <span className={highlightClassName}>{text.slice(hlStart, hlEnd)}</span>
      )}
      {hlStart >= 0 && text.slice(hlEnd)}
      {caret && (
        <span aria-hidden="true" className={`ml-[0.14em] ${CARET_CLS}`} />
      )}
    </>
  ) : (
    <m.span
      /* 换 key 即重挂载，逐字动效从头再播一遍 */
      key={`play-${playKey}`}
      aria-hidden="true"
      className="inline"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {chars.map((char, i) => {
        const isHighlight = hlStart >= 0 && i >= hlStart && i < hlEnd;
        return (
          <m.span
            // 标语是静态文案，位置即标识，索引做 key 不会引发重排问题
            key={`${i}-${char}`}
            variants={charReveal}
            className={`inline-block whitespace-pre${
              isHighlight ? ` ${highlightClassName}` : ""
            }`}
          >
            {char}
          </m.span>
        );
      })}

      {caret && (
        <m.span
          aria-hidden="true"
          variants={fadeIn(delay + CHAR_STAGGER * chars.length)}
          className="ml-[0.14em] inline-block"
        >
          <span className={CARET_CLS} />
        </m.span>
      )}
    </m.span>
  );

  /* 只有「非 reduce」才值得做成可点击的：它唯一的交互就是重播动效，
     reduce 用户点下去什么也不会发生，那就别给一个假按钮。 */
  if (actionLabel && !reduceMotion) {
    return (
      <h1 className={className} aria-label={text}>
        <button
          type="button"
          onClick={onActivate}
          aria-label={actionLabel}
          title={actionLabel}
          className="statement-button"
        >
          {content}
        </button>
      </h1>
    );
  }

  return (
    <h1 className={className} aria-label={reduceMotion ? undefined : text}>
      {content}
    </h1>
  );
}
