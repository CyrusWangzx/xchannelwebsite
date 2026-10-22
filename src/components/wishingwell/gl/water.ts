/**
 * 许愿池 · 水面材质（自定义 GLSL）
 *
 * 水面**当成不透明面画**：折射不是靠「画两层再混合」，而是水面着色器自己
 * 去采样离屏烘焙好的池底纹理（floorTex，含沉积的硬币）。
 * 这样没有排序问题、不需要 alpha 混合、也没有半透明物体的穿透 bug，
 * 「半透明感」来自池底颜色被水色染色后透上来。
 *
 * 三件事叠出水面：
 *   ① 高度场 —— 最多 8 圈涟漪 + 长波微澜（世界空间，解析式）
 *   ② 法线   —— 对高度场求**解析梯度**，得 normalize(vec3(-dh/dx, 1, -dh/dz))
 *   ③ 折射   —— refractedUv = screenUv + normal.xz * uRefractStrength
 *
 * ⚠️ 为什么不用 dFdx/dFdy 求法线（本项目踩过）：
 *   屏幕空间梯度 = 世界梯度 × 「每像素覆盖多少世界距离」，后者在斜视池面时
 *   变化剧烈（近处 0.01 世界单位/像素，远处能到 0.5）。于是同一个高度场，
 *   屏幕上的法线在远景被放大几十倍，`pow(dot(n,H), 96)` 的高光在大片区域
 *   都能打到接近 1，直接糊成一条条发光白带，再被 bloom 放大成「爆白」。
 *   解析梯度只跟世界坐标有关，与分辨率、视角、DPR 全部无关，
 *   既稳定又不会在低分辨率（乃至 SwiftShader 软渲染）下抖。
 */

export const WATER_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uViewProj;

out vec3 vWorld;

void main() {
  vWorld = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

export const WATER_FS = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;

uniform sampler2D uFloorTex;
/** 视口像素尺寸，用于把 gl_FragCoord 还原成屏幕 uv（折射偏移用） */
uniform vec2 uResolution;
/** 池半径：把世界 xz 映射到 0..1 的 uv（只用于给涟漪定位与径向水色） */
uniform float uPoolRadius;
uniform float uTime;

/* 涟漪：xy = 中心 uv，z = 已存活秒数，w = 强度 */
uniform vec4 uRipple[8];

uniform float uNormalStrength;   /* 高度场梯度 → 法线坡度的放大倍数 */
uniform float uRefractStrength;  /* 折射偏移（屏幕 uv 的比例，约 0.01–0.03） */
uniform vec3 uShallow;           /* 池边水色 */
uniform vec3 uDeep;              /* 池心水色 */
uniform vec3 uRimColor;          /* 掠射角的边光 */
uniform float uRimStrength;
uniform vec3 uLightDir;          /* 指向光源的方向（已归一化） */
uniform float uSpecular;         /* 高光强度 */

out vec4 fragColor;

const int MAX_RIPPLES = 8;

/** 静息微澜：长波、低幅，水面不能是一块镜面玻璃 */
float ambientH(vec2 p, float t) {
  return sin(p.x * 1.35 + t * 0.80) * 0.085
       + sin(p.y * 1.15 - t * 0.62) * 0.075
       + sin((p.x + p.y) * 2.05 + t * 1.10) * 0.035;
}

/** 微澜的解析梯度（d/dx, d/dz） */
vec2 ambientGrad(vec2 p, float t) {
  float d = cos((p.x + p.y) * 2.05 + t * 1.10) * 2.05 * 0.035;
  return vec2(
    cos(p.x * 1.35 + t * 0.80) * 1.35 * 0.085 + d,
    cos(p.y * 1.15 - t * 0.62) * 1.15 * 0.075 + d
  );
}

/** 涟漪高度场（世界坐标）*/
float rippleH(vec2 p, out vec2 grad) {
  grad = vec2(0.0);
  float h = 0.0;
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = uRipple[i];
    float strength = r.w;
    if (strength <= 0.0) continue;

    /* 涟漪中心在 uv 空间登记，这里换算回世界 xz */
    vec2 cW = (r.xy - 0.5) * (2.0 * uPoolRadius);
    vec2 delta = p - cW;
    float dw = length(delta) + 1e-4;
    float age = r.z;

    /* 相位随距离推进、随距离与时间衰减：环形波从落点扩散出去 */
    float phase = dw * 3.4 - age * 7.5;
    float env = exp(-dw * 0.55) * exp(-age * 2.2) * strength;
    h += sin(phase) * env;

    /* d/d(dw)[ sin(phase)·env ]，再乘径向单位向量 */
    float slope = (3.4 * cos(phase) - 0.55 * sin(phase)) * env;
    grad += (delta / dw) * slope;
  }
  return h;
}

void main() {
  vec2 p = vWorld.xz;
  vec2 uv = p / (2.0 * uPoolRadius) + 0.5;

  /* ① 高度场 + ② 解析梯度 */
  vec2 rGrad;
  float h = rippleH(p, rGrad) + ambientH(p, uTime);
  vec2 grad = (rGrad + ambientGrad(p, uTime)) * uNormalStrength;

  /* 软饱和：极端坡度不允许把法线翻过去（否则高光/边光会瞬间爆掉） */
  grad = grad / (1.0 + length(grad) * 0.55);

  vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));

  /* ③ 折射：屏幕空间偏移采样池底（越靠池心偏移越大，读起来越有深度） */
  float radial = clamp(distance(uv, vec2(0.5)) * 2.0, 0.0, 1.0);
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  /* 偏移在池边收敛到 0：掠射时正常也不会「看到」更远处的池底，
     收敛掉可以少采到池壁外，也少一点边缘抖动 */
  float refrAmt =
    uRefractStrength * (0.55 + radial * 0.55) * (1.0 - radial * radial * 0.7);
  vec2 refractedUv = clamp(
    screenUv + normal.xz * refrAmt,
    vec2(0.002),
    vec2(0.998)
  );
  vec4 floorSample = texture(uFloorTex, refractedUv);

  /* 水色：池心深、池边浅 —— 有深度的读法 */
  vec3 waterTint = mix(uDeep, uShallow, radial * radial * 0.85);

  /* 池底被水吸收：保留大部分池底（硬币要看得见），整体往水色拉 */
  vec3 floorLit = mix(floorSample.rgb * 0.72, waterTint, 0.46);

  /* ⚠️ 池底 pass 只画了池底圆盘，圆盘之外 clear 成透明 —— 折射偏移一旦
     采到那片区域，rgb 就是 0，会在水面上糊出**硬边黑块**。
     这里拿池底纹理的 alpha 当覆盖掩膜：没覆盖到的地方退回纯水色，
     读起来就是「水更深 / 掠射看到的是池壁」，不会露馅。 */
  float cover = smoothstep(0.08, 0.62, floorSample.a);
  vec3 col = mix(waterTint * 0.94, floorLit, cover);

  /* 涟漪的亮边：只在波峰处轻轻挑一线，不做大面积提亮 */
  float crest = clamp(abs(h) * 1.2, 0.0, 1.0);
  col += uRimColor * crest * 0.05;

  /* 高光（Blinn-Phong，视线近似正上方，足够用） */
  vec3 V = vec3(0.0, 1.0, 0.0);
  vec3 H = normalize(normalize(uLightDir) + V);
  float spec = pow(max(dot(normal, H), 0.0), 120.0);
  col += vec3(1.0, 0.98, 0.9) * spec * uSpecular;

  /* 掠射角的边光：加高次幂，让它只是贴着池壁的一圈细光，不是一整片 */
  float fres = pow(1.0 - clamp(normal.y, 0.0, 1.0), 5.0);
  col += uRimColor * fres * uRimStrength;

  /* 水面当不透明面画 */
  fragColor = vec4(col, 1.0);
}
`;
