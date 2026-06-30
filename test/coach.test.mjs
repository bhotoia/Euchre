import test from 'node:test';
import assert from 'node:assert/strict';

import { newGame } from '../js/engine.js';
import { coachPlay, coachBid, mulberry32 } from '../js/coach.js';

const C = (rank, suit) => ({ rank, suit, id: `${rank}-${suit}` });

// Build a play-phase state skeleton, then let the caller override specifics.
function playState(over) {
  return Object.assign(newGame(), {
    phase: 'play', dealer: 3, trump: 'hearts', maker: 0, makerSeat: 0,
    alone: false, sittingSeat: null, ledSuit: null, trickPile: [],
    voids: [[], [], [], []], tricksWon: [0, 0], completedTricks: [],
    upCard: C('A', 'spades'), // unused/dead for these positions
  }, over);
}

test('coach: leading the right bower as maker is endorsed (not a mistake)', () => {
  const S = playState({
    turn: 0,
    hands: [
      [C('J', 'hearts'), C('A', 'hearts'), C('K', 'spades'), C('9', 'diamonds'), C('9', 'clubs')],
      [C('9', 'spades'), C('10', 'spades'), C('Q', 'clubs'), C('K', 'clubs'), C('10', 'diamonds')],
      [C('Q', 'spades'), C('A', 'clubs'), C('Q', 'diamonds'), C('K', 'diamonds'), C('10', 'clubs')],
      [C('9', 'hearts'), C('10', 'hearts'), C('Q', 'hearts'), C('A', 'diamonds'), C('J', 'spades')],
    ],
  });
  // PIMC may rate an off-lead near-equal, but leading the right bower must never
  // be graded worse than a minor inaccuracy for a coach to be trustworthy.
  const res = coachPlay(S, 0, C('J', 'hearts'), { samples: 200, rng: mulberry32(1) });
  assert.ok(['optimal', 'good'].includes(res.grade), `right-bower lead graded ${res.grade} (delta ${res.delta.toFixed(2)})`);
});

test('coach: never overtrump your partner — slough instead', () => {
  // Partner (seat 2) is winning the trick with A♠. Hero (seat 0) is void in spades
  // and must choose between trumping (A♥) or sloughing (9♣). Keeping A♥ for the
  // next trick wins both tricks, so the slough is strictly better.
  const S = playState({
    turn: 0,
    trickPile: [
      { seat: 2, card: C('A', 'spades') },
      { seat: 3, card: C('10', 'spades') },
    ],
    ledSuit: 'spades',
    tricksWon: [2, 1],
    completedTricks: [
      { plays: [], winner: 0 }, { plays: [], winner: 2 }, { plays: [], winner: 1 },
    ],
    hands: [
      [C('A', 'hearts'), C('9', 'clubs')], // hero: trump winner vs junk
      [C('K', 'clubs'), C('Q', 'clubs')],
      [C('9', 'diamonds')],
      [C('9', 'hearts')],
    ],
  });
  const res = coachPlay(S, 0, C('A', 'hearts'), { samples: 240, rng: mulberry32(2) });
  assert.equal(res.best.id, '9-clubs', `expected slough, got ${res.best.id}`);
  assert.ok(res.delta > 0, 'overtrumping partner should grade worse than the slough');
  assert.equal(res.lesson.topic, 'Partner trust');
  assert.match(res.lesson.drill, /partner is high/i);
});

test('coach: throwing away the boss is a mistake (taking it is best)', () => {
  // Last-ish trick: hero holds the right bower (unbeatable) plus a loser. Leading
  // the boss to win must out-rank leading the loser.
  const S = playState({
    turn: 0,
    tricksWon: [2, 2],
    completedTricks: [
      { plays: [], winner: 0 }, { plays: [], winner: 1 },
      { plays: [], winner: 0 }, { plays: [], winner: 1 },
    ],
    hands: [
      [C('J', 'hearts'), C('9', 'clubs')], // right bower vs junk
      [C('A', 'clubs')],
      [C('K', 'clubs')],
      [C('Q', 'clubs')],
    ],
  });
  const res = coachPlay(S, 0, C('9', 'clubs'), { samples: 200, rng: mulberry32(3) });
  assert.equal(res.best.id, 'J-hearts', `expected boss lead, got ${res.best.id}`);
  assert.notEqual(res.grade, 'optimal');
});

test('coach: a strong hand should order up, not pass', () => {
  const S = Object.assign(newGame(), {
    phase: 'bid1', dealer: 2, turn: 0, maker: null, trump: null,
    voids: [[], [], [], []], completedTricks: [], trickPile: [], tricksWon: [0, 0],
    upCard: C('J', 'hearts'), // right bower turned up; dealer (partner) would get it
    hands: [
      [C('A', 'hearts'), C('K', 'hearts'), C('Q', 'hearts'), C('10', 'hearts'), C('A', 'spades')],
      [C('9', 'spades'), C('10', 'spades'), C('Q', 'clubs'), C('K', 'clubs'), C('9', 'clubs')],
      [C('Q', 'spades'), C('A', 'clubs'), C('Q', 'diamonds'), C('K', 'diamonds'), C('10', 'clubs')],
      [C('9', 'hearts'), C('K', 'spades'), C('A', 'diamonds'), C('9', 'diamonds'), C('10', 'diamonds')],
    ],
  });
  const res = coachBid(S, 0, { action: 'pass' }, { samples: 120, rng: mulberry32(4) });
  assert.equal(res.best.action, 'orderUp', `expected orderUp, got ${res.best.action}`);
  assert.ok(res.delta > 0, 'passing a strong hand should grade worse');
  assert.equal(res.lesson.topic, 'Feed your partner');
  assert.match(res.lesson.principle, /partner up/i);
});

test('coach: dealer picking up is not described as feeding partner', () => {
  const S = Object.assign(newGame(), {
    phase: 'bid1', dealer: 0, turn: 0, maker: null, trump: null,
    voids: [[], [], [], []], completedTricks: [], trickPile: [], tricksWon: [0, 0],
    upCard: C('J', 'hearts'),
    hands: [
      [C('A', 'hearts'), C('K', 'hearts'), C('Q', 'hearts'), C('10', 'hearts'), C('A', 'spades')],
      [C('9', 'spades'), C('10', 'spades'), C('Q', 'clubs'), C('K', 'clubs'), C('9', 'clubs')],
      [C('Q', 'spades'), C('A', 'clubs'), C('Q', 'diamonds'), C('K', 'diamonds'), C('10', 'clubs')],
      [C('9', 'hearts'), C('K', 'spades'), C('A', 'diamonds'), C('9', 'diamonds'), C('10', 'diamonds')],
    ],
  });
  const res = coachBid(S, 0, { action: 'pass' }, { samples: 120, rng: mulberry32(5) });
  assert.equal(res.best.action, 'orderUp');
  assert.notEqual(res.lesson.topic, 'Feed your partner');
  assert.doesNotMatch(res.lesson.principle, /partner up/i);
});

test('coach: same-suit bid corrections name alone vs partner, not the same suit again', () => {
  const S = Object.assign(newGame(), {
    phase: 'bid2', dealer: 3, turn: 0, maker: null, trump: null,
    voids: [[], [], [], []], completedTricks: [], trickPile: [], tricksWon: [0, 0],
    upCard: C('9', 'clubs'),
    hands: [
      [C('J', 'spades'), C('A', 'spades'), C('K', 'spades'), C('A', 'hearts'), C('9', 'diamonds')],
      [C('9', 'spades'), C('10', 'spades'), C('Q', 'clubs'), C('K', 'clubs'), C('9', 'hearts')],
      [C('Q', 'spades'), C('A', 'clubs'), C('Q', 'diamonds'), C('K', 'diamonds'), C('10', 'clubs')],
      [C('K', 'hearts'), C('10', 'hearts'), C('A', 'diamonds'), C('9', 'diamonds'), C('10', 'diamonds')],
    ],
  });
  const res = coachBid(S, 0, { action: 'callTrump', suit: 'spades', alone: true }, { samples: 120, rng: mulberry32(6) });
  if (res.best.action === 'callTrump' && res.best.suit === 'spades' && !res.best.alone) {
    assert.match(res.explanation, /Right trump, but bring your partner/i);
    assert.doesNotMatch(res.explanation, /^Better: call ♠\./);
  } else {
    assert.ok(res.explanation.length > 0);
  }
});
