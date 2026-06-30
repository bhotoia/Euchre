// ai.js — difficulty-aware bidding + card play.
//   easy   — timid bidding, often plays a random legal card
//   normal — solid heuristics: win cheaply, lead trump/aces
//   hard   — positional play (2nd hand low / 3rd hand high / win-when-boss),
//            lightweight card-counting to know when a card is unbeatable

import {
  makeDeck, isTrump, isRightBower, isLeftBower, effectiveSuit, cardStrength, SUITS,
} from './cards.js';
import { TEAM_OF, getLegalCards } from './engine.js';

const BASE = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6 };
const FULL_DECK = makeDeck();

const THRESH = {
  // Tuned so round 1 isn't always ordered up: roughly r1/r2/pass-out =
  //   easy 53/38/9, normal 69/27/4, hard 80/18/2 (hard bids most aggressively).
  // `call` (round 2) is higher than `order` because you pick your best suit there,
  // so it must clear a real bar or trump never gets passed out. `pen` = how much a
  // non-dealer's team discounts handing trump to the opposing dealer.
  // `alone` kept high so AI only goes alone on a near-unbeatable hand (it benches a player).
  easy:   { order: 15.5, call: 16.5, alone: 23.0, pen: 3.0 },
  normal: { order: 14.0, call: 15.5, alone: 20.0, pen: 3.0 },
  hard:   { order: 13.0, call: 15.0, alone: 18.0, pen: 2.5 },
};

// Per-character play styles. Optional — when omitted, behavior is unchanged
// (so the coach's rollouts and casual play are identical to before).
//   bidDelta : added to order/call thresholds (negative = bids more)
//   bid : optional fixed bidding difficulty, independent of match difficulty
//   aloneDelta : added to the alone threshold
//   play : force a play strength ('hard'/'normal') regardless of difficulty
//   lead : 'trump' (lead high trump), 'random' (sometimes random), else default
//   wild : chance to take a random legal lead (bluffer)
export const STYLES = {
  aggressor: { bidDelta: -2.5, aloneDelta: -3, play: 'hard', lead: 'trump' },
  punisher:  { bidDelta: 0,    aloneDelta: 0,  play: 'hard' },
  grinder:   { bidDelta: 2.0,  aloneDelta: 2,  play: 'normal', lead: 'safe' },
  bluffer:   { bidDelta: -1.5, aloneDelta: 1,  play: 'normal', lead: 'random', wild: 0.3 },

  // Recruitable ally profiles. These deliberately vary bidding appetite,
  // willingness to go alone, and lead strategy so partner choice changes play.
  allyBalanced:   { bid: 'normal', bidDelta: 0,    aloneDelta: 2,  play: 'normal' },
  allyPatient:    { bid: 'normal', bidDelta: 1.0,  aloneDelta: 5,  play: 'hard',   lead: 'safe' },
  allyBold:       { bid: 'normal', bidDelta: -2.0, aloneDelta: -2, play: 'hard',   lead: 'trump' },
  allyPressure:   { bid: 'normal', bidDelta: -1.0, aloneDelta: 2,  play: 'hard',   lead: 'trump' },
  allyTricky:     { bid: 'normal', bidDelta: -0.5, aloneDelta: 1,  play: 'normal', lead: 'random', wild: 0.16 },
  allyCounter:    { bid: 'normal', bidDelta: 0.5,  aloneDelta: 3,  play: 'hard' },
  allyLoneWolf:   { bid: 'normal', bidDelta: -1.5, aloneDelta: -5, play: 'hard',   lead: 'trump' },
  allySurgical:   { bid: 'normal', bidDelta: 1.5,  aloneDelta: 4,  play: 'hard',   lead: 'safe' },
  allyConservative:{ bid: 'normal', bidDelta: 2.5, aloneDelta: 6,  play: 'normal', lead: 'safe' },
  allyWildcard:   { bid: 'normal', bidDelta: -1.0, aloneDelta: 0,  play: 'normal', lead: 'random', wild: 0.28 },
};

// strength of a hand if `trump` were trump (0..~25)
function handStrength(hand, trump) {
  let s = 0;
  for (const c of hand) {
    if (isRightBower(c, trump)) s += 8;
    else if (isLeftBower(c, trump)) s += 7;
    else if (c.suit === trump) s += 3 + BASE[c.rank] * 0.4;
    else if (c.rank === 'A') s += 1.5;
  }
  const suitsHeld = new Set(hand.map((c) => effectiveSuit(c, trump)));
  s += (4 - suitsHeld.size) * 1.2; // void bonus
  return s;
}

// ─── Bidding ───
export function aiBid(state, seat, diff = 'normal', style = null) {
  const sp = STYLES[style] || null;
  const base = THRESH[sp?.bid || diff] || THRESH.normal;
  const t = sp
    ? { order: base.order + sp.bidDelta, call: base.call + sp.bidDelta, alone: base.alone + sp.aloneDelta, pen: base.pen }
    : base;
  const hand = state.hands[seat];
  const isDealer = seat === state.dealer;

  if (state.phase === 'bid1') {
    const trump = state.upCard.suit;
    const evalHand = isDealer ? [...hand, state.upCard] : hand;
    let strength = handStrength(evalHand, trump);
    const dealerTeam = TEAM_OF(state.dealer);
    if (TEAM_OF(seat) !== dealerTeam) strength -= t.pen; // don't gift trump to opp dealer
    if (strength >= t.order) return { action: 'orderUp', alone: strength >= t.alone };
    return { action: 'pass' };
  }

  if (state.phase === 'bid2') {
    const turned = state.upCard.suit;
    let best = null;
    for (const suit of SUITS) {
      if (suit === turned) continue;
      const s = handStrength(hand, suit);
      if (!best || s > best.s) best = { suit, s };
    }
    if (best && best.s >= t.call) return { action: 'callTrump', suit: best.suit, alone: best.s >= t.alone };
    return { action: 'pass' };
  }
  return { action: 'pass' };
}

// dealer discards weakest card after ordering up
export function aiDiscard(state) {
  const trump = state.trump;
  return lowestSlough(state.hands[state.dealer], trump);
}

// ─── helpers ───

// lowest "throwaway": prefer non-trump, and prefer voiding a short suit
function lowestSlough(cards, trump) {
  const nonTrump = cards.filter((c) => !isTrump(c, trump));
  const pool = nonTrump.length ? nonTrump : cards;
  const freq = {};
  for (const c of pool) { const s = effectiveSuit(c, trump); freq[s] = (freq[s] || 0) + 1; }
  const val = (c) => {
    const s = effectiveSuit(c, trump);
    return cardStrength(c, trump, s) + (freq[s] === 1 ? -0.4 : 0); // nudge singletons out
  };
  return pool.slice().sort((a, b) => val(a) - val(b))[0];
}

function seenSet(state) {
  const s = new Set();
  for (const tk of state.completedTricks) for (const p of tk.plays) s.add(p.card.id);
  for (const p of state.trickPile) s.add(p.card.id);
  return s;
}

// is `card` unbeatable in the current trick context? (no unseen opponent card can top it)
function isBoss(card, state, seat) {
  const trump = state.trump;
  const ledSuit = state.trickPile.length
    ? effectiveSuit(state.trickPile[0].card, trump)
    : effectiveSuit(card, trump);
  const myStr = cardStrength(card, trump, ledSuit);
  const seen = seenSet(state);
  const mine = new Set(state.hands[seat].map((c) => c.id));
  for (const c of FULL_DECK) {
    if (c.id === card.id || seen.has(c.id) || mine.has(c.id)) continue;
    if (cardStrength(c, trump, ledSuit) > myStr) return false;
  }
  return true;
}

// ─── Card play ───
export function aiPlay(state, seat, diff = 'normal', style = null, rng = Math.random) {
  const trump = state.trump;
  const legal = getLegalCards(state, seat);
  if (legal.length === 1) return legal[0];

  const sp = STYLES[style] || null;
  const effDiff = sp?.play || diff;

  if (effDiff === 'easy') {
    // weak: mostly random among legal moves
    if (rng() < 0.6) return legal[Math.floor(rng() * legal.length)];
    return lowestSlough(legal, trump);
  }

  const plays = state.trickPile;
  const partner = (seat + 2) % 4;
  const byStrAsc = (a, b) =>
    cardStrength(a, trump, effectiveSuit(a, trump)) - cardStrength(b, trump, effectiveSuit(b, trump));

  // current winner of the in-progress trick
  let winningSeat = null, winningStr = -1;
  if (plays.length) {
    const ledSuit = effectiveSuit(plays[0].card, trump);
    for (const p of plays) {
      const s = cardStrength(p.card, trump, ledSuit);
      if (s > winningStr) { winningStr = s; winningSeat = p.seat; }
    }
  }

  // ── LEADING ──
  if (plays.length === 0) {
    const trumps = legal.filter((c) => isTrump(c, trump));
    const offAces = legal.filter((c) => !isTrump(c, trump) && c.rank === 'A');
    const nonTrump = legal.filter((c) => !isTrump(c, trump));
    const amMaker = TEAM_OF(seat) === state.maker;
    const highTrump = trumps.slice().sort((a, b) => cardStrength(b, trump, trump) - cardStrength(a, trump, trump))[0];

    // style-driven leads
    if (sp) {
      if (sp.wild && rng() < sp.wild) return legal[Math.floor(rng() * legal.length)];
      if (sp.lead === 'trump' && highTrump) return highTrump;       // aggressor hammers trump
      if (sp.lead === 'safe' && nonTrump.length) return lowestSlough(nonTrump, trump); // grinder hides
    }

    if (effDiff === 'hard') {
      // maker strips opponents of trump when holding the right bower or length
      if (amMaker && (trumps.some((c) => isRightBower(c, trump)) ? trumps.length >= 2 : trumps.length >= 3)) return highTrump;
      if (offAces.length) return offAces[0];
      if (nonTrump.length) return lowestSlough(nonTrump, trump);
      return trumps.sort(byStrAsc)[0];
    }
    // normal
    if (trumps.some((c) => isRightBower(c, trump)) && trumps.length >= 2) return highTrump;
    if (offAces.length) return offAces[0];
    if (nonTrump.length) return nonTrump.sort(byStrAsc)[0];
    return legal.sort(byStrAsc)[0];
  }

  // ── FOLLOWING ──
  const ledSuit = effectiveSuit(plays[0].card, trump);
  const partnerWinning = winningSeat === partner;
  const winners = legal
    .filter((c) => cardStrength(c, trump, ledSuit) > winningStr)
    .sort((a, b) => cardStrength(a, trump, ledSuit) - cardStrength(b, trump, ledSuit));

  if (partnerWinning) return lowestSlough(legal, trump); // never overtrump partner

  if (effDiff === 'hard') {
    const playersThisTrick = state.alone ? 3 : 4;
    const playersAfter = playersThisTrick - plays.length - 1;
    if (winners.length) {
      const cheapest = winners[0];
      if (playersAfter === 0 || isBoss(cheapest, state, seat)) return cheapest; // safe to take
      const bossWin = winners.find((c) => isBoss(c, state, seat));
      if (bossWin) return bossWin;                  // take only if guaranteed
      return lowestSlough(legal, trump);            // otherwise duck, preserve strength
    }
    return lowestSlough(legal, trump);
  }

  // normal: win as cheaply as possible, else throw lowest
  if (winners.length) return winners[0];
  return legal.sort(byStrAsc)[0];
}

// ─── shared rollout policy ───
// Side-effect-free strong card-play decision, reused by the AI and by the
// coach's Monte-Carlo playouts. Defaults to the strongest ('hard') heuristics.
export function rolloutPolicy(state, seat, diff = 'hard') {
  return aiPlay(state, seat, diff);
}
