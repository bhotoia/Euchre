// Soundness check: if the coach's EV ranking is correct, a team that always plays
// the coach's recommended card should beat a team playing the plain 'hard' AI.
// Both teams bid identically (aiBid hard), so the difference is card play only.
//
// Run: node test/coach-sim.mjs   (not part of `npm test` — it's slow)

import { newGame, deal, orderUp, discard, callTrump, pass, playCard, getLegalCards, TEAM_OF } from '../js/engine.js';
import { aiBid, aiDiscard, aiPlay } from '../js/ai.js';
import { coachPlay, mulberry32 } from '../js/coach.js';

const GAMES = Number(process.argv[2] || 40);
const SAMPLES = Number(process.argv[3] || 60);
const rng = mulberry32(0x5EED);

let team0Wins = 0, hands = 0;
let decisions = 0, totalMs = 0, maxMs = 0;

for (let g = 0; g < GAMES; g++) {
  const state = newGame();
  deal(state); hands++;
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
      let card;
      if (TEAM_OF(seat) === 0) {
        const legal = getLegalCards(state, seat);
        const t0 = performance.now();
        card = coachPlay(state, seat, legal[0], { samples: SAMPLES, rng }).best;
        const dt = performance.now() - t0;
        decisions++; totalMs += dt; if (dt > maxMs) maxMs = dt;
      } else {
        card = aiPlay(state, seat, 'hard');
      }
      playCard(state, seat, card);
    } else if (state.phase === 'redeal' || state.phase === 'handEnd') {
      deal(state); hands++;
    }
  }
  if (state.winner === 0) team0Wins++;
}

const rate = (team0Wins / GAMES * 100).toFixed(1);
console.log(`Coach team won ${team0Wins}/${GAMES} games (${rate}%) over ${hands} hands`);
console.log(`Coach decision latency: avg ${(totalMs / decisions).toFixed(1)}ms, max ${maxMs.toFixed(1)}ms (${SAMPLES} samples)`);
if (team0Wins <= GAMES / 2) {
  console.error('WARNING: coach did not beat the hard AI — EV ranking may be off.');
  process.exit(1);
}
