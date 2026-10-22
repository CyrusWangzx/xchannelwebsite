/**
 * 作战沙盘（豆总）
 *
 * 等距视角的「战区图」，手写 SVG —— 不用 Three.js，也不用 ECharts 的 3D 散点。
 * 理由很实际：战区标签要精确落在菱形正中，SVG 里直接写坐标就行；
 * 换成 3D 场景就得做二次投影，还得处理文字朝向，收益为负。
 *
 * 每个战区是一个 `role="button"` 的 `<g>`：可点、可聚焦、Enter/Space 触发，
 * 和 HTML 按钮的键盘行为对齐（SVG 元素默认不响应 Enter，这里手动接）。
 */
import type { BattleZone } from "../types";

const TONE: Record<BattleZone["status"], string> = {
  ok: "0 214 143",
  watch: "255 217 61",
  blocked: "255 92 138",
};

const HALF_W = 104;
const HALF_H = 52;

function diamond(z: BattleZone) {
  return `${z.x},${z.y - HALF_H} ${z.x + HALF_W},${z.y} ${z.x},${z.y + HALF_H} ${z.x - HALF_W},${z.y}`;
}

export default function BattleMap({
  zones,
  activeCode,
  onSelect,
}: {
  zones: BattleZone[];
  activeCode: string | null;
  onSelect: (code: string) => void;
}) {
  /* 等距网格：两组斜率 ±0.5 的直线，盖满整个画布再裁掉 */
  const lines: { key: string; d: string }[] = [];
  for (let c = -640; c <= 640; c += 56) {
    lines.push({
      key: `a${c}`,
      d: `M${c} 0 L${c + 640} 320`,
    });
    lines.push({
      key: `b${c}`,
      d: `M${c} 320 L${c + 640} 0`,
    });
  }

  return (
    <svg
      viewBox="0 0 640 320"
      className="dou-map mx-auto w-full max-w-[880px]"
      data-active={activeCode ?? undefined}
      role="group"
      aria-label="作战沙盘"
    >
      <defs>
        <clipPath id="dou-map-clip">
          <rect x="0" y="0" width="640" height="320" rx="6" />
        </clipPath>
      </defs>

      {/* 底网格：纯装饰 */}
      <g clipPath="url(#dou-map-clip)" aria-hidden="true">
        {lines.map((l) => (
          <path
            key={l.key}
            d={l.d}
            stroke="rgb(0 196 214 / 0.09)"
            strokeWidth={1}
            fill="none"
          />
        ))}
      </g>

      {zones.map((z) => {
        const tone = TONE[z.status];
        const on = z.code === activeCode;
        return (
          <g
            key={z.code}
            className="dou-zone outline-none"
            data-active={on}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${z.code} ${z.name}，进度 ${z.progress}%，${z.statusLabel}`}
            onClick={() => onSelect(z.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(z.code);
              }
            }}
          >
            <title>{`${z.name} · ${z.progress}%`}</title>

            {/* 地面光斑：让菱形像浮在沙盘上，而不是贴上去 */}
            <ellipse
              cx={z.x}
              cy={z.y + 26}
              rx={HALF_W * 1.02}
              ry={26}
              fill={`rgb(${tone} / 0.14)`}
            />

            <polygon
              points={diamond(z)}
              fill={`rgb(${tone} / ${on ? 0.26 : 0.13})`}
              stroke={`rgb(${tone} / ${on ? 1 : 0.55})`}
              strokeWidth={on ? 1.8 : 1.1}
            />

            {/* 内圈虚线：沙盘的靶环感 */}
            <polygon
              points={diamond(z)
                .split(" ")
                .map((p) => {
                  const [x, y] = p.split(",").map(Number);
                  return `${z.x + (x - z.x) * 0.62},${z.y + (y - z.y) * 0.62}`;
                })
                .join(" ")}
              fill="none"
              stroke={`rgb(${tone} / 0.35)`}
              strokeWidth={0.8}
              strokeDasharray="4 5"
            />

            <text
              x={z.x}
              y={z.y - 4}
              textAnchor="middle"
              fill="rgb(230 241 255)"
              fontSize={11.5}
              letterSpacing="0.02em"
            >
              {z.code} · {z.name}
            </text>

            <text
              x={z.x}
              y={z.y + 14}
              textAnchor="middle"
              fill={`rgb(${tone})`}
              fontSize={13}
              fontWeight={700}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              className="dou-zone-label"
            >
              {z.progress}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
