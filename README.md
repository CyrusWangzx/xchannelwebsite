# [占位] 展示型官网框架

## 1. 项目简介与技术栈

本项目为展示型单页官网框架，采用锚点滚动导航，无后端依赖。

**技术栈：**

| 类别 | 技术 | 版本 |
|------|------|------|
| 构建 | Vite | ^6.4.4 |
| 框架 | React + TypeScript | ^18.3.1 / ~5.9.3 |
| 样式 | Tailwind CSS (PostCSS) | ^3.4.19 |
| 动效 | Framer Motion | ^11.18.2 |
| 图标 | Lucide React | ^1.53.0 |
| 部署 | CloudBase CLI + Framework Plugin | ^3.8.5 / ^1.9.7 |

## 2. 环境要求与版本锁定

- **Node.js ≥ 18**（推荐 18.20.4+）
- **npm ≥ 10**

**版本锁定说明：**

- **Vite 6**：当前 pin 到 ^6.4.4。Vite 7 要求 Node 20+，在 Node 18 环境下不可用。
- **Tailwind CSS v3**：pin 到 ^3.4.19。Tailwind v4 采用全新引擎，与 PostCSS 路线不兼容；且 v4 要求 Node 20+。
- **升级路径**：当升级至 Node 22+ 后，可考虑：
  - Vite → 7.x（需 Node 20+）
  - Tailwind CSS → 4.x（需重写配置，PostCSS 插件不再适用）

## 3. 本地开发

```powershell
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

> **PowerShell 提示**：在 PowerShell 5.1 中，命令行分隔符使用 `;` 而非 `&&`。但 npm scripts 内部的 `&&` 是正常的（由 npm 的 shell 执行）。

## 4. 换肤指南

只需修改 `src/index.css` 顶部 `:root` 中的 CSS 变量即可全局换色：

| 变量 | 含义 | 默认值 |
|------|------|--------|
| `--c-bg` | 页面主背景 | `#0a0e17` |
| `--c-surface` | 卡片/面板表面色 | `#111623` |
| `--c-text` | 主文字色 | `#e7eaf3` |
| `--c-muted` | 次要/弱化文字色 | `#9aa3b8` |
| `--c-accent` | 强调色（按钮、链接高亮） | `#6366f1` |
| `--c-accent-strong` | 强调色悬停态（更深） | `#4f46e5` |
| `--c-border` | 通用描边色 | `rgba(231,234,243,0.12)` |

**动效节奏调整：**

| 变量 | 含义 | 默认值 |
|------|------|--------|
| `--dur-fast` | 快速过渡（hover 等） | `150ms` |
| `--dur-base` | 常规过渡 | `300ms` |
| `--dur-slow` | 慢速过渡（页面级） | `800ms` |
| `--ease-out` | 缓动曲线 | `cubic-bezier(0.22, 1, 0.36, 1)` |

## 5. CloudBase 部署步骤

### 前置条件

- 腾讯云账号
- CloudBase 环境（需在控制台创建并开通静态网站托管）

### 部署流程

1. **安装 CLI**（二选一）：
   ```powershell
   # 全局安装
   npm i -g @cloudbase/cli

   # 或使用项目内依赖
   npx tcb
   ```

2. **登录**：
   ```powershell
   tcb login
   ```

3. **配置环境 ID**：
   打开 `cloudbaserc.json`，将 `"envId": "ENV_ID"` 替换为你的真实环境 ID。

4. **部署**：
   ```powershell
   npm run deploy
   ```

5. **访问**：部署成功后访问 `https://<环境ID>.tcloudbaseapp.com`

### 兜底命令

如果 `npm run deploy` 失败，可手动上传构建产物：

```powershell
npm run build
npx tcb hosting deploy dist -e <你的环境ID>
```

## 6. 验收自查清单

- [ ] 四档宽度（375 / 768 / 1280 / 1920）无横向滚动条
- [ ] 浏览器 Console 无报错、无 `console.log` 残留
- [ ] Tab 键焦点可见（所有可交互元素有 `focus-visible` 轮廓）
- [ ] 模拟 `prefers-reduced-motion: reduce` 后动效降级（无动画）
- [ ] 所有 `[占位]` 文案已替换为真实内容
- [ ] 所有 PlaceholderBox 已替换为真实图片

## 7. 目录结构

```
chat-1/
├── index.html                  # 入口 HTML
├── package.json                # 依赖与脚本
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── postcss.config.js           # PostCSS 配置
├── tailwind.config.ts          # Tailwind Token 配置
├── cloudbaserc.json            # CloudBase 部署配置
├── public/favicon.svg          # 站点图标
└── src/
    ├── main.tsx                # 入口：LazyMotion + MotionConfig
    ├── App.tsx                 # 根组件：组装所有 Section
    ├── index.css               # 设计 Token（换肤入口）
    ├── content.ts              # 全站文案数据
    ├── vite-env.d.ts           # Vite 类型声明
    ├── components/             # 7 个原语组件
    │   ├── Container.tsx       # 居中容器
    │   ├── Section.tsx         # 区块容器
    │   ├── SectionTitle.tsx    # 标题组件
    │   ├── Button.tsx          # 按钮组件
    │   ├── Card.tsx            # 卡片容器
    │   ├── Reveal.tsx          # 滚动显现动画
    │   └── PlaceholderBox.tsx  # 图片占位块
    └── sections/               # 8 个页面区块
        ├── Nav.tsx             # 导航栏
        ├── Hero.tsx            # 首屏主视觉
        ├── Features.tsx        # 核心能力
        ├── Showcase.tsx        # 产品展示
        ├── Stats.tsx           # 数据统计
        ├── About.tsx           # 关于我们
        ├── Cta.tsx             # 行动号召
        └── Footer.tsx          # 页脚
```

### Phase 3 内容填充指引

1. **文案替换**：只改 `src/content.ts`，所有字段以 `[占位]` 开头，直接替换即可。
2. **图片替换**：将 `PlaceholderBox` 替换为 `<img>` 或自定义组件，建议：
   - 使用 `loading="lazy"` 延迟加载
   - 设置明确的 `width` / `height` 属性防止布局偏移
   - 推荐 WebP 格式，提供 JPG 兜底
3. **图标替换**：`features` 数组中的 `icon` 字段可改为任意 lucide-react 图标名（需同步更新 `Features.tsx` 中的 import 和映射）。
