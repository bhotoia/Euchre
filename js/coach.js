// coach.js — accurate move evaluation via Perfect-Information Monte-Carlo (PIMC).
//
// Euchre is an imperfect-information game, so a heuristic cannot reliably grade a
// move. Instead we sample many full deals consistent with what the player can
// actually know (cards played, void inferences, the turned card), play each one
// out with a strong policy, and average the resulting points per candidate move.
// Common random numbers (the same sampled world is reused across every candidate
// in a sample) make the ranking stable with far fewer samples.
//
// Pure module: no DOM. Safe to import in Node tests or a Web Worker.

import {
  makeDeck, SUITS, SUIT_SYMBOL, effectiveSuit, cardStrength,
  isTrump, isRightBower, isLeftBower,
} from './cards.js';
import {
  orderUp, discard, callTrump, pass, playCard, getLegalCards, TEAM_OF,
} from './engine.js';
import { aiBid, aiDiscard, rolloutPolicy } from './ai.js';

// ─── rng ───
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECK = makeDeck();
const CARD_BY_ID = new Map(DECK.map((c) => [c.id, c]));
const clone = (s) => (typeof structuredClone === 'function' ? structuredClone(s) : JSON.parse(JSON.stringify(s)));

// ─── determinization ───

// Cards the hero cannot see: full deck minus their hand, minus everything played,
// minus the up-card. The up-card is handled separately: during bidding it sits on
// the kitty (belongs to nobody); after a round-1 order-up it is pinned into the
// dealer's hand (see sampleWorld). Either way it must never be randomly dealt.
function unknownPool(state, heroSeat) {
  const seen = new Set();
  for (const c of state.hands[heroSeat]) seen.add(c.id);
  for (const tk of state.completedTricks) for (const p of tk.plays) seen.add(p.card.id);
  for (const p of state.trickPile) seen.add(p.card.id);
  if (state.upCard) seen.add(state.upCard.id);
  return DECK.filter((c) => !seen.has(c.id));
}

// True when the up-card was ordered up in round 1 and is therefore in the dealer's
// hand (trump suit equals the up-card's suit). A round-2 call turns it down (dead).
function upCardWithDealer(state) {
  return state.maker !== null && state.upCard != null
    && state.trump === state.upCard.suit;
}

// Deal the unknown cards to the non-hero seats, matching each seat's current hand
// size and respecting known voids. Leftover cards are "dead" (kitty/discard) and
// simply go unassigned. Returns a fresh 4-seat hands array (hero keeps real hand).
function sampleWorld(state, heroSeat, rng) {
  const trump = state.trump;
  const pool = unknownPool(state, heroSeat);

  const seats = [0, 1, 2, 3].filter((s) => s !== heroSeat);
  const need = {};
  for (const s of seats) need[s] = state.hands[s].length;

  // If the up-card was ordered up in round 1 and the dealer still holds it (hasn't
  // played it), the hero KNOWS the dealer has that card — pin it before dealing.
  const seenPlayed = new Set();
  for (const tk of state.completedTricks) for (const p of tk.plays) seenPlayed.add(p.card.id);
  for (const p of state.trickPile) seenPlayed.add(p.card.id);
  let pinSeat = -1, pinCard = null;
  if (upCardWithDealer(state) && state.dealer !== heroSeat
      && need[state.dealer] > 0 && !seenPlayed.has(state.upCard.id)
      && !(state.voids[state.dealer] || []).includes(effectiveSuit(state.upCard, trump))) {
    pinSeat = state.dealer;
    pinCard = CARD_BY_ID.get(state.upCard.id) || state.upCard;
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const remaining = coachShuffle(pool, rng);
    const hands = [[], [], [], []];
    hands[heroSeat] = state.hands[heroSeat].slice();
    const want = { ...need };
    let ok = true;

    // place the pinned up-card first (it is not in the pool)
    if (pinSeat >= 0) { hands[pinSeat].push({ ...pinCard }); want[pinSeat]--; }

    // greedily fill the rest, hardest-constrained seats first
    const order = seats.slice().sort((a, b) => (state.voids[b]?.length || 0) - (state.voids[a]?.length || 0));
    for (const s of order) {
      const voids = state.voids[s] || [];
      while (want[s] > 0) {
        const idx = remaining.findIndex((c) => !voids.includes(effectiveSuit(c, trump)));
        if (idx < 0) { ok = false; break; }
        hands[s].push(remaining.splice(idx, 1)[0]);
        want[s]--;
      }
      if (!ok) break;
    }
    if (ok) return hands;
  }

  // constraints unsatisfiable (extremely rare) — fall back to ignoring voids
  const remaining = coachShuffle(pool, rng);
  const hands = [[], [], [], []];
  hands[heroSeat] = state.hands[heroSeat].slice();
  for (const s of seats) hands[s] = remaining.splice(0, need[s]);
  return hands;
}

function coachShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── playout ───

// Drive a cloned state to the end of the hand using strong policies for every
// seat, then return signed points from the hero team's perspective.
function playout(st, heroTeam) {
  let guard = 0;
  while (guard++ < 60) {
    switch (st.phase) {
      case 'bid1':
      case 'bid2': {
        const dec = aiBid(st, st.turn);
        coachApplyBid(st, st.turn, dec);
        break;
      }
      case 'discard':
        discard(st, aiDiscard(st));
        break;
      case 'play':
        playCard(st, st.turn, rolloutPolicy(st, st.turn));
        break;
      case 'redeal':
        return 0; // all passed — washed hand, no score
      default:
        return signedPoints(st, heroTeam);
    }
    if (st.phase === 'handEnd' || st.phase === 'gameEnd') return signedPoints(st, heroTeam);
  }
  return signedPoints(st, heroTeam);
}

function coachApplyBid(st, seat, dec) {
  if (dec.action === 'orderUp') orderUp(st, seat, dec.alone);
  else if (dec.action === 'callTrump') callTrump(st, seat, dec.suit, dec.alone);
  else pass(st, seat);
}

function signedPoints(st, heroTeam) {
  const r = st.lastResult;
  if (!r) return 0;
  return r.team === heroTeam ? r.points : -r.points;
}

// ─── public: evaluate a card play ───

export function coachPlay(state, heroSeat, chosenCard, opts = {}) {
  const samples = opts.samples ?? 200;
  const rng = opts.rng ?? mulberry32(opts.seed ?? 0xC0FFEE);
  const heroTeam = TEAM_OF(heroSeat);
  const legal = getLegalCards(state, heroSeat);

  const ev = new Map(legal.map((c) => [c.id, 0]));
  for (let n = 0; n < samples; n++) {
    const world = sampleWorld(state, heroSeat, rng); // common random numbers
    for (const cand of legal) {
      const st = clone(state);
      st.hands = world.map((h) => h.map((c) => ({ ...c })));
      const card = st.hands[heroSeat].find((c) => c.id === cand.id);
      playCard(st, heroSeat, card);
      ev.set(cand.id, ev.get(cand.id) + playout(st, heroTeam));
    }
  }
  for (const id of ev.keys()) ev.set(id, ev.get(id) / samples);

  const evByMove = legal.map((c) => ({ id: c.id, ev: ev.get(c.id) }))
    .sort((a, b) => b.ev - a.ev);
  const bestId = evByMove[0].id;
  const best = legal.find((c) => c.id === bestId);
  const bestEV = evByMove[0].ev;
  const chosenEV = ev.get(chosenCard.id) ?? bestEV;
  const delta = bestEV - chosenEV;
  const grade = gradeFor(delta, chosenCard.id === bestId);

  return {
    kind: 'play', best, bestEV, chosen: chosenCard, chosenEV, delta, grade,
    evByMove,
    explanation: explainPlay(state, heroSeat, chosenCard, best, delta, grade),
    lesson: lessonForPlay(state, heroSeat, chosenCard, best, delta, grade),
  };
}

// ─── public: evaluate a bid ───
// chosen = { action:'orderUp'|'callTrump'|'pass', suit?, alone? }

export function coachBid(state, heroSeat, chosen, opts = {}) {
  const samples = opts.samples ?? 140;
  const rng = opts.rng ?? mulberry32(opts.seed ?? 0xBEEF);
  const heroTeam = TEAM_OF(heroSeat);
  const candidates = bidCandidates(state, heroSeat);

  const ev = new Map(candidates.map((c) => [bidKey(c), 0]));
  for (let n = 0; n < samples; n++) {
    const world = sampleWorld(state, heroSeat, rng);
    for (const cand of candidates) {
      const st = clone(state);
      st.hands = world.map((h) => h.map((c) => ({ ...c })));
      coachApplyBid(st, heroSeat, cand);
      ev.set(bidKey(cand), ev.get(bidKey(cand)) + playout(st, heroTeam));
    }
  }
  for (const k of ev.keys()) ev.set(k, ev.get(k) / samples);

  const ranked = candidates.map((c) => ({ cand: c, key: bidKey(c), ev: ev.get(bidKey(c)) }))
    .sort((a, b) => b.ev - a.ev);
  const best = ranked[0];
  const chosenEV = ev.get(bidKey(chosen)) ?? best.ev;
  const delta = best.ev - chosenEV;
  const isBest = bidKey(chosen) === best.key;
  const grade = gradeFor(delta, isBest);

  return {
    kind: 'bid', best: best.cand, bestEV: best.ev, chosen, chosenEV, delta, grade,
    ranked,
    explanation: explainBid(state, heroSeat, chosen, best.cand, delta, grade),
    lesson: lessonForBid(state, heroSeat, chosen, best.cand, delta, grade),
  };
}

function bidCandidates(state, heroSeat) {
  if (state.phase === 'bid1') {
    return [{ action: 'pass' }, { action: 'orderUp', alone: false }, { action: 'orderUp', alone: true }];
  }
  // bid2: pass or call any suit other than the turned-down one
  const out = [{ action: 'pass' }];
  for (const suit of SUITS) {
    if (suit === state.upCard.suit) continue;
    out.push({ action: 'callTrump', suit, alone: false });
    out.push({ action: 'callTrump', suit, alone: true });
  }
  return out;
}

const bidKey = (c) => `${c.action}:${c.suit || ''}:${c.alone ? 'A' : ''}`;

// ─── grading ───

const BANDS = [
  { max: 0.10, grade: 'optimal' },
  { max: 0.35, grade: 'good' },
  { max: 0.75, grade: 'inaccuracy' },
  { max: 1.50, grade: 'mistake' },
  { max: Infinity, grade: 'blunder' },
];

export function gradeFor(delta, isExactBest) {
  if (isExactBest) return 'optimal';
  for (const b of BANDS) if (delta <= b.max) return b.grade;
  return 'blunder';
}

export const GRADE_LABEL = {
  optimal: 'Optimal', good: 'Good', inaccuracy: 'Inaccuracy',
  mistake: 'Mistake', blunder: 'Blunder',
};

// ─── card-counting: is `card` currently unbeatable for the led/own suit? ───
function coachIsBoss(card, state, heroSeat) {
  const trump = state.trump;
  const ledSuit = state.trickPile.length
    ? effectiveSuit(state.trickPile[0].card, trump)
    : effectiveSuit(card, trump);
  const myStr = cardStrength(card, trump, ledSuit);
  const seen = new Set();
  for (const tk of state.completedTricks) for (const p of tk.plays) seen.add(p.card.id);
  for (const p of state.trickPile) seen.add(p.card.id);
  const mine = new Set(state.hands[heroSeat].map((c) => c.id));
  for (const c of DECK) {
    if (c.id === card.id || seen.has(c.id) || mine.has(c.id)) continue;
    if (cardStrength(c, trump, ledSuit) > myStr) return false;
  }
  return true;
}

// ─── naming ───
export function cardName(card, trump) {
  let suffix = '';
  if (trump) {
    if (isRightBower(card, trump)) suffix = ' (right bower)';
    else if (isLeftBower(card, trump)) suffix = ' (left bower)';
  }
  return `${card.rank}${SUIT_SYMBOL[card.suit]}${suffix}`;
}

function evPhrase(delta) {
  if (delta <= 0.05) return '';
  return ` Worth about +${delta.toFixed(1)} expected points vs your card.`;
}

function costPhrase(delta) {
  if (delta <= 0.10) return 'Tiny edge';
  if (delta <= 0.35) return 'Small edge';
  if (delta <= 0.75) return 'Real leak';
  if (delta <= 1.50) return 'Costly leak';
  return 'Major leak';
}

// ─── explanation: card play ───

function explainPlay(state, seat, chosen, best, delta, grade) {
  const trump = state.trump;
  const plays = state.trickPile;
  const partner = (seat + 2) % 4;
  const leading = plays.length === 0;

  if (grade === 'optimal' || chosen.id === best.id) {
    return `${praise(grade)} ${reasonFor(state, seat, best, true)}`.trim();
  }

  const lead = best ? `Better: ${cardName(best, trump)}.` : '';
  const why = reasonFor(state, seat, best, false);
  return `${lead} ${why}${evPhrase(delta)}`.trim();
}

function praise() {
  return 'Best play.';
}

// Produce the dominant tactical reason that the recommended card is right.
function reasonFor(state, seat, card, isOwnChoice) {
  const trump = state.trump;
  const plays = state.trickPile;
  const partner = (seat + 2) % 4;
  const amMaker = TEAM_OF(seat) === state.maker;

  if (plays.length === 0) {
    // leading
    if (isTrump(card, trump) && amMaker) {
      return 'As the maker, leading high trump draws out the opponents’ trump so your other winners survive.';
    }
    if (!isTrump(card, trump) && card.rank === 'A') {
      return 'Cash your off-suit ace now, before someone can trump it.';
    }
    if (coachIsBoss(card, state, seat)) {
      return 'This card can’t be beaten right now — lead it and take a guaranteed trick.';
    }
    return 'Lead low and hold your strength for a trick you can actually win.';
  }

  // following
  const ledSuit = effectiveSuit(plays[0].card, trump);
  let winSeat = plays[0].seat, winStr = cardStrength(plays[0].card, trump, ledSuit);
  for (const p of plays) {
    const s = cardStrength(p.card, trump, ledSuit);
    if (s > winStr) { winStr = s; winSeat = p.seat; }
  }
  const partnerWinning = winSeat === partner;
  const cardWins = cardStrength(card, trump, ledSuit) > winStr;

  if (partnerWinning && !cardWins) {
    return 'Your partner already holds the trick — throw off your weakest card instead of wasting a winner.';
  }
  if (cardWins && coachIsBoss(card, state, seat)) {
    return 'That card is unbeatable here — take the trick while you safely can.';
  }
  if (plays.length === 1 && !cardWins) {
    return 'Second hand low: don’t spend a high card before the players behind you commit.';
  }
  if (plays.length === 2 && cardWins) {
    return 'Third hand high: play high to win the trick or force out a trump.';
  }
  if (!cardWins) {
    return 'You can’t win this cheaply — duck and keep your strong card for a trick you can take.';
  }
  return 'Win it as cheaply as possible and keep your bigger cards in reserve.';
}

// ─── explanation: bid ───

function lesson(topic, principle, drill, delta, grade) {
  return {
    topic,
    principle,
    drill,
    cost: costPhrase(delta),
    grade,
  };
}

function lessonForPlay(state, seat, chosen, best, delta, grade) {
  const trump = state.trump;
  const plays = state.trickPile;
  const partner = (seat + 2) % 4;
  const amMaker = TEAM_OF(seat) === state.maker;
  const card = best || chosen;

  if (plays.length === 0) {
    if (isTrump(card, trump) && amMaker) {
      return lesson(
        'Trump control',
        'When you make trump, your first job is often to pull enemy trump before they can ruin your side-suit winners.',
        'Before leading, ask: “Am I maker, and can high trump strip their stoppers?”',
        delta, grade,
      );
    }
    if (!isTrump(card, trump) && card.rank === 'A') {
      return lesson(
        'Cash timing',
        'Off-suit aces are strongest before opponents get void and start trumping in.',
        'When on lead, scan for naked aces you should cash before playing slow cards.',
        delta, grade,
      );
    }
    if (coachIsBoss(card, state, seat)) {
      return lesson(
        'Guaranteed tricks',
        'Boss cards convert uncertainty into points; take sure tricks before the table changes.',
        'Mark the current boss card in every suit, then lead it when tempo matters.',
        delta, grade,
      );
    }
    return lesson(
      'Tempo conservation',
      'Not every lead should fight for the trick; sometimes the master move is keeping ammunition for later.',
      'If you cannot lead a winner, lead low and preserve trump or aces for a decisive trick.',
      delta, grade,
    );
  }

  const ledSuit = effectiveSuit(plays[0].card, trump);
  let winSeat = plays[0].seat, winStr = cardStrength(plays[0].card, trump, ledSuit);
  for (const p of plays) {
    const s = cardStrength(p.card, trump, ledSuit);
    if (s > winStr) { winStr = s; winSeat = p.seat; }
  }
  const partnerWinning = winSeat === partner;
  const cardWins = cardStrength(card, trump, ledSuit) > winStr;

  if (partnerWinning && !cardWins) {
    return lesson(
      'Partner trust',
      'A master does not spend strength to “help” a partner who is already winning.',
      'When partner is high, throw your weakest legal card unless you can secure a clear extra point later.',
      delta, grade,
    );
  }
  if (cardWins && coachIsBoss(card, state, seat)) {
    return lesson(
      'Secure the trick',
      'When your card is unbeatable in the current trick, taking control is usually worth more than saving style points.',
      'Before ducking, ask whether your winning card can actually be beaten here.',
      delta, grade,
    );
  }
  if (plays.length === 1 && !cardWins) {
    return lesson(
      'Second hand low',
      'Second seat usually waits; spending high before two players act often gives away control.',
      'In second seat, default low unless you can win cheaply or must stop a march.',
      delta, grade,
    );
  }
  if (plays.length === 2 && cardWins) {
    return lesson(
      'Third hand high',
      'Third seat is where you protect partner’s lead and force the last player to pay.',
      'When third to act, play high if it wins or forces trump from the final hand.',
      delta, grade,
    );
  }
  if (!cardWins) {
    return lesson(
      'Ducking discipline',
      'Throwing good cards into lost tricks is how competent players leak points.',
      'If you cannot win cheaply, dump the least useful legal card and save winners for later.',
      delta, grade,
    );
  }
  return lesson(
    'Win cheaply',
    'Masters win the trick with the smallest card that does the job.',
    'Compare your legal winners and spend the lowest one that still takes control.',
    delta, grade,
  );
}

function explainBid(state, seat, chosen, best, delta, grade) {
  if (grade === 'optimal' || bidKey(chosen) === bidKey(best)) {
    return `Best call. ${bidReason(state, best)}`.trim();
  }
  if (sameTrumpChoice(chosen, best)) {
    return `${aloneCorrection(chosen, best)} ${bidReason(state, best)}${evPhrase(delta)}`.trim();
  }
  return `Better: ${bidLabel(best)}. ${bidReason(state, best)}${evPhrase(delta)}`.trim();
}

function bidLabel(b) {
  if (b.action === 'pass') return 'pass';
  if (b.action === 'orderUp') return b.alone ? 'order it up alone' : 'order it up with your partner';
  return `${b.alone ? 'go alone on ' : 'call '}${SUIT_SYMBOL[b.suit]}${b.alone ? '' : ' with your partner'}`;
}

function sameTrumpChoice(a, b) {
  if (!a || !b || a.action !== b.action) return false;
  if (a.action === 'orderUp') return true;
  if (a.action === 'callTrump') return a.suit === b.suit;
  return false;
}

function aloneCorrection(chosen, best) {
  if (best.alone && !chosen.alone) return `Right trump, but stronger: ${bidLabel(best)}.`;
  if (!best.alone && chosen.alone) return `Right trump, but bring your partner: ${bidLabel(best)}.`;
  return `Right idea, cleaner version: ${bidLabel(best)}.`;
}

function bidReason(state, best) {
  if (best.action === 'pass') return 'Your hand isn’t strong enough to make trump here — let it go.';
  if (best.alone) return 'Your hand is strong enough to win 5 tricks without your partner — go for the bonus.';
  return 'You have enough trump strength to make this your trump and take three tricks.';
}

function lessonForBid(state, seat, chosen, best, delta, grade) {
  if (best.action === 'pass') {
    return lesson(
      'Trump discipline',
      'Passing marginal hands is a weapon: it avoids donating euchres and preserves better trump chances.',
      'Before ordering, count sure tricks first; if you cannot see three, let the hand breathe.',
      delta, grade,
    );
  }
  if (best.alone) {
    return lesson(
      'Lone-hand judgment',
      'Going alone is not bravado; it is math when your hand can reasonably sweep five tricks.',
      'Look for right bower plus support, outside aces, and control of the first lead.',
      delta, grade,
    );
  }
  const feedingPartner = best.action === 'orderUp' && state.dealer !== seat && TEAM_OF(state.dealer) === TEAM_OF(seat);
  return lesson(
    feedingPartner ? 'Feed your partner' : 'Make trump with purpose',
    feedingPartner
      ? 'Ordering your partner up can upgrade their hand and give your team control immediately.'
      : 'Calling trump is about expected tricks, not liking a suit.',
    feedingPartner
      ? 'When partner deals, value the up-card as a team asset, not just as your hand.'
      : 'Count trump length, bowers, aces, and lead position before making trump.',
    delta, grade,
  );
}
