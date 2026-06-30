// engine.js — pure Euchre state machine. No DOM, no AI. All transitions return new-ish state.
// Seats 0..3 clockwise. Teams: [0,2] vs [1,3]. Seat 0 = human "You" in AI mode.

import { makeDeck, shuffle, effectiveSuit, trickWinner, legalCards } from './cards.js';

export const TEAM_OF = (seat) => seat % 2; // 0 -> team0, 1 -> team1, etc.

export function currentLedSuit(state) {
  if (state?.trickPile?.length) return effectiveSuit(state.trickPile[0].card, state.trump);
  return state?.ledSuit || null;
}

// Build a fresh game. dealer rotates each hand.
export function newGame() {
  return {
    phase: 'idle',
    dealer: 3,            // so first deal's first bidder is seat 0
    turn: 0,
    hands: [[], [], [], []],
    kitty: [],
    upCard: null,
    trump: null,
    maker: null,         // team index that called trump
    makerSeat: null,     // seat that called
    alone: false,
    aloneSeat: null,
    sittingSeat: null,   // partner sitting out when alone
    trickPile: [],       // current trick: [{seat, card}]
    ledSuit: null,
    voids: [[], [], [], []], // per-seat suits a seat is known void in (from follow history)
    tricksWon: [0, 0],   // per team this hand
    completedTricks: [], // [{plays, winner}] for animation/history
    scores: [0, 0],
    passes: 0,           // passes in current bidding round
    lastResult: null,    // {team, points, kind} after a hand
    resultStatsRecorded: false, // persisted guard against double-counting a resumed result screen
    winner: null,        // team index when game over
  };
}

// Deal a new hand. Mutates+returns state (caller treats as fresh phase).
export function deal(state, rng = Math.random) {
  if (!state || !Array.isArray(state.scores)) throw new Error('Cannot deal without a valid game state');
  const deck = shuffle(makeDeck(), rng);
  state.dealer = (state.dealer + 1) % 4;
  state.hands = [[], [], [], []];
  // deal 5 each (simple 5-at-once; order irrelevant to outcome)
  let idx = 0;
  for (let s = 0; s < 4; s++) {
    state.hands[s] = deck.slice(idx, idx + 5);
    idx += 5;
  }
  state.kitty = deck.slice(20, 24);
  state.upCard = state.kitty[0];
  state.trump = null;
  state.maker = null;
  state.makerSeat = null;
  state.alone = false;
  state.aloneSeat = null;
  state.sittingSeat = null;
  state.trickPile = [];
  state.ledSuit = null;
  state.voids = [[], [], [], []];
  state.tricksWon = [0, 0];
  state.completedTricks = [];
  state.passes = 0;
  state.lastResult = null;
  state.resultStatsRecorded = false;
  state.phase = 'bid1';
  state.turn = (state.dealer + 1) % 4; // left of dealer bids first
  return state;
}

// ---- Bidding round 1: order up the turned card, or pass ----

export function orderUp(state, seat, alone = false) {
  assertTurn(state, seat, 'bid1');
  // dealer picks up upCard and discards; trump = upCard suit
  state.trump = state.upCard.suit;
  state.maker = TEAM_OF(seat);
  state.makerSeat = seat;
  state.alone = alone;
  if (alone) {
    state.aloneSeat = seat;
    state.sittingSeat = (seat + 2) % 4;
  }
  // dealer takes the up card; must discard one. Engine auto-discards weakest later
  // via discardForDealer (UI/AI chooses). For now add to dealer hand.
  state.hands[state.dealer].push(state.upCard);
  state.phase = 'discard';
  state.turn = state.dealer;
  return state;
}

// dealer discards one card after picking up
export function discard(state, card) {
  assertTurn(state, state.dealer, 'discard');
  const hand = state.hands[state.dealer];
  const i = hand.findIndex((c) => c.id === card.id);
  if (i < 0) throw new Error('Dealer may only discard a card from their hand');
  hand.splice(i, 1);
  startPlay(state);
  return state;
}

// ---- Bidding round 2: name a suit (not the turned suit) ----

export function callTrump(state, seat, suit, alone = false) {
  assertTurn(state, seat, 'bid2');
  if (!['spades', 'hearts', 'diamonds', 'clubs'].includes(suit)) throw new Error('Invalid trump suit');
  if (suit === state.upCard.suit) throw new Error('Turned-down suit cannot be called in round two');
  state.trump = suit;
  state.maker = TEAM_OF(seat);
  state.makerSeat = seat;
  state.alone = alone;
  if (alone) {
    state.aloneSeat = seat;
    state.sittingSeat = (seat + 2) % 4;
  }
  startPlay(state);
  return state;
}

// generic pass; advances bidder, transitions rounds, handles all-pass
export function pass(state, seat = state.turn) {
  if (state.phase !== 'bid1' && state.phase !== 'bid2') throw new Error('Pass is only valid while bidding');
  if (seat !== state.turn) throw new Error('Cannot pass out of turn');
  state.passes += 1;
  if (state.phase === 'bid1') {
    if (state.passes >= 4) {
      // move to round 2
      state.phase = 'bid2';
      state.passes = 0;
      state.turn = (state.dealer + 1) % 4;
    } else {
      state.turn = (state.turn + 1) % 4;
    }
  } else if (state.phase === 'bid2') {
    if (state.passes >= 4) {
      // all passed twice — no trump. Redeal (standard, not stick-the-dealer).
      state.phase = 'redeal';
    } else {
      state.turn = (state.turn + 1) % 4;
    }
  }
  return state;
}

function startPlay(state) {
  state.phase = 'play';
  state.trickPile = [];
  state.ledSuit = null;
  // leader = left of dealer, skipping the sitting partner if alone
  let leader = (state.dealer + 1) % 4;
  if (state.alone && leader === state.sittingSeat) leader = (leader + 1) % 4;
  state.turn = leader;
}

// ---- Trick play ----

export function getLegalCards(state, seat) {
  return legalCards(state.hands[seat], currentLedSuit(state), state.trump);
}

export function playCard(state, seat, card) {
  assertTurn(state, seat, 'play');
  const hand = state.hands[seat];
  const i = hand.findIndex((c) => c.id === card.id);
  if (i < 0) throw new Error('Card is not in the active hand');
  const handCard = hand[i];
  const legal = getLegalCards(state, seat);
  if (!legal.some((c) => c.id === handCard.id)) throw new Error('Card does not follow suit');
  hand.splice(i, 1);
  if (state.trickPile.length === 0) {
    state.ledSuit = effectiveSuit(handCard, state.trump);
  } else {
    state.ledSuit = currentLedSuit(state);
  }
  if (state.trickPile.length > 0 && effectiveSuit(handCard, state.trump) !== state.ledSuit) {
    // failed to follow the led suit → this seat is void in it
    if (!state.voids[seat].includes(state.ledSuit)) state.voids[seat].push(state.ledSuit);
  }
  state.trickPile.push({ seat, card: handCard });

  const playersThisTrick = state.alone ? 3 : 4;
  if (state.trickPile.length === playersThisTrick) {
    const winner = trickWinner(state.trickPile, state.trump);
    state.tricksWon[TEAM_OF(winner)] += 1;
    state.completedTricks.push({ plays: state.trickPile.slice(), winner });
    state.trickPile = [];
    state.ledSuit = null;
    // next leader = winner; flag trick-complete for UI sweep
    state.turn = winner;
    state.lastTrickWinner = winner;
    if (state.completedTricks.length === 5) {
      scoreHand(state);
    }
  } else {
    state.turn = nextSeat(state, seat);
  }
  return state;
}

function nextSeat(state, seat) {
  let n = (seat + 1) % 4;
  if (state.alone && n === state.sittingSeat) n = (n + 1) % 4;
  return n;
}

function assertTurn(state, seat, phase) {
  if (!state || state.phase !== phase) throw new Error(`Action requires ${phase} phase`);
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error('Invalid seat');
  if (state.turn !== seat) throw new Error('Action attempted out of turn');
}

function scoreHand(state) {
  const makerTeam = state.maker;
  const defenders = 1 - makerTeam;
  const makerTricks = state.tricksWon[makerTeam];
  let team = makerTeam;
  let points = 0;
  let kind = '';

  if (makerTricks >= 3) {
    if (makerTricks === 5) {
      points = state.alone ? 4 : 2;
      kind = state.alone ? 'alone-march' : 'march';
    } else {
      points = 1;
      kind = 'point';
    }
  } else {
    // euchred — defenders get 2
    team = defenders;
    points = 2;
    kind = 'euchre';
  }

  state.scores[team] += points;
  state.lastResult = { team, points, kind, makerTeam, makerTricks };
  if (state.scores[team] >= 10) {
    state.phase = 'gameEnd';
    state.winner = team;
  } else {
    state.phase = 'handEnd';
  }
}
