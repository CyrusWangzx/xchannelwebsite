/**
 * 许愿池 · 场景材质（GLSL）
 *
 * 一个共用的实例化顶点着色器（INSTANCED_VS）+ 一个会摆尾的版本（FISH_VS）
 * + 五个片元着色器（池底 / 池壁 / 硬币 / 漂流瓶 / 鱼 / 水花）。
 * 实例矩阵按 4×vec4 传（aInst0..3），另加一个 aParam：
 *   aParam.x = 高光/发光档（硬币：已实现 → 1；瓶子：0）
 *   aParam.y = 随机种子（每枚硬币的色差，避免 1000 枚一模一样）
 *   aParam.z = 不透明度（幽灵物体 → 0.35）
 *   aParam.w = 保留
 */

export const INSTANCED_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec4 aInst0;
in vec4 aInst1;
in vec4 aInst2;
in vec4 aInst3;
in vec4 aParam;

uniform mat4 uViewProj;

out vec3 vNormal;
out vec3 vWorld;
out vec3 vLocal;
out vec4 vParam;

void main() {
  mat4 model = mat4(aInst0, aInst1, aInst2, aInst3);
  vec4 world = model * vec4(aPosition, 1.0);

  vWorld = world.xyz;
  vLocal = aPosition;
  vParam = aParam;

  /* 刚体变换 + 等比缩放：直接取旋转部分当法线矩阵（逆=转置，这里对称无差） */
  vNormal = normalize(mat3(model) * aNormal);

  gl_Position = uViewProj * world;
}
`;

/** 非实例化的静态几何（池底 / 池壁 / 池沿）顶点着色器 */
export const STATIC_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uViewProj;

out vec3 vNormal;
out vec3 vWorld;

void main() {
  vWorld = aPosition;
  vNormal = normalize(aNormal);
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

const LIT_COMMON = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uCameraPos;

float lambert(vec3 n, vec3 l) { return max(dot(n, normalize(l)), 0.0); }

float blinn(vec3 n, vec3 wpos, vec3 l, float shininess) {
  vec3 V = normalize(uCameraPos - wpos);
  vec3 H = normalize(normalize(l) + V);
  return pow(max(dot(n, H), 0.0), shininess);
}

float edgeLight(vec3 n, vec3 wpos) {
  vec3 V = normalize(uCameraPos - wpos);
  return pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.6);
}
`;

/* ------------------------------------------------------------------ 池底 */

export const FLOOR_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vWorld;

uniform vec3 uStone;      /* 池底石材基色 */
uniform vec3 uStoneDeep;  /* 池心更暗的一档 */
uniform vec3 uGrout;      /* 石缝 / 刻线的颜色 */
uniform float uPoolRadius;
uniform float uTime;

out vec4 fragColor;

${LIT_COMMON}

/** 同心石环 + 放射石缝：一个居中的马赛克圆盘 */
float mosaic(vec2 p, float radius) {
  float r = length(p) / radius;
  float a = atan(p.y, p.x);

  /* 同心环：每 0.14 半径一道 */
  float rings = abs(fract(r / 0.145) - 0.5) * 2.0;

  /* 放射缝：每 12° 一道 */
  float spokes = abs(fract(a / 0.2094 + 0.5) - 0.5) * 2.0;

  return min(rings, spokes);
}

void main() {
  vec2 p = vWorld.xz;

  float line = mosaic(p, uPoolRadius);
  float grout = smoothstep(0.86, 1.0, line);

  /* 池心比池边更暗（水更深的地方） */
  float depth = clamp(length(p) / uPoolRadius, 0.0, 1.0);
  vec3 stone = mix(uStoneDeep, uStone, depth * depth);

  /* 石材自身的微颗粒 */
  float grain = fract(sin(dot(floor(p * 26.0), vec2(12.9898, 78.233))) * 43758.5453);
  stone *= 0.9 + grain * 0.2;

  vec3 col = mix(stone, uGrout, grout * 0.75);

  /* 中央的星芒刻痕：许愿池的「井眼」 */
  float r = length(p);
  float ang = atan(p.y, p.x);
  float star = cos(ang * 8.0);
  float starMask = smoothstep(0.9, 1.0, star) * smoothstep(0.62, 0.46, r) * smoothstep(0.06, 0.2, r);
  col += uGrout * starMask * 0.55;

  vec3 n = normalize(vNormal);
  float d = lambert(n, uLightDir);
  col *= 0.42 + 0.72 * d;

  /* 一点点池底自发光，避免水下的硬币掉进纯黑 */
  col += uStone * 0.06;

  fragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ 池壁 */

export const WALL_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorld;

uniform vec3 uStone;
uniform vec3 uStoneDeep;
uniform vec3 uGrout;
uniform float uRimHeight;

out vec4 fragColor;

${LIT_COMMON}

void main() {
  float a = atan(vWorld.z, vWorld.x);

  /* 竖向砌块缝 + 横向一道腰线 */
  float seams = abs(fract(a / 0.2618 + 0.5) - 0.5) * 2.0;
  float band = abs(fract(vWorld.y / 0.42) - 0.5) * 2.0;
  float grooved = smoothstep(0.88, 1.0, min(seams, band));

  /* 越靠近池口越亮（受天光），池底那圈压暗 */
  float h = clamp(vWorld.y / uRimHeight, 0.0, 1.0);
  vec3 stone = mix(uStoneDeep, uStone, pow(h, 1.3));

  vec3 col = mix(stone, uGrout, grooved * 0.8);

  vec3 n = normalize(vNormal);
  /* 壁面两侧都画（关闭了背面剔除），用 abs 保证内壁也有光 */
  float d = lambert(n, uLightDir) * 0.7 + abs(n.y) * 0.1;
  col *= 0.36 + 0.78 * d;

  /* 池口那道沿：最上沿给一条亮边，是「井沿」的读法 */
  float lip = smoothstep(uRimHeight - 0.05, uRimHeight, vWorld.y);
  col += uStone * lip * 0.5;

  fragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ 硬币 */

export const COIN_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
in vec4 vParam;

uniform vec3 uGold;        /* 金色基色 */
uniform vec3 uGoldDeep;    /* 暗部 */
uniform vec3 uHighlight;   /* 已实现的硬币：光环色 */
uniform float uCoinRadius;
uniform float uCoinThick;
uniform float uTime;

out vec4 fragColor;

${LIT_COMMON}

void main() {
  vec3 n = normalize(vNormal);

  /* 每枚硬币按随机种子微调色相，1000 枚才不会像一批刚出厂的塑料片 */
  float seed = vParam.y;
  vec3 gold = mix(uGold, uGoldDeep, seed * 0.5);

  /* 币面雕花：只在两个平face上画 */
  float faceMask = smoothstep(uCoinThick * 0.22, uCoinThick * 0.5, abs(vLocal.y));
  float r = length(vLocal.xz) / uCoinRadius;

  /* 外圈一道环 + 中央一个小浮雕 */
  float ring = smoothstep(0.72, 0.78, r) * (1.0 - smoothstep(0.84, 0.92, r));
  float boss = 1.0 - smoothstep(0.0, 0.34, r);
  float relief = (ring * 0.8 + boss * 0.9) * faceMask;

  /* 币面齿边：靠纯几何太贵，用色带近似。
     注意 GLSL 的内置函数是 fract，不是 frac —— 写错会直接编译失败。 */
  float milled = step(0.93, fract(atan(vLocal.z, vLocal.x) * 24.0 / 6.2831));
  float milledMask = (1.0 - faceMask) * r * milled;

  vec3 albedo = gold * (0.86 + relief * 0.34);
  albedo = mix(albedo, gold * 0.72, milledMask);

  float d = lambert(n, uLightDir);
  vec3 col = albedo * (0.3 + 0.85 * d);

  /* 金属高光：很窄、很亮 */
  col += vec3(1.0, 0.95, 0.8) * blinn(n, vWorld, uLightDir, 72.0) * (0.8 + vParam.x * 1.4);

  /* 金属边光 */
  col += gold * edgeLight(n, vWorld) * (0.5 + vParam.x * 1.8);

  /* 已实现的硬币：加一层呼吸的金色光环（spec：已实现硬币金色高亮 + 光环） */
  if (vParam.x > 0.5) {
    float pulse = 0.5 + 0.5 * sin(uTime * 2.4 + seed * 6.2831);
    col += uHighlight * (0.32 + pulse * 0.34);
  }

  float alpha = vParam.z;
  fragColor = vec4(col, alpha);
}
`;

/* --------------------------------------------------------- 水花粒子 */

/** 无光照的亮粒子：水花是「自发光的水」，不该有明暗面 */
export const SPLASH_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
in vec4 vParam;

uniform vec3 uSplash;       /* 水花基色 */
uniform vec3 uSplashTip;    /* 边缘更亮的颜色 */
uniform vec3 uCameraPos;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorld);

  /* 边缘更亮 → 看起来是水不是塑料球 */
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 1.6);
  vec3 col = mix(uSplash, uSplashTip, rim);

  float alpha = clamp(vParam.z, 0.0, 1.0) * (0.55 + rim * 0.65);
  fragColor = vec4(col, alpha);
}
`;


/* --------------------------------------------------------------- 鱼 */

/**
 * 鱼的顶点着色器：`INSTANCED_VS` 的「会摆尾」版本。
 *
 * 和硬币/瓶子共用那套 20 float 交错实例缓冲，但 aParam 的语义不同：
 *   aParam.x = 鳞面光泽档（1 = 身体，0.6 = 鳍）
 *   aParam.y = 摆尾相位（0..1，每条鱼不同，否则 7 条鱼同步摇头）
 *   aParam.z = 不透明度
 *   aParam.w = 时间（秒）—— 摆尾要它，所以不能省
 *
 * ⚠️ 摆尾只改**位置**，不重算整张法线表：只按剪切 x += f(z) 的逆矩阵转置
 * 修正 n.z 一项（`n.z -= f' * n.x`）就够了。整张法线重算是为了一个 40px 的
 * 小东西，不值；但完全不修会让鳞面看起来像贴纸。
 */
export const FISH_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec2 aUv;
in vec4 aInst0;
in vec4 aInst1;
in vec4 aInst2;
in vec4 aInst3;
in vec4 aParam;

uniform mat4 uViewProj;

out vec3 vNormal;
out vec3 vWorld;
out vec3 vLocal;
out vec4 vParam;
out float vMat;

const float TAU = 6.28318530718;

void main() {
  mat4 model = mat4(aInst0, aInst1, aInst2, aInst3);

  /* t: 0 = 鼻端，1 = 尾端。振幅 ∝ t²（鼻子不动、尾巴最大），
     相位沿体长滞后 → 整条身体是一列行波，不是整体左右平移。 */
  float t = clamp(0.5 - aPosition.z, 0.0, 1.0);
  float phase = aParam.w * TAU * 0.62 + aParam.y * TAU;
  float ang = phase - t * 2.1;
  float amp = t * t;
  float dust = sin(ang) * amp;

  /* dA/dt，再乘 dt/dz = -1 得到剪切斜率 f' */
  float dA = cos(ang) * (-2.1) * amp + sin(ang) * 2.0 * t;
  float fPrime = -dA * 0.13;

  vec3 pos = aPosition;
  /* 鳍比身体软，额外多摆一点（aUv.x = 1 的是鳍） */
  pos.x += dust * (0.13 + aUv.x * 0.06);

  vec4 world = model * vec4(pos, 1.0);

  vWorld = world.xyz;
  /* 斑纹/眼睛用**未形变**的局部坐标，纹样才不会随摆尾在鱼身上滑动 */
  vLocal = aPosition;
  vParam = aParam;
  vMat = aUv.x;

  vec3 n = aNormal;
  n.z -= fPrime * n.x;

  vNormal = normalize(mat3(model) * normalize(n));
  gl_Position = uViewProj * world;
}
`;

export const FISH_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
in vec4 vParam;
in float vMat;

uniform vec3 uFish;        /* 背部主色（锦鲤的橙） */
uniform vec3 uFishDeep;    /* 斑纹 / 暗部 */
uniform vec3 uFishBelly;   /* 腹部（浅） */
uniform vec3 uFishFin;     /* 鳍 */

out vec4 fragColor;

${LIT_COMMON}

void main() {
  vec3 n = normalize(vNormal);
  bool isFin = vMat > 0.5;

  /* -1 = 腹部，+1 = 背脊；0 = 鼻端，1 = 尾柄 */
  float dorsal = clamp(vLocal.y / 0.16, -1.0, 1.0);
  float along = clamp(0.5 - vLocal.z, 0.0, 1.0);

  vec3 col;

  if (isFin) {
    /* 鳍条：沿体长的细密条纹，比给鳍做半透明便宜，也没有排序问题 */
    float ray = sin(along * 44.0 + vParam.y * 6.2831) * 0.5 + 0.5;
    col = uFishFin * (0.74 + ray * 0.36);
  } else {
    /* 背深腹浅。⚠️ 分界要压到身体下半部：水面着色器还会把整片池底
       往青色的水色里拉 46%，白肚子吃进去就变成一片灰白，
       从俯视角看只剩「一坨浅色的东西」。 */
    col = mix(uFishBelly, uFish, smoothstep(-0.92, -0.2, dorsal));

    /* 斑纹：两条低频正弦交叉出来的不规则块，只落在背上。
       两色就够 —— 画真纹理在这个尺寸上完全看不出，反而容易脏。
       ⚠️ 变量别叫 patch：patch 是 GLSL ES 3.00 的**保留字**（曲面细分用），
       编译器直接报 "Illegal use of reserved word"，整条 well 会掉进 2D 降级。
       （同理：本文件整段 shader 是模板串，注释里**不能出现反引号**，
         否则模板串会被提前截断 → esbuild 报 "Expected ;"） */
    float seed = vParam.y;
    float blotch =
      sin(along * 7.4 + seed * 6.2831) * cos(dorsal * 2.2 - seed * 3.1);
    float blotchMask =
      smoothstep(0.12, 0.5, blotch) * smoothstep(-0.34, 0.36, dorsal);
    col = mix(col, uFishDeep, blotchMask * 0.9);

    /* 眼睛：吻端后 0.2 体长、左右各一的小点（半径随体长，别太大） */
    vec3 e1 = vec3(0.07, 0.032, 0.3);
    vec3 e2 = vec3(-0.07, 0.032, 0.3);
    float eyeDist = min(length(vLocal - e1), length(vLocal - e2));
    float eye = 1.0 - smoothstep(0.015, 0.027, eyeDist);
    col = mix(col, col * 0.08 + vec3(0.015, 0.014, 0.016), eye);
  }

  float d = lambert(n, uLightDir);

  /* 鳍几乎竖直站着，纯 lambert 会黑成一个洞 → 抬环境光 */
  float ambient = isFin ? 0.62 : 0.44;
  col *= ambient + 0.78 * d;

  /* 湿滑鳞面：窄高光。留着别调大 —— 水下不该出现镜面白点 */
  col +=
    vec3(0.95, 0.94, 0.9) * blinn(n, vWorld, uLightDir, 68.0) *
    (isFin ? 0.14 : 0.34);

  /* 极轻的透光边。⚠️ 别超过 0.15：再大就成一圈「贴纸描边」，
     整条鱼看着像从画上剪下来贴在水面，而不是在水里。 */
  col += (isFin ? uFishFin : uFish) * edgeLight(n, vWorld) * 0.13;

  fragColor = vec4(col, vParam.z);
}
`;


/* --------------------------------------------------------------- 漂流瓶 */

export const BOTTLE_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
in vec4 vParam;

uniform vec3 uGlass;       /* 瓶身玻璃色 */
uniform vec3 uGlassDeep;   /* 厚处的颜色 */
uniform vec3 uPaper;       /* 瓶里的信纸 */
uniform vec3 uHighlight;   /* 已回应：塞子/信纸的金色 */
uniform float uBottleHeight;
uniform float uTime;

out vec4 fragColor;

${LIT_COMMON}

void main() {
  vec3 n = normalize(vNormal);
  float y = vLocal.y / uBottleHeight;

  /* 瓶底厚、瓶口薄：用高度做一档通透度 */
  float thick = smoothstep(0.62, 0.0, y);
  vec3 glass = mix(uGlass, uGlassDeep, thick * 0.75);

  vec3 col = glass;

  /* 信纸：藏在瓶身中段，透过玻璃看到的暖白 */
  float paperBand = smoothstep(0.16, 0.24, y) * (1.0 - smoothstep(0.42, 0.5, y));
  float paperCore = (1.0 - smoothstep(0.0, 0.2, abs(vLocal.x + vLocal.z * 0.35) / 0.13));
  col = mix(col, uPaper, paperBand * paperCore * 0.72);

  /* 已回应的：信纸换成金色（一眼能看出「官方已回应」） */
  if (vParam.x > 0.5) {
    col = mix(col, uHighlight, paperBand * (0.35 + 0.3 * sin(uTime * 2.0 + vParam.y * 6.2831)) * 0.8);
  }

  float d = lambert(n, uLightDir);
  col *= 0.5 + 0.72 * d;

  /* 玻璃：极窄的高光 + 强边光，才像玻璃而不是塑料 */
  col += vec3(1.0) * blinn(n, vWorld, uLightDir, 128.0) * 1.15;
  col += uGlass * edgeLight(n, vWorld) * (1.5 + vParam.x);

  /* 深色主题下瓶身自带一点内亮，浅色主题由 uGlass 自己变深 */
  col += uGlass * 0.1;

  fragColor = vec4(col, vParam.z);
}
`;
