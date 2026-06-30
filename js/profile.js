// profile.js — editable player identity (your name + your team name), persisted.
// Pure helpers + a thin localStorage wrapper, so it unit-tests without a DOM.

export const PROFILE_KEY = 'euchre.profile.v1';

const DEFAULTS = { playerName: 'You', teamName: 'Us' };
const MAX_LEN = 14;

export function defaultProfile() {
  return { ...DEFAULTS };
}

// Trim, collapse whitespace, clamp length; fall back to the default when empty.
export function sanitizeName(value, fallback = 'You') {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  return s || fallback;
}

export function loadProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return {
      playerName: sanitizeName(raw.playerName, DEFAULTS.playerName),
      teamName: sanitizeName(raw.teamName, DEFAULTS.teamName),
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p) {
  const clean = {
    playerName: sanitizeName(p.playerName, DEFAULTS.playerName),
    teamName: sanitizeName(p.teamName, DEFAULTS.teamName),
  };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(clean)); } catch {}
  return clean;
}
