import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sanitizeName } from '../js/profile.js';
import {
  defaultCosmetics, isOwned, ownPack, setActivePack, packById,
} from '../js/cosmetics.js';
import {
  TOURNAMENTS, tournamentById, progressFor, currentRound,
  isTournamentUnlocked, recordRoundWin, allTournamentsComplete,
  canStartPrestigeSeason, beginPrestigeSeason, completePrestigeSeason,
  prestigeFor, prestigeLabel,
} from '../js/tournaments.js';
import { defaultStats, recordOutcome, recordTournamentCup, recordCoachMove, BADGES } from '../js/stats.js';
import {
  dailyConfig, dailyDealRng, dailyActionRng, scoreDaily, defaultDailyStore,
  completeDaily, dailyBest, dailyStreak,
} from '../js/daily.js';

test('profile: sanitizeName trims, clamps, and falls back', () => {
  assert.equal(sanitizeName('  Amrit  '), 'Amrit');
  assert.equal(sanitizeName('a'.repeat(40)).length, 14);
  assert.equal(sanitizeName('   ', 'You'), 'You');
  assert.equal(sanitizeName('A   B'), 'A B'); // collapse inner whitespace
});

test('daily: date creates a stable shared lineup and deal sequence', () => {
  const a = dailyConfig('2026-06-25');
  const b = dailyConfig('2026-06-25');
  assert.deepEqual(a, b);
  assert.equal(new Set([a.ally, ...a.opponents]).size, 3);
  const r1 = dailyDealRng(a.dateKey, 0);
  const r2 = dailyDealRng(a.dateKey, 0);
  assert.deepEqual(Array.from({ length: 8 }, () => r1()), Array.from({ length: 8 }, () => r2()));
  const p1 = dailyActionRng(a.dateKey, 3);
  const p2 = dailyActionRng(a.dateKey, 3);
  assert.deepEqual(Array.from({ length: 4 }, () => p1()), Array.from({ length: 4 }, () => p2()));
});

test('daily: only the first official result is recorded', () => {
  const store = defaultDailyStore();
  const first = completeDaily(store, '2026-06-25', { score: 900, won: true });
  const retry = completeDaily(store, '2026-06-25', { score: 1400, won: true });
  assert.equal(first.recorded, true);
  assert.equal(retry.recorded, false);
  assert.equal(store.entries['2026-06-25'].score, 900);
});

test('daily: score rewards wins, margin, euchres, and lone hands', () => {
  const basic = scoreDaily({ won: true, scores: [10, 8], hands: 12 });
  const sharp = scoreDaily({ won: true, scores: [10, 4], hands: 9, euchres: 2, aloneWins: 1 });
  assert.ok(sharp > basic);
});

test('daily: streak ignores forfeits and best uses official scores', () => {
  const store = defaultDailyStore();
  completeDaily(store, '2026-06-23', { score: 500, won: false });
  completeDaily(store, '2026-06-24', { score: 0, won: false, forfeit: true });
  completeDaily(store, '2026-06-25', { score: 1200, won: true });
  assert.equal(dailyStreak(store, '2026-06-25'), 1);
  assert.equal(dailyBest(store), 1200);
});

test('ui: Daily Deal keeps one official attempt and secondary replays', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /You get one official attempt\. Replays are practice only\./);
  assert.match(ui, /const hasOfficialEntry = !!officialEntry\(loadDaily\(\), config\.dateKey\)/);
  assert.match(ui, /practice: hasOfficialEntry/);
  assert.match(ui, /play\.className = 'btn btn-glass';\s*play\.textContent = t\('replayPractice'\)/);
  assert.match(ui, /never affect score, streaks, bests, or stats/);
  assert.match(ui, /if \(mode === 'daily' && dailyCtx\?\.practice\) \{/);
  assert.doesNotMatch(ui, /lastDailyPractice/);
});

test('cosmetics: classic always owned; ownPack unlocks once; active gated to owned', () => {
  const c = defaultCosmetics();
  assert.equal(isOwned(c, 'classic'), true);
  assert.equal(isOwned(c, 'crimson'), false);
  assert.equal(setActivePack(c, 'crimson'), 'classic'); // can't equip unowned
  assert.equal(ownPack(c, 'crimson'), true);
  assert.equal(ownPack(c, 'crimson'), false);           // already owned
  assert.equal(setActivePack(c, 'crimson'), 'crimson');
  assert.equal(packById('nope').id, 'classic');         // unknown → default
});

test('cosmetics: previews are isolated and foil effects remain static', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.theme-classic\s*\{[^}]*--cb-a:\s*#1c5e3f/s);
  assert.match(css, /\.reward-pack\s*>\s*\.pp-back\s*\{[^}]*inset:\s*0/s);
  assert.match(css, /html\[data-pack="gilded"\]\s+\.card\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /html\[data-pack="obsidian"\]\s+\.card\s*\{[^}]*overflow:\s*visible/s);
  assert.doesNotMatch(css, /holoShift|animation:\s*[^;]*holo/i);
  assert.doesNotMatch(css, /data-pack="(?:obsidian|gilded)"\]\s*\.card::after/);
});

test('settings: appearance summarizes and opens active card packs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="appearancePacksBtn"/);
  assert.match(html, /id="settingsPackSummary"/);
  assert.match(html, /id="settingsPackPreview"/);
  assert.match(css, /\.settings-pack-link\s*\{/);
  assert.match(css, /\.settings-pack-preview\s*\{/);
  assert.match(ui, /let packsReturnScreen = 'clubhouse'/);
  assert.match(ui, /function openSettings\(\)/);
  assert.match(ui, /function renderSettings\(\)/);
  assert.match(ui, /\$\('appearancePacksBtn'\)\.onclick = \(\) => openPacks\('settings'\)/);
  assert.match(ui, /\$\('packsBack'\)\.onclick = \(\) => \{ renderSettings\(\); show\(packsReturnScreen\); \}/);
});

test('settings: about privacy support screen documents local data posture', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="aboutBtn"/);
  assert.match(html, /id="about"/);
  assert.match(html, /id="aboutPrivacyCopy"/);
  assert.match(html, /id="aboutVersion"/);
  assert.match(css, /\.about-app-card\s*\{/);
  assert.match(css, /\.about-build\s*\{/);
  assert.match(ui, /const APP_INFO\s*=\s*\{/);
  assert.match(ui, /function openAbout\(\)/);
  assert.match(ui, /function renderAbout\(\)/);
  assert.match(ui, /version:\s*APP_INFO\.versionName/);
  assert.match(ui, /code:\s*APP_INFO\.versionCode/);
  assert.match(ui, /\$\('aboutBtn'\)\.onclick = openAbout/);
  assert.match(ui, /It does not use accounts, cloud sync, ads, analytics, crash reporting, telemetry, or online multiplayer/);
});

test('docs: privacy policy is ready for no-domain static hosting', () => {
  const index = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  const policy = readFileSync(new URL('../docs/privacy-policy.html', import.meta.url), 'utf8');
  const nojekyll = readFileSync(new URL('../docs/.nojekyll', import.meta.url), 'utf8');
  assert.match(index, /href="privacy-policy\.html"/);
  assert.match(policy, /<title>Euchre Privacy Policy<\/title>/);
  assert.match(policy, /Last updated: June 30, 2026/);
  assert.match(policy, /does not use accounts, cloud sync, ads, analytics, crash reporting, telemetry, online multiplayer, or a backend service/);
  assert.match(policy, /mailto:abhotoia@gmail\.com/);
  assert.equal(nojekyll, '\n');
});

test('settings: Mandarin language picker localizes core UI', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="languagePickerBtn"/);
  assert.match(html, /id="languageScrim"/);
  assert.match(html, /id="languageChoiceEn"/);
  assert.match(html, /id="languageChoiceZh"/);
  assert.match(ui, /language:\s*'en'/);
  assert.match(ui, /const LANGS\s*=\s*\{[^}]*zh:\s*'中文（普通话）'/s);
  assert.match(ui, /document\.documentElement\.lang = lang\(\) === 'zh' \? 'zh-Hans' : 'en'/);
  assert.match(ui, /function bindLanguagePicker\(\)/);
  assert.match(ui, /openModal\('languageScrim', lang\(\) === 'zh' \? 'languageChoiceZh' : 'languageChoiceEn'\)/);
  assert.match(ui, /function setLanguage\(code\)/);
  assert.match(ui, /feedback\.language = code/);
  assert.match(ui, /function applyLanguage\(\)/);
  assert.match(ui, /action\.textContent = t\('changeLanguage'\)/);
  assert.match(ui, /desc\.textContent = `\$\{t\('currentLanguage'\)\}: \$\{LANGS\[current\]\}`/);
  assert.doesNotMatch(ui, /#settings \.setting-row:nth-of-type\(1\)/);
  assert.doesNotMatch(html, /id="languageToggle"/);
  assert.match(ui, /尤克牌/);
  assert.match(ui, /玩法说明/);
  assert.match(ui, /轮到你出牌/);
  assert.match(ui, /查看原因/);
});

test('pwa: iPhone Home Screen shell has launch assets and safe areas', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const ios = readFileSync(new URL('../ios/README.md', import.meta.url), 'utf8');
  const launch = readFileSync(new URL('../icons/ios-launch/iphone-16-pro-max-1320x2868.png', import.meta.url));
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon" sizes="180x180"/);
  assert.match(html, /apple-touch-startup-image/);
  assert.match(html, /iphone-se-750x1334\.png/);
  assert.match(html, /iphone-16-pro-max-1320x2868\.png/);
  assert.match(css, /--safe-l:\s*env\(safe-area-inset-left/);
  assert.match(css, /@supports \(height: 100dvh\)/);
  assert.match(css, /#menu \{[^}]*var\(--safe-t\)[^}]*var\(--safe-b\)/s);
  assert.match(sw, /icons\/ios-launch\/iphone-15-1179x2556\.png/);
  assert.match(sw, /icons\/ios-launch\/iphone-16-pro-max-1320x2868\.png/);
  assert.match(ios, /Add to Home Screen/);
  assert.equal(launch[0], 0x89);
  assert.equal(launch.toString('ascii', 1, 4), 'PNG');
});

test('settings: game speed defaults slow and fast preserves current pacing', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="speedToggle"/);
  assert.match(html, /id="speedState"/);
  assert.match(ui, /gameSpeed:\s*'slow'/);
  assert.match(ui, /function bindSpeedToggle\(\)/);
  assert.match(ui, /function setGameSpeed\(speed\)/);
  assert.match(ui, /function savedGameSpeed\(\)/);
  assert.match(ui, /function refreshGameSpeedFromStorage\(\)/);
  assert.match(ui, /function bindSpeedStorageSync\(\)/);
  assert.match(ui, /setGameSpeed\(feedback\.gameSpeed === 'fast' \? 'slow' : 'fast'\)/);
  assert.match(ui, /next\.gameSpeed = next\.gameSpeed === 'fast' \? 'fast' : 'slow'/);
  assert.match(ui, /bindSpeedStorageSync\(\)/);
  assert.match(ui, /function speedScale\(\)/);
  assert.match(ui, /return feedback\.gameSpeed === 'fast' \? 1 : 1\.45/);
  assert.match(ui, /function paceDelay\(ms\)/);
  assert.match(ui, /return delay\(paceMs\(ms\)\)/);
});

test('feedback: card play sound is a soft felt tap', () => {
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /function cardTick\(\)/);
  assert.match(ui, /tap\.type = 'triangle'; tap\.frequency\.value = 185/);
  assert.match(ui, /exponentialRampToValueAtTime\(0\.018, now \+ 0\.012\)/);
  assert.match(ui, /lp\.type = 'lowpass'; lp\.frequency\.value = 520/);
  assert.match(ui, /g\.gain\.setValueAtTime\(0\.012, now\)/);
  assert.doesNotMatch(ui, /lp\.frequency\.value = 1300/);
  assert.doesNotMatch(ui, /g\.gain\.value = 0\.05/);
});

test('ui: end-of-hand quips stay readable before the result card', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(css, /\.seat-bubble\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /\.seat-bubble\s*\{[^}]*animation:\s*bubblePop/s);
  assert.match(css, /\.seat-bubble\.pos-1\s*\{[^}]*transform:\s*translate\(0,\s*-108%\)/s);
  assert.match(css, /\.seat-bubble\.pos-3\s*\{[^}]*right:\s*66px/s);
  assert.match(ui, /const HAND_RESULT_SETTLE_MS\s*=\s*180/);
  assert.match(ui, /function keepBubbleInsideFelt/);
  assert.doesNotMatch(ui, /let the character reaction land before the result modal/);
});

test('ui: gameplay score cluster keeps trump centered', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /#table\s+\.scoreboard\s*\{[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/s);
  assert.match(css, /\.score-pill\s*\{[^}]*justify-content:\s*center[^}]*width:\s*clamp/s);
  assert.match(css, /\.hud:has\(#hintBtn:not\(\[hidden\]\)\)\s+\.score-pill\s*\{[^}]*width:\s*46px/s);
  assert.match(css, /#table\s+\.hud:has\(#lastTrickBtn:not\(\[hidden\]\)\):has\(#hintBtn:not\(\[hidden\]\)\)\s+\.hud-right\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /#table\s+\.hud:has\(#lastTrickBtn:not\(\[hidden\]\)\):has\(#hintBtn:not\(\[hidden\]\)\)\s+\.hud-right\s+\.icon-btn\s*\{[^}]*width:\s*30px/s);
});

test('coach UI: lesson block and auto-advance state are present', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="coachQuick"/);
  assert.match(html, /<details class="coach-details" id="coachDetails">/);
  assert.match(html, /<summary>Read the reasoning<\/summary>/);
  assert.match(html, /id="coachLesson"/);
  assert.match(html, /id="coachAutoState"/);
  assert.match(css, /\.coach-quick\s*\{/);
  assert.match(css, /\.coach-quick span\s*\{/);
  assert.match(css, /\.coach-details\s*\{/);
  assert.match(css, /\.coach-lesson\s*\{/);
  assert.match(ui, /function coachQuickVerdict\(res, type\)/);
  assert.match(ui, /<b>Play \$\{escapeHTML\(cardName\(res\.best, S\.trump\)\)\}<\/b>, not \$\{escapeHTML\(chosen\)\}/);
  assert.match(ui, /<b>\$\{escapeHTML\(coachBidVerdict\(res\.best\)\)\}<\/b>, not \$\{escapeHTML\(coachBidVerdict\(res\.chosen\)\)\.toLowerCase\(\)\}/);
  assert.match(ui, /\$\('coachQuick'\)\.innerHTML = coachQuickVerdict\(res, type\)/);
  assert.match(ui, /details\.open = false/);
  assert.match(ui, /function renderCoachAutoState/);
  assert.match(ui, /function renderCoachLesson/);
  assert.match(ui, /function focusTopic/);
});

test('coach UI: game-end Train recap shows a mastery path', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /function masteryDrill\(topic\)/);
  assert.match(ui, /function masteryProgress\(statsNow, gameList\)/);
  assert.match(ui, /function renderMasteryPath\(list\)/);
  assert.match(ui, /Mastery path/);
  assert.match(ui, /Next gate/);
  assert.match(ui, /Drill/);
  assert.match(ui, /gameOver \? renderMasteryPath\(list\) : ''/);
  assert.match(css, /\.mastery-card\s*\{/);
  assert.match(css, /\.mastery-grid\s*\{/);
});

test('ui: discard mode is explicit and readable', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /let pendingDiscardId = null/);
  assert.match(ui, /function renderDiscardCue/);
  assert.match(ui, /tapAgainDiscard/);
  assert.match(ui, /await paceDelay\(100\);\s*if \(visibleCard\) visibleCard\.style\.visibility = 'hidden';\s*await flyCard\(source, target, ghost, \{ ms: paceMs\(640\)/s);
  assert.match(ui, /feedbackEvent\('card'\);\s*await paceDelay\(140\);/);
  assert.match(css, /\.discard-target\.choose\s*\{/);
  assert.match(css, /\.discard-target \.discard-preview\s*\{[^}]*left:\s*50%[^}]*top:\s*50%[^}]*translate:\s*-50% -50%/s);
  assert.match(css, /\.discard-mode\s+\.hand-you,\s*[\r\n]+\.discard-mode\s+\.hand-you\s+\.card\s*\{[^}]*filter:\s*none/s);
  assert.match(css, /\.hand-you \.card\.discardable::after\s*\{/);
  assert.match(css, /\.hand-you \.card\.discard-selected/);
});

test('ui: quips do not control training pace and dealing stays quick', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /setTimeout\(\(\) => reactBubble\(2, 'praise'/);
  assert.match(ui, /setStatus\(t\('coachOptimal'\)\);\s*await delay\(180\)/);
  assert.match(ui, /animationDelay = paceMs\(\(i % 5\) \* 44 \+ Math\.floor\(i \/ 5\) \* 28\)/);
  assert.match(ui, /await paceDelay\(440\);\s*cards\.forEach/);
  assert.match(css, /\.card\.dealing\s*\{\s*animation:\s*dealIn \.38s/s);
});

test('ui: card-play pace is brisk but readable', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(css, /\.up-card-slot\s*\{[^}]*top:\s*23%/);
  assert.match(ui, /await paceDelay\(340\);\s*if \(!isActive\(run\)\) return;\s*let rng = Math\.random/s);
  assert.match(ui, /renderCompletedTrick\(last\.plays\);\s*await paceDelay\(460\)/);
  assert.match(ui, /reactToTrick\(last\);\s*await paceDelay\(690\)/);
  assert.match(ui, /await paceDelay\(180\);\s*\}\s*\}\s*else\s*\{\s*renderAll\(\);\s*await paceDelay\(400\)/s);
});

test('ui: turned-up card is shown as a bright card in order-up drawer', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /sub\.appendChild\(bidUpCardPreview\(S\.upCard, S\.dealer\)\)/);
  assert.match(ui, /function bidUpCardPreview\(card, dealerSeat\)/);
  assert.match(ui, /className = `bid-up-recipient team-/);
  assert.match(ui, /t\('pickupRecipient'/);
  assert.doesNotMatch(ui, /function bidDealerCue/);
  assert.match(ui, /preview\.setAttribute\('aria-label', `Turned up/);
  assert.doesNotMatch(ui, /bid-sheet-open/);
  assert.match(css, /\.bid-up-card \.card\s*\{[^}]*width:\s*82px[^}]*height:\s*115px[^}]*filter:\s*none[^}]*opacity:\s*1/s);
  assert.match(css, /\.bid-up-card \.card\s*\{[^}]*box-shadow:[^}]*var\(--gold\)/s);
  assert.match(css, /\.bid-up-card-label b\s*\{[^}]*color:\s*var\(--gold\)/s);
  assert.match(css, /\.bid-up-recipient\s*\{[^}]*border-radius:\s*999px[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.bid-up-recipient\.team-us/);
  assert.match(css, /\.bid-up-recipient\.team-them/);
  assert.doesNotMatch(css, /grid-template-columns:\s*1fr 1fr/);
});

test('ui: dealer receives ordered-up card before pickup animation completes', () => {
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /const pickupAnimation = preparePickupAnimation\(upCardData\);[\s\S]*orderUp\(S, seat, d\.alone\);[\s\S]*renderAll\(\);[\s\S]*await pickupAnimation\(\);/);
  assert.match(ui, /function preparePickupAnimation\(upCardData\)/);
  assert.match(ui, /flyCardFromRect\(fromRect, dealerNode/);
});

test('ui: result modal has premium hand and game summaries', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="modalSummary"/);
  assert.match(css, /\.result-summary\s*\{/);
  assert.match(css, /\.result-grid\s*\{/);
  assert.match(ui, /function handResultTitle\(r\)/);
  assert.match(ui, /t\('youEuchredThem'\)/);
  assert.match(ui, /function renderResultSummary\(gameOver, r\)/);
  assert.match(ui, /t\('caller'\)/);
  assert.match(ui, /t\('tricks'\)/);
  assert.match(ui, /renderResultSummary\(gameOver, r\);\s*renderRecap\(gameOver\);/);
});

test('ui: tournament faceoffs and rewards show event context', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="faceoffMeta"/);
  assert.match(html, /id="rewardUnlocks"/);
  assert.match(css, /\.faceoff-meta\s*\{/);
  assert.match(css, /\.reward-unlocks\s*\{/);
  assert.match(ui, /function venueLabel\(tour\)/);
  assert.match(ui, /function opponentPairName\(opponents\)/);
  assert.match(ui, /function faceoffMetaHTML\(items = \[\]\)/);
  assert.match(ui, /\{ k: 'Venue', v: venueLabel\(tour\) \}/);
  assert.match(ui, /\{ k: 'Opponents', v: opponentPairName\(opponents\), wide: true \}/);
  assert.match(ui, /\$\('rewardUnlocks'\)\.innerHTML/);
  assert.match(ui, /<div class="reward-unlock"><span>Card pack<\/span>/);
});

test('juice: euchring someone sounds celebratory, getting euchred sounds heavy', () => {
  const juice = readFileSync(new URL('../js/juice.js', import.meta.url), 'utf8');
  assert.match(juice, /function euchreFanfare\(\)/);
  assert.match(juice, /if \(byYou\) \{\s*euchreFanfare\(\);/s);
  assert.match(juice, /confetti\(\{ count: 70, power: 0\.68 \}\)/);
  assert.match(juice, /\} else \{\s*thunk\(\);\s*buzz\(Object\.assign\(\[25, 40, 60\], \{ kind: 'euchreLose' \}\)\);/s);
});

test('feedback: premium cues distinguish won and lost moments', () => {
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  const juice = readFileSync(new URL('../js/juice.js', import.meta.url), 'utf8');
  const native = readFileSync(new URL('../android/java/com/offlineeuchre/cardgame/MainActivity.java', import.meta.url), 'utf8');
  assert.match(native, /package com\.offlineeuchre\.cardgame;/);
  assert.match(ui, /trickWin: \[16, 24, 26\]/);
  assert.match(ui, /trickLose: \[24, 44, 18\]/);
  assert.match(ui, /feedbackEvent\(trickByYou \? 'trickWin' : 'trickLose'\)/);
  assert.match(ui, /emit\('trick', \{ winner: last\.winner, youWon: trickByYou, mode \}\)/);
  assert.match(juice, /on\('hand', \(e\) => handJolt\(e\)\)/);
  assert.match(juice, /function handJolt\(e\)/);
  assert.match(juice, /kind: e\.youScored \? 'handWin' : 'handLose'/);
  assert.match(juice, /kind: e\.youScored \? 'marchWin' : 'marchLose'/);
  assert.match(juice, /function rewardJolt\(\)/);
  assert.match(juice, /kind: 'reward'/);
  assert.match(native, /"trickWin"\.equals\(kind\)/);
  assert.match(native, /"handWin"\.equals\(kind\)/);
  assert.match(native, /"reward"\.equals\(kind\)/);
});

test('ui: hidden drawer easter eggs stay cosmetic and hidden until found', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /id="secretScrim"/);
  assert.match(html, /id="secretFelt"/);
  assert.match(html, /id="secretDealer"/);
  assert.match(html, /id="secretCut"/);
  assert.match(css, /body\.felt-polished #felt/);
  assert.match(ui, /function openSecretDrawer\(\)/);
  assert.match(ui, /openModal\('secretScrim', 'secretClose'\)/);
  assert.match(ui, /addEventListener\('pointerdown'/);
  assert.match(ui, /quietBadge\('drawer'\)/);
  assert.match(ui, /quietBadge\('polish'/);
  assert.match(ui, /quietBadge\('oracle'\)/);
  assert.match(ui, /quietBadge\('cut'/);
  assert.match(ui, /!b\.hidden \|\| stats\.badges\[id\]/);
  assert.equal(BADGES.drawer.hidden, true);
  assert.equal(BADGES.polish.hidden, true);
  assert.equal(BADGES.oracle.hidden, true);
  assert.equal(BADGES.cut.hidden, true);
});

test('tournaments: cups gate on prerequisites', () => {
  const store = {};
  const foxwood = tournamentById('cellar');
  const highland = tournamentById('highland');
  assert.equal(isTournamentUnlocked(foxwood, store), true);   // no prereq
  assert.equal(isTournamentUnlocked(highland, store), false); // needs cellar
});

test('tournaments: rounds advance and completing grants the reward once', () => {
  const store = {};
  const tour = tournamentById('cellar');
  const total = tour.rounds.length;
  assert.equal(currentRound(store, 'cellar'), 0);

  let res;
  for (let i = 0; i < total - 1; i++) {
    res = recordRoundWin(store, 'cellar', total);
    assert.equal(res.done, false);
  }
  res = recordRoundWin(store, 'cellar', total); // final round
  assert.equal(res.done, true);
  assert.equal(res.justCompleted, true);
  assert.equal(progressFor(store, 'cellar').cleared, total);

  // a redundant win does not re-trigger the reward
  const again = recordRoundWin(store, 'cellar', total);
  assert.equal(again.justCompleted, false);

  // now highland unlocks
  assert.equal(isTournamentUnlocked(tournamentById('highland'), store), true);
});

test('tournaments: prestige seasons restart the cup ladder after the crown', () => {
  const store = {};
  for (const tour of TOURNAMENTS) {
    for (let i = 0; i < tour.rounds.length; i++) recordRoundWin(store, tour.id, tour.rounds.length);
  }
  assert.equal(allTournamentsComplete(store), true);
  assert.equal(canStartPrestigeSeason(store), true);

  const started = beginPrestigeSeason(store);
  assert.equal(started.started, true);
  assert.equal(started.level, 1);
  assert.equal(prestigeFor(store).active, true);
  assert.equal(progressFor(store, 'cellar').done, false);
  assert.equal(isTournamentUnlocked(tournamentById('cellar'), store), true);
  assert.equal(isTournamentUnlocked(tournamentById('highland'), store), false);

  for (const tour of TOURNAMENTS) {
    for (let i = 0; i < tour.rounds.length; i++) recordRoundWin(store, tour.id, tour.rounds.length);
  }
  const done = completePrestigeSeason(store);
  assert.equal(done.justCompleted, true);
  assert.equal(prestigeFor(store).completed, 1);
  assert.equal(prestigeFor(store).active, false);
  assert.equal(prestigeLabel(1), 'Prestige I');
});

test('rivals: head-to-head record updates and marks beaten', async () => {
  const { loadRivals, recordVsRival, h2h } = await import('../js/rivals.js');
  const store = {};
  recordVsRival(store, 'vesper', false);
  assert.deepEqual(h2h(store, 'vesper'), { wins: 0, losses: 1, beaten: false });
  recordVsRival(store, 'vesper', true);
  assert.equal(h2h(store, 'vesper').wins, 1);
  assert.equal(h2h(store, 'vesper').beaten, true);
  assert.equal(typeof loadRivals, 'function');
});

test('stats: an outcome records the deciding hand and game exactly once', () => {
  const s = defaultStats();
  recordOutcome(s, {
    result: { team: 0, points: 1, kind: 'point', makerTeam: 0, makerTricks: 3 },
    gameOver: true,
    won: true,
    difficulty: 'normal',
  });
  assert.equal(s.handsPlayed, 1);
  assert.equal(s.handsWon, 1);
  assert.equal(s.gamesPlayed, 1);
  assert.equal(s.gamesWon, 1);
  assert.equal(s.badges.firstWin, true);
});

test('stats: expanded achievements cover easy, long-term, and prestige goals', () => {
  const s = defaultStats();
  for (let i = 0; i < 10; i++) {
    recordOutcome(s, {
      result: { team: 0, points: 1, kind: 'point', makerTeam: 0, makerTricks: 3 },
      gameOver: true,
      won: true,
      difficulty: 'normal',
    });
  }
  assert.equal(s.badges.games10, true);
  assert.equal(s.badges.wins10, true);
  assert.equal(s.badges.streak10, true);

  for (let i = 0; i < 100; i++) recordCoachMove(s, true);
  assert.equal(s.badges.coach100, true);

  for (let i = 0; i < 5; i++) recordTournamentCup(s, { prestige: i > 0, seasonComplete: i === 4 });
  assert.equal(s.badges.allCups, true);
  assert.equal(s.badges.prestigeCup, true);
  assert.equal(s.badges.prestige1, true);
  assert.equal(BADGES.prestige10.desc, 'Complete 10 Prestige seasons');
});

test('ai styles: aggressor orders up far more than grinder', async () => {
  const { newGame, deal } = await import('../js/engine.js');
  const { aiBid } = await import('../js/ai.js');
  let agg = 0, grind = 0; const N = 2000;
  for (let i = 0; i < N; i++) {
    const s = newGame(); deal(s);
    const seat = s.turn;
    if (aiBid(s, seat, 'normal', 'aggressor').action === 'orderUp') agg++;
    if (aiBid(s, seat, 'normal', 'grinder').action === 'orderUp') grind++;
  }
  assert.ok(agg > grind, `aggressor (${agg}) should order up more than grinder (${grind})`);
});

test('allies: default available; beaten rivals unlock; others locked', async () => {
  const {
    DEFAULT_ALLY, ALLY_PROFILES, allyProfile, availableAllies, isAllyUnlocked,
  } = await import('../js/allies.js');
  const { STYLES } = await import('../js/ai.js');
  assert.ok(availableAllies({}).includes(DEFAULT_ALLY));
  const store = { vesper: { wins: 1, losses: 0, beaten: true }, duke: { wins: 0, losses: 2, beaten: false } };
  assert.equal(isAllyUnlocked('vesper', store), true);
  assert.equal(isAllyUnlocked('duke', store), false);
  assert.equal(isAllyUnlocked(DEFAULT_ALLY, store), true);
  assert.equal(allyProfile(DEFAULT_ALLY).style, 'allyBalanced');
  for (const [id, profile] of Object.entries(ALLY_PROFILES)) {
    assert.ok(profile.label, `${id} needs a style label`);
    assert.ok(profile.description, `${id} needs a style description`);
    assert.ok(STYLES[profile.style], `${id} references missing AI style ${profile.style}`);
  }
});

test('allies: partner profiles change bidding and alone behavior', async () => {
  const { newGame } = await import('../js/engine.js');
  const { aiBid } = await import('../js/ai.js');
  const { allyProfile } = await import('../js/allies.js');
  const C = (rank, suit) => ({ rank, suit, id: `${rank}-${suit}` });

  const marginal = Object.assign(newGame(), {
    phase: 'bid1', dealer: 3, turn: 2, upCard: C('9', 'hearts'),
    hands: [
      [], [],
      [C('A', 'hearts'), C('K', 'hearts'), C('Q', 'hearts'), C('9', 'clubs'), C('10', 'diamonds')],
      [],
    ],
  });
  assert.equal(aiBid(marginal, 2, 'hard', allyProfile('duke').style).action, 'orderUp');
  assert.equal(aiBid(marginal, 2, 'hard', allyProfile('sage').style).action, 'pass');

  const loneChance = Object.assign(newGame(), {
    phase: 'bid1', dealer: 3, turn: 2, upCard: C('9', 'hearts'),
    hands: [
      [], [],
      [C('J', 'hearts'), C('A', 'hearts'), C('Q', 'hearts'), C('A', 'clubs'), C('9', 'diamonds')],
      [],
    ],
  });
  assert.equal(aiBid(loneChance, 2, 'easy', allyProfile('rex').style).alone, true);
  assert.equal(aiBid(loneChance, 2, 'easy', allyProfile('mac').style).alone, false);
});

test('tournaments: rounds list exactly two opponents (seat 2 = your ally)', async () => {
  for (const tour of TOURNAMENTS) {
    for (const round of tour.rounds) {
      assert.equal(round.opponents.length, 2, `${tour.id} round has ${round.opponents.length} opponents`);
    }
  }
});

test('tournaments: every roster id referenced by a cup exists', async () => {
  const { ROSTER } = await import('../js/personalities.js');
  for (const tour of TOURNAMENTS) {
    for (const round of tour.rounds) {
      for (const id of round.opponents) {
        assert.ok(ROSTER[id], `missing roster character: ${id}`);
      }
    }
  }
});

test('team names: opponent pairs receive stable readable names', async () => {
  const { teamNameForPair } = await import('../js/personalities.js');
  assert.equal(teamNameForPair('vera', 'pip'), 'Crimson Owls');
  assert.equal(teamNameForPair('nyx', 'vesper'), 'Shadow Ravens');
  assert.equal(teamNameForPair('vera', 'pip'), teamNameForPair('vera', 'pip'));
});
