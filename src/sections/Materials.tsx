/**
 * X.收藏 —— 玻璃展示柜（#/materials）
 *
 * Cyrus 的要求：「把 X.物料 改成这种实际的『玻璃展示柜』，加入 3D 渲染，
 * 点击柜门可开启，然后点击其中的 3D 物料进行查看，会显示信息」。
 *
 * 几个刻意的取舍：
 * 1. 柜体是**真用 CSS 3D 搭出来的箱体**（背板 / 左右侧板 / 顶 / 底 / 四层层板 /
 *    底座），正面两扇玻璃门各自绕外侧铰链 rotateY 打开。没有引入 3D 库——
 *    这个箱体统共十几个面，上 three.js 是拿大炮打蚊子，还会把首屏体积顶上去。
 *    造型与光照的全部参数都在 index.css 的「玻璃展示柜」一节，这里只负责结构。
 * 2. 展品用的是**去背过的透明底图**（public/materials/cut/*）。原实拍是白底，
 *    直接摆进柜子会变成一张张白卡；而且手机壳白款、耳机壳这类「白壳压白底」
 *    连抠像算法都容易翻车，最后是走 AI 分割抠图才干净的。
 * 3. 场景用固定设计尺寸（1040×860）再整体缩到容器宽度。CSS 里拿不到容器宽度，
 *    而窄屏上 44rem 宽的柜子必须等比缩小才不会把展品挤成一团，所以这步交给
 *    ResizeObserver——缩的是**整个投影**，不是逐个改尺寸，比例永远不会走样。
 * 4. 交互只有三条：点柜门开合、点展品看展签、Esc（或再点一次）收起展签。
 *    柜门在 DOM 里是一枚 aria-hidden 的装饰按钮（鼠标顺手可点），
 *    真正的开关是顶部那枚带 aria-expanded 的实体按钮，键盘与读屏都走它。
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { DoorClosed, DoorOpen, X } from "lucide-react";
import Section from "../components/Section";
import Container from "../components/Container";
import SectionTitle from "../components/SectionTitle";
import Reveal from "../components/Reveal";
import ApparelRack from "../components/apparel/ApparelRack";
import { brand, materialDrawers, materialsSection } from "../content";

/* 3D 场景的设计尺寸（px）。柜体的所有尺寸都在这个坐标系里定义，
   再由 .vitrine-scale 整体缩放到容器宽度。数字与 index.css 里的一致。
   ⚠️ 画布比柜体大一圈不是浪费：柜门开到底时会甩出正面（z≈466px），
   被透视放大后往左、往上顶——实测左溢出 11px、上溢出 27px，
   这圈余量就是留给它的（见 index.css 的 .vitrine 顶距与 .vitrine-stage 透视）。 */
const DESIGN_W = 1040;
const DESIGN_H = 860;

/* 柜内每一层的高度（rem），与 index.css 的 --tier-h 一致。 */
const TIER_H = 10;

type Drawer = (typeof materialDrawers)[number];

export default function Materials() {
  /* useId 在 React 18 里会带冒号（":r0:"），进 HTML id 虽然合法但不便于排查 */
  const uid = useId().replace(/:/g, "");

  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const clipRef = useRef<HTMLDivElement | null>(null);

  /* 把 3D 场景等比缩到可用宽度。
     ⚠️ 只设上限、不设下限：设计画布一旦比容器宽，.vitrine-clip 的 overflow:hidden
     就会把甩出的柜门吃掉（实测 360px 屏上固定下限 0.36 会让画布比容器宽 46px，
     门被裁掉 20px）。下限交给「画布宽度 = 容器宽度」这条恒等式保证。
     上限 1.12 则避免在超宽屏上把柜子放成一面墙。 */
  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      setScale(Math.min(1.12, w / DESIGN_W));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 关柜门时顺手收起展签——看不见的展品不该还停在「已选中」状态 */
  const toggleCase = useCallback(() => {
    setOpen((prev) => {
      if (prev) setSelectedKey(null);
      return !prev;
    });
  }, []);

  /* 点展品。柜门没开就先开：键盘用户不必先去够顶部那枚开关。 */
  const toggleItem = useCallback((key: string) => {
    setOpen(true);
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  /* Esc 收起展签 */
  useEffect(() => {
    if (!selectedKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey]);

  /* 按 content.ts 里的 tier 分层分组；层级自上而下 = tier 1→4 */
  const tiers = useMemo(() => {
    const buckets = new Map<number, { item: Drawer; index: number }[]>();
    materialDrawers.forEach((item, index) => {
      const bucket = buckets.get(item.tier);
      if (bucket) bucket.push({ item, index });
      else buckets.set(item.tier, [{ item, index }]);
    });
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  const selected = useMemo(
    () => materialDrawers.find((d) => d.key === selectedKey) ?? null,
    [selectedKey]
  );
  const selectedIndex = useMemo(
    () => materialDrawers.findIndex((d) => d.key === selectedKey),
    [selectedKey]
  );

  const total = materialDrawers.length;
  const caseId = `${uid}-case`;

  const itemLabel = (name: string, isSelected: boolean) =>
    (isSelected ? materialsSection.deselectLabel : materialsSection.selectLabel).replace(
      "{name}",
      name
    );

  return (
    <Section id="materials" ariaLabelledBy="materials-title" spacing="loose">
      <Container>
        <SectionTitle
          eyebrow={materialsSection.eyebrow}
          title={materialsSection.title}
          description={materialsSection.description}
          id="materials-title"
          as="h1"
        />

        <Reveal>
          {/* 操作提示：不做成大按钮，只做一行克制的指引。
              两端的短横在 360 窄屏上会把文字挤得发飘，所以窄屏直接收掉。 */}
          <p className="mb-6 flex items-center justify-center gap-2.5 text-caption tracking-[0.18em] text-muted">
            <span aria-hidden="true" className="hidden h-px w-6 bg-accent/50 xs:block" />
            {materialsSection.hint}
            <span aria-hidden="true" className="hidden h-px w-6 bg-accent/50 xs:block" />
          </p>

          {/* 柜体铭牌 + 柜门开关 */}
          <div className="mx-auto mb-5 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-3 rounded-panel border border-hairline bg-surface/40 px-4 py-2.5 md:gap-x-4">
            <span className="shrink-0 text-caption uppercase tracking-[0.24em] text-muted">
              {materialsSection.cabinetLabel}
            </span>
            <span className="cabinet-rail h-1 min-w-8 flex-1" aria-hidden="true" />
            <span className="shrink-0 text-caption tabular-nums text-muted">
              {String(total).padStart(2, "0")}
            </span>
            <button
              type="button"
              className={`btn-reset inline-flex shrink-0 items-center gap-2 rounded-pill border px-3.5 py-1.5 text-caption transition-colors duration-base ease-ease ${
                open
                  ? "border-accent/50 bg-accent/12 text-accent-bright"
                  : "border-hairline bg-surface/60 text-text hover:border-accent/45 hover:text-accent-bright"
              }`}
              aria-expanded={open}
              aria-controls={caseId}
              onClick={toggleCase}
            >
              {open ? (
                <DoorClosed size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <DoorOpen size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
              <span>{open ? materialsSection.closeLabel : materialsSection.openLabel}</span>
            </button>
          </div>

          {/* 3D 展示柜 */}
          <div
            ref={clipRef}
            className="vitrine-clip"
            style={{ height: Math.round(DESIGN_H * scale) }}
          >
            <div
              className="vitrine-scale"
              style={{ "--case-scale": scale } as CSSProperties}
            >
              <div className="vitrine-stage">
                <div
                  id={caseId}
                  className="vitrine"
                  data-open={open ? "true" : "false"}
                  data-selected={selected ? "true" : "false"}
                  role="group"
                  aria-label={materialsSection.caseLabel}
                >
                  {/* 内腔（全是装饰性平面）。
                      排列顺序 = 同一 z 上的绘制顺序，靠后的盖在先前的上面 */}
                  <div className="vt-face vt-back" aria-hidden="true" />
                  {/* 开柜后的「亮灯」：一片贴在背板前的柔光，合上门时 opacity 0 */}
                  <div className="vt-face vt-glow" aria-hidden="true" />
                  <div className="vt-face vt-side vt-left" aria-hidden="true" />
                  <div className="vt-face vt-side vt-right" aria-hidden="true" />
                  <div className="vt-face vt-ceil" aria-hidden="true" />
                  <div className="vt-face vt-floor" aria-hidden="true" />
                  {/* 内腔左右两条竖向灯带 */}
                  <div className="vt-face vt-glowbar vt-glowbar-left" aria-hidden="true" />
                  <div className="vt-face vt-glowbar vt-glowbar-right" aria-hidden="true" />
                  <div className="vt-face vt-led" aria-hidden="true" />

                  {/* 底座 */}
                  <div className="vt-face vt-plinth vt-plinth-front" aria-hidden="true" />
                  <div className="vt-face vt-plinth vt-plinth-left" aria-hidden="true" />
                  <div className="vt-face vt-plinth vt-plinth-right" aria-hidden="true" />
                  {/* 底座正面的厂牌：一枚刻着字的小铝牌 */}
                  <div className="vt-face vt-nameplate" aria-hidden="true">
                    {brand.name}
                  </div>

                  {/* 每一层：层板 + 前沿 + 立在板上的展品 */}
                  {tiers.map(([tier, entries]) => {
                    const tierVars = {
                      "--sy": `${tier * TIER_H}rem`,
                    } as CSSProperties;

                    return (
                      <Fragment key={tier}>
                        <div className="vt-face vt-shelf" style={tierVars} aria-hidden="true" />
                        <div className="vt-face vt-shelf-lip" style={tierVars} aria-hidden="true" />
                        {/* 层号铭牌：贴在背板左上角，像陈列柜里的层标识 */}
                        <div className="vt-face vt-tier-tag" style={tierVars} aria-hidden="true">
                          {String(tier).padStart(2, "0")}
                        </div>
                        <div className="vt-tier" style={tierVars}>
                          {entries.map(({ item, index }) => {
                            const isSelected = selectedKey === item.key;
                            /* 展品盒的宽度由图片比例反算（rem），显式写进 CSS 变量。
                               这样盒子在图片解码完成前就已定型，热区平面也就有了确定尺寸——
                               在此之前宽度是「由 <img> 撑开的 auto」，解码前就是 0。 */
                            const iw = (item.ih * item.cutW) / item.cutH;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                className="vitrine-item"
                                data-key={item.key}
                                style={
                                  {
                                    "--ih": `${item.ih}rem`,
                                    "--iw": `${iw}rem`,
                                  } as CSSProperties
                                }
                                aria-pressed={isSelected}
                                aria-label={itemLabel(item.name, isSelected)}
                                title={`${String(index + 1).padStart(2, "0")} ${item.name}`}
                                onClick={() => toggleItem(item.key)}
                              >
                                {/* 热区平面：一件展品一块，铺满展品盒，与图片解耦 */}
                                <span className="vitrine-hit" aria-hidden="true" />
                                {/* 聚光层：被选中/悬停时才亮，见 index.css 的 .vitrine-halo */}
                                <span className="vitrine-halo" aria-hidden="true" />
                                <img
                                  src={item.cut}
                                  alt=""
                                  width={item.cutW}
                                  height={item.cutH}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </Fragment>
                    );
                  })}

                  {/* 正面外框 + 外框上的金属细部 + 两扇玻璃门 */}
                  <div className="vt-face vt-frame" aria-hidden="true" />
                  <div className="vt-face vt-mullion vt-mullion-left" aria-hidden="true" />
                  <div className="vt-face vt-mullion vt-mullion-right" aria-hidden="true" />
                  {/* 顶冠檐口：柜顶前沿压一条檐，柜子才有「家具」的轮廓 */}
                  <div className="vt-face vt-crown" aria-hidden="true" />
                  {/* 铰链：留在柜体上，门开合时不跟着走 */}
                  <div className="vt-face vt-hinge vt-hinge-left" aria-hidden="true" />
                  <div className="vt-face vt-hinge vt-hinge-right" aria-hidden="true" />
                  <button
                    type="button"
                    className="vitrine-door vt-door-left"
                    aria-hidden="true"
                    tabIndex={-1}
                    aria-label={materialsSection.doorLabel}
                    onClick={toggleCase}
                  />
                  <button
                    type="button"
                    className="vitrine-door vt-door-right"
                    aria-hidden="true"
                    tabIndex={-1}
                    aria-label={materialsSection.doorLabel}
                    onClick={toggleCase}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 展签：内容区常驻，保证 aria-live 能稳定播报 */}
          <div className="mx-auto mt-6 max-w-2xl" aria-live="polite">
            {selected ? (
              <article className="relative rounded-panel border border-hairline bg-surface/50 p-5 pr-14 md:p-6 md:pr-16">
                <button
                  type="button"
                  className="btn-reset absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-pill border border-hairline text-muted transition-colors duration-base ease-ease hover:border-accent/45 hover:text-accent-bright md:right-4 md:top-4"
                  onClick={() => setSelectedKey(null)}
                  aria-label={materialsSection.detailCloseLabel}
                >
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                </button>

                <div className="flex flex-col gap-5 tab:flex-row tab:items-start tab:gap-7">
                  {/* 展品的缩略图：与柜里是同一张去背图，不用再拍一张 */}
                  <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center rounded-card border border-hairline bg-bg-deep/60 p-2.5 tab:mx-0">
                    <img
                      src={selected.cut}
                      alt={materialsSection.imageAltTemplate.replace(
                        "{name}",
                        selected.name
                      )}
                      width={selected.cutW}
                      height={selected.cutH}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-caption uppercase tracking-[0.22em] text-accent-bright">
                      {materialsSection.detailEyebrow} ·{" "}
                      {String(selectedIndex + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-h3">
                      {selected.name}
                      <span className="text-caption font-normal text-muted">
                        {selected.category}
                      </span>
                    </h3>
                    <p className="mt-3 text-body text-muted">{selected.desc}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {selected.specs.map((spec) => (
                        <li
                          key={spec}
                          className="rounded-pill border border-hairline bg-surface/60 px-3 py-1 text-caption text-muted"
                        >
                          {spec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ) : (
              <p className="rounded-panel border border-dashed border-hairline px-5 py-8 text-center text-caption tracking-[0.16em] text-muted">
                {materialsSection.detailEmpty}
              </p>
            )}
          </div>
        </Reveal>

        {/* 第二工位：官方服装挂架。
            同一导航区块里的第二件事走 h2 工位牌（与 #/games 的「赛博刮刮乐」同一规矩），
            不再挂第二个 SectionTitle，否则眉题与导航 label 的 5/5 对位会被破坏。 */}
        <Reveal>
          <ApparelRack />
        </Reveal>
      </Container>
    </Section>
  );
}
