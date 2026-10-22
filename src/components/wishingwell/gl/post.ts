/**
 * 许愿池 · 后处理（亮部提取 → 可分离高斯 → 合成 + 暗角）
 *
 * 手写而不是引 postprocessing：这里只要 Bloom + Vignette 两件事，
 * 三个 pass 就够了，没有理由为此背一个库。
 *
 * 亮度链路：sceneTex →(阈值)→ bloomA ─(H)→ bloomB ─(V)→ bloomA ─(H)→ bloomB ─(V)→ 合成
 * 模糊在半分辨率上做（Bloom 本来就是低频，全分辨率纯属浪费）。
 *
 * 画布是**透明**的：池子之外必须能透出页面底色，
 * 所以场景以 alpha=0 清屏，合成时 alpha = max(sceneAlpha, bloomAlpha)。
 */

export const POST_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec2 aUv;

out vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition.xy, 0.0, 1.0);
}
`;

/** ① 亮部提取（软阈值） */
export const BRIGHT_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uScene;
uniform float uThreshold;
uniform float uSoftKnee;

out vec4 fragColor;

void main() {
  vec4 c = texture(uScene, vUv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float knee = max(uSoftKnee, 1e-4);
  float soft = clamp(lum - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float contrib = max(soft, lum - uThreshold) / max(lum, 1e-4);

  fragColor = vec4(c.rgb * contrib, c.a * step(1e-4, contrib));
}
`;

/** ② 可分离高斯（9 tap），uDirection 决定横还是竖 */
export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;

out vec4 fragColor;

/* 9 tap，σ≈2.2；权重已归一化 */
const float W[5] = float[5](0.227027, 0.194595, 0.121622, 0.054054, 0.016216);

void main() {
  vec2 step = uTexel * uDirection;
  vec4 sum = texture(uSource, vUv) * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = step * float(i);
    sum += texture(uSource, vUv + o) * W[i];
    sum += texture(uSource, vUv - o) * W[i];
  }
  fragColor = sum;
}
`;

/** ③ 合成：场景 + Bloom，叠暗角 */
export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uVignette;
uniform vec2 uResolution;

out vec4 fragColor;

void main() {
  vec4 scene = texture(uScene, vUv);
  vec4 bloom = texture(uBloom, vUv);

  vec3 col = scene.rgb + bloom.rgb * uBloomStrength;

  /* 暗角：只压边缘，中心 (1-uVignette) */
  vec2 d = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float v = smoothstep(0.62, 1.28, length(d) * 1.42);
  col *= 1.0 - v * uVignette;

  /* 透明画布：池子之外透出页面底色 */
  float alpha = clamp(scene.a + bloom.a * uBloomStrength, 0.0, 1.0);
  fragColor = vec4(col, alpha);
}
`;
