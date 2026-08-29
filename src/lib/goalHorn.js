// Synthesized stadium goal-horn blast using the Web Audio API.
// Plays a loud brassy chord blare for `duration` seconds. Self-contained — owns
// and closes its own AudioContext so it never interferes with the main deck.
export function playGoalHorn(duration = 2.6) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.95, now + 0.04);
  master.gain.setValueAtTime(0.95, now + duration - 0.25);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, now);
  filter.Q.value = 1.6;
  filter.connect(master);

  // A brassy goal-horn chord (D major-ish), detuned sawtooths + vibrato.
  const freqs = [
    { f: 146.83, g: 0.5 }, // D3
    { f: 220.0, g: 0.32 }, // A3
    { f: 293.66, g: 0.28 }, // D4
    { f: 369.99, g: 0.18 }, // F#4
  ];

  freqs.forEach(({ f, g }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, now);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3.5;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + duration);
    const amp = ctx.createGain();
    amp.gain.value = g;
    osc.connect(amp).connect(filter);
    osc.start(now);
    osc.stop(now + duration);
  });

  setTimeout(() => ctx.close().catch(() => {}), (duration + 0.4) * 1000);
}