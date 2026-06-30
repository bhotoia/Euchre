import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeDeck, sameColorSuit, isLeftBower, effectiveSuit, cardStrength,
  trickWinner, legalCards,
} from '../js/cards.js';
import {
  newGame, deal, orderUp, discard, callTrump, pass, playCard, getLegalCards,
  currentLedSuit,
} from '../js/engine.js';

function seeded(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

test('deck and bower rules are correct', () => {
  const deck = makeDeck();
  assert.equal(deck.length, 24);
  assert.equal(new Set(deck.map((card) => card.id)).size, 24);
  assert.equal(sameColorSuit('spades'), 'clubs');
  assert.equal(sameColorSuit('hearts'), 'diamonds');

  const left = { rank: 'J', suit: 'diamonds', id: 'J-diamonds' };
  assert.equal(isLeftBower(left, 'hearts'), true);
  assert.equal(effectiveSuit(left, 'hearts'), 'hearts');
  assert.equal(cardStrength(left, 'hearts', 'hearts'), 99);
});

test('left bower must follow trump, not its printed suit', () => {
  const left = { rank: 'J', suit: 'diamonds', id: 'J-diamonds' };
  const aceDiamonds = { rank: 'A', suit: 'diamonds', id: 'A-diamonds' };
  const hand = [left, aceDiamonds, { rank: '9', suit: 'clubs', id: '9-clubs' }];
  assert.deepEqual(legalCards(hand, 'diamonds', 'hearts').map((card) => card.id), ['A-diamonds']);
  assert.deepEqual(legalCards(hand, 'hearts', 'hearts').map((card) => card.id), ['J-diamonds']);
});

test('deal is deterministic when supplied a seeded random source', () => {
  const first = newGame();
  const second = newGame();
  deal(first, seeded(42));
  deal(second, seeded(42));
  assert.deepEqual(first.hands, second.hands);
  assert.equal(first.hands.flat().length, 20);
  assert.equal(first.kitty.length, 4);
});

test('deal resets the persisted result-stats guard for the new hand', () => {
  const state = newGame();
  state.resultStatsRecorded = true;
  deal(state, seeded(9));
  assert.equal(state.resultStatsRecorded, false);
});

test('bidding advances through both rounds and redeals', () => {
  const state = newGame();
  deal(state, seeded(7));
  for (let i = 0; i < 4; i++) pass(state);
  assert.equal(state.phase, 'bid2');
  for (let i = 0; i < 4; i++) pass(state);
  assert.equal(state.phase, 'redeal');
});

test('engine rejects out-of-turn and illegal actions', () => {
  const state = newGame();
  deal(state, seeded(12));
  assert.throws(() => orderUp(state, (state.turn + 1) % 4), /out of turn/);
  for (let i = 0; i < 4; i++) pass(state);
  assert.throws(() => callTrump(state, state.turn, state.upCard.suit), /cannot be called/);
});

test('dealer pickup produces a five-card hand after discard', () => {
  const state = newGame();
  deal(state, seeded(3));
  const caller = state.turn;
  orderUp(state, caller);
  assert.equal(state.hands[state.dealer].length, 6);
  discard(state, state.hands[state.dealer][0]);
  assert.equal(state.phase, 'play');
  assert.equal(state.hands[state.dealer].length, 5);
});

test('dealer receives turned card when an opponent orders up alone', () => {
  const state = newGame();
  deal(state, seeded(3)); // first hand dealer is seat 0: the human team
  const dealer = state.dealer;
  const caller = 1;
  state.turn = caller;
  const turnedCard = state.upCard;

  orderUp(state, caller, true);

  assert.equal(state.dealer, dealer);
  assert.equal(state.alone, true);
  assert.equal(state.aloneSeat, caller);
  assert.equal(state.sittingSeat, 3);
  assert.equal(state.phase, 'discard');
  assert.equal(state.turn, dealer);
  assert.equal(state.hands[dealer].length, 6);
  assert.ok(state.hands[dealer].some((card) => card.id === turnedCard.id));
});

test('a completed fifth trick scores the hand', () => {
  const state = newGame();
  Object.assign(state, {
    phase: 'play',
    turn: 0,
    dealer: 3,
    trump: 'hearts',
    maker: 0,
    makerSeat: 0,
    ledSuit: null,
    trickPile: [],
    tricksWon: [2, 2],
    completedTricks: Array.from({ length: 4 }, () => ({ plays: [], winner: 0 })),
    hands: [
      [{ rank: 'J', suit: 'hearts', id: 'J-hearts' }],
      [{ rank: 'A', suit: 'clubs', id: 'A-clubs' }],
      [{ rank: '9', suit: 'hearts', id: '9-hearts' }],
      [{ rank: 'A', suit: 'spades', id: 'A-spades' }],
    ],
  });
  playCard(state, 0, state.hands[0][0]);
  playCard(state, 1, state.hands[1][0]);
  playCard(state, 2, state.hands[2][0]);
  playCard(state, 3, state.hands[3][0]);
  assert.equal(state.phase, 'handEnd');
  assert.deepEqual(state.scores, [1, 0]);
});

test('void tracking records when a seat fails to follow the led suit', () => {
  const state = newGame();
  Object.assign(state, {
    phase: 'play', turn: 0, dealer: 3, trump: 'hearts', maker: 0, makerSeat: 0,
    ledSuit: null, trickPile: [], tricksWon: [0, 0], completedTricks: [],
    voids: [[], [], [], []],
    hands: [
      [{ rank: 'A', suit: 'spades', id: 'A-spades' }],
      [{ rank: '9', suit: 'clubs', id: '9-clubs' }],  // can't follow spades → void
      [{ rank: 'K', suit: 'spades', id: 'K-spades' }],
      [{ rank: 'Q', suit: 'spades', id: 'Q-spades' }],
    ],
  });
  playCard(state, 0, state.hands[0][0]); // leads spades
  playCard(state, 1, state.hands[1][0]); // sloughs clubs → void in spades
  assert.deepEqual(state.voids[1], ['spades']);
  assert.deepEqual(state.voids[2], []);
});

test('legal play derives led suit from trick pile when cached ledSuit drifts', () => {
  const state = newGame();
  Object.assign(state, {
    phase: 'play',
    turn: 1,
    dealer: 3,
    trump: 'hearts',
    maker: 0,
    makerSeat: 0,
    ledSuit: null, // simulates an old/stale save or UI timing drift
    trickPile: [{ seat: 0, card: { rank: 'A', suit: 'spades', id: 'A-spades' } }],
    tricksWon: [0, 0],
    completedTricks: [],
    voids: [[], [], [], []],
    hands: [
      [],
      [
        { rank: 'K', suit: 'spades', id: 'K-spades' },
        { rank: '9', suit: 'clubs', id: '9-clubs' },
      ],
      [],
      [],
    ],
  });

  assert.equal(currentLedSuit(state), 'spades');
  assert.deepEqual(getLegalCards(state, 1).map((card) => card.id), ['K-spades']);
  assert.throws(() => playCard(state, 1, state.hands[1][1]), /follow suit/);
  playCard(state, 1, state.hands[1][0]);
  assert.equal(state.trickPile[1].card.id, 'K-spades');
});

test('trick winner honors trump and bowers', () => {
  const plays = [
    { seat: 0, card: { rank: 'A', suit: 'clubs', id: 'A-clubs' } },
    { seat: 1, card: { rank: 'J', suit: 'diamonds', id: 'J-diamonds' } },
    { seat: 2, card: { rank: 'J', suit: 'hearts', id: 'J-hearts' } },
    { seat: 3, card: { rank: 'A', suit: 'hearts', id: 'A-hearts' } },
  ];
  assert.equal(trickWinner(plays, 'hearts'), 2);
});
