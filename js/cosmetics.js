// cosmetics.js — unlockable visual packs that re-skin the card backs, the felt,
// and the card faces. Theming itself lives in CSS keyed on html[data-pack="id"];
// this module only owns the catalog, the owned/active state, and applyPack().

export const COSMETICS_KEY = 'euchre.cosmetics.v1';

// unlock: 'default' (owned from the start) | { tournament: id } | { badge: id }
export const PACKS = [
  { id: 'classic',  name: 'Classic Green', blurb: 'The original felt.',        unlock: 'default' },
  { id: 'midnight', name: 'Midnight',      blurb: 'Indigo after hours.',       unlock: 'default' },
  { id: 'obsidian', name: 'Obsidian Holo', blurb: 'Win The Cellar.',          unlock: { tournament: 'cellar' }, holo: true },
  { id: 'crimson',  name: 'Crimson Club',  blurb: 'Win The Parlour.',         unlock: { tournament: 'highland' } },
  { id: 'royal',    name: 'Royale',        blurb: 'Win The Highrise.',        unlock: { tournament: 'apex' } },
  { id: 'neon',     name: 'Neon Nights',   blurb: 'Win The Vault.',           unlock: { tournament: 'vault' } },
  { id: 'gilded',   name: 'Gilded Master', blurb: 'Win The Masters.',         unlock: { tournament: 'masters' }, holo: true },
];

export function packById(id) {
  return PACKS.find((p) => p.id === id) || PACKS[0];
}

export function defaultCosmetics() {
  return { owned: { classic: true, midnight: true }, active: 'classic' };
}

export function isOwned(store, id) {
  return id === 'classic' || !!store.owned[id];
}

// Mark a pack owned. Returns true if it was newly unlocked.
export function ownPack(store, id) {
  if (store.owned[id]) return false;
  store.owned[id] = true;
  return true;
}

// Switch the active pack (only if owned). Returns the resolved active id.
export function setActivePack(store, id) {
  if (isOwned(store, id)) store.active = id;
  return store.active;
}

export function unlockHint(pack) {
  if (pack.unlock === 'default') return 'Owned';
  if (pack.unlock?.tournament) return pack.blurb;
  if (pack.unlock?.badge) return pack.blurb;
  return 'Locked';
}

// ─── persistence ───

export function loadCosmetics() {
  try {
    const raw = JSON.parse(localStorage.getItem(COSMETICS_KEY) || '{}');
    const base = defaultCosmetics();
    const owned = { ...base.owned, ...(raw.owned || {}) };
    let active = raw.active && owned[raw.active] ? raw.active : 'classic';
    return { owned, active };
  } catch {
    return defaultCosmetics();
  }
}

export function saveCosmetics(store) {
  try { localStorage.setItem(COSMETICS_KEY, JSON.stringify(store)); } catch {}
  return store;
}

// ─── apply (DOM) ───

export function applyPack(id) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.pack = id || 'classic';
  }
}
