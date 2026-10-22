import type { Config } from "tailwindcss";

/* 描边统一由「通道 + 显式 alpha」生成。
   修复原缺陷：此前 border 走 <alpha-value>，不带透明度修饰符时取 1，
   导致 border-border 输出不透明 rgb(231,234,243)，与 12% 细线的设计意图不符。 */
const hairline = "rgb(var(--c-hairline-rgb) / var(--hairline-alpha))";
const hairlineStrong = "rgb(var(--c-hairline-rgb) / var(--hairline-strong-alpha))";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    /* 零回归断点阶梯：base = 360（无需前缀）
       md / lg 的生效点与改造前完全一致，现有 8 处 md: 与 3 处 lg: 不受影响。
       tab(1024) 与 xl(1440) / 2xl(1920) 为新增档位。 */
    screens: {
      xs: "480px",
      md: "768px",
      tab: "1024px",
      lg: "1280px",
      xl: "1440px",
      "2xl": "1920px",
    },
    extend: {
      /* 语义颜色——映射到 CSS 变量（RGB 通道语法，支持透明度修饰符） */
      colors: {
        bg: {
          DEFAULT: "rgb(var(--c-bg-rgb) / <alpha-value>)",
          deep: "rgb(var(--c-bg-deep-rgb) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--c-surface-rgb) / <alpha-value>)",
          elevated: "rgb(var(--c-surface-elevated-rgb) / <alpha-value>)",
        },
        text: "rgb(var(--c-text-rgb) / <alpha-value>)",
        muted: "rgb(var(--c-muted-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--c-accent-rgb) / <alpha-value>)",
          strong: "rgb(var(--c-accent-strong-rgb) / <alpha-value>)",
          bright: "rgb(var(--c-accent-bright-rgb) / <alpha-value>)",
          /* 用 accent 色**上文字**时用这一支：两个主题里各自取达标的那一个。
             accent-bright 只在深色主题达标（浅底上 3.48:1），accent-strong 反之。 */
          text: "rgb(var(--c-accent-text-rgb) / <alpha-value>)",
        },
        cyan: "rgb(var(--c-cyan-rgb) / <alpha-value>)",
        /* 物料品牌色：取自 public/materials 那套实拍图的真实色值。
           brand      = 那支黄（#FDEC0A），**只做小面积填充**，配 brand-ink 用；
           brand-ink  = 压在黄底上的墨字（#111），对比度远高于 AA；
           brand-edge = 线条与文字专用：深色底上就是黄，浅色主题会自动换成深琥珀，
                        否则黄线黄字在白底上直接消失。 */
        brand: {
          DEFAULT: "rgb(var(--c-brand-rgb) / <alpha-value>)",
          ink: "rgb(var(--c-brand-ink-rgb) / <alpha-value>)",
          edge: "rgb(var(--c-brand-edge-rgb) / <alpha-value>)",
          red: "rgb(var(--c-brand-red-rgb) / <alpha-value>)",
        },
        /* 媒体浮层底色：与 accent 等不同，这组令牌**不参与主题反相**
           （永远是把画面压暗），用于盖在图片上的遮罩与控件。 */
        scrim: "rgb(var(--c-scrim-rgb) / <alpha-value>)",
        /* 许愿池：3D 场景的配色在 shader 里由引擎直接读令牌（见 engine.readPalette），
           这里这几支是给**页面上的 UI** 用的（计数数字、卡片状态色），
           让 HTML 那一层和池子里的颜色是同一套来源。 */
        well: {
          gold: "rgb(var(--c-well-gold-rgb) / <alpha-value>)",
          glass: "rgb(var(--c-well-glass-rgb) / <alpha-value>)",
          highlight: "rgb(var(--c-well-highlight-rgb) / <alpha-value>)",
          water: "rgb(var(--c-well-water-rim-rgb) / <alpha-value>)",
          splash: "rgb(var(--c-well-splash-rgb) / <alpha-value>)",
        },
        /* 语义描边：border 是向后兼容别名，新代码统一用 hairline */
        hairline: {
          DEFAULT: hairline,
          strong: hairlineStrong,
        },
        border: {
          DEFAULT: hairline,
          strong: hairlineStrong,
        },
      },

      /* 排版尺度 */
      fontSize: {
        display: [
          "clamp(2.5rem, 6vw, 4.5rem)",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
            fontWeight: "700",
          },
        ],
        /* 首屏标语：比 display 略收一档。
           标语是一整句话（2026-10-22 起为 9 个字符「认真的玩 假装创业」，含一个空格），
           按 display 的 6vw 走，桌面端会被挤成尴尬断行；收到 4.8vw / 上限
           3.25rem 后，配合 max-w-5xl 的标语框（可用 ~944px）刚好单行
           放得下（约 17.5 字符宽 × 52px ≈ 910px），窄屏再自然折行。
           ⚠️ 换标语后回来核一眼字数：超过约 17.5 字就会在桌面端折成两行。 */
        statement: [
          "clamp(2rem, 4.8vw, 3.25rem)",
          {
            lineHeight: "1.18",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        h1: [
          "clamp(2rem, 4vw, 3rem)",
          {
            lineHeight: "1.15",
            letterSpacing: "-0.02em",
            fontWeight: "700",
          },
        ],
        h2: [
          "clamp(1.75rem, 3.5vw, 2.5rem)",
          {
            lineHeight: "1.2",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        h3: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        h4: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.7" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
      },

      /* 圆角——新增语义档位，默认档位保持不动以免影响存量类名 */
      borderRadius: {
        card: "var(--r-md)",
        panel: "var(--r-lg)",
        pill: "var(--r-pill)",
      },

      /* 阴影——全部指向令牌，修掉原先写死的 indigo 与纯黑 */
      boxShadow: {
        card: "var(--shadow-1)",
        elevated: "var(--shadow-2)",
        glow: "var(--shadow-glow)",
      },

      /* 容器宽度 */
      maxWidth: {
        content: "1200px",
        wide: "1440px",
      },

      /* 等宽栈：给必须对齐的数字（计数、兑换码）用 */
      fontFamily: {
        mono: "var(--font-mono)",
      },

      /* 8pt 间距系统补齐 */
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },

      /* 动效时长 */
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },

      /* 动效曲线 */
      transitionTimingFunction: {
        ease: "var(--ease-out)",
      },

      /* 浮动动画关键帧 */
      keyframes: {
        float: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(4%, -3%, 0) scale(1.08)" },
        },
      },
      animation: {
        float: "float 24s ease-in-out infinite",
        "float-slow": "float 32s ease-in-out infinite reverse",
      },
    },
  },
  plugins: [],
} satisfies Config;
