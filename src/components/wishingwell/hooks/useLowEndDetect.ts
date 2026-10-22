/**
 * 低端设备检测
 *
 * 命中任意一条就走 2D 降级版：
 *   · 没有 WebGL2（老设备 / 显卡黑名单 / 隐私模式禁了）
 *   · 逻辑核心 ≤ 4
 *   · deviceMemory ≤ 2GB（Chrome 系才有这个字段，没有就不参与判断）
 *   · 用户开了 prefers-reduced-motion？—— 不降级，仍然给 3D，只是关掉抛物线动画
 *
 * 检测只在挂载后跑一次，且**不阻塞首帧**：初值是「未知」，
 * 页面先按 3D 渲染骨架，判定完再决定换不换 2D。
 */
import { useEffect, useState } from "react";
import { supportsWebGL2 } from "../gl/glutil";

export interface LowEndState {
  /** 是否已判定完成 */
  checked: boolean;
  /** 是否应该走 2D 降级 */
  low: boolean;
  /** 判定原因（写进 data 属性，验收脚本会读） */
  reason: "ok" | "no-webgl2" | "few-cores" | "low-memory";
  cores: number;
  webgl2: boolean;
}

export function useLowEndDetect(): LowEndState {
  const [state, setState] = useState<LowEndState>({
    checked: false,
    low: false,
    reason: "ok",
    cores: 8,
    webgl2: true,
  });

  useEffect(() => {
    let reason: LowEndState["reason"] = "ok";
    const webgl2 = supportsWebGL2();
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

    if (!webgl2) reason = "no-webgl2";
    else if (cores <= 4) reason = "few-cores";
    else if (typeof mem === "number" && mem <= 2) reason = "low-memory";

    setState({ checked: true, low: reason !== "ok", reason, cores, webgl2 });
  }, []);

  return state;
}
