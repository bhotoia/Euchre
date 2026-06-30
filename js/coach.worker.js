// coach.worker.js — runs the PIMC evaluator off the main thread so the table
// animations never stutter while the coach is thinking.
//
// Protocol: post { id, type:'play'|'bid', state, heroSeat, chosen, opts }.
// Replies   { id, ok, res } or { id, ok:false, error }. `opts.seed` (a number)
// is used instead of an rng function, which cannot cross the worker boundary.

import { coachPlay, coachBid } from './coach.js';

self.onmessage = (e) => {
  const { id, type, state, heroSeat, chosen, opts } = e.data || {};
  try {
    const res = type === 'bid'
      ? coachBid(state, heroSeat, chosen, opts || {})
      : coachPlay(state, heroSeat, chosen, opts || {});
    self.postMessage({ id, ok: true, res });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
