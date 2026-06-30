// tournaments.js — cup ladders: a sequence of matches (games to 10) vs escalating
// themed opponents. Clear every round to win the cup and unlock its reward pack.
// `rounds[i].opponents` = [westId, partnerId, eastId] → seats [1,2,3] (seat 2 is
// your ally). Difficulty escalates within a cup, independent of the menu selector.
// Pure logic + a thin localStorage wrapper.

// A five-cup casino climb — grimy dive up to the grand gala. Each cup has a
// venue (table ambiance), a boss in its final round, and a signature reward.
// `rounds[i].opponents` = [west, east] (seats 1 & 3). Seat 2 is always your ally.
export const TOURNAMENTS = [
  {
    id: 'cellar', name: 'The Cellar', venue: 'cellar', boss: 'vesper',
    blurb: 'A back-alley dive that smells of smoke and bad decisions.',
    reward: { pack: 'obsidian', badge: 'cellarCup', title: 'Cellar Shark' },
    rounds: [
      { opponents: ['kit', 'sage'],   difficulty: 'easy' },
      { opponents: ['duke', 'vera'],  difficulty: 'normal' },
      { opponents: ['nyx', 'vesper'], difficulty: 'hard' },
    ],
  },
  {
    id: 'highland', name: 'The Parlour', venue: 'parlour', boss: 'pip',
    blurb: 'Green baize and brass. The regulars don’t go easy.', requires: 'cellar',
    reward: { pack: 'crimson', badge: 'highlandCup', title: 'Parlour Sharp' },
    rounds: [
      { opponents: ['vera', 'sage'],  difficulty: 'normal' },
      { opponents: ['duke', 'coral'], difficulty: 'normal' },
      { opponents: ['nyx', 'pip'],    difficulty: 'hard' },
    ],
  },
  {
    id: 'apex', name: 'The Highrise', venue: 'penthouse', boss: 'coral',
    blurb: 'Marble, glass, and very expensive silence.', requires: 'highland',
    reward: { pack: 'royal', badge: 'apexCup', title: 'Highrise Ace' },
    rounds: [
      { opponents: ['duke', 'vera'], difficulty: 'hard' },
      { opponents: ['pip', 'nyx'],   difficulty: 'hard' },
      { opponents: ['rex', 'coral'], difficulty: 'hard' },
    ],
  },
  {
    id: 'vault', name: 'The Vault', venue: 'vault', boss: 'nyx',
    blurb: 'Invitation only. The house keeps its best behind steel.', requires: 'apex',
    reward: { pack: 'neon', badge: 'vaultCup', title: 'Vault Breaker' },
    rounds: [
      { opponents: ['coral', 'vera'], difficulty: 'hard' },
      { opponents: ['rex', 'duke'],   difficulty: 'hard' },
      { opponents: ['pip', 'nyx'],    difficulty: 'hard' },
    ],
  },
  {
    id: 'masters', name: 'The Masters', venue: 'gala', boss: 'rex',
    blurb: 'Red velvet and gold. The champion is waiting.', requires: 'vault',
    reward: { pack: 'gilded', badge: 'mastersCup', title: 'Grand Master' },
    rounds: [
      { opponents: ['coral', 'nyx'],   difficulty: 'hard' },
      { opponents: ['vera', 'vesper'], difficulty: 'hard' },
      { opponents: ['pip', 'rex'],     difficulty: 'hard' },
    ],
  },
];

export const TOURNAMENTS_KEY = 'euchre.tournaments.v1';
const PRESTIGE_KEY = '__prestige';

export function tournamentById(id) {
  return TOURNAMENTS.find((t) => t.id === id) || null;
}

// ─── progress (pure) ───

export function progressFor(store, id) {
  return store[id] || { cleared: 0, done: false };
}

// Next round index to play (== rounds cleared). Equals rounds.length when done.
export function currentRound(store, id) {
  return progressFor(store, id).cleared;
}

export function isTournamentUnlocked(tour, store) {
  if (!tour.requires) return true;
  return !!progressFor(store, tour.requires).done;
}

export function allTournamentsComplete(store) {
  return TOURNAMENTS.every((tour) => progressFor(store, tour.id).done);
}

export function prestigeFor(store) {
  const raw = store[PRESTIGE_KEY] || {};
  return {
    level: Number(raw.level) || 0,
    completed: Number(raw.completed) || 0,
    active: !!raw.active,
  };
}

export function canStartPrestigeSeason(store) {
  const prestige = prestigeFor(store);
  return !prestige.active && allTournamentsComplete(store);
}

export function beginPrestigeSeason(store) {
  if (!canStartPrestigeSeason(store)) {
    return { ...prestigeFor(store), started: false };
  }
  const current = prestigeFor(store);
  for (const tour of TOURNAMENTS) delete store[tour.id];
  const next = {
    level: current.completed + 1,
    completed: current.completed,
    active: true,
  };
  store[PRESTIGE_KEY] = next;
  return { ...next, started: true };
}

export function completePrestigeSeason(store) {
  const prestige = prestigeFor(store);
  if (!prestige.active || !allTournamentsComplete(store)) {
    return { ...prestige, justCompleted: false };
  }
  const next = {
    level: prestige.level,
    completed: Math.max(prestige.completed, prestige.level),
    active: false,
  };
  store[PRESTIGE_KEY] = next;
  return { ...next, justCompleted: true };
}

export function prestigeLabel(level) {
  if (!level) return 'Prestige';
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return `Prestige ${numerals[level - 1] || level}`;
}

// Record a round win. Returns { cleared, done, justCompleted }.
export function recordRoundWin(store, id, totalRounds) {
  const p = { ...progressFor(store, id) };
  const wasDone = p.done;
  p.cleared = Math.min(totalRounds, p.cleared + 1);
  p.done = p.cleared >= totalRounds;
  store[id] = p;
  return { cleared: p.cleared, done: p.done, justCompleted: p.done && !wasDone };
}

export function resetTournament(store, id) {
  delete store[id];
  return store;
}

// ─── persistence ───

export function loadTournaments() {
  try {
    return JSON.parse(localStorage.getItem(TOURNAMENTS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveTournaments(store) {
  try { localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(store)); } catch {}
  return store;
}
