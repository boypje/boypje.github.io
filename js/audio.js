// Background music plus little synthesized sound effects (Web Audio, no extra files).
// Nothing makes a sound until start() runs from a click, as browsers require.

const MUSIC_VOL = 0.32, MUSIC_DUCKED = 0.12;

export function createAudio(musicUrl) {
  let ctx = null, master = null, sfx = null, noiseBuf = null;
  let windGain = null, windFilter = null;
  let started = false, ducked = false;
  let muted = false;
  try { muted = localStorage.getItem("bw-muted") === "1"; } catch {}

  const music = new Audio(musicUrl);
  music.loop = true;
  music.preload = "auto";
  music.volume = MUSIC_VOL;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfx = ctx.createGain();
      sfx.gain.value = 0.7;
      sfx.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // continuous wind bed, faded in while flying or falling
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.7;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      src.connect(windFilter).connect(windGain).connect(sfx);
      src.start();
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  // one enveloped oscillator note
  function tone(freq, dur, { type = "sine", vol = 0.25, to = null, delay = 0, attack = 0.005 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // a burst of filtered noise (steps, thuds, whooshes)
  function noise(dur, { freq = 800, to = null, q = 1, type = "lowpass", vol = 0.3, delay = 0, attack = 0.004 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  const vary = (x, amt = 0.08) => x * (1 + (Math.random() * 2 - 1) * amt);

  const api = {
    get muted() { return muted; },
    get started() { return started; },
    start() {
      started = true;
      ensure();
      if (!muted) music.play().catch(() => {});
    },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem("bw-muted", m ? "1" : "0"); } catch {}
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
      if (m) music.pause();
      else if (started) { ensure(); music.play().catch(() => {}); }
    },
    duck(on) {
      if (ducked === on) return;
      ducked = on;
      const target = on ? MUSIC_DUCKED : MUSIC_VOL;
      const from = music.volume, t0 = performance.now();
      const stepFade = () => {
        const k = Math.min(1, (performance.now() - t0) / 400);
        music.volume = from + (target - from) * k;
        if (k < 1) requestAnimationFrame(stepFade);
      };
      stepFade();
    },
    pauseForHidden(hidden) {
      if (!started || muted) return;
      if (hidden) { music.pause(); ctx?.suspend(); }
      else { ctx?.resume(); music.play().catch(() => {}); }
    },

    step() {
      noise(0.08, { freq: vary(1100, 0.2), to: 300, vol: 0.16 });
      tone(vary(95, 0.1), 0.06, { type: "triangle", vol: 0.12 });
    },
    jump() {
      tone(vary(320), 0.16, { type: "triangle", vol: 0.2, to: 640 });
      noise(0.14, { type: "bandpass", freq: 600, to: 1800, q: 1.2, vol: 0.08 });
    },
    doubleJump() {
      tone(520, 0.14, { type: "triangle", vol: 0.18, to: 1040 });
      tone(1320, 0.18, { type: "sine", vol: 0.08, delay: 0.06 });
    },
    land(strength = 1) {
      const s = Math.min(1, strength);
      noise(0.14, { freq: 500, to: 120, vol: 0.18 + 0.25 * s });
      tone(130, 0.12, { type: "sine", vol: 0.12 + 0.2 * s, to: 55 });
    },
    flyOn() {
      noise(0.55, { type: "bandpass", freq: 350, to: 1800, q: 0.9, vol: 0.32, attack: 0.05 });
      tone(380, 0.4, { type: "sine", vol: 0.12, to: 900, attack: 0.03 });
    },
    flyOff() {
      noise(0.45, { type: "bandpass", freq: 1500, to: 300, q: 0.9, vol: 0.25, attack: 0.03 });
      tone(700, 0.3, { type: "sine", vol: 0.08, to: 300 });
    },
    open() {
      tone(660, 0.35, { type: "triangle", vol: 0.18 });
      tone(990, 0.45, { type: "triangle", vol: 0.16, delay: 0.09 });
      tone(1320, 0.5, { type: "sine", vol: 0.06, delay: 0.09 });
    },
    close() {
      tone(780, 0.14, { type: "triangle", vol: 0.12, to: 480 });
    },
    click() {
      tone(1250, 0.05, { type: "square", vol: 0.04 });
      tone(900, 0.05, { type: "triangle", vol: 0.06 });
    },
    discover() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: "triangle", vol: 0.15, delay: i * 0.08 }));
      tone(2093, 0.6, { type: "sine", vol: 0.05, delay: 0.32 });
    },
    travel() {
      noise(0.6, { type: "bandpass", freq: 300, to: 2400, q: 0.8, vol: 0.25, attack: 0.08 });
      tone(440, 0.5, { type: "sine", vol: 0.08, to: 1320, attack: 0.05 });
    },
    respawn() {
      tone(620, 0.45, { type: "triangle", vol: 0.16, to: 180 });
      tone(330, 0.3, { type: "triangle", vol: 0.12, delay: 0.42, to: 520 });
    },
    // 0..1, how strongly the wind should blow right now
    wind(level) {
      if (!ctx || !windGain) return;
      const l = muted ? 0 : Math.max(0, Math.min(1, level));
      windGain.gain.setTargetAtTime(l * 0.22, ctx.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(380 + l * 900, ctx.currentTime, 0.2);
    },
  };
  return api;
}
