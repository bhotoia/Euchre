// events.js — minimal pub/sub so feature modules (juice, personality, stats)
// can react to gameplay without ui.js importing each of them directly.
// Events emitted by ui.js: 'bid', 'trick', 'hand', 'game', 'euchre', 'march'.

const listeners = new Map(); // name -> Set<fn>

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn) {
  listeners.get(name)?.delete(fn);
}

export function emit(name, detail = {}) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(detail); } catch (e) { /* a listener must never break the game loop */ }
  }
}
