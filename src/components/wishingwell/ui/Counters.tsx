/**
 * 许愿池 · 计数条
 * 三档数字：枚愿望 / 条建议 / 条已实现。数字用等宽栈，免得跳动时宽度乱抖。
 */
import { Coins, ScrollText, Sparkles } from "lucide-react";
import { wishingWell as C } from "../../../content";

interface CountersProps {
  coins: number;
  bottles: number;
  implemented: number;
}

export default function Counters({ coins, bottles, implemented }: CountersProps) {
  const items = [
    {
      key: "coins",
      icon: Coins,
      value: coins,
      label: C.countCoins,
      tone: "text-well-gold",
    },
    {
      key: "bottles",
      icon: ScrollText,
      value: bottles,
      label: C.countBottles,
      tone: "text-well-glass",
    },
    {
      key: "implemented",
      icon: Sparkles,
      value: implemented,
      label: C.countImplemented,
      tone: "text-well-highlight",
    },
  ] as const;

  return (
    <dl className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
      {items.map(({ key, icon: Icon, value, label, tone }) => (
        <div key={key} className="flex items-baseline gap-2">
          <Icon size={16} strokeWidth={1.75} className={tone} aria-hidden="true" />
          <dd className="font-mono text-h4 tabular-nums">{value}</dd>
          <dt className="text-caption text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}
