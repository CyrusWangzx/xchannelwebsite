/**
 * 进入视口才加载（IntersectionObserver）
 *
 * 许愿池在首屏之下（Hero 轮播图与 Cta 之间），所以 3D 那部分必须懒加载：
 * 首屏不去建 WebGL context、不编译 shader、不下载任何东西。
 *
 * once = true 时只触发一次（加载过的就别再卸载了，否则滚动来回会反复重建 context）。
 */
import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(
  rootMargin = "220px 0px",
  once = true,
): { ref: React.RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, once]);

  return { ref, inView };
}
