/**
 * 许愿池 · 几何
 *
 * 池体、水面、硬币、漂流瓶全部现算，不加载任何模型文件。
 * 统一用一个「旋转体（lathe）」生成器：给一条 2D 母线（r,y 从下到上），
 * 绕 Y 轴旋一圈，法线由母线切向推出。
 *
 * 硬币那支母线故意做成 4 点（底心 → 底缘 → 顶缘 → 顶心），
 * 相邻段法线取平均 → 边缘自然带一圈倒角，转起来有一道细高光，比硬边圆柱好看。
 */

import { ATTRIB } from "./glutil";

export interface GeometryData {
  position: Float32Array;
  normal: Float32Array;
  /** 只有水面和全屏 quad 需要 uv */
  uv?: Float32Array;
  index: Uint16Array | Uint32Array;
}

export interface UploadedGeometry {
  vao: WebGLVertexArrayObject;
  /** 索引数量 */
  count: number;
  /** 索引类型（UNSIGNED_SHORT / UNSIGNED_INT） */
  indexType: number;
}

export const FLOOR_Y = 0;
export const WATER_LEVEL = 1.15;
export const POOL_RADIUS = 5;
export const RIM_HEIGHT = 1.62;
/** 硬币与瓶子的世界尺寸 */
export const COIN_RADIUS = 0.16;
export const COIN_THICK = 0.046;
export const BOTTLE_RADIUS = 0.13;
export const BOTTLE_HEIGHT = 0.64;

/** 一圈用多少段。24 段在这个尺度下已经看不出棱 */
const RING_SEGMENTS = 40;

/**
 * 母线旋转体。
 * @param profile 从下到上的 [半径, 高度] 列表；半径 0 表示该处收成一个点（封口）
 */
export function makeLathe(
  profile: [number, number][],
  segments = RING_SEGMENTS,
): GeometryData {
  const n = profile.length;

  /* 每个母线点的法线（在 r-y 平面内）：垂直于相邻段、朝外 */
  const normals2d: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let nr = 0;
    let ny = 0;
    const prev = i > 0 ? profile[i - 1] : null;
    const next = i < n - 1 ? profile[i + 1] : null;
    for (const [a, b] of [
      [prev, profile[i]],
      [profile[i], next],
    ] as [[number, number] | null, [number, number] | null][]) {
      if (!a || !b) continue;
      const dr = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dr, dy) || 1;
      /* (ny, -dr) 归一化后即朝外侧法线 */
      nr += dy / len;
      ny += -dr / len;
    }
    const len = Math.hypot(nr, ny) || 1;
    normals2d.push([nr / len, ny / len]);
  }

  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  /** 每个母线点在顶点数组里的起始下标；收点处只有一个顶点 */
  const base: number[] = [];

  for (let i = 0; i < n; i++) {
    const [r, y] = profile[i];
    const [nr, ny] = normals2d[i];
    base.push(position.length / 3);

    if (r < 1e-6) {
      position.push(0, y, 0);
      normal.push(0, ny >= 0 ? 1 : -1, 0);
    } else {
      for (let j = 0; j < segments; j++) {
        const t = (j / segments) * Math.PI * 2;
        const ct = Math.cos(t);
        const st = Math.sin(t);
        position.push(r * ct, y, r * st);
        normal.push(nr * ct, ny, nr * st);
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const a0 = profile[i][0] < 1e-6;
    const b0 = profile[i + 1][0] < 1e-6;
    const bi = base[i];
    const bj = base[i + 1];

    if (a0 && b0) continue; /* 两点都收成中心：无面 */

    if (a0) {
      /* 底部收点 → 扇面 */
      for (let j = 0; j < segments; j++) {
        const k = (j + 1) % segments;
        index.push(bi, bj + k, bj + j);
      }
    } else if (b0) {
      /* 顶部收点 → 扇面 */
      for (let j = 0; j < segments; j++) {
        const k = (j + 1) % segments;
        index.push(bi + j, bi + k, bj);
      }
    } else {
      for (let j = 0; j < segments; j++) {
        const k = (j + 1) % segments;
        index.push(bi + j, bi + k, bj + k);
        index.push(bi + j, bj + k, bj + j);
      }
    }
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index:
      position.length / 3 > 65535
        ? new Uint32Array(index)
        : new Uint16Array(index),
  };
}

/** 平躺的圆盘（池底 / 水面），法线朝上 */
export function makeDisc(radius: number, y: number, segments = 96): GeometryData {
  const position: number[] = [0, y, 0];
  const normal: number[] = [0, 1, 0];
  const uv: number[] = [0.5, 0.5];
  const index: number[] = [];

  for (let j = 0; j <= segments; j++) {
    const t = (j / segments) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    position.push(radius * ct, y, radius * st);
    normal.push(0, 1, 0);
    uv.push(ct * 0.5 + 0.5, st * 0.5 + 0.5);
  }
  /* ⚠️ 必须是 j <= segments（不是 <）。
     环上顶点有 segments+1 个（j=0..segments 各一个，末端与起点角度重合），
     在 position 数组里占下标 1..segments+1。三角形 (0, j, j+1) 要一路取到
     j = segments 才能把**最后一圈扇区**补上；写成 j < segments 会漏掉
     从 (segments-1)/segments·2π 到 2π 的那一小片，圆盘上就出现一道
     从圆心裂到盘边的楔形缺口 —— 透过水面那道缝直接看到 clear 后的透明，
     表现为水面上一条细黑线（池底圆盘同样会裂）。 */
  for (let j = 1; j <= segments; j++) {
    index.push(0, j, j + 1);
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv),
    index: new Uint16Array(index),
  };
}

/** 硬币：母线 4 点，边缘带倒角 */
export function makeCoin(): GeometryData {
  const R = COIN_RADIUS;
  const h = COIN_THICK;
  return makeLathe(
    [
      [0, -h / 2],
      [R, -h / 2],
      [R, h / 2],
      [0, h / 2],
    ],
    28,
  );
}

/** 漂流瓶：底 → 身 → 肩 → 颈 → 塞子 */
export function makeBottle(): GeometryData {
  const R = BOTTLE_RADIUS;
  const H = BOTTLE_HEIGHT;
  return makeLathe(
    [
      [0, 0],
      [R * 0.92, 0.02 * H],
      [R, 0.12 * H],
      [R, 0.52 * H],
      [R * 0.86, 0.6 * H],
      [R * 0.42, 0.7 * H],
      [R * 0.3, 0.78 * H],
      [R * 0.3, 0.92 * H],
      [R * 0.36, 0.95 * H],
      [R * 0.36, H],
      [0, H],
    ],
    26,
  );
}

/* ------------------------------------------------------------------ 鱼 */

/**
 * 锦鲤。**局部空间里体长归一化为 1**：z ∈ [-0.5, +0.5]，+z 是鼻端；
 * 所以实例缩放给多少，鱼在世界里就有多长（不用再乘一个 LENGTH 常数）。
 *
 * 为什么不用 `makeLathe`：鱼身是**椭圆截面**（半宽 < 半高），套旋转体会得到
 * 一根圆棍；尾鳍 / 胸鳍 / 背鳍还都是平面片。这里按「截面环 + 三角片」手搭。
 *
 * 顶点自带的 `uv.x` 是**材质槽**：0 = 身体，1 = 鳍。片元着色器靠它区分
 * （鳍要更薄更亮、不参与斑纹），所以这条几何必须用
 * `uploadInstancedGeometry(..., withUv=true)` 上传。
 *
 * 法线用相邻顶点的差分求（沿环的切向 × 沿体长的切向）。椭圆截面不能拿
 * (cos, sin) 直接当法线 —— 半宽和半高不等时会明显偏，鱼的背脊会发黑。
 */
export function makeFish(): GeometryData {
  /** [t 沿体长 0=尾柄 1=吻端, 半宽(x), 半高(y)] */
  const PROFILE: [number, number, number][] = [
    [0.0, 0.014, 0.032],
    [0.1, 0.05, 0.084],
    [0.24, 0.08, 0.13],
    [0.42, 0.094, 0.153],
    [0.58, 0.088, 0.145],
    [0.72, 0.069, 0.115],
    [0.85, 0.045, 0.075],
    [0.94, 0.023, 0.039],
    [1.0, 0.002, 0.004],
  ];
  const RS = 14;

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  const ring = (i: number, j: number): [number, number, number] => {
    const [t, w, h] = PROFILE[i];
    const a = (j / RS) * Math.PI * 2;
    return [Math.cos(a) * w, Math.sin(a) * h, t - 0.5];
  };

  const sub = (
    a: [number, number, number],
    b: [number, number, number],
  ): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

  for (let i = 0; i < PROFILE.length; i++) {
    const iPrev = Math.max(0, i - 1);
    const iNext = Math.min(PROFILE.length - 1, i + 1);
    for (let j = 0; j < RS; j++) {
      const p = ring(i, j);
      /* 沿环的切向 × 沿体长的切向 = 朝外法线 */
      const dRing = sub(ring(i, (j + 1) % RS), ring(i, (j + RS - 1) % RS));
      const dBody = sub(ring(iNext, j), ring(iPrev, j));
      let nx = dRing[1] * dBody[2] - dRing[2] * dBody[1];
      let ny = dRing[2] * dBody[0] - dRing[0] * dBody[2];
      let nz = dRing[0] * dBody[1] - dRing[1] * dBody[0];
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9) {
        /* 首尾两环截面收缩到几乎一个点，退化 → 退回径向 */
        const rl = Math.hypot(p[0], p[1]) || 1;
        nx = p[0] / rl;
        ny = p[1] / rl;
        nz = 0;
      } else {
        nx /= len;
        ny /= len;
        nz /= len;
      }
      position.push(p[0], p[1], p[2]);
      normal.push(nx, ny, nz);
      uv.push(0, PROFILE[i][0]);
    }
  }

  /* 环与环之间连成四边形（culling 是关的，绕序不影响观感，但仍写成一致方向） */
  for (let i = 0; i < PROFILE.length - 1; i++) {
    for (let j = 0; j < RS; j++) {
      const k = (j + 1) % RS;
      const a = i * RS + j;
      const b = i * RS + k;
      const c = (i + 1) * RS + j;
      const d = (i + 1) * RS + k;
      index.push(a, b, c);
      index.push(b, d, c);
    }
  }

  /** 鳍：一片三角。法线由调用方给（正立/平躺的面各自朝哪边是明确的），
   *  这里统一归一化 —— 着色器虽然还会再 normalize 一次，但「几何产出的法线
   *  必须是单位向量」是离线单测守的契约，手写常数很容易差个千分之几。 */
  const fin = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    n: [number, number, number],
  ) => {
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const ux = n[0] / nl;
    const uy = n[1] / nl;
    const uz = n[2] / nl;
    const base = position.length / 3;
    for (const p of [p1, p2, p3]) {
      position.push(p[0], p[1], p[2]);
      normal.push(ux, uy, uz);
      uv.push(1, 0);
    }
    index.push(base, base + 1, base + 2);
  };

  /* 尾鳍：竖直、末端分叉（缺口在前，两梢朝后） */
  const tTop: [number, number, number] = [0, 0.032, -0.47];
  const tBot: [number, number, number] = [0, -0.032, -0.47];
  const tUp: [number, number, number] = [0, 0.19, -0.75];
  const tNotch: [number, number, number] = [0, 0.004, -0.635];
  const tLow: [number, number, number] = [0, -0.19, -0.75];
  fin(tTop, tUp, tNotch, [1, 0, 0]);
  fin(tTop, tNotch, tBot, [1, 0, 0]);
  fin(tBot, tNotch, tLow, [1, 0, 0]);

  /* 背鳍：脊背上一片竖三角 */
  fin([0, 0.15, 0.12], [0, 0.15, -0.17], [0, 0.30, -0.09], [1, 0, 0]);

  /* 胸鳍：**近水平**的两片。俯视时它们才是「鱼」的剪影来源 ——
     侧扁的鱼从上看只有一条，靠这两片才读得出鱼的形状。 */
  fin(
    [0.055, -0.01, 0.2],
    [0.2, -0.05, 0.05],
    [0.15, -0.055, 0.31],
    [0.16, 0.98, 0.09],
  );
  fin(
    [-0.055, -0.01, 0.2],
    [-0.2, -0.05, 0.05],
    [-0.15, -0.055, 0.31],
    [-0.16, 0.98, 0.09],
  );

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv),
    index: new Uint16Array(index),
  };
}

/** 全屏三角形对（后处理用），NDC 坐标 */
export function makeQuad(): GeometryData {  return {
    position: new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 2, 0, 0, 2]),
    index: new Uint16Array([0, 1, 2]),
  };
}

/** 池壁：开口圆筒（只侧面，无盖），外圈法线朝外的与朝内的都要，
    所以这里绕一圈给两个方向的面——配合「关闭背面剔除」一起用。 */
export function makePoolWall(
  radius = POOL_RADIUS,
  height = RIM_HEIGHT,
  segments = 96,
): GeometryData {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (let j = 0; j <= segments; j++) {
    const t = (j / segments) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    /* 底 / 顶，法线朝外 */
    position.push(radius * ct, 0, radius * st);
    normal.push(ct, 0, st);
    position.push(radius * ct, height, radius * st);
    normal.push(ct, 0, st);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    index.push(a, a + 1, a + 3);
    index.push(a, a + 3, a + 2);
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

/** 池沿上盖：一圈从内半径到外半径的环面（把壁的厚度封住） */
export function makeRim(
  innerR = POOL_RADIUS,
  outerR = POOL_RADIUS + 0.34,
  y = RIM_HEIGHT,
  segments = 96,
): GeometryData {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (let j = 0; j <= segments; j++) {
    const t = (j / segments) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    position.push(innerR * ct, y, innerR * st);
    normal.push(0, 1, 0);
    position.push(outerR * ct, y, outerR * st);
    normal.push(0, 1, 0);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    index.push(a, a + 3, a + 1);
    index.push(a, a + 2, a + 3);
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

export function makePoolOuter(
  innerR = POOL_RADIUS + 0.34,
  height = RIM_HEIGHT,
  segments = 96,
): GeometryData {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (let j = 0; j <= segments; j++) {
    const t = (j / segments) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    position.push(innerR * ct, 0, innerR * st);
    normal.push(ct, 0, st);
    position.push(innerR * ct, height, innerR * st);
    normal.push(ct, 0, st);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    index.push(a, a + 3, a + 1);
    index.push(a, a + 2, a + 3);
  }

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

/** 单位球（半径 1，供水花粒子按实例缩放）——用半圆母线旋出来 */
export function makeSphere(segments = 14, rings = 8): GeometryData {
  const profile: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI; /* 0 = 底，π = 顶 */
    profile.push([Math.sin(phi), -Math.cos(phi)]);
  }
  return makeLathe(profile, segments);
}

/* --------------------------------------------------------------- 上传 */

/** 静态几何（池底 / 池壁 / 池沿 / 全屏 quad）：aPosition + 可选 aNormal / aUv */
export function uploadStaticGeometry(
  gl: WebGL2RenderingContext,
  geo: GeometryData,
  withUv = false,
): UploadedGeometry {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const bind = (loc: number, data: Float32Array, size: number) => {
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };

  bind(ATTRIB.aPosition, geo.position, 3);
  if (geo.normal) bind(ATTRIB.aNormal, geo.normal, 3);
  if (withUv && geo.uv) bind(ATTRIB.aUv, geo.uv, 2);

  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.index, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    vao,
    count: geo.index.length,
    indexType:
      geo.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
  };
}

/** 一个实例在交错缓冲里占的 float 数：16（矩阵）+ 4（参数） */
export const INSTANCE_STRIDE_FLOATS = 20;

/**
 * 实例化几何：静态的 aPosition/aNormal 来自几何本身，
 * aInst0..aInst3 + aParam 全部指向**同一条**交错实例缓冲（stride 80 字节）。
 * 每帧只要 bufferSubData 一次，就能更新所有实例的位置与参数。
 *
 * @param withUv 几何自带 uv 时传 true（目前只有鱼用：uv.x 当材质槽 0=身 1=鳍）
 */
export function uploadInstancedGeometry(
  gl: WebGL2RenderingContext,
  geo: GeometryData,
  instanceBuffer: WebGLBuffer,
  withUv = false,
): UploadedGeometry {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, geo.position, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(ATTRIB.aPosition);
  gl.vertexAttribPointer(ATTRIB.aPosition, 3, gl.FLOAT, false, 0, 0);

  if (geo.normal) {
    const nrmBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normal, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(ATTRIB.aNormal);
    gl.vertexAttribPointer(ATTRIB.aNormal, 3, gl.FLOAT, false, 0, 0);
  }

  if (withUv && geo.uv) {
    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(ATTRIB.aUv);
    gl.vertexAttribPointer(ATTRIB.aUv, 2, gl.FLOAT, false, 0, 0);
  }

  const strideBytes = INSTANCE_STRIDE_FLOATS * 4;
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  const slots: [number, number][] = [
    [ATTRIB.aInst0, 0],
    [ATTRIB.aInst1, 4],
    [ATTRIB.aInst2, 8],
    [ATTRIB.aInst3, 12],
    [ATTRIB.aParam, 16],
  ];
  for (const [loc, floatOffset] of slots) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(
      loc,
      4,
      gl.FLOAT,
      false,
      strideBytes,
      floatOffset * 4,
    );
    gl.vertexAttribDivisor(loc, 1);
  }

  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.index, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    vao,
    count: geo.index.length,
    indexType:
      geo.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
  };
}

export function disposeGeometry(
  gl: WebGL2RenderingContext,
  g: UploadedGeometry,
): void {
  gl.deleteVertexArray(g.vao);
}
