// cards.js — card model + trump/bower logic. Single source of truth for comparisons.

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOL = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

// red vs black — used to find the left bower (same color, other suit)
export const SUIT_COLOR = {
  spades: 'black',
  clubs: 'black',
  hearts: 'red',
  diamonds: 'red',
};

// base off-trump rank order (low → high)
const BASE_RANK_VALUE = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6 };

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// the suit that shares a color with `suit` (the left bower's native suit when suit is trump)
export function sameColorSuit(suit) {
  switch (suit) {
    case 'spades': return 'clubs';
    case 'clubs': return 'spades';
    case 'hearts': return 'diamonds';
    case 'diamonds': return 'hearts';
  }
}

export function isRightBower(card, trump) {
  return card.rank === 'J' && card.suit === trump;
}

export function isLeftBower(card, trump) {
  return card.rank === 'J' && card.suit === sameColorSuit(trump);
}

export function isTrump(card, trump) {
  return card.suit === trump || isLeftBower(card, trump);
}

// the effective suit of a card given trump (left bower counts as trump suit)
export function effectiveSuit(card, trump) {
  if (!trump) return card.suit;
  if (isLeftBower(card, trump)) return trump;
  return card.suit;
}

// absolute strength of a card given trump + the suit that was led.
// higher wins. trump beats non-trump; among non-trump only led-suit cards score.
export function cardStrength(card, trump, ledSuit) {
  if (isRightBower(card, trump)) return 100;
  if (isLeftBower(card, trump)) return 99;
  if (card.suit === trump) return 20 + BASE_RANK_VALUE[card.rank];
  // non-trump: only matters if it follows the led suit
  if (effectiveSuit(card, trump) === ledSuit) return BASE_RANK_VALUE[card.rank];
  return 0; // off-suit, off-trump — cannot win
}

// given a played trick [{seat, card}], return the winning seat
export function trickWinner(plays, trump) {
  const ledSuit = effectiveSuit(plays[0].card, trump);
  let best = plays[0];
  let bestStrength = cardStrength(plays[0].card, trump, ledSuit);
  for (let i = 1; i < plays.length; i++) {
    const s = cardStrength(plays[i].card, trump, ledSuit);
    if (s > bestStrength) {
      bestStrength = s;
      best = plays[i];
    }
  }
  return best.seat;
}

// legal cards a hand may play given the led suit (must follow if able)
export function legalCards(hand, ledSuit, trump) {
  if (!ledSuit) return hand.slice();
  const canFollow = hand.filter((c) => effectiveSuit(c, trump) === ledSuit);
  return canFollow.length ? canFollow : hand.slice();
}
