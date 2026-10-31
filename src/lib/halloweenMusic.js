// Musiquilla de Halloween de ~5 s generada con Web Audio (sin archivos):
// zumbido grave de fondo, "theremin" fantasmal con vibrato y campanitas de caja de música.
// Devuelve { stop } o null si el navegador bloquea el sonido hasta que se toque la pantalla.
const N = { D2: 73.42, A2: 110, A4: 440, Cs5: 554.37, D5: 587.33, E5: 659.25, F5: 698.46, A5: 880, Cs6: 1108.73, D6: 1174.66 };
const DURATION = 5;

export async function playHalloweenMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try { await ctx.resume(); } catch { /* bloqueado */ }
  if (ctx.state !== "running") { ctx.close(); return null; }

  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.4);
  master.gain.setValueAtTime(0.5, t0 + DURATION - 0.8);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + DURATION);
  master.connect(ctx.destination);

  // Zumbido grave (re y la) con temblor lento
  for (const f of [N.D2, N.A2]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.value = f === N.D2 ? 0.22 : 0.08;
    lfo.frequency.value = 3; lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(g).connect(master);
    o.start(t0); lfo.start(t0); o.stop(t0 + DURATION); lfo.stop(t0 + DURATION);
  }

  // "Theremin": una sola voz que se desliza entre notas, con vibrato
  const th = ctx.createOscillator(), thGain = ctx.createGain(), vib = ctx.createOscillator(), vibGain = ctx.createGain();
  th.type = "sine";
  vib.frequency.value = 6; vibGain.gain.value = 9;
  vib.connect(vibGain).connect(th.frequency);
  const melody = [[0, N.A4], [0.55, N.D5], [1.1, N.F5], [1.65, N.E5], [2.2, N.D5], [2.75, N.Cs5], [3.3, N.D5]];
  th.frequency.setValueAtTime(N.A4, t0);
  for (const [t, f] of melody) th.frequency.exponentialRampToValueAtTime(f, t0 + t + 0.18); // deslizamiento
  thGain.gain.setValueAtTime(0.0001, t0);
  thGain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.3);
  thGain.gain.setValueAtTime(0.16, t0 + 4.2);
  thGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.9);
  th.connect(thGain).connect(master);
  th.start(t0); vib.start(t0); th.stop(t0 + DURATION); vib.stop(t0 + DURATION);

  // Campanitas (arpegio menor con una nota "inquietante")
  const bells = [N.D5, N.F5, N.A5, N.Cs6, N.D6, N.A5, N.F5, N.Cs5];
  for (let i = 0; i < 16; i++) {
    const t = t0 + 0.2 + i * 0.26;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = bells[i % bells.length];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.5);
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
