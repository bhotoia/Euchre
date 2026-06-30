// juice.js — celebration & feedback effects. Subscribes to game events and adds
// confetti, screen-shake, colour flashes, and richer sound. All effects respect
// prefers-reduced-motion and the user's sound/haptics preferences.

import { on } from './events.js';

let getPrefs = () => ({ sound: true, haptics: true });
let reduceMotion = false;
let actx = null;

export function initJuice(prefsFn) {
  if (prefsFn) getPrefs = prefsFn;
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

  on('game', (e) => {
    if (e.youWon) celebrate();
    else loseThud();
  });
  on('hand', (e) => handJolt(e));
  on('euchre', (e) => euchreJolt(e.byYou));
  on('march', (e) => marchJolt(e));
  on('reward', () => rewardJolt());
}

// ─── sound ───
function ctx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = actx || new AC();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch { return null; }
}

function tone(freq, start, dur, { type = 'sine', vol = 0.06 } = {}) {
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur);
}

function noiseBurst(start, dur, vol = 0.18) {
  const c = ctx(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = vol;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  src.connect(lp).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

function fanfare() {
  if (!getPrefs().sound) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, i * 0.09, 0.32, { type: 'triangle', vol: 0.07 }));
  tone(392, 0.36, 0.5, { type: 'sine', vol: 0.05 });
}

function euchreFanfare() {
  if (!getPrefs().sound) return;
  const notes = [587.33, 739.99, 880, 1174.66]; // D5 F#5 A5 D6 — brighter than score pop
  notes.forEach((f, i) => tone(f, i * 0.075, 0.24, { type: 'triangle', vol: 0.075 }));
  tone(1480, 0.24, 0.16, { type: 'sine', vol: 0.04 });
}

function rewardFanfare() {
  if (!getPrefs().sound) return;
  [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.075, 0.28, { type: 'triangle', vol: 0.065 }));
  tone(1318.51, 0.34, 0.22, { type: 'sine', vol: 0.035 });
}

function handTone(byYou) {
  if (!getPrefs().sound) return;
  if (byYou) {
    tone(440, 0, 0.12, { type: 'triangle', vol: 0.045 });
    tone(554.37, 0.08, 0.14, { type: 'triangle', vol: 0.04 });
  } else {
    tone(196, 0, 0.18, { type: 'sine', vol: 0.038 });
  }
}

function marchTone(byYou) {
  if (!getPrefs().sound) return;
  const notes = byYou ? [523.25, 659.25, 783.99] : [329.63, 261.63, 196];
  notes.forEach((f, i) => tone(f, i * 0.08, 0.2, { type: byYou ? 'triangle' : 'sine', vol: byYou ? 0.055 : 0.04 }));
}

function thunk() {
  if (!getPrefs().sound) return;
  tone(150, 0, 0.18, { type: 'square', vol: 0.09 });
  noiseBurst(0, 0.16, 0.14);
}

// ─── haptics ───
function buzz(pattern) {
  if (!getPrefs().haptics) return;
  if (window.NativeFeedback?.vibrate) window.NativeFeedback.vibrate(pattern.kind || 'score');
  else if (navigator.vibrate) navigator.vibrate(pattern);
}

// ─── visual effects ───
function flash(color, ms = 420) {
  if (reduceMotion) return;
  const el = document.createElement('div');
  el.className = 'juice-flash';
  el.style.background = color;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '0'; });
  setTimeout(() => el.remove(), ms);
}

function shake() {
  if (reduceMotion) return;
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
  setTimeout(() => app.classList.remove('shake'), 600);
}

const COLORS = ['#e8c468', '#34d27b', '#4ea3ff', '#ff7a6b', '#ffffff', '#9be36b'];

function confetti({ count = 140, power = 1 } = {}) {
  if (reduceMotion) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'juice-confetti';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);

  const parts = Array.from({ length: count }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 11 * power,
    vy: (-8 - Math.random() * 8) * power,
    s: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  }));

  let frames = 0;
  (function step() {
    frames++;
    g.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y < H + 20) alive = true;
      g.save();
      g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.color;
      g.globalAlpha = Math.max(0, 1 - frames / 160);
      g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      g.restore();
    }
    if (alive && frames < 160) requestAnimationFrame(step);
    else canvas.remove();
  })();
}

// ─── composed moments ───
function celebrate() {
  confetti({ count: 160, power: 1 });
  fanfare();
  buzz(Object.assign([30, 45, 55, 45, 80], { kind: 'gameWin' }));
}

function handJolt(e) {
  if (!e?.result || e.result.kind !== 'point') return;
  handTone(e.youScored);
  buzz(Object.assign(e.youScored ? [18, 24, 28] : [24, 42, 18], { kind: e.youScored ? 'handWin' : 'handLose' }));
}

function euchreJolt(byYou) {
  shake();
  flash(byYou ? 'rgba(52,210,123,.28)' : 'rgba(232,68,59,.30)');
  if (byYou) {
    euchreFanfare();
    buzz(Object.assign([22, 28, 38, 34, 70], { kind: 'euchreWin' }));
    confetti({ count: 70, power: 0.68 });
  } else {
    thunk();
    buzz(Object.assign([25, 40, 60], { kind: 'euchreLose' }));
  }
}

function marchJolt(e) {
  if (!e) return;
  if (e.youScored) confetti({ count: e.alone ? 110 : 80, power: e.alone ? 0.85 : 0.7 });
  marchTone(e.youScored);
  buzz(Object.assign(e.youScored ? [18, 24, 32, 36] : [26, 44, 26], { kind: e.youScored ? 'marchWin' : 'marchLose' }));
}

function loseThud() {
  flash('rgba(0,0,0,.35)', 500);
  thunk();
  buzz(Object.assign([32, 55, 38], { kind: 'gameLose' }));
}

function rewardJolt() {
  confetti({ count: 220, power: 1.2 });
  rewardFanfare();
  buzz(Object.assign([24, 30, 38, 42, 86], { kind: 'reward' }));
}

// allow ui.js to trigger a small score-pop sound without an event
export function scorePop() {
  if (getPrefs().sound) tone(760, 0, 0.13, { type: 'sine', vol: 0.06 });
}
