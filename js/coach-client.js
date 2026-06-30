// coach-client.js — main-thread façade over the coach. Prefers a Web Worker so
// PIMC never blocks animations; falls back to a direct (lazy) import if workers
// aren't available (e.g. opened from file://). Same API either way.

let worker = null;      // Worker | false (failed) | null (untried)
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker === false) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./coach.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, res, error } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(res); else p.reject(new Error(error));
    };
    worker.onerror = () => { worker = false; };
    return worker;
  } catch {
    worker = false;
    return null;
  }
}

// req = { type:'play'|'bid', state, heroSeat, chosen, opts:{ samples, seed } }
export function evaluateMove(req) {
  const w = getWorker();
  if (w) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      w.postMessage({ id, ...req });
    }).catch(() => evalSync(req));
  }
  return evalSync(req);
}

async function evalSync(req) {
  const { coachPlay, coachBid } = await import('./coach.js');
  return req.type === 'bid'
    ? coachBid(req.state, req.heroSeat, req.chosen, req.opts || {})
    : coachPlay(req.state, req.heroSeat, req.chosen, req.opts || {});
}
