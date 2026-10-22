/* 全站文案数据——尚未确定的字段以 [占位] 开头，待替换真实内容 */

/* 品牌基本信息（Logo 的 alt 文本、页脚署名等均从此读取） */
export const brand = {
  name: "x.channel",
  /* 用于页脚品牌简介 / meta description */
  tagline: "[占位] 一句话品牌简介，建议不超过 30 字。",
};

/* 顶层导航：X.Channel 的五个板块。
   五个板块都是**独立页面**（#/persona 这类路由），不再是首页里的锚点区块，
   所以这里带一个 key，供导航高亮当前页使用。 */
export const navLinks: {
  key: "persona" | "media" | "games" | "token" | "materials";
  label: string;
  href: string;
}[] = [
  { key: "persona", label: "X.形象", href: "#/persona" },
  { key: "media", label: "X.媒体", href: "#/media" },
  { key: "games", label: "X.游戏", href: "#/games" },
  { key: "token", label: "X.Token", href: "#/token" },
  { key: "materials", label: "X.收藏", href: "#/materials" },
];

/* 首屏主视觉区 */
export const hero = {
  /* 标语上方的眉标。终端提示符的位置感，不承载信息，只定调性 */
  eyebrow: "X.CHANNEL",
  /* 首屏标语。text 是完整句子，会被逐字拆开浮现；
     highlight 指定句中被高亮的片段——整句的落点就在这个词上。
     en 是同一句的英文版（Cyrus 给的措辞），紧跟在中文下方，构成中英并置的完整标语；
     两者是同一件东西的两种写法，改一个就该改另一个。
     actionLabel 是标语按钮的无障碍名称：标语本身是可点的（点了会重播逐字动效），
     但内部全是 aria-hidden 的逐字片段，读屏取不到名字，必须显式给一个。 */
  statement: {
    /* 2026-10-22 Cyrus 定稿：「认真的玩 假装创业」/ play it till make it。
       中间那个空格是他原文给的（不是逗号），逐字动效里空格会单独占一个 span，
       所以两截之间会自然留出一道气口，别再自作主张换成标点。
       highlight 取后半句：前半句是姿态，后半句是落点，光落在那儿才收得住。 */
    text: "认真的玩 假装创业",
    highlight: "假装创业",
    en: "PLAY IT TILL MAKE IT",
    actionLabel: "重读这句话",
  },
  subtitle:
    "从战略判断到日常取舍，AI 都在场——不是候命的工具，而是参与者。",
  /* 首屏唯一的按钮。它不跳转，只把注意力引到上方标语——
     真正的交互发生在标语本身（点一下会重播逐字浮现）。 */
  cta: { label: "点一下这句话" },
};

/* 首屏作品展示片（素材：X.Channel 作品展示片，64s / 1280×720 / 13MB）
   体积较大，故采用「海报 + 点击播放」而非自动播放，页面加载时零字节下载。 */
export const heroMedia = {
  src: "/hero-reel.mp4",
  poster: "/hero-reel-poster.webp",
  /* 视频的无障碍名称 */
  label: "X.Channel 作品展示片",
  playLabel: "播放作品展示片",
  pauseLabel: "暂停播放",
  muteLabel: "静音",
  unmuteLabel: "打开声音",
  /* 进度条的无障碍名称 */
  progressLabel: "播放进度",
};

/* 首屏海报轮播（位于作品展示片下方）
   素材：3 张活动海报，竖版为主（两张 3:4、一张 1:1）。
   海报本身已是完整成品（含标题、日期、场地等全部文字），
   所以叠加层只放轮播控件，不再添加任何说明文案。 */
export const bannerSlides: { src: string; alt: string }[] = [
  { src: "/banner-01.webp", alt: "[占位] 第一张海报的画面描述（供读屏用户理解内容）" },
  { src: "/banner-02.webp", alt: "[占位] 第二张海报的画面描述（供读屏用户理解内容）" },
  { src: "/banner-03.webp", alt: "[占位] 第三张海报的画面描述（供读屏用户理解内容）" },
];

/* 轮播控件的无障碍文案 + 面板标题。
   {n} = 当前序号，{total} = 总张数，由组件替换。 */
export const bannerCarousel = {
  /* 面板左上角的可见标题（参照 Steam「精选和推荐」的版面） */
  title: "[占位] 精选和推荐",
  regionLabel: "活动海报轮播",
  prevLabel: "上一张海报",
  nextLabel: "下一张海报",
  playLabel: "开始自动播放",
  pauseLabel: "暂停自动播放",
  slideStatus: "第 {n} 张，共 {total} 张",
  dotLabel: "跳转到第 {n} 张海报",
};

/* ---- X.形象 --------------------------------------------------------------
   现在 16 位成员（11 位原成员 + 2026-10-21 加入的 5 位，见下面的 members）。
   原 11 位的素材由「四联角色设计稿」自动切出，输出两份：
   portrait（600×800 透明底全身像，卡片用）/ avatar（256×256 透明底头部，个人主页用）。
   两者都由 public/persona/<slug>-*.webp 提供，slug 同时用作个人主页的路由片段。
   注意：源图里的「子轩机甲」与「子轩」是同一角色的两版形象，
   Cyrus 已确认只保留「子轩」，机甲版不进花名册。 */
export const personaSection = {
  eyebrow: "X.形象",
  /* 原来带「[占位]」前缀与一句「一句话介绍…建议不超过 40 字」的示例文案，
     Cyrus 2026-10-21 定稿：标题去掉占位前缀，团队介绍只留四个字——「自由，随心。」 */
  title: "认识一下 X.Channel 的这群人",
  description: "自由，随心。",
  /* 卡片上那张全身像的 alt 模板，{name} 由组件替换 */
  portraitAlt: "{name} 的形象设定图",
  /* 卡片右下角的「查看主页」提示 */
  openHint: "查看主页",
};

/* 花名册。16 位成员：
   - 前 11 位是原来的 X 组织成员（四联角色设计稿自动切出）；
   - 后 5 位是 2026-10-21 加入的新成员，各自带自己的 IP 形象（素材在 G:\#002XIP资产）。
   `role` 是身份标签，Cyrus 2026-10-21 定稿的分配规则：
   - 三位 AI：豆总 CEO / 小金子 CFO / 二表哥 CDO；
   - 创始成员：子轩、白川、娜酱、志云、落叶、**小喷菇（易恒老师）**；
   - 其余大佬：核心成员。
   `role` 仍是可选字段：没定身份的人不传，卡片与个人主页会自动省略这一行
   —— 不要再拿「[占位] 身份」凑数。
   `ink` 标记「白墨线稿」：默子那张是黑白线稿，深色主题下压成白墨、浅色主题由 CSS 反相，
   否则黑线在深色玻璃卡上等于隐形。 */
type Member = {
  slug: string;
  name: string;
  role?: string;
  /** 已有专属个人主页的三位 AI：er / dou / jin。
      有值时 `#/member/<slug>` 直接渲染那一页（见 agents/），没值走「偷懒啦」空态。
      ⚠️ 加人时只改这里，别去动路由。 */
  home?: "er" | "dou" | "jin";
  portrait: string;
  avatar: string;
  ink?: boolean;
};

export const members: Member[] = [
  { slug: "erbiaoge", name: "二表哥", role: "CDO", home: "er", portrait: "/persona/erbiaoge-portrait.webp", avatar: "/persona/erbiaoge-avatar.webp" },
  /* slug 仍为 nana（对外链接不变），名字按 Cyrus 2026-10-21 的口径改为「娜酱」 */
  { slug: "nana", name: "娜酱", role: "创始成员", portrait: "/persona/nana-portrait.webp", avatar: "/persona/nana-avatar.webp" },
  { slug: "zixuan", name: "子轩", role: "创始成员", portrait: "/persona/zixuan-portrait.webp", avatar: "/persona/zixuan-avatar.webp" },
  /* 易恒老师 = 小喷菇（Cyrus 2026-10-22 确认）：卡片沿用 IP 名「小喷菇」，身份按创始成员算 */
  { slug: "xiaopenggu", name: "小喷菇", role: "创始成员", portrait: "/persona/xiaopenggu-portrait.webp", avatar: "/persona/xiaopenggu-avatar.webp" },
  { slug: "xiaocha", name: "小猹", role: "核心成员", portrait: "/persona/xiaocha-portrait.webp", avatar: "/persona/xiaocha-avatar.webp" },
  { slug: "zhiyun", name: "志云", role: "创始成员", portrait: "/persona/zhiyun-portrait.webp", avatar: "/persona/zhiyun-avatar.webp" },
  { slug: "chamei", name: "猹妹", role: "核心成员", portrait: "/persona/chamei-portrait.webp", avatar: "/persona/chamei-avatar.webp" },
  { slug: "baichuan", name: "白川", role: "创始成员", portrait: "/persona/baichuan-portrait.webp", avatar: "/persona/baichuan-avatar.webp" },
  { slug: "luoye", name: "落叶", role: "创始成员", portrait: "/persona/luoye-portrait.webp", avatar: "/persona/luoye-avatar.webp" },
  { slug: "douzong", name: "豆总", role: "CEO", portrait: "/persona/douzong-portrait.webp", avatar: "/persona/douzong-avatar.webp", home: "dou" },
  { slug: "jinchan", name: "小金子", role: "CFO", portrait: "/persona/jinchan-portrait.webp", avatar: "/persona/jinchan-avatar.webp" },

  /* --- 2026-10-21 新成员 --- */
  { slug: "goodtime", name: "GoodTime", role: "核心成员", portrait: "/persona/goodtime-portrait.webp", avatar: "/persona/goodtime-avatar.webp" },
  { slug: "dayanmai", name: "大燕麦", role: "核心成员", portrait: "/persona/dayanmai-portrait.webp", avatar: "/persona/dayanmai-avatar.webp" },
  { slug: "goagoal", name: "王GoGoal", role: "核心成员", portrait: "/persona/goagoal-portrait.webp", avatar: "/persona/goagoal-avatar.webp" },
  { slug: "baijiuling", name: "白九龄", role: "核心成员", portrait: "/persona/baijiuling-portrait.webp", avatar: "/persona/baijiuling-avatar.webp" },
  { slug: "mozi", name: "默子要早睡", role: "核心成员", portrait: "/persona/mozi-portrait.webp", avatar: "/persona/mozi-avatar.webp", ink: true },
];

/* 成员个人主页。
   Cyrus 2026-10-21 最新口径：主页还没建设的成员，**按 X.Token 的占位模式来**
   —— 一句「XX 偷懒啦」+ 一个「一键催促」按钮。
   按钮纯前端反馈（不埋点、不发请求、不落库），文案里也不假装「已发送给本人」。 */
export const memberPage = {
  backLabel: "返回 X.形象",
  /* {name} 由组件替换为成员名 */
  title: "{name} 的个人主页",
  /* X.Token 同款空态：面板里只放这一句 */
  lazyText: "{name} 偷懒啦，主页还没建设好~",
  urgeLabel: "一键催促",
  /* 点过一次之后按钮换成这句（继续点仍然只是计数） */
  urgeDoneLabel: "再催一次",
  /* 点击反馈，{name} / {count} 由组件替换 */
  urgeFeedback: "已经催了 {count} 次，{name} 还在睡…",
  /* 无障碍：个人主页里那张头像图的 alt 模板 */
  avatarAltTemplate: "{name} 的形象头像",
  /* 路由片段对不上任何成员时的兜底文案（写给人看的正常话，不再挂 [占位]） */
  notFoundTitle: "没找到这位成员",
  notFoundText: "检查一下链接，或者回 X.形象 重新选一个。",
};

/* ---- X.游戏：投币厅（#/games）-------------------------------------------
   一台霓虹街机 = 三款像素小游戏。点机器（侧视角）进主视角，在机台上选一款开打，
   通关后从机身下方的出球口滚出一颗兑换球，点球打开 Token 兑换码。
   ⚠️ 本阶段**只做「拿到兑换码」**：兑换什么、跟什么绑定都还没实现，
      也不落库——刷新页面即失。codeNote 里对用户明说了这件事。
   一局的参数（目标数、容错次数、需要哪些操作键）在 lib/arcade.ts 的 META 里，
   那是引擎的事；这里只放文案。 */
export const gamesSection = {
  eyebrow: "X.游戏",
  title: "投币厅",
  description:
    "一台机器，三款像素小游戏。点机器进主视角，在机台上选一款开打——通关，出球口就滚出一颗 Token 兑换球。",
  hint: "点机器进主视角。键盘方向键 / WASD 操作，手机用屏幕下方的按键。",
  /* 投币厅整体的无障碍名称 */
  caseLabel: "X.游戏 投币厅",
  /* 侧视角那台机器的进入按钮 */
  enterLabel: "进入投币厅",
  /* 灯箱上的字：侧视角与选单页不指向任何一款游戏，用中性字 */
  marqueeIdle: "X.CHANNEL",
  marqueeSelect: "INSERT COIN",
  /* 灯箱上那行「点击开始」 */
  standbyLabel: "点 击 开 始",
  /* 主视角里的选单：三款游戏摆在机台上，投币开打 */
  selectTitle: "投币选一款",
  selectHint: "三款都在机台上，选一款就开始。",
  /* {name} 由组件替换 */
  selectLabel: "选择「{name}」开始游戏",
  selectBadge: "投币",
  /* 主视角顶部的读数 */
  goalLabel: "得分",
  lifeLabel: "剩余机会",
  screenAlt: "{name} 的游戏画面",
  exitLabel: "退出游戏",
  restartLabel: "再来一次",
  backToSelectLabel: "换一款",
  /* 通关 / 失败的横幅 */
  winTitle: "通关",
  winText: "出球口滚出一颗兑换球，落在机台下面。",
  loseTitle: "失败",
  loseText: "再来一局就好，这游戏没那么难。",
  /* 操作键的无障碍名称 */
  controls: {
    left: "左移",
    right: "右移",
    up: "向上",
    down: "向下",
    action: "动作键",
  },
  /* 兑换球出口 */
  trayTitle: "兑换球出口",
  trayEmpty: "还没有兑换球。通关任意一款游戏，球会从出球口滚出来。",
  trayMoreTemplate: "另有 {n} 颗未展开",
  ballLabel: "打开第 {n} 颗兑换球（{game}）",
  ballCloseLabel: "收起第 {n} 颗兑换球的兑换码",
  /* 兑换码面板 */
  codeEyebrow: "Token 兑换码",
  codeNote:
    "这一阶段只做到「拿到兑换码」：兑换什么、和哪个权益绑定都还没接，刷新页面就没了。",
  copyLabel: "复制",
  copiedLabel: "已复制",
  /* 降级路径：Clipboard API 不可用（非安全上下文 / 无权限）时，
     我们只把兑换码整段选中，不代按复制键 —— 所以文案要说「已选中」。 */
  copySelectedLabel: "已选中，请手动复制",
  copyFailedLabel: "复制失败，请手动选中",
  closeLabel: "关闭",
};

/* 三款游戏的「文案侧」定义；key 必须与 lib/arcade.ts 的 GameKey 对得上。
   hue 决定机身霓虹取哪一支令牌（1/2/3 → --c-arcade-neon1/2/3）。 */
export const arcadeGames: {
  key: "catch" | "brick" | "snake";
  name: string;
  marquee: string;
  hue: 1 | 2 | 3;
  tagline: string;
  howTo: string;
}[] = [
  {
    key: "catch",
    name: "浓度收集",
    marquee: "AI DENSITY",
    hue: 1,
    tagline: "左右移动，接住落下来的「AI 浓度」方块。漏三个就结束。",
    howTo: "← → 移动",
  },
  {
    key: "brick",
    name: "砖块清屏",
    marquee: "BRICK BREAK",
    hue: 2,
    tagline: "把 24 块砖全打掉。球掉下去三次就结束。",
    howTo: "← → 移动，空格发球",
  },
  {
    key: "snake",
    name: "信号贪吃蛇",
    marquee: "SIGNAL SNAKE",
    hue: 3,
    tagline: "吃满 8 颗信号。撞墙或者咬到自己，立刻结束。",
    howTo: "方向键转向",
  },
];

/* ---- X.游戏 · 刮刮乐（第二工位）-----------------------------------------
   玩法、概率、奖金倍数全在 lib/scratch.ts（纯逻辑），颜色全在 index.css 的
   `--c-scratch-*`，这里只有文案。
   票面结构照真实票面：抬头（品牌 / 系列 / 面额角标）→ 票名 + 玩法 →
   中奖号码 → 覆盖膜 → 底栏（保安区 / 票号 / 中奖率 / 说明）。
   两条自我约束：
   1. **票面不写「谢谢惠顾」**：没中就写没中，不做「差一点」的诱导。
   2. **不写「必中」「稳赚」**：概率原样摆在旁边，40% / 60% 都写明。 */
export const scratchSection = {
  eyebrow: "第二工位 · 刮刮乐",
  title: "刮刮乐",
  description:
    "五款票、三种面额，插在柜台的钢丝架上。拿一张起来，正反两面都能看，看准了再刮。",
  hint: "点一张票把它拿起来：可以翻到背面看奖级，也可以直接刮开。刮完放回架子。",

  /* ---- 取票柜（钢丝架 + 木底座） ---- */
  rackSign: "X.CHANNEL 刮刮乐",
  rackSignSub: "即开即兑 · 演示专柜",
  rackRestock: "本次会话每款限取 3 张，刷新页面重置——还没有接后台。",
  remainingTemplate: "剩 {n} 张",
  soldOut: "售罄",
  pickLabelTemplate: "拿起「{name}」，面额 {denom} 元",
  denomLabel: "面额",
  denomNote: "面额只是票档，三档的奖级与概率完全一样。",

  /* ---- 票面（真票的印刷文字） ---- */
  brand: "X.CHANNEL",
  denomUnit: "元",
  matchLabel: "中奖号码",
  matchNote: "对号入座",
  serialLabel: "票号",
  guardLabel: "保安区",
  guardHint: "刮开无效",
  maxPrizeLabel: "最高奖级",
  /* 票面只印一行短规则 —— 真票的完整玩法印在背面。
     ⚠️ 票面**不出现任何金额**（Cyrus 2026-10-21：不能出现具体金额）。
     玩法因此改成「对中几个决定奖级」，和 lib/scratch.ts 的 HIT_COUNT 完全一致。 */
  ruleShort: "对中「中奖号码」的个数决定奖级",
  rule: "刮开覆盖膜，出现与「中奖号码」相同的符号即算对中。对中格数越多奖级越高：1 格五等奖、2 格四等奖、3 格三等奖、4 格二等奖、5 格一等奖。",
  scratchTip: "刮 开 覆 盖 膜",
  /* {pct} 由组件按概率表算（lib/scratch.ts 的 WIN_PERMILLE），不写死 */
  oddsTemplate: "中奖率 {pct}",
  disclaimer: "演示票 · 不涉及真实兑奖",

  /* ---- 拿在手上：翻面 / 开刮 ---- */
  flipToBackLabel: "翻到背面",
  flipToFrontLabel: "翻回正面",
  scratchNowLabel: "刮开这张",
  inspectHint: "正面是图案和中奖号码，背面是奖级说明。翻一翻再决定。",

  /* ---- 票背（奖级说明） ---- */
  backTitle: "奖级与概率",
  backRuleTitle: "玩法",
  backNotesTitle: "须知",
  backNotes: [
    "本票为演示票，不涉及真实兑奖，也没有任何实际价值。",
    "覆盖膜刮开后，保安区仍然有效，可用于核验票面。",
    "中奖结果在出票时就已确定，刮开只是揭示，不存在「刮的手法」影响结果。",
  ],
  backBarcodeLabel: "条码",

  /* ---- 刮的过程 ---- */
  revealAllLabel: "全部刮开",
  progressTemplate: "已刮开 {pct}%",
  revealedLabel: "已刮开",

  /* ---- 结果 ---- */
  resultEyebrow: "开奖",
  winTitle: "中奖",
  winNote: "按票面规则，这张对了。这一阶段只提示奖级，兑换还没接。",
  loseTitle: "未中奖",
  loseNote: "这张没对上。下一张也许就中了。",
  againLabel: "再取一张",
  backLabel: "放回架子",
  announceWinTemplate: "中奖，{tier}。",
  announceLose: "未中奖。",

  /* ---- 奖级表 ---- */
  oddsTitle: "奖级与概率",
  oddsNote: "结果在出票时就已确定，刮开只是揭示。五款票、三个面额的概率完全一样。",
  oddsColTier: "奖级",
  oddsColNeed: "需命中",
  oddsColChance: "概率",
  oddsColOneIn: "约每几张",
  oddsNeedTemplate: "{n} 格",
  oddsNoTier: "—",
  /* 下标 = outcome（0 未中奖，1..5 奖级） */
  tierLabels: ["未中奖", "一等奖", "二等奖", "三等奖", "四等奖", "五等奖"],

  /* ---- 声音 ---- */
  soundOnLabel: "刮擦音 开",
  soundOffLabel: "刮擦音 关",
  soundHint: "刮擦音默认开启，可以随时关掉。",
};

/* 五款票的「文案侧」定义；key 必须与 lib/scratch.ts 的 CARD_FACES 对得上。
   票名照真票那样起（四个字，读着像彩票），系列名印在抬头。
   颜色不在这里 —— 一款一色，色值与纹样在 index.css。 */
export const scratchFaces: {
  key: string;
  name: string;
  series: string;
}[] = [
  { key: "star", name: "星芒闪耀", series: "璀璨系列" },
  { key: "weave", name: "波光粼粼", series: "静水系列" },
  { key: "matrix", name: "矩阵密码", series: "数码系列" },
  { key: "signal", name: "信号满格", series: "电波系列" },
  { key: "prism", name: "棱镜折光", series: "光影系列" },
];

export const tokenSection = {
  eyebrow: "X.Token",
  /* 2026-10-22 Cyrus：这一页先给一句「还在建设中」的占位说明。
     顺手把标题和描述里的 [占位] 清掉 —— 页面已经明确告知建设中，
     再顶着一句「建议不超过 40 字」的示例文字只会显得没做完。 */
  title: "X.Channel Token",
  description: "",
  emptyText: "这里还在建设中~",
};

/* ---- X.收藏：物料展览馆（#/materials） ------------------------------------
   素材来源：Cyrus 给的一张物料合集实拍图，已按品类拆成 11 张图放在
   public/materials/ 下。拆分脚本与坐标记录在 .workbuddy/tmp/mat/crop8.py。
   ⚠️ 这 11 类是按画面里能确认的物品命名的，没有编造规格；
      描述只写「图上看得见的东西」，尺寸/材质等未知参数一律不写。 */
export const materialsSection = {
  eyebrow: "X.收藏",
  title: "物料展览馆",
  description:
    "我们把「99% AI NATIVE」这一整套视觉，做成了一柜子能拿在手上的东西。推开柜门，逐件看它们的样子。",
  /* 柜体铭牌上的小标签 */
  cabinetLabel: "展示柜",
  /* 清单上方的操作提示 */
  hint: "点击柜门开启，再点柜里的展品看详情。",
  /* 柜门开关（也是一枚 aria-expanded 的实体按钮） */
  openLabel: "打开柜门",
  closeLabel: "关闭柜门",
  /* 两扇玻璃门本身的无障碍名称（纯装饰按钮，键盘用户走上面的开关） */
  doorLabel: "玻璃柜门",
  /* 展示柜整体的无障碍名称 */
  caseLabel: "X.收藏 玻璃展示柜",
  /* 展品按钮的无障碍名称：{name} 由组件替换 */
  selectLabel: "查看「{name}」的详情",
  deselectLabel: "收起「{name}」的详情",
  /* 展品图的 alt 模板 */
  imageAltTemplate: "{name} 的实物图",
  /* 展签（点击展品后出现的详情面板） */
  detailEyebrow: "展签",
  detailEmpty: "点击柜里的任意一件展品，这里会显示它的信息。",
  detailCloseLabel: "关闭展签",
  /* ---- 以下三项是「抽屉柜」版本的遗留字段，玻璃展示柜不再使用 ---- */
  expandLabel: "拉开「{name}」",
  collapseLabel: "收起「{name}」",
  gripLabel: "抽屉把手",
};

/* 一格展品 = 一类物料（玻璃展示柜里的展品）。
   key 同时用作分组的键；image / w / h 是白底实拍原图的固有尺寸，保留备用；
   cut / cutW / cutH 是**去背版**（透明底），玻璃展示柜里的展品用它——
   原实拍图直接摆进柜子会变成一张张白卡。
   tier / ih 是摆放参数：第几层（自上而下 1–4）+ 展品在柜内的高度（rem，
   宽度由图片自身比例决定）。 */
export const materialDrawers: {
  key: string;
  name: string;
  category: string;
  image: string;
  w: number;
  h: number;
  cut: string;
  cutW: number;
  cutH: number;
  tier: number;
  ih: number;
  specs: string[];
  desc: string;
}[] = [
  {
    key: "phone-case",
    name: "手机壳",
    category: "机身周边",
    image: "/materials/01-phone-case.webp",
    w: 500,
    h: 459,
    cut: "/materials/cut/01-phone-case.webp",
    cutW: 471,
    cutH: 454,
    tier: 1,
    ih: 7,
    specs: ["2 款配色", "相机模组全包"],
    desc: "两款配色同框：黄色满印款把角色与标语铺满整个背面，白色款则留出大片底色，只让几枚贴标与「99% AI NATIVE」浮在上面。",
  },
  {
    key: "desk-mat",
    name: "桌垫",
    category: "桌面周边",
    image: "/materials/02-desk-mat.webp",
    w: 837,
    h: 484,
    cut: "/materials/cut/02-desk-mat.webp",
    cutW: 760,
    cutH: 434,
    tier: 3,
    ih: 7,
    specs: ["大版面", "同框含鼠标"],
    desc: "整张桌面主视觉：「X.channel 假装创业集团」落在左上角，中央是「99% AI NATIVE」，四角用星芒与「期间限定」「AI 浓度 UP!」两枚爆炸贴收边。",
  },
  {
    key: "lanyard",
    name: "工牌挂绳",
    category: "身份周边",
    image: "/materials/03-lanyard.webp",
    w: 278,
    h: 514,
    cut: "/materials/cut/03-lanyard.webp",
    cutW: 265,
    cutH: 506,
    tier: 2,
    ih: 9,
    specs: ["织带双面印", "含透明卡套"],
    desc: "黄色织带两面都印着「SMILE AHEAD」，配一只透明卡套工牌，卡面是组织标识与「99% AI NATIVE」。",
  },
  {
    key: "keychain",
    name: "亚克力钥匙扣",
    category: "挂件周边",
    image: "/materials/04-keychain.webp",
    w: 547,
    h: 168,
    cut: "/materials/cut/04-keychain.webp",
    cutW: 541,
    cutH: 168,
    tier: 3,
    ih: 3.6,
    specs: ["5 款", "随附角色铭牌"],
    desc: "五枚一块：豆总 CEO、小金子 CFO、二表哥 CXO、落叶，外加一枚只印 X 标记的几何款。每枚都带着自己的名字牌。",
  },
  {
    key: "acrylic-charm",
    name: "亚克力小挂件",
    category: "挂件周边",
    image: "/materials/05-acrylic-charm.webp",
    w: 452,
    h: 104,
    cut: "/materials/cut/05-acrylic-charm.webp",
    cutW: 451,
    cutH: 104,
    tier: 3,
    ih: 3.1,
    specs: ["5 款", "小尺寸"],
    desc: "钥匙扣的同门小号：Cyrus、Stella、志云、易恒、白川，五枚并排，底部各印角色名牌，适合串在包带或拉链头上。",
  },
  {
    key: "earbuds-case",
    name: "耳机保护壳",
    category: "机身周边",
    image: "/materials/06-earbuds-case.webp",
    w: 178,
    h: 152,
    cut: "/materials/cut/06-earbuds-case.webp",
    cutW: 173,
    cutH: 142,
    tier: 1,
    ih: 5.6,
    specs: ["分体上盖", "侧边留挂绳孔"],
    desc: "白色硬壳，正面印「99% AI NATIVE」字样，右下角贴一枚戴皇冠的角色，侧面留了挂绳孔。",
  },
  {
    key: "pin-badge",
    name: "圆形徽章",
    category: "配饰周边",
    image: "/materials/07-pin-badge.webp",
    w: 687,
    h: 188,
    cut: "/materials/cut/07-pin-badge.webp",
    cutW: 682,
    cutH: 173,
    tier: 4,
    ih: 3.6,
    specs: ["4 款", "含别针底座"],
    desc: "四枚圆徽章：一枚组织标识款「X.channel」，一枚二表哥 CXO，一枚落叶，还有一枚戴皇冠的角色头像。",
  },
  {
    key: "washi-tape",
    name: "和纸胶带",
    category: "手账周边",
    image: "/materials/08-washi-tape.webp",
    w: 214,
    h: 220,
    cut: "/materials/cut/08-washi-tape.webp",
    cutW: 212,
    cutH: 219,
    tier: 2,
    ih: 6,
    specs: ["2 卷", "宽幅"],
    desc: "两卷宽幅和纸胶带：一卷绕着一圈角色头像，一卷印「99% AI NATIVE」与皇冠、星芒等散点图案。",
  },
  {
    key: "sticker",
    name: "贴纸",
    category: "手账周边",
    image: "/materials/09-sticker.webp",
    w: 726,
    h: 175,
    cut: "/materials/cut/09-sticker.webp",
    cutW: 717,
    cutH: 175,
    tier: 4,
    ih: 3.6,
    specs: ["2 张", "多枚刀模"],
    desc: "两张贴纸版。一张是团队全家福，人物下面都带着名牌；另一张围绕「99% AI NATIVE」散开皇冠、爱心、星芒与「SMILE AHEAD」胶囊标。",
  },
  {
    key: "pouch",
    name: "收纳袋",
    category: "随行周边",
    image: "/materials/10-pouch.webp",
    w: 423,
    h: 212,
    cut: "/materials/cut/10-pouch.webp",
    cutW: 411,
    cutH: 212,
    tier: 2,
    ih: 6,
    specs: ["2 款", "拉链款 / 抽绳款"],
    desc: "两款黄色收纳袋并排：左边是带拉链的方袋，右边是抽绳小袋，同印「99% AI NATIVE」与「SMILE AHEAD!」。",
  },
  {
    key: "notebook",
    name: "笔记本",
    category: "文具周边",
    image: "/materials/11-notebook.webp",
    w: 220,
    h: 410,
    cut: "/materials/cut/11-notebook.webp",
    cutW: 205,
    cutH: 366,
    tier: 1,
    ih: 9,
    specs: ["硬壳封面", "弹力绑带"],
    desc: "黄色硬壳封面，自上而下排着组织标识、「99% AI NATIVE」与「AI 浓度 UP!」爆炸贴，右下角是角色与「SMILE AHEAD!」，侧边配一条黑色弹力绑带。",
  },
];


/* ---- X.收藏 第二工位：官方服装（3D 衣架 + 单件卫衣）--------------------
   Cyrus 的第一件官方服装：X.Channel × 2026 观猹大会 联名款连帽卫衣。

   两条背景：
   1. **尺码暂缓**。Cyrus 已给过一张 S–5XL 的尺码表（衣长/胸围/肩宽/袖长/
      身高/体重），但这一阶段**不做任何尺码 UI，也不把表里的数字写进代码**——
      表是"待上线"的物料，先落进来只会变成一堆没人用的死数据。架子刻意做长做宽，
      就是给下一阶段 8 个尺码一起挂上来留的位置。
   2. **正/背两张素材是怎么来的**：Cyrus 给的是「效果图展示图」（两张卫衣并排在
      浅色卡面上）。脚本按包围盒裁切 → 2.5× LANCZOS 放大 → 用**与画布边缘连通的
      亮区**判背景（不是全局亮度阈值，那样会把布料高光一起吃掉）→ 连通域 + 闭运算
      补边缘缺口 → 收缩 3px 去掉原图自带的浅色描边。产物：
      `public/apparel/hoodie-front.webp`（1202×1241）、`hoodie-back.webp`（1187×1234）。
      脚本落在 `.workbuddy/tmp/apparel/`，要重出素材照着重跑即可。 */
export const apparelSection = {
  /* ⚠️ 这里刻意不叫「X.收藏」：同一导航区块里的第二件事用 h2 工位牌，
     眉题一换，导航 label 与区块眉题的 5/5 对位才不会被破坏。 */
  eyebrow: "官方服装",
  title: "X.Channel × 2026 观猹大会 联名款",
  description:
    "首件官方服装。黑色水洗连帽卫衣：左胸是品牌徽标，背后是「观猹大会 2026」的体素纪念图案。",
  hint: "点衣服进近景，可以翻到背面看。",
  /* ---- 衣架铭牌 ---- */
  serialLabel: "官方服饰 · 001",
  rackLabel: "官方服装挂架",
  countLabel: "在架",
  /* ---- 视角控制 ---- */
  enterLabel: "看近景",
  closeLabel: "回到衣架",
  frontLabel: "正面",
  backLabel: "背面",
  faceGroupLabel: "查看卫衣的哪一面",
  flipLabel: "翻到{face}",
  /* ---- 无障碍名称 ---- */
  caseLabel: "官方服装挂架",
  itemLabel: "查看「{name}」的近景",
  itemFlipLabel: "翻到「{name}」的{face}",
  imageAlt: "「{name}」的{face}",
  /* ---- 只写图上看得见的属性，不编造克重/材质/工艺 ---- */
  specs: ["黑色水洗", "连帽", "袋鼠兜", "联名款"],
  /* 尺码在文案里交代，UI 里不出现 */
  moreNote: "架子刻意留长——S 到 5XL 的尺码会陆续挂上来。",
};

/* 首件官方服装。w / h 是去背素材的固有像素尺寸，用来算 3D 面片的宽高比。 */
export const apparel = {
  key: "guancha-2026-hoodie",
  name: "X.Channel × 2026 观猹大会 联名款",
  category: "连帽卫衣",
  front: "/apparel/hoodie-front.webp",
  back: "/apparel/hoodie-back.webp",
  w: 1202,
  h: 1241,
};


/* ---- X.媒体：独立页面（#/media）-------------------------------------------
   两块内容：
   1. `mediaWorks` —— 参与作品的四个人，**封面直接用他们的 AI 形象**
      （`members[].portrait`，不再另做一套封面图）；
   2. `showcase`   —— 还没上线的作品位（[占位]），结构先立着。

   ⚠️ `mediaWorks[].href` 由 Cyrus 补（2026-10-23 已给齐四个）。
      **为空时卡片不渲染成链接**，只显示「链接待补」—— 不挂空链接、不假装能点。
      补链接时只改这一处数据，卡片/验收都不用动。
   ⚠️ `kind` 一律照各站**真实标题/玩法**写，不编：梗图档案馆、猜词对战、抽签、入职考试。
      没有可靠信息就不传（卡片不留空位）。 */

export interface MediaWork {
  /** 对应 members[].slug：形象与「看这个人」的链接都从这里取 */
  slug: string;
  name: string;
  /** 站内名与常用名不一致时用（易恒 = 小喷菇） */
  alias?: string;
  /** 作品名。未定稿写 [占位]；定了只改这一行 */
  work: string;
  /** 作品形式（短片 / 视觉 / 音乐…）。没定就不传，卡片不占位 */
  kind?: string;
  /** 外部作品链接。空 = 待补，卡片不可点 */
  href?: string;
  /** 该卡底色，取自形象本身的主色（空格分隔 RGB，供 rgb(... / a) 用） */
  tint: string;
}

export const mediaWorks: MediaWork[] = [
  {
    slug: "nana",
    name: "娜酱",
    work: "梗图宇宙",
    kind: "热梗档案馆 · 网页",
    href: "http://gengtu.jueyunai.cn/",
    tint: "150 214 190",
  },
  {
    slug: "luoye",
    name: "落叶",
    work: "豆总默契大作战",
    kind: "猜词对战 · 小游戏",
    href: "https://xchannel.huanyuliuguang.cn/",
    tint: "232 162 72",
  },
  {
    slug: "zhiyun",
    name: "志云",
    work: "猹相局",
    kind: "AI 人设抽签 · 网页",
    href: "https://xiang.jueyunai.cn",
    tint: "186 104 104",
  },
  {
    slug: "baichuan",
    name: "白川",
    work: "X.Channel入职考试",
    kind: "AI Native 入职问卷",
    href: "https://xchannel-entry-exam.app.workbuddy.host/",
    tint: "216 178 122",
  },
];

export const mediaSection = {
  eyebrow: "X.媒体",
  title: "四块屏幕，四份作品",
  description:
    "娜酱、落叶、志云、白川各带一件作品来上班，封面用的是各自的 AI 形象，点开就去看现场。",
  worksLabel: "参与作品",
  /** 有 href 时右上角那个角标 / 待补时那个角标 */
  linkReady: "去作品页",
  linkPending: "链接待补",
  profileLabel: "看这个人",
  moreTitle: "更多作品",
  moreNote: "[占位] 这一栏留给还没上线的作品，位置先留着。",
};

/* ---- 以下三组数据（features / stats / about）当前未被使用 ----------------
   Cyrus 要求首页去掉「核心能力 / 数据 / 关于我们」三个区块，
   App.tsx 已不再渲染它们。数据与对应组件（sections/Features|Stats|About.tsx）
   都保留着，需要恢复时把 import 与渲染加回首页分支即可。 */

/* 核心能力：4 项，icon 限定 sparkles/zap/layers/shield */
export const features: {
  icon: "sparkles" | "zap" | "layers" | "shield";
  title: string;
  desc: string;
}[] = [
  {
    icon: "sparkles",
    title: "[占位] 能力一",
    desc: "[占位] 描述这项能力的核心价值，建议不超过 30 字。",
  },
  {
    icon: "zap",
    title: "[占位] 能力二",
    desc: "[占位] 描述这项能力的核心价值，建议不超过 30 字。",
  },
  {
    icon: "layers",
    title: "[占位] 能力三",
    desc: "[占位] 描述这项能力的核心价值，建议不超过 30 字。",
  },
  {
    icon: "shield",
    title: "[占位] 能力四",
    desc: "[占位] 描述这项能力的核心价值，建议不超过 30 字。",
  },
];

/* 产品展示：3 项，均 16:9 */
export const showcase: { ratio: "16:9"; title: string; desc: string }[] = [
  {
    ratio: "16:9",
    title: "[占位] 展示项一",
    desc: "[占位] 简短描述该展示内容，建议不超过 40 字。",
  },
  {
    ratio: "16:9",
    title: "[占位] 展示项二",
    desc: "[占位] 简短描述该展示内容，建议不超过 40 字。",
  },
  {
    ratio: "16:9",
    title: "[占位] 展示项三",
    desc: "[占位] 简短描述该展示内容，建议不超过 40 字。",
  },
];

/* 数据统计：4 项 */
export const stats: { value: string; label: string }[] = [
  { value: "[占位] 100+", label: "[占位] 服务客户" },
  { value: "[占位] 99.9%", label: "[占位] 可用性" },
  { value: "[占位] 50+", label: "[占位] 团队成员" },
  { value: "[占位] 7×24", label: "[占位] 技术支持" },
];

/* 关于我们 */
export const about = {
  eyebrow: "[占位] 关于我们",
  title: "[占位] 我们是谁",
  paragraphs: [
    "[占位] 第一段介绍公司/团队的背景与使命，建议 50-80 字。",
    "[占位] 第二段描述核心优势或愿景，建议 50-80 字。",
  ],
};

/* ---- 行动号召区 ----------------------------------------------------------
   结构（自上而下）：组织 logo → 标题 → 副标题 → 「加入我们」引导 → 关注我们。
   按 Cyrus 要求去掉了原来的「立即联系」按钮。
   「加入我们」点开后展开一块内容面板，当前刻意留白（等加入流程/招募入口到位）。 */
export const cta = {
  title: "准备好和 X.Channel 干点大事了吗？",
  subtitle: "别只是看看——有趣的下一步，等你一起开工。",
  /* 加入引导：点击展开 / 收起下方的内容面板 */
  join: {
    label: "加入我们",
    collapseLabel: "收起",
    /* 展开面板里的留白区文案 */
    emptyTitle: "[占位] 加入方式待补充",
    emptyText:
      "[占位] 这里预留给加入流程、招募入口或联系方式。当前先留空，等 Cyrus 给内容。",
  },
  /* 关注我们：六个流媒体账号。
     ⚠️ 官方 logo 素材尚未提供，accent 是各平台品牌色，当前用于文字徽章的小圆点，
     拿到官方 logo 后把徽章内容换成 <img> 即可（数据结构不用动）。
     href 留空则只展示、不渲染成链接。 */
  social: {
    heading: "关注我们",
    accounts: [
      { key: "bilibili", label: "哔哩哔哩", href: "", accent: "#00A1D6" },
      { key: "x", label: "X", href: "", accent: "#0F1419" },
      { key: "weibo", label: "微博", href: "", accent: "#E6162D" },
      { key: "channels", label: "微信视频号", href: "", accent: "#07C160" },
      { key: "mp", label: "公众号", href: "", accent: "#07C160" },
      { key: "guancha", label: "观猹", href: "", accent: "#3B82F6" },
    ],
  },
};

/* ---- 特别鸣谢 ------------------------------------------------------------
   页面最下方的合作方致谢。logo 由 Cyrus 提供，已从截图裁切去底、去掉水印，
   输出为 public/thanks-guancha.webp（自带白色底板，深浅主题下都能用）。
   合作伙伴可继续往 partners 里加，版面会自动居中换行。 */
/* 合作方条目。`heightClass` 必须显式声明成可选字段，否则数组字面量推成联合类型，
   组件里读 `partner.heightClass` 会因为部分成员没有该键而报 TS 错。 */
type Partner = {
  name: string;
  logo: string;
  href: string;
  heightClass?: string;
};

export const specialThanks = {
  eyebrow: "特别鸣谢",
  title: "感谢我们的合作伙伴",
  /* 合作方名称同时用于 logo 的 alt 文本。
     ⚠️ 三个 logo 都是**白底图**，在深色页上就是三张白卡——这是刻意的：
        Tokendance 那个 TP 的白色内腔是图形的一部分（黑笔画反白），
        离开白底就只剩一团黑；Beav 是从深色卡片里抠出来的 app 图标。
        圆角由 CSS 的 `rounded-lg` 裁，图里不留圆角。
     `heightClass` 可选：方形 app 图标在同高度下会显得弱一档，给它大一档。 */
  partners: [
    {
      name: "观猹 insights",
      logo: "/thanks-guancha.webp",
      /* 有官网就填，留空则只展示 logo、不渲染成链接 */
      href: "",
    },
    {
      name: "Tokendance",
      logo: "/thanks-tokendance.webp",
      href: "",
    },
    {
      name: "Beav",
      logo: "/thanks-beav.webp",
      href: "",
      heightClass: "h-14 md:h-16",
    },
  ] as Partner[],
  /* {name} 由组件替换 */
  logoAltTemplate: "{name} 的 logo",
};

/* ---- 页脚 ----------------------------------------------------------------
   现在只放组织 logo，**没有文案**。
   原来的 `footer` 对象（特别鸣谢字样 / 花名册无障碍名 / 头像 alt 模板）
   随「页脚花名册」一起移除：Cyrus 要把成员 AI 形象与鸣谢做成彩蛋，
   页脚不再是承载它们的容器。成员数据见上面的 `members`，未受影响。 */

/* ---- 首页 · 3D 许愿池 ----------------------------------------------------
   插在「轮播图」（Hero 结尾）与「加入我们」（Cta）之间。

   硬币 = 许愿，漂流瓶 = 建议。**只做展示**：种子数据只读，
   用户提交进会内内存（刷新即散），不落库、不展示联系方式；
   数据层的接缝在 lib/wishStore.ts，将来 B 端接口就绪直接换实现。

   ⚠️ 这一块不是导航里的五个板块之一，所以 eyebrow 与 navLinks 不必对应，
      但也不要用 X.形象 / X.媒体 / X.游戏 / X.Token / X.收藏 这五个名字。
   ------------------------------------------------------------------------ */
export const wishingWell = {
  eyebrow: "X.许愿池",
  title: "投一枚硬币，或者放一只漂流瓶",
  description:
    "硬币是愿望，漂流瓶是建议。落水那一下会有涟漪，池底替你收着。",

  /* 选物与投掷提示 */
  chooseCoin: "硬币 · 说个愿望",
  chooseBottle: "漂流瓶 · 提个建议",
  dragHint: "按住拖进池子里，松手投出",
  tapHint: "也可以直接点池面投进去",
  cameraHint: "拖空白处可以换个角度看池子",

  /* 计数 */
  countCoins: "枚愿望",
  countBottles: "条建议",
  countImplemented: "条已实现",

  /* 音效（默认静音） */
  soundOn: "打开音效",
  soundOff: "静音",

  /* 表单 */
  composer: {
    titleCoin: "写下你的愿望",
    titleBottle: "写下你的建议",
    textLabel: "内容",
    textPlaceholderCoin: "许一个愿……（10–200 字）",
    textPlaceholderBottle: "想建议点什么……（10–200 字）",
    authorLabel: "昵称",
    authorPlaceholder: "留空就署名「匿名」",
    contactLabel: "联系方式",
    contactPlaceholder: "选填",
    contactHint: "仅后台可见，不会出现在页面上。",
    anonymous: "匿名",
    submit: "投进去",
    submitting: "投掷中…",
    cancel: "算了",
    charCountLabel: "字数",
    errors: {
      tooShort: "再多写几个字吧（至少 10 字）。",
      tooLong: "太长了，收到 200 字以内。",
      rateLimited: "投得有点急，等 {n} 秒再来。",
      failed: "没投成功，稍后再试。",
    },
  },

  ghostNotice:
    "你的这一枚只有自己看得见（半透明），审核通过后才会出现在池子里。",

  /* 点开物体后的卡片 */
  card: {
    likes: "共鸣",
    likeAction: "认同",
    liked: "已认同",
    replyTitle: "官方回复",
    implementedLabel: "已实现",
    approvedLabel: "已收录",
    pendingLabel: "审核中",
    ghostLabel: "仅你可见",
    close: "关闭",
    report: "举报",
    reported: "已收到",
  },

  /* 纯文本列表（无障碍 / 2D 版共用） */
  list: {
    title: "池子里的内容",
    summary: "展开文字版列表",
    empty: "池子还是空的，来投第一枚吧。",
    countLabel: "共 {n} 条",
    coinTag: "愿望",
    bottleTag: "建议",
  },

  /* 2D 降级 */
  fallback: {
    notice: "当前设备用轻量模式展示（未启用 3D）。",
    dropLabel: "点一下投放",
  },

  /* 无障碍 */
  a11y: {
    regionLabel: "许愿池",
    canvasLabel: "许愿池 3D 场景（装饰，内容见下方文字列表）",
    keyboardHint: "按回车打开许愿表单",
    listLink: "跳到文字版列表",
  },
};

/* 种子数据（展示用）。紧凑写法：
   [类型, 正文, 昵称, 状态, 共鸣数, 官方回复?]
   展开成 Wish[]，createdAt 由下标倒推，保证排序稳定、每次一致。 */
const WISH_SEED_BASE = Date.parse("2026-09-30T10:00:00Z");

const WISH_SEED_ROWS: [
  "coin" | "bottle",
  string,
  string,
  "approved" | "implemented" | "pending",
  number,
  string?,
][] = [
  ["coin", "希望 X.Channel 的线下活动能开到成都来，一定到场。", "二表哥", "approved", 186],
  ["coin", "想要一件带星芒图样的卫衣，黑底那种，别整花的。", "娜娜", "approved", 154],
  ["coin", "希望能出一套完整的品牌设计规范，我们做周边的好照着来。", "落叶", "implemented", 231, "设计规范已经整理完，下月连同色卡一起放出。"],
  ["coin", "许愿明年做一次 24 小时不间断直播，我熬得住。", "小猹", "implemented", 302, "24 小时直播已在排期，届时会提前一周预告。"],
  ["coin", "想看到更多幕后花絮，尤其是拍摄翻车的合集。", "志云", "approved", 143],
  ["coin", "希望 AI 形象能出实体手办，众筹我第一个冲。", "豆总", "approved", 198],
  ["coin", "愿这个项目永远别变成一家无聊的公司。", "白川", "approved", 421],
  ["coin", "希望出一个播客，通勤路上想听你们聊创作。", "子轩", "approved", 167],
  ["coin", "许愿明年的周边有马克杯，装咖啡刚好。", "小喷菇", "implemented", 128, "马克杯打样过了两轮，手感调好就上。"],
  ["coin", "希望能在视频网站看到长视频版本的创作复盘。", "小金子", "approved", 176],
  ["coin", "想许一个：明年一定去现场看你们的活动。", "猹妹", "approved", 149],
  ["coin", "希望品牌色出官方色卡下载，我做图老是对不准。", "落叶", "implemented", 214, "色卡已随设计规范一起放出，含 HEX 与 RGB 两套取值。"],
  ["coin", "愿认真做事的人都被看见。", "二表哥", "approved", 388],
  ["coin", "希望开源一套中英混排的字体，混排的间距太难受了。", "白川", "approved", 132],
  ["coin", "许愿有一个能看全部作品的时间线页面。", "豆总", "implemented", 259, "时间线页已上线，在「X.媒体」里可以按年份翻。"],
  ["coin", "想要一套 4K 壁纸，屏保用。", "娜娜", "approved", 141],
  ["coin", "希望每期作品都配一支幕后短片。", "子轩", "approved", 158],
  ["coin", "愿团队成员都能准点下班。", "小猹", "approved", 405],
  ["coin", "许愿出一本把项目从头讲一遍的小册子。", "志云", "approved", 189],
  ["coin", "希望官网能一键切换深浅色 —— 已经有了，真好。", "小喷菇", "implemented", 233, "谢谢，深浅色是上线第一件事。"],
  ["coin", "想看到 X.Channel 和其他创作者联动。", "小金子", "approved", 164],
  ["coin", "许愿一个线上共创活动，普通人也能参与进来。", "猹妹", "approved", 221],
  ["coin", "希望能把「认真的玩 假装创业」做成实体海报。", "白川", "implemented", 287, "海报已印，活动现场就能拿到。"],
  ["coin", "愿我明年也能做出一个像这样的作品。", "落叶", "approved", 356],
  ["coin", "许愿周边别太贵，学生党扛不住。", "小猹", "approved", 312],
  ["coin", "希望能公布一下整个团队的创作流程。", "豆总", "approved", 178],
  ["coin", "许愿你们一直保持现在这个更新频率。", "娜娜", "approved", 195],
  ["coin", "想要一个能在官网许愿的地方 —— 现在实现了，谢谢。", "子轩", "implemented", 268, "许愿池就是为这句话建的。"],
  ["coin", "希望明年的活动有线上同步直播。", "志云", "approved", 152],
  ["coin", "愿每一次认真都被认真回应。", "二表哥", "approved", 447],
  ["bottle", "建议给「X.收藏」加个搜索，物料多起来不好找。", "白川", "approved", 173],
  ["bottle", "建议作品页支持按年份筛选，现在翻起来有点累。", "小金子", "implemented", 205, "年份筛选已加上，在作品页右上角。"],
  ["bottle", "建议官网加一个 RSS，我想订阅更新。", "豆总", "approved", 138],
  ["bottle", "建议移动端导航做成全屏抽屉，现在有点挤。", "小喷菇", "approved", 161],
  ["bottle", "建议给每件物料补一句设计说明，会更有意思。", "猹妹", "approved", 184],
  ["bottle", "建议把鸣谢的合作方做成可点击的卡片。", "小猹", "approved", 127],
];

export const wishSeed = WISH_SEED_ROWS.map(
  ([kind, text, author, status, likes, reply], i) => ({
    id: `seed-${kind}-${i + 1}`,
    kind,
    text,
    author,
    status,
    likes,
    createdAt: new Date(WISH_SEED_BASE - i * 5_400_000).toISOString(),
    ...(reply ? { reply: { text: reply, by: "X.Channel 团队" } } : {}),
  }),
);
