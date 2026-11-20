let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export async function decodeAudioFile(url) {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const ctx = getCtx();
  if (ctx.state === 'suspended') await ctx.resume();
  return await ctx.decodeAudioData(arr);
}

export function computePeaks(buffer, samples = 700) {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / samples));
  const peaks = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(channel[start + j] || 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

export function computeEnergy(buffer, windowSec = 0.5) {
  const channel = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const win = Math.max(1, Math.floor(sr * windowSec));
  const count = Math.floor(channel.length / win);
  const energies = [];
  for (let i = 0; i < count; i++) {
    let sum = 0;
    const start = i * win;
    for (let j = 0; j < win; j++) {
      const v = channel[start + j] || 0;
      sum += v * v;
    }
    energies.push({ time: i * windowSec, energy: Math.sqrt(sum / win) });
  }
  return energies;
}

export function suggestStartPoint(buffer) {
  const energies = computeEnergy(buffer, 0.5);
  if (!energies.length) return { start: 0, reason: 'Default start', energy: 0 };
  const avg = energies.reduce((s, e) => s + e.energy, 0) / energies.length;
  let maxIdx = 0, maxE = 0;
  energies.forEach((e, i) => {
    if (e.time > 4 && e.energy > maxE) { maxE = e.energy; maxIdx = i; }
  });
  const reason = maxE > avg * 1.6 ? 'High-energy section detected' : 'Loudest section';
  return { start: Math.round(energies[maxIdx].time), reason, energy: maxE, average: avg };
}

// Average level of a decoded track, in dBFS. Long files are sampled so this
// stays quick on a whole library.
export function computeRmsDb(buffer) {
  const channel = buffer.getChannelData(0);
  const stride = Math.max(1, Math.floor(channel.length / 200000));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < channel.length; i += stride) {
    const v = channel[i];
    sum += v * v;
    n++;
  }
  if (!n || sum === 0) return -60;
  return 20 * Math.log10(Math.sqrt(sum / n));
}

export async function analyzeLoudness(url) {
  return computeRmsDb(await decodeAudioFile(url));
}

// The loudest end of a library sets the ceiling, so every other track is turned
// down to match it instead of being pushed past the player's maximum.
export function referenceDb(levels) {
  const valid = levels.filter((db) => typeof db === 'number');
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))];
}

export function volumeForDb(db, ref) {
  if (db == null || ref == null) return 100;
  const gain = Math.pow(10, (ref - db) / 20);
  return Math.max(25, Math.min(100, Math.round(gain * 100)));
}

export function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseTime(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  if (str.includes(':')) {
    const [m, s] = str.split(':').map(Number);
    return m * 60 + (s || 0);
  }
  return Number(str) || 0;
}