/**
 * 许愿池 · WebGL2 底层工具
 *
 * 只为这一个场景服务：编译/链接、VAO、纹理、FBO。没有抽象层，没有渲染图。
 * 所有 shader 源码直接内联在各自的模块里（water / coin / bottle / post）。
 */

export interface Program {
  program: WebGLProgram;
  /** 惰性缓存 uniform 位置——每帧查位置是会掉帧的 */
  u(name: string): WebGLUniformLocation | null;
}

export function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const opts: WebGLContextAttributes = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: "high-performance",
    /* 截图/验收要能读回像素；不开 preserveDrawingBuffer 也能读，
       但截图前必须先在同一帧内 readPixels。这里开小一点成本换稳定。 */
    preserveDrawingBuffer: false,
    /* 用**直通 alpha**：画布是透明的，池子之外要透出页面底色。
       预乘会让 Bloom 叠加后的边缘出现一圈暗边。 */
    premultipliedAlpha: false,
  };
  return canvas.getContext("webgl2", opts);
}

/* 探测结果缓存：一个页面探一次就够。
   探测本身要建一个真 context，StrictMode 下 effect 跑两遍会建两个，
   既浪费也会在控制台留下 "CONTEXT_LOST_WEBGL: loseContext" 的告警。 */
let webgl2Support: boolean | null = null;

/** 判断设备是否支持 WebGL2（低端检测用，会真的建一次 context 再丢掉） */
export function supportsWebGL2(): boolean {
  if (webgl2Support !== null) return webgl2Support;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) {
      webgl2Support = false;
      return false;
    }
    /* 一次性探针画布，用完就释放（它不会被复用，lose 掉是安全的） */
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    webgl2Support = true;
    return true;
  } catch {
    webgl2Support = false;
    return false;
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error(`createShader 失败：${label}`);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "(无日志)";
    gl.deleteShader(sh);
    /* 把源码开头一并抛出：编译失败时「无日志」几乎总是源码本身有问题
       （比如模板串被反引号提前截断、首行不是 #version），只看日志查不出来 */
    const head = src.slice(0, 90).replace(/\n/g, "⏎");
    /* ⚠️ context 一旦 lost，getShaderParameter 返回 null（表现为「编译失败但无日志」），
       所以必须把 isContextLost / getError 一起报出来，否则会往源码上找错方向 */
    throw new Error(
      `[${label}] shader 编译失败（len=${src.length}, lost=${gl.isContextLost()}, ` +
        `glError=0x${gl.getError().toString(16)}）：\n${log}\n源码开头：${head}`,
    );
  }
  return sh;
}

/**
 * 所有 shader 共用的属性槽位。**显式绑定**而不是听编译器安排：
 * 同一份几何（VAO）要在「硬币/池底/水面/粒子」多个 program 之间复用，
 * 一旦各 program 分到的 location 不同，VAO 就得为每个 program 各建一份。
 * 绑死之后，一个 VAO 到处用。
 */
export const ATTRIB = {
  aPosition: 0,
  aNormal: 1,
  aUv: 2,
  aInst0: 3,
  aInst1: 4,
  aInst2: 5,
  aInst3: 6,
  aParam: 7,
} as const;

export function createProgram(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string,
  label: string,
): Program {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc, `${label}:vs`);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc, `${label}:fs`);
  const program = gl.createProgram();
  if (!program) throw new Error(`createProgram 失败：${label}`);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);

  for (const [name, loc] of Object.entries(ATTRIB)) {
    gl.bindAttribLocation(program, loc, name);
  }

  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(无日志)";
    gl.deleteProgram(program);
    throw new Error(`[${label}] program 链接失败：\n${log}`);
  }

  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    u(name) {
      if (!cache.has(name)) {
        cache.set(name, gl.getUniformLocation(program, name));
      }
      return cache.get(name) ?? null;
    },
  };
}

/* --------------------------------------------------------------- 纹理 / FBO */

export interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  withDepth: boolean,
): RenderTarget {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );

  if (withDepth) {
    const depth = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      width,
      height,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depth,
    );
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, width, height };
}

export function resizeTarget(
  gl: WebGL2RenderingContext,
  rt: RenderTarget,
  width: number,
  height: number,
): void {
  if (rt.width === width && rt.height === height) return;
  rt.width = width;
  rt.height = height;
  gl.bindTexture(gl.TEXTURE_2D, rt.tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
}

export function disposeTarget(gl: WebGL2RenderingContext, rt: RenderTarget): void {
  gl.deleteFramebuffer(rt.fbo);
  gl.deleteTexture(rt.tex);
}

export function bindTarget(
  gl: WebGL2RenderingContext,
  rt: RenderTarget | null,
  viewportW: number,
  viewportH: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
  gl.viewport(0, 0, rt ? rt.width : viewportW, rt ? rt.height : viewportH);
}

/** 一次性把编译错误抛到控制台，便于验收脚本看到（而不是静默黑屏） */
export function fail(gl: WebGL2RenderingContext, label: string): never {
  const err = gl.getError();
  throw new Error(`WebGL 错误 @ ${label}：0x${err.toString(16)}`);
}
