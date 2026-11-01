// "Jingle Bells" (melodía tradicional) de ~5 s generada con Web Audio, sin archivos:
// campanillas, un bajo suave y cascabeles. Devuelve { stop } o null si el navegador bloquea el sonido.
const C3 = 130.81, G2 = 98, C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99;
const BEAT = 0.27;
const MELODY = [[E5, 1], [E5, 1], [E5, 2], [E5, 1], [E5, 1], [E5, 2], [E5, 1], [G5, 1], [C5, 1.5], [D5, 0.5], [E5, 4]];
const DURATION = 16 * BEAT + 0.7;

export async function playChristmasMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try { await ctx.resume(); } catch { /* bloqueado */ }
  if (ctx.state !== "running") { ctx.close(); return null; }

  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  const tone = (type, freq, t, peak, decay) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.02);
  };

  // Melodía: cada nota lleva un armónico agudo para que suene a campanilla
  let t = t0;
  for (const [freq, beats] of MELODY) {
    const decay = Math.min(1.2, beats * BEAT + 0.35);
    tone("sine", freq, t, 0.3, decay);
    tone("sine", freq * 3, t, 0.06, decay * 0.5);
    t += beats * BEAT;
  }

  // Bajo y cascabeles a cada pulso
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  for (let beat = 0; beat < 16; beat++) {
    const at = t0 + beat * BEAT;
    if (beat % 2 === 0) tone("triangle", beat % 4 === 0 ? C3 : G2, at, 0.16, BEAT * 1.6);
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = 6000;
    g.gain.value = 0.08;
    src.connect(filter).connect(g).connect(master);
    src.start(at);
  }

  const timer = setTimeout(() => ctx.close().catch(() => {}), (DURATION + 0.3) * 1000);
  return {
    stop() {
      clearTimeout(timer);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      setTimeout(() => ctx.close().catch(() => {}), 400);
    }
  };
}
