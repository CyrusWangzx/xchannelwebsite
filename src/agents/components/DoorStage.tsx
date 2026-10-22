/**
 * 诊断室的门（首屏核心视觉）
 *
 * 纯 CSS 3D：门扇绕**左边缘**转开 104°，门后是「屋里」——桌面、台灯、几张还在跑的
 * 面板。开门之后房间才真的亮起来（`.er-room` 的 blur/brightness 收掉）。
 *
 * 🔴 三条 3D 铁律（展示柜 / 投币厅 / 这里共用的坑）：
 *   ① `.er-door-scene` 的祖先链上**不能有 filter / opacity<1 / overflow clip**，
 *      否则 preserve-3d 被拍平成两层平面，门就只是「一张图往左滑」；
 *   ② 门的转轴必须显式写 `transform-origin: left center`，靠默认的 50% 50% 会变成
 *      「绕中间翻」，像一扇旋转门；
 *   ③ 房间的**模糊放在房间自己身上**，不能加到 scene 上——scene 一旦有 filter，
 *      门扇的 3D 就没了。
 *
 * 门是可点按钮，键盘可达（Enter/Space）。打开后不再关闭：这是一次「进屋」的动作，
 * 不是开关。移动端另有精简版（门楣 + 铜牌），见 ErHome。
 */
import { useState } from "react";

interface DoorStageProps {
  plaque: string;
  roomCaption: string;
  ariaLabel: string;
  hint: string;
  openedText: string;
  /** 打开后回调（父级用来收起提示、埋后续动作） */
  onOpen?: () => void;
}

export default function DoorStage({
  plaque,
  roomCaption,
  ariaLabel,
  hint,
  openedText,
  onOpen,
}: DoorStageProps) {
  const [open, setOpen] = useState(false);

  const openDoor = () => {
    if (open) return;
    setOpen(true);
    onOpen?.();
  };

  return (
    <div className={open ? "er-door-open" : ""}>
      {/* 黄铜铭牌：钉在门楣上，门开了它也不动 */}
      <div className="er-brass mx-auto w-full max-w-[24rem] rounded-[6px] px-4 py-2.5 text-center">
        <span className="text-[13px] font-semibold tracking-[0.18em] md:text-sm">
          {plaque}
        </span>
      </div>

      {/* 门：frame + room + leaf 三层 */}
      <div
        className="er-door-scene relative mx-auto mt-5 aspect-[4/5] w-full max-w-[24rem]"
        data-open={open}
      >
        {/* 门套：比门扇更深，靠明度差把门「凹」进墙里 —— 
            整块同色是这个组件第一版最大的问题，看着像一排柜门。 */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[4px]"
          style={{
            background: "linear-gradient(180deg, #241a12 0%, #1a120c 100%)",
            boxShadow:
              "inset 0 0 0 1px rgb(0 0 0 / 0.6), 0 40px 70px -52px rgb(0 0 0 / 0.95)",
          }}
        />
        {/* 门套内沿的一道浅木反光，门扇就是从这个「槽」里出来的 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[13px] rounded-[1px]"
          style={{
            boxShadow:
              "inset 0 0 0 1px rgb(255 214 170 / 0.1), inset 0 1px 0 rgb(255 214 170 / 0.16)",
          }}
        />

        {/* 门后的屋子：被门挡着，开门才看见。
            灯罩 + 光锥 + 桌面光池这三件是一组，缺一件就只剩一团糊的暖色。 */}
        <div
          aria-hidden="true"
          className="er-room absolute inset-[14px] overflow-hidden rounded-[2px]"
        >
          {/* 后墙 */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, #2c1d13 0%, #140d09 72%)" }}
          />

          {/* 台灯光锥 */}
          <div
            className="er-lamp absolute left-1/2 top-[7%] h-[62%] w-[64%] -translate-x-1/2"
            style={{
              background:
                "linear-gradient(180deg, rgb(255 196 122 / 0.26), rgb(255 196 122 / 0.05) 62%, transparent)",
              clipPath: "polygon(40% 0%, 60% 0%, 96% 100%, 4% 100%)",
              filter: "blur(7px)",
            }}
          />

          {/* 灯罩 */}
          <div
            className="absolute left-1/2 top-[4%] h-6 w-16 -translate-x-1/2"
            style={{
              background: "linear-gradient(180deg, #5b4322, #2c1f12)",
              clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
              boxShadow: "0 12px 30px -4px rgb(255 190 110 / 0.5)",
            }}
          />

          {/* 桌面：一条明确的水平面，房间才有进深 */}
          <div
            className="absolute inset-x-0 bottom-0 h-[32%]"
            style={{
              background: "linear-gradient(180deg, #402e20 0%, #1c130c 100%)",
              boxShadow: "inset 0 8px 14px -8px rgb(0 0 0 / 0.8)",
            }}
          />

          {/* 桌面上的光池 */}
          <div
            className="absolute bottom-[22%] left-1/2 h-9 w-[66%] -translate-x-1/2 rounded-[50%]"
            style={{
              background:
                "radial-gradient(ellipse, rgb(255 205 140 / 0.34), transparent 72%)",
            }}
          />

          {/* 桌上摊着的东西：两页纸 + 一块还亮着的面板 */}
          <div className="absolute bottom-[13%] left-[14%] h-[13%] w-[26%] rotate-[-4deg] rounded-[1px] bg-[rgb(226_212_184_/_0.55)]" />
          <div className="absolute bottom-[10%] left-[19%] h-[13%] w-[26%] rotate-[3deg] rounded-[1px] bg-[rgb(210_195_168_/_0.42)]" />
          <div className="absolute bottom-[14%] right-[12%] h-[15%] w-[24%] rounded-[2px] border border-cyan/30 bg-cyan/10">
            <span className="absolute left-1.5 top-1.5 block h-[2px] w-6 rounded-full bg-cyan/40" />
            <span className="absolute left-1.5 top-3 block h-[2px] w-4 rounded-full bg-cyan/25" />
          </div>

          <p className="absolute inset-x-0 bottom-2.5 text-center text-[11px] tracking-[0.3em] text-accent-text/70">
            {roomCaption}
          </p>
        </div>

        {/* 门缝底下那道暖光：门关着也知道里头有人在。开门后它被门挡住，很自然 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[18px] bottom-[10px] h-[2px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(255 190 110 / 0.6), transparent)",
            filter: "blur(1px)",
          }}
        />

        {/* 门扇：一个按钮。绕左边转开 */}
        <button
          type="button"
          onClick={openDoor}
          aria-label={ariaLabel}
          aria-expanded={open}
          className="er-door-leaf er-wood absolute inset-[14px] rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgb(255 214 170 / 0.09), transparent 20%, transparent 80%, rgb(0 0 0 / 0.3)), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.18) 0 1px, transparent 1px 58px)",
            backgroundColor: "rgb(72 50 34)",
            boxShadow:
              "inset 0 0 0 1px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 214 170 / 0.14), 22px 0 48px -34px rgb(0 0 0 / 0.9)",
          }}
        >
          {/* 四块内嵌门板：两道竖缝 + 一道横缝围出来的老式木门 */}
          <span aria-hidden="true" className="absolute inset-[9%] grid grid-cols-2 grid-rows-3 gap-[7%]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="rounded-[1px]"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(255 214 170 / 0.06), rgb(0 0 0 / 0.24))",
                  boxShadow:
                    "inset 0 1px 0 rgb(255 214 170 / 0.12), inset 0 -1px 0 rgb(0 0 0 / 0.5), inset 1px 0 0 rgb(0 0 0 / 0.4), inset -1px 0 0 rgb(0 0 0 / 0.4), 0 1px 0 rgb(0 0 0 / 0.35)",
                }}
              />
            ))}
          </span>

          {/* 门把手：黄铜球 */}
          <span
            aria-hidden="true"
            className="absolute right-[7%] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 28%, #ffe0a6, #a87c3f 62%, #6b4a20)",
              boxShadow: "0 3px 8px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(0 0 0 / 0.4)",
            }}
          />
        </button>
      </div>

      <p
        aria-live="polite"
        className="mt-4 text-center text-caption tracking-wide text-muted"
      >
        {open ? openedText : hint}
      </p>
    </div>
  );
}
