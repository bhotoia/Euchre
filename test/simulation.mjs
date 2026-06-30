import assert from 'node:assert/strict';
import { newGame, deal, orderUp, discard, callTrump, pass, playCard, getLegalCards } from '../js/engine.js';
import { aiBid, aiDiscard, aiPlay } from '../js/ai.js';

let games = 0;
let hands = 0;
let moves = 0;

for (let game = 0; game < 250; game++) {
  const state = newGame();
  deal(state);
  hands++;
  let guard = 0;

  while (state.phase !== 'gameEnd' && guard++ < 5000) {
    if (state.phase === 'bid1' || state.phase === 'bid2') {
      const seat = state.turn;
      const bid = aiBid(state, seat, 'hard');
      if (bid.action === 'orderUp') orderUp(state, seat, bid.alone);
      else if (bid.action === 'callTrump') callTrump(state, seat, bid.suit, bid.alone);
      else pass(state);
    } else if (state.phase === 'discard') {
      discard(state, aiDiscard(state));
    } else if (state.phase === 'play') {
      const seat = state.turn;
      const legal = getLegalCards(state, seat);
      const card = aiPlay(state, seat, 'hard');
      assert.ok(legal.some((candidate) => candidate.id === card.id));
      playCard(state, seat, card);
      moves++;
    } else if (state.phase === 'redeal' || state.phase === 'handEnd') {
      deal(state);
      hands++;
    }
  }

  assert.equal(state.phase, 'gameEnd');
  assert.ok(state.scores[state.winner] >= 10);
  games++;
}

console.log(`Simulation passed: ${games} games, ${hands} hands, ${moves} legal plays`);
