// daily.js — deterministic offline Daily Deal configuration, scoring, and
// history. The local calendar date is the shared seed; no server is required.

export const DAILY_KEY = 'euchre.daily.v1';

const ALLIES = ['mac', 'vesper', 'duke', 'vera', 'pip', 'coral', 'nyx', 'rex', 'sage', 'kit'];
const OPPONENTS = ['vesper', 'duke', 'vera', 'pip', 'coral', 'nyx', 'rex', 'sage', 'kit'];
const DIFFICULTIES = ['normal', 'hard', 'hard'];

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hashString(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dailyRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyConfig(dateKey = localDateKey()) {
  const seed = hashString(`euchre-daily:${dateKey}`);
  const rng = dailyRng(seed);
  const ally = ALLIES[Math.floor(rng() * ALLIES.length)];
  const pool = OPPONENTS.filter((id) => id !== ally);
  const westIndex = Math.floor(rng() * pool.length);
  const west = pool.splice(westIndex, 1)[0];
  const east = pool[Math.floor(rng() * pool.length)];
  const difficulty = DIFFICULTIES[Math.floor(rng() * DIFFICULTIES.length)];
  return { dateKey, seed, ally, opponents: [west, east], difficulty };
}

export function dailyDealRng(dateKey, dealIndex = 0) {
  return dailyRng(hashString(`euchre-daily:${dateKey}:deal:${dealIndex}`));
}

export function dailyActionRng(dateKey, actionIndex = 0) {
  return dailyRng(hashString(`euchre-daily:${dateKey}:action:${actionIndex}`));
}

export function scoreDaily({ won = false, scores = [0, 0], hands = 0, euchres = 0, aloneWins = 0 } = {}) {
  const margin = (scores[0] || 0) - (scores[1] || 0);
  return Math.max(0,
    (won ? 1000 : 0) +
    margin * 75 +
    euchres * 120 +
    aloneWins * 200 -
    hands * 10
  );
}

export function defaultDailyStore() {
  return { entries: {} };
}

export function loadDaily() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    return { entries: { ...(raw.entries || {}) } };
  } catch {
    return defaultDailyStore();
  }
}

export function saveDaily(store) {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(store)); } catch {}
  return store;
}

export function officialEntry(store, dateKey) {
  return store?.entries?.[dateKey] || null;
}

export function completeDaily(store, dateKey, result) {
  if (!store.entries) store.entries = {};
  if (store.entries[dateKey]) return { entry: store.entries[dateKey], recorded: false };
  store.entries[dateKey] = { ...result, dateKey, official: true, completed: true };
  return { entry: store.entries[dateKey], recorded: true };
}

export function dailyBest(store) {
  const scores = Object.values(store?.entries || {}).map((e) => Number(e.score) || 0);
  return scores.length ? Math.max(...scores) : 0;
}

function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function dailyStreak(store, todayKey = localDateKey()) {
  const entries = store?.entries || {};
  let key = entries[todayKey] && !entries[todayKey].forfeit ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (entries[key] && !entries[key].forfeit) {
    streak += 1;
    key = shiftDateKey(key, -1);
  }
  return streak;
}

export function recentDailyEntries(store, limit = 7) {
  return Object.values(store?.entries || {})
    .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))
    .slice(0, limit);
}
