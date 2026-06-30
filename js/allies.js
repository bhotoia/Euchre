// allies.js — recruitable partner profiles. You start with balanced Mac and
// recruit rivals by beating them. Each ally has a distinct AI style plus player-
// facing copy for the team picker. Character visuals still come from ROSTER.

export const ALLY_KEY = 'euchre.ally.v1';
export const DEFAULT_ALLY = 'mac';

export const ALLY_PROFILES = {
  mac: {
    style: 'allyBalanced',
    label: 'Balanced',
    description: 'Plays a normal, dependable game and rarely forces a call.',
  },
  vesper: {
    style: 'allyPatient',
    label: 'Patient',
    description: 'Bids carefully, preserves strong cards, and almost never goes alone.',
  },
  duke: {
    style: 'allyBold',
    label: 'All-in',
    description: 'Calls aggressively, leads trump, and will go alone with confidence.',
  },
  vera: {
    style: 'allyPressure',
    label: 'Pressure',
    description: 'Orders up often and attacks with trump, but prefers keeping a partner.',
  },
  pip: {
    style: 'allyTricky',
    label: 'Tricky',
    description: 'Mixes up leads and takes calculated chances to stay unpredictable.',
  },
  coral: {
    style: 'allyCounter',
    label: 'Card counter',
    description: 'Uses strong card-reading and waits for a clear advantage before calling.',
  },
  rex: {
    style: 'allyLoneWolf',
    label: 'Lone wolf',
    description: 'Bids big, drives trump, and goes alone more than any other ally.',
  },
  nyx: {
    style: 'allySurgical',
    label: 'Surgical',
    description: 'Calls only solid hands, ducks unsafe tricks, and seldom goes alone.',
  },
  sage: {
    style: 'allyConservative',
    label: 'Conservative',
    description: 'Passes marginal hands, leads safely, and almost always keeps the team together.',
  },
  kit: {
    style: 'allyWildcard',
    label: 'Wildcard',
    description: 'Bids with nerve and occasionally makes an unexpected lead.',
  },
};

export function allyProfile(id) {
  return ALLY_PROFILES[id] || ALLY_PROFILES[DEFAULT_ALLY];
}

export function loadAlly() {
  try { return JSON.parse(localStorage.getItem(ALLY_KEY) || '{}').id || DEFAULT_ALLY; }
  catch { return DEFAULT_ALLY; }
}
export function saveAlly(id) {
  try { localStorage.setItem(ALLY_KEY, JSON.stringify({ id })); } catch {}
  return id;
}

// Available allies = the default + every rival you've beaten (from rivals store).
export function availableAllies(rivalsStore) {
  const out = [DEFAULT_ALLY];
  for (const id of Object.keys(rivalsStore || {})) {
    if (rivalsStore[id] && rivalsStore[id].beaten && !out.includes(id)) out.push(id);
  }
  return out;
}

export function isAllyUnlocked(id, rivalsStore) {
  return availableAllies(rivalsStore).includes(id);
}
