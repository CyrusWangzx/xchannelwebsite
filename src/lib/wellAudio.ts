/**
 * 许愿池 / 投币厅 · 音效（Web Audio 合成，零音频文件）
 *
 * 全部用振荡器 + 噪声合成，不加载任何 mp3/ogg：
 *   pickup  拿起   —— 三角波的短促轻点
 *   throw   投出   —— 带通噪声扫频（"咻"）
 *   splash  入水   —— 噪声爆裂 + 下行正弦（"噗通"）
 *   click   点击   —— 干净的正弦轻点
 *   scratch 刮擦   —— 极短的高通噪声（刮刮乐·刮层的手感，见下方注释）
 *   prize   中奖   —— 两声上行的三角波（只有中奖才响）
 *
 * 默认静音：AudioContext 直到用户第一次打开声音（一次显式手势）才创建，
 * 否则浏览器控制台会抛 "AudioContext was not allowed to start" 警告。
 */

export type WellSoundName =
  | "pickup"
  | "throw"
  | "splash"
  | "click"
  | "scratch"
  | "prize";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function ensureNoise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.6);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  /* 预生成白噪声，反复复用（每次 play 只读，不改写） */
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export function setAudioEnabled(v: boolean): void {
  enabled = v;
  if (v) {
    const c = ensureCtx();
    if (c && c.state === "suspended") void c.resume();
  }
}

/** 有没有 Web Audio 可用（2D/降级版也共用） */
export function audioSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.AudioContext ??
      (window as unknown as { webkitAudioContext?: unknown })
        .webkitAudioContext,
  );
}

function blip(
  c: AudioContext,
  type: OscillatorType,
  freq: number,
  dur: number,
  gain: number,
  glideTo?: number,
  /* 起音延迟：给「两声」的音效（中奖）用，省得为它单开一个函数 */
  delay = 0,
) {
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(
  c: AudioContext,
  dur: number,
  gain: number,
  filter: BiquadFilterType,
  freqFrom: number,
  freqTo: number,
  q = 1,
) {
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = ensureNoise(c);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freqFrom, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freqTo), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/**
 * 播放一个音效。静音状态下**直接返回**——不建 context、不做任何计算。
 */
export function playWellSound(name: WellSoundName): void {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();

  switch (name) {
    case "pickup":
      blip(c, "triangle", 660, 0.09, 0.16, 880);
      break;
    case "throw":
      noise(c, 0.34, 0.13, "bandpass", 900, 3000, 1.4);
      break;
    case "splash":
      noise(c, 0.42, 0.2, "lowpass", 2400, 320, 0.8);
      blip(c, "sine", 420, 0.28, 0.14, 120);
      break;
    case "click":
      blip(c, "sine", 880, 0.06, 0.1, 1320);
      break;
    /* 刮擦：一段极短的高通噪声，重复播放就成了「沙沙」的手感。
       ① 必须短（≤80ms）—— 长了会变成持续的「呼」，随手指移动听着很脏；
       ② 必须轻（0.028）—— 每 ~90ms 响一次，音量稍大就变成噪音攻击；
       ③ 高通而不是低通 —— 刮层是脆的，低频会听成「擦玻璃」。
       调用方（ScratchTicket）负责节流，见那里的 SCRATCH_SOUND_GAP。 */
    case "scratch":
      noise(c, 0.075, 0.028, "highpass", 3600, 2400, 0.7);
      break;
    /* 中奖：两个上行三角波，隔 110ms。只在中奖时响，未中奖给一声 click。 */
    case "prize":
      blip(c, "triangle", 620, 0.14, 0.13, 930);
      blip(c, "triangle", 930, 0.22, 0.11, 1240, 0.11);
      break;
  }
}

/** 页面卸载/离开时释放 */
export function disposeAudio(): void {
  if (ctx) {
    void ctx.close().catch(() => undefined);
    ctx = null;
    master = null;
  }
}
