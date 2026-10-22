/**
 * 能力雷达（豆总）
 *
 * 手写 SVG，不引图表库 —— 五个维度、四层刻度环、一个值多边形，
 * ECharts 那 900KB 换不来这几十行。
 *
 * 交互分两条路，图本身**不承担点击**：
 * - 鼠标：悬停右侧列表项 → 图里那一维高亮（粗线 + 加粗标签），其余压暗；
 * - 键盘：列表项是 `<button>`，Tab 可达、`aria-pressed` 表达当前项。
 * 把可交互控件放进 SVG 会让读屏和焦点管理都变难，所以图只做「指示」。
 */
import { useState } from "react";
import type { RadarAxis } from "../types";

const SIZE = 320;
const CX = 160;
const CY = 166;
const R = 108;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(value: number, index: number, total: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  const r = R * (value / 100);
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)] as const;
}

function ringPath(ratio: number, total: number) {
  return (
    Array.from({ length: total })
      .map((_, i) => {
        const angle = (-90 + (360 / total) * i) * (Math.PI / 180);
        const x = CX + R * ratio * Math.cos(angle);
        const y = CY + R * ratio * Math.sin(angle);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export default function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const [active, setActive] = useState(axes[0]?.id ?? "");

  const total = axes.length;
  const points = axes.map((a, i) => point(a.value, i, total));
  const shape = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <div className="grid items-center gap-6 tab:grid-cols-[minmax(0,300px)_minmax(0,1fr)] tab:gap-8">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[300px]"
        role="img"
        aria-label={`能力雷达：${axes.map((a) => `${a.label} ${a.value}`).join("，")}`}
      >
        {RINGS.map((ratio) => (
          <path
            key={ratio}
            d={ringPath(ratio, total)}
            fill="none"
            stroke="rgb(0 196 214 / 0.16)"
            strokeWidth={1}
          />
        ))}

        {axes.map((a, i) => {
          const [x, y] = point(100, i, total);
          const on = a.id === active;
          return (
            <line
              key={a.id}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={on ? "rgb(0 229 255 / 0.55)" : "rgb(0 196 214 / 0.18)"}
              strokeWidth={1}
              className="dou-radar-axis"
            />
          );
        })}

        <polygon
          points={shape}
          fill="rgb(0 196 214 / 0.18)"
          stroke="rgb(0 229 255 / 0.75)"
          strokeWidth={1.5}
        />

        {points.map(([x, y], i) => {
          const on = axes[i].id === active;
          return (
            <circle
              key={axes[i].id}
              cx={x}
              cy={y}
              r={on ? 4 : 2.6}
              fill={on ? "rgb(0 229 255)" : "rgb(126 231 245)"}
            />
          );
        })}

        {axes.map((a, i) => {
          const angle = (-90 + (360 / total) * i) * (Math.PI / 180);
          const x = CX + (R + 24) * Math.cos(angle);
          const y = CY + (R + 24) * Math.sin(angle);
          const on = a.id === active;
          return (
            <text
              key={`l-${a.id}`}
              x={x}
              y={y + 4}
              textAnchor={Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end"}
              fill={on ? "rgb(126 231 245)" : "rgb(150 163 189)"}
              fontSize={11}
              letterSpacing="0.06em"
            >
              {a.label}
            </text>
          );
        })}
      </svg>

      {/* 右侧：可点/可聚焦的维度列表（真正的无障碍入口在这里） */}
      <div>
        <ul className="space-y-1.5">
          {axes.map((a) => {
            const on = a.id === active;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onMouseEnter={() => setActive(a.id)}
                  onFocus={() => setActive(a.id)}
                  onClick={() => setActive(a.id)}
                  className={`w-full rounded-[3px] border px-3 py-2 text-left transition duration-fast ease-ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    on
                      ? "border-[rgb(0_196_214_/_0.55)] bg-[rgb(0_196_214_/_0.1)]"
                      : "border-transparent hover:border-hairline hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-text">{a.label}</span>
                    <span className="font-mono text-[13px] tabular-nums text-accent-text">
                      {a.value}
                    </span>
                  </span>
                  <span
                    className={`mt-1 block text-[11.5px] leading-relaxed transition-opacity duration-fast ${
                      on ? "text-muted opacity-100" : "text-muted opacity-0"
                    }`}
                  >
                    {a.note}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* 案例只显示当前那一维，避免整块面板变成一堵字墙 */}
        <p className="mt-3 border-l-2 border-[rgb(0_196_214_/_0.5)] pl-3 text-[12px] leading-relaxed text-muted">
          {axes.find((a) => a.id === active)?.case}
        </p>
      </div>
    </div>
  );
}
