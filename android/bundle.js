// Bundles the ES-module game into ONE classic script for the Android WebView
// (WebView blocks file:// module loading), and stages all web assets under
// android/assets/ for packaging into the APK.
//
// The web build runs the coach in a Web Worker (coach-client.js + coach.worker.js)
// and uses `import * as Stats` / aliased imports. None of that survives a
// concatenated classic script, so for the APK we:
//   - omit coach-client.js / coach.worker.js and run the coach synchronously,
//   - rebuild the `Stats` namespace and the `charLine` alias as shims,
// all injected before ui.js (which reads them at module top-level).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');        // euchreapp/
const assets = path.join(__dirname, 'assets');  // android/assets/

// fresh assets dir
fs.rmSync(assets, { recursive: true, force: true });
fs.mkdirSync(path.join(assets, 'js'), { recursive: true });

const strip = (c) => c
  .replace(/import\b[\s\S]*?from\s*['"][^'"]*['"];/g, '') // strip imports (incl. multiline)
  .replace(/^[ \t]*export\s+/gm, '');                      // strip the `export` keyword

// 1) bundle JS in dependency order, stripping import/export.
//    coach-client.js + coach.worker.js are intentionally excluded (worker/import.meta).
const order = [
  'cards.js', 'engine.js', 'ai.js', 'coach.js',
  'stats.js', 'profile.js', 'cosmetics.js', 'tournaments.js', 'daily.js',
  'events.js', 'juice.js', 'personalities.js',
  'portraits.js', 'rivals.js', 'career.js', 'allies.js',
];
let out = '"use strict";\n';
for (const f of order) {
  out += `\n/* ===== ${f} ===== */\n${strip(fs.readFileSync(path.join(root, 'js', f), 'utf8'))}\n`;
}

// 2) shims that replace the worker/namespace/alias imports ui.js expects
out += `
/* ===== WebView shims (no worker; reconstruct namespace + alias) ===== */
const Stats = {
  defaultStats, loadStats, saveStats, recordHand, recordGame, recordOutcome, recordCoachMove,
  unlockBadge, winRate, coachAccuracy, rankFor, BADGES, STATS_KEY,
};
const charLine = line;
function evaluateMove(req) {
  const res = req.type === 'bid'
    ? coachBid(req.state, req.heroSeat, req.chosen, req.opts || {})
    : coachPlay(req.state, req.heroSeat, req.chosen, req.opts || {});
  return Promise.resolve(res);
}
`;

// 3) ui.js then main.js (read the shims above at load time)
for (const f of ['ui.js', 'main.js']) {
  out += `\n/* ===== ${f} ===== */\n${strip(fs.readFileSync(path.join(root, 'js', f), 'utf8'))}\n`;
}

fs.writeFileSync(path.join(assets, 'js', 'bundle.js'), out);

// 4) copy css + icons
fs.cpSync(path.join(root, 'css'), path.join(assets, 'css'), { recursive: true });
fs.cpSync(path.join(root, 'icons'), path.join(assets, 'icons'), { recursive: true });

// 5) transform index.html → classic script, drop SW + manifest (no server in-app)
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="module" src="js\/main\.js"><\/script>/,
  '<script src="js/bundle.js"></script>');
html = html.replace(/<script>[\s\S]*?serviceWorker[\s\S]*?<\/script>/, '');
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
fs.writeFileSync(path.join(assets, 'index.html'), html);

console.log('bundle.js bytes:', out.length);
console.log('assets staged at', assets);
