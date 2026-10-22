/**
 * X.收藏 第二工位 —— 官方服装挂架（纯 CSS 3D）
 *
 * Cyrus 的要求：「增加一个 3D 渲染的衣架，挂着我们做好的衣服，用户点击衣服时
 * 可以切换到近景视角来查看衣服的前面和背面」「尺码部分暂缓实现，但衣架要设计
 * 大一点，之后把所有尺码都挂在衣架上」。
 *
 * 几条刻意的取舍：
 *
 * 1. **衣架是真 3D 结构**，不是一张画：前后两排立柱 + 两根横杆（前杆挂衣、后杆
 *    撑出进深）+ 两根顶部纵梁 + 两只沿进深方向的脚。整架 `rotateY(-14deg)`，
 *    后排在 z=-160px —— 只在 yaw 下才看得出的那点视差，正是"这是个架子"的全部
 *    证据。金属管身不用 3D 圆柱，用**横向明暗渐变**假装：这个尺寸下一根 26px 的
 *    柱子，渐变比四五个面片更像真管子，还不会把 3D 上下文搞复杂。
 *
 * 2. **衣服是照片抠图，不是矢量重绘**。Cyrus 给的「效果图展示图」里两件卫衣是
 *    同一机位、同一打光的幽灵模特图，抠出来就是天然的正面/背面两张面片。手绘
 *    SVG 卫衣在近景一定会露怯（帽子、袋鼠兜、水洗纹理），而且重绘别人的印花
 *    本来就不该做。抠图脚本与参数记录在 content.ts 的 `apparelSection` 注释里。
 *
 * 3. **"近景"不是换一套 DOM**，是同一件衣服在 3D 场景里往镜头前走、同时把衣架
 *    压暗。所以翻面这件事只是一句 `rotateY(180deg)`——衣服本来就是有正反两面的
 *    一张薄片（±18px 的布厚），转过去看到背面是同一件东西的背面。
 *
 * 4. **尺码一个都不渲染**。架子的长度、立柱高度、`closeScale` 的算法都按"以后
 *    要挂 8 件"来定，但这一阶段 DOM 里只有一件，且**没有任何尺码相关的 UI 或
 *    数据**——暂缓就真的暂缓，不留半截控件。文案里那句「S 到 5XL 会陆续挂上来」
 *    是唯一交代。
 *
 * 5. 尺寸体系沿用展示柜：固定设计画布 1200×880，整体 `scale3d` 缩到容器宽度
 *    （CSS 拿不到容器宽度，只能交给 ResizeObserver）。近景的放大倍数是**算**出来
 *    的，不是写死的——窄屏上衣服要占屏宽 88%，宽屏占 54%，这样 360px 手机上
 *    近景才不会缩成一枚徽章。
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { apparel, apparelSection } from "../../content";

/* 设计画布（px）。所有几何都在这个坐标系里，再由 .apparel-scale 等比缩放。 */
const DESIGN_W = 1200;
/* 远景画布高度：架底在 708，下面留一点地面就够了。
   近景要更高（衣服被放大到超出这个高度），所以高度是**按模式算**的——
   固定成近景高度会让远景下面空出一大块，窄屏上尤其明显。 */
const RACK_H = 772;

/* 衣服面片的宽度（设计 px）。高度由素材固有比例算，别写死。 */
const GARMENT_W = 470;
const GARMENT_H = Math.round((GARMENT_W * apparel.h) / apparel.w);

/* 挂点在画布里的位置：水平居中。竖向让「横杆 → 挂钩 → 帽尖」几乎贴在一起——
   挂钩拉太长，衣服就不像挂在衣架上，像吊在绳子上。 */
const GARMENT_LEFT = (DESIGN_W - GARMENT_W) / 2;
const GARMENT_TOP = 158;

type Mode = "rack" | "close";
type Face = "front" | "back";

export default function ApparelRack() {
  const uid = useId().replace(/:/g, "");
  const sceneId = `${uid}-scene`;

  const [mode, setMode] = useState<Mode>("rack");
  const [face, setFace] = useState<Face>("front");

  /* scale：整块画布 → 容器宽度；close：近景时衣服自己的放大倍数。 */
  const [metrics, setMetrics] = useState({
    scale: 1,
    close: 1.38,
    rackH: RACK_H,
    closeH: RACK_H,
  });
  const clipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      /* 上限 1.05：超宽屏上别把衣架放成一面墙（与展示柜同一口径） */
      const scale = Math.min(1.05, w / DESIGN_W);
      /* 近景时衣服占容器宽度的比例：窄屏要几乎铺满，宽屏留白才好看 */
      const frac = w < 760 ? 0.88 : 0.54;
      const close = frac / (GARMENT_W / DESIGN_W);
      const closeH = Math.max(RACK_H, GARMENT_TOP + GARMENT_H * close + 26);
      setMetrics({
        scale,
        close,
        rackH: Math.round(RACK_H * scale),
        closeH: Math.round(closeH * scale),
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const enter = useCallback(() => {
    setFace("front");
    setMode("close");
  }, []);

  const leave = useCallback(() => {
    setFace("front");
    setMode("rack");
  }, []);

  const flip = useCallback(() => {
    setFace((prev) => (prev === "front" ? "back" : "front"));
  }, []);

  /* Esc 回到衣架：近景是"走进去了"，得有一键退出的路 */
  useEffect(() => {
    if (mode !== "close") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, leave]);

  const faceWord = face === "front" ? apparelSection.frontLabel : apparelSection.backLabel;
  const otherWord = face === "front" ? apparelSection.backLabel : apparelSection.frontLabel;

  return (
    <div className="apparel" data-mode={mode}>
      {/* ---- 工位牌：同一区块里的第二件事用 h2，不另起 SectionTitle ---- */}
      <div className="apparel-head">
        <p className="text-caption uppercase tracking-[0.2em] text-accent-text">
          {apparelSection.eyebrow}
        </p>
        <h2 className="apparel-title" id="apparel-title">
          {apparelSection.title}
        </h2>
        <p className="apparel-sub">{apparelSection.description}</p>
        <p className="mt-1.5 text-caption text-muted">{apparelSection.hint}</p>
      </div>

      {/* ---- 铭牌行 + 视角控制 ---- */}
      <div className="apparel-bar">
        <span className="shrink-0 text-caption uppercase tracking-[0.24em] text-muted">
          {apparelSection.serialLabel}
        </span>
        <span className="cabinet-rail h-1 min-w-6 flex-1" aria-hidden="true" />
        <span className="shrink-0 text-caption tabular-nums text-muted">
          {String(1).padStart(2, "0")} {apparelSection.countLabel}
        </span>

        {mode === "rack" ? (
          <button
            type="button"
            className="apparel-btn btn-reset"
            onClick={enter}
            aria-controls={sceneId}
          >
            <Maximize2 size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>{apparelSection.enterLabel}</span>
          </button>
        ) : (
          <>
            <div
              className="apparel-faces"
              role="group"
              aria-label={apparelSection.faceGroupLabel}
            >
              <button
                type="button"
                className="btn-reset"
                data-on={face === "front" ? "true" : "false"}
                aria-pressed={face === "front"}
                onClick={() => setFace("front")}
              >
                {apparelSection.frontLabel}
              </button>
              <button
                type="button"
                className="btn-reset"
                data-on={face === "back" ? "true" : "false"}
                aria-pressed={face === "back"}
                onClick={() => setFace("back")}
              >
                {apparelSection.backLabel}
              </button>
            </div>
            <button type="button" className="apparel-btn btn-reset" onClick={leave}>
              <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{apparelSection.closeLabel}</span>
            </button>
          </>
        )}
      </div>

      {/* ---- 3D 场景 ---- */}
      <div
        ref={clipRef}
        className="apparel-clip"
        style={{ height: mode === "close" ? metrics.closeH : metrics.rackH }}
      >
        <div
          className="apparel-scale"
          style={
            {
              "--ap-scale": metrics.scale,
              "--ap-close": metrics.close,
            } as CSSProperties
          }
        >
          <div className="apparel-stage">
            <div className="apparel-floor" aria-hidden="true" />
            <div
              id={sceneId}
              className="apparel-scene"
              role="group"
              aria-label={apparelSection.caseLabel}
            >
              {/* 衣架本体：全是装饰性平面，读屏不需要 */}
              <div className="ap-frame" aria-hidden="true">
                <span className="ap-post ap-post--fl" />
                <span className="ap-post ap-post--fr" />
                <span className="ap-post ap-post--bl" />
                <span className="ap-post ap-post--br" />
                <span className="ap-cross ap-cross--l" />
                <span className="ap-cross ap-cross--r" />
                <span className="ap-rail ap-rail--back" />
                <span className="ap-rail ap-rail--front" />
                <span className="ap-rail ap-rail--bot ap-rail--back" />
                <span className="ap-rail ap-rail--bot ap-rail--front" />
                <span className="ap-foot ap-foot--l" />
                <span className="ap-foot ap-foot--r" />
              </div>

              {/* 落地投影：衣服是叶子节点，压暗/淡出都安全 */}
              <span className="ap-shadow" aria-hidden="true" />

              <div className="ap-garment">
                {/* 挂钩：从衣服帽尖伸上去扣住横杆 */}
                <svg
                  className="ap-hook"
                  viewBox="0 0 26 30"
                  fill="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M13 30V14c0-9 9-9 9 0"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>

                {/* 正/背两张面片：一块 ±18px 厚的布 */}
                <div className="ap-3d" data-face={face}>
                  <div className="ap-side ap-side--front">
                    <img src={apparel.front} alt="" width={apparel.w} height={apparel.h} decoding="async" />
                  </div>
                  <div className="ap-side ap-side--back">
                    <img src={apparel.back} alt="" width={apparel.w} height={apparel.h} decoding="async" />
                  </div>
                </div>

                {/* 命中平面。单独一块、不参与翻面——翻到背面时它还得能点。
                    放 z=26px 是为了稳定压在两块布前面。 */}
                <button
                  type="button"
                  className="ap-hit btn-reset"
                  onClick={mode === "rack" ? enter : flip}
                  aria-label={
                    mode === "rack"
                      ? apparelSection.itemLabel.replace("{name}", apparel.name)
                      : apparelSection.itemFlipLabel
                          .replace("{name}", apparel.name)
                          .replace("{face}", otherWord)
                  }
                />
              </div>

              {/* 当前面：给读屏一个不依赖图像 alt 的锚点 */}
              <p className="ap-sr" aria-live="polite">
                {mode === "close" ? `${apparel.name}，${faceWord}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- 架下的说明 ---- */}
      <div className="apparel-meta">
        <ul className="apparel-specs">
          {apparelSection.specs.map((spec) => (
            <li key={spec}>{spec}</li>
          ))}
        </ul>
        <p className="apparel-more">{apparelSection.moreNote}</p>
      </div>
    </div>
  );
}
