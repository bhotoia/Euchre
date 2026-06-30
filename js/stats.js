// stats.js — persistent player stats, ranks, and badges. Pure helpers + a thin
// localStorage wrapper so the logic stays unit-testable without a DOM.

export const STATS_KEY = 'euchre.stats.v1';

export function defaultStats() {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    handsPlayed: 0,
    handsWon: 0,        // hands your team scored on
    pointsFor: 0,
    pointsAgainst: 0,
    euchresDealt: 0,    // you euchred the makers
    euchresReceived: 0, // makers euchred = you failed your own call
    marches: 0,         // your team swept all 5
    aloneWins: 0,       // your team scored going alone
    currentStreak: 0,   // consecutive game wins
    longestStreak: 0,
    coachGraded: 0,     // training moves the coach evaluated
    coachOptimal: 0,    // of those, how many were optimal/best
    cupsWon: 0,
    prestigeCupWins: 0,
    prestigeSeasonsWon: 0,
    badges: {},         // id -> unlocked (true)
  };
}

// ─── pure recorders (mutate + return the same object) ───

// Record a finished hand from the engine's lastResult, from YOUR team's view
// (team 0 = You + Partner). `result` = state.lastResult; `alone` = state.alone.
export function recordHand(s, result, alone = false) {
  if (!result) return s;
  s.handsPlayed += 1;
  const youScored = result.team === 0;
  if (youScored) {
    s.handsWon += 1;
    s.pointsFor += result.points;
  } else {
    s.pointsAgainst += result.points;
  }
  // maker team 0 = you called it. euchre kind means makers failed.
  const youMade = result.makerTeam === 0;
  if (result.kind === 'euchre') {
    if (youMade) s.euchresReceived += 1; else s.euchresDealt += 1;
  }
  if ((result.kind === 'march' || result.kind === 'alone-march') && youScored) s.marches += 1;
  if (alone && youScored && result.makerTeam === 0) s.aloneWins += 1;
  return s;
}

export function recordGame(s, won) {
  s.gamesPlayed += 1;
  if (won) {
    s.gamesWon += 1;
    s.currentStreak += 1;
    if (s.currentStreak > s.longestStreak) s.longestStreak = s.currentStreak;
  } else {
    s.currentStreak = 0;
  }
  return s;
}

export function recordCoachMove(s, isOptimal) {
  s.coachGraded += 1;
  if (isOptimal) s.coachOptimal += 1;
  evaluateAchievements(s);
  return s;
}

// Record one displayed result into the shared career ledger. `gameOver` means
// this hand also ended the game; callers should invoke this once per result
// screen. This keeps the deciding hand from being skipped.
export function recordOutcome(s, {
  result = null, alone = false, gameOver = false, won = false, difficulty = 'normal',
} = {}) {
  if (result) {
    recordHand(s, result, alone);
    if ((result.kind === 'march' || result.kind === 'alone-march') && result.team === 0) unlockBadge(s, 'firstMarch');
    if (alone && result.team === 0 && result.makerTeam === 0) unlockBadge(s, 'firstAlone');
    if (result.kind === 'euchre' && result.makerTeam === 1 && difficulty === 'hard') unlockBadge(s, 'euchreHard');
  }
  if (gameOver) {
    recordGame(s, won);
    if (won) unlockBadge(s, 'firstWin');
    if (s.currentStreak >= 3) unlockBadge(s, 'streak3');
  }
  evaluateAchievements(s);
  return s;
}

export function recordTournamentCup(s, { prestige = false, seasonComplete = false } = {}) {
  s.cupsWon = (s.cupsWon || 0) + 1;
  if (prestige) s.prestigeCupWins = (s.prestigeCupWins || 0) + 1;
  if (seasonComplete) s.prestigeSeasonsWon = (s.prestigeSeasonsWon || 0) + 1;
  evaluateAchievements(s);
  return s;
}

export function unlockBadge(s, id) {
  if (!s.badges[id]) { s.badges[id] = true; return true; } // returns true if newly unlocked
  return false;
}

export function evaluateAchievements(s) {
  if (s.gamesPlayed >= 10) unlockBadge(s, 'games10');
  if (s.gamesPlayed >= 50) unlockBadge(s, 'games50');
  if (s.gamesPlayed >= 250) unlockBadge(s, 'games250');
  if (s.gamesWon >= 10) unlockBadge(s, 'wins10');
  if (s.gamesWon >= 25) unlockBadge(s, 'wins25');
  if (s.gamesWon >= 100) unlockBadge(s, 'wins100');
  if (s.gamesWon >= 250) unlockBadge(s, 'wins250');
  if (s.handsPlayed >= 50) unlockBadge(s, 'hands50');
  if (s.handsPlayed >= 250) unlockBadge(s, 'hands250');
  if (s.handsPlayed >= 1000) unlockBadge(s, 'hands1000');
  if (s.pointsFor >= 100) unlockBadge(s, 'points100');
  if (s.pointsFor >= 500) unlockBadge(s, 'points500');
  if (s.pointsFor >= 2000) unlockBadge(s, 'points2000');
  if (s.euchresDealt >= 10) unlockBadge(s, 'euchres10');
  if (s.euchresDealt >= 50) unlockBadge(s, 'euchres50');
  if (s.euchresDealt >= 200) unlockBadge(s, 'euchres200');
  if (s.marches >= 10) unlockBadge(s, 'marches10');
  if (s.marches >= 50) unlockBadge(s, 'marches50');
  if (s.aloneWins >= 5) unlockBadge(s, 'alone5');
  if (s.aloneWins >= 25) unlockBadge(s, 'alone25');
  if (s.currentStreak >= 5) unlockBadge(s, 'streak5');
  if (s.currentStreak >= 10) unlockBadge(s, 'streak10');
  if (s.currentStreak >= 25) unlockBadge(s, 'streak25');
  if (s.coachGraded >= 100 && coachAccuracy(s) >= 0.85) unlockBadge(s, 'coach100');
  if (s.coachGraded >= 500 && coachAccuracy(s) >= 0.9) unlockBadge(s, 'coach500');
  if ((s.cupsWon || 0) >= 5) unlockBadge(s, 'allCups');
  if ((s.prestigeCupWins || 0) >= 1) unlockBadge(s, 'prestigeCup');
  if ((s.prestigeCupWins || 0) >= 25) unlockBadge(s, 'prestigeCup25');
  if ((s.prestigeSeasonsWon || 0) >= 1) unlockBadge(s, 'prestige1');
  if ((s.prestigeSeasonsWon || 0) >= 3) unlockBadge(s, 'prestige3');
  if ((s.prestigeSeasonsWon || 0) >= 5) unlockBadge(s, 'prestige5');
  if ((s.prestigeSeasonsWon || 0) >= 10) unlockBadge(s, 'prestige10');
  return s;
}

// ─── derived ───

export function winRate(s) {
  return s.gamesPlayed ? s.gamesWon / s.gamesPlayed : 0;
}

export function coachAccuracy(s) {
  return s.coachGraded ? s.coachOptimal / s.coachGraded : 0;
}

const RANK_TIERS = [
  { id: 'novice', name: 'Novice', minWins: 0 },
  { id: 'sharp',  name: 'Sharp',  minWins: 5 },
  { id: 'shark',  name: 'Shark',  minWins: 20 },
  { id: 'master', name: 'Master', minWins: 50 },
];

// rank by games won, but promotion to Master also needs strong coach accuracy
export function rankFor(s) {
  let rank = RANK_TIERS[0];
  for (const r of RANK_TIERS) {
    if (s.gamesWon >= r.minWins) rank = r;
  }
  if (rank.id === 'master' && s.coachGraded >= 50 && coachAccuracy(s) < 0.7) {
    return RANK_TIERS[2]; // hold at Shark until accuracy proves out
  }
  return rank;
}

export const BADGES = {
  firstWin:    { name: 'First Win',     desc: 'Win your first game' },
  firstMarch:  { name: 'Sweeper',       desc: 'Score a march (all 5 tricks)' },
  firstAlone:  { name: 'Lone Wolf',     desc: 'Win a hand going alone' },
  euchreHard:  { name: 'Giant Slayer',  desc: 'Euchre the Hard AI' },
  streak3:     { name: 'On a Roll',     desc: 'Win 3 games in a row' },
  sharpEye:    { name: 'Sharp Eye',     desc: '90% coach accuracy over 20+ moves' },
  games10:     { name: 'Table Regular', desc: 'Play 10 games' },
  games50:     { name: 'Felt Familiar', desc: 'Play 50 games' },
  games250:    { name: 'House Fixture', desc: 'Play 250 games' },
  wins10:      { name: 'Ten Taker',     desc: 'Win 10 games' },
  wins25:      { name: 'Cold Streak',   desc: 'Win 25 games' },
  wins100:     { name: 'Centurion',     desc: 'Win 100 games' },
  wins250:     { name: 'End Boss',      desc: 'Win 250 games' },
  hands50:     { name: 'Card Sharp',    desc: 'Play 50 hands' },
  hands250:    { name: 'Table Weather', desc: 'Play 250 hands' },
  hands1000:   { name: 'Felt Immortal', desc: 'Play 1,000 hands' },
  points100:   { name: 'Scorekeeper',   desc: 'Score 100 career points' },
  points500:   { name: 'Point Storm',   desc: 'Score 500 career points' },
  points2000:  { name: 'Ledger Breaker', desc: 'Score 2,000 career points' },
  euchres10:   { name: 'Trap Setter',   desc: 'Deal 10 euchres' },
  euchres50:   { name: 'No Escape',     desc: 'Deal 50 euchres' },
  euchres200:  { name: 'Bower Reaper',  desc: 'Deal 200 euchres' },
  marches10:   { name: 'Broom Closet',  desc: 'Score 10 marches' },
  marches50:   { name: 'Clean Sweep',   desc: 'Score 50 marches' },
  alone5:      { name: 'Solo Artist',   desc: 'Win 5 lone hands' },
  alone25:     { name: 'Table for One', desc: 'Win 25 lone hands' },
  streak5:     { name: 'Heat Check',    desc: 'Win 5 games in a row' },
  streak10:    { name: 'Untouchable',   desc: 'Win 10 games in a row' },
  streak25:    { name: 'Myth Run',      desc: 'Win 25 games in a row' },
  coach100:    { name: 'Lesson Learned', desc: '85% coach accuracy over 100+ moves' },
  coach500:    { name: 'Master Student', desc: '90% coach accuracy over 500+ moves' },
  cellarCup:   { name: 'Cellar Champ',  desc: 'Win The Cellar' },
  highlandCup: { name: 'Parlour Sharp', desc: 'Win The Parlour' },
  apexCup:     { name: 'Highrise Ace',  desc: 'Win The Highrise' },
  vaultCup:    { name: 'Vault Breaker', desc: 'Win The Vault' },
  mastersCup:  { name: 'Grand Master',  desc: 'Win The Masters' },
  allCups:     { name: 'Crown Claimed', desc: 'Win all five cups' },
  rivalSweep:  { name: 'Nemesis Sweep', desc: 'Beat every rival' },
  prestigeCup: { name: 'Again, Then',   desc: 'Win a cup in Prestige' },
  prestigeCup25: { name: 'Cup Collector', desc: 'Win 25 Prestige cups' },
  prestige1:   { name: 'Prestige I',    desc: 'Complete a Prestige season' },
  prestige3:   { name: 'Prestige III',  desc: 'Complete 3 Prestige seasons' },
  prestige5:   { name: 'Prestige V',    desc: 'Complete 5 Prestige seasons' },
  prestige10:  { name: 'Prestige X',    desc: 'Complete 10 Prestige seasons' },
  wink:        { name: 'Table Whisper', desc: 'Find a hidden table trick', hidden: true },
  moon:        { name: 'Moonlit Bower', desc: 'Find a hidden table trick', hidden: true },
  drawer:      { name: 'Dealer’s Drawer', desc: 'Find a hidden table trick', hidden: true },
  polish:      { name: 'Fresh Felt', desc: 'Find a hidden table trick', hidden: true },
  oracle:      { name: 'Dealer’s Tell', desc: 'Find a hidden table trick', hidden: true },
  cut:         { name: 'Clean Cut', desc: 'Find a hidden table trick', hidden: true },
};

// ─── persistence ───

export function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return { ...defaultStats(), ...raw, badges: { ...(raw.badges || {}) } };
  } catch {
    return defaultStats();
  }
}

export function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  return s;
}
