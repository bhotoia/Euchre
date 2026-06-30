# Euchre

Mobile-first Euchre against AI, delivered as an installable PWA and a self-contained Android WebView app. The app is dependency-light: vanilla HTML/CSS/JavaScript in the browser, Express only for local static serving, and no backend or accounts.

> **Agent contract:** Treat this file as the source of truth for the repository's current state. Update it in the same change whenever features, architecture, persistence, commands, build steps, important invariants, or known limitations change. Do not document planned behavior as implemented behavior.

## Current state

Last reviewed: **June 30, 2026**

- Working modes: **Solo**, **Train**, **Daily Deal**, and **Tournaments**.
- Games use standard 24-card Euchre, teams `[0,2]` vs `[1,3]`, and finish at 10 points.
- Solo and Train support Easy, Normal, and Hard opponents.
- The selected ally always occupies seat 2. Mac is the balanced default; recruited rivals use distinct bidding, alone, and lead profiles.
- Opponent pairs receive deterministic team names derived from their two characters; gameplay uses those names instead of the generic "Them" label.
- Train mode grades bids and card plays with a sampled imperfect-information coach, explains alternatives, tracks accuracy, and can auto-advance optimal moves.
- Five sequential three-round tournaments unlock card packs, badges, titles, rivals, and new allies; after The Masters, Prestige Seasons let players restart the ladder while keeping earned collection/career progress.
- Profile/team naming, stats, ranks, badges, rivals, trophies, cosmetics, preferences, tournament/prestige progress, and resumable games persist locally.
- Settings includes an English / Chinese Mandarin (`中文（普通话）`) language picker. The Settings row shows the current language and opens a focused choice modal; Mandarin mode localizes the main navigation, Settings, rules, Daily Deal state, gameplay prompts, bidding/discard sheets, coach shell, and result UI while leaving player-entered names and character names intact.
- Settings includes a Slow/Fast game-speed toggle. Slow is the default for new or learning players; Fast preserves the previous brisk pacing.
- Shared career stats include Solo, Train, official Daily Deal attempts, and Tournament hands and games.
- Daily Deal generates the same offline date-seeded deals, ally, opponents, and difficulty for everyone; only the first attempt is official.
- The streamlined home screen focuses on the four play modes. Clubhouse groups team, stats, trophies, and card packs; Settings groups identity, feedback, appearance, rules, about/privacy/support, and data controls.
- Settings includes an About screen with app version/build, current local-only privacy posture, support guidance, application id, and data-storage summary.
- The repo includes a no-domain static privacy site in `docs/` for GitHub Pages-style hosting.
- The repo includes Play Store handoff drafts, Data Safety notes, release checklist, and generated listing assets under `docs/play-store/`.
- The app works offline after its PWA shell has been cached.
- Android packaging has a Gradle/App Bundle path for Play Store readiness. Web assets are still bundled into a fullscreen WebView app before native builds.
- The iPhone version is the installable iOS Home Screen/PWA build. It includes Apple web app metadata, a 180×180 touch icon, recent-iPhone launch images, and safe-area-aware layouts for SE through Plus/Pro Max style screens. A signed App Store `.ipa` still requires a macOS/Xcode packaging step outside this Windows workspace.
- There is no server-side data, login, cloud sync, telemetry, online multiplayer, or pass-and-play.
- Pass-and-play was intentionally removed; do not restore or describe it as planned without an explicit product decision.

## Run and verify

Requirements: Node.js and npm.

```bash
npm install
npm start
```

Open `http://localhost:5050`. The server binds to `0.0.0.0` and prints LAN URLs for testing on a phone. Set `EUCHRE_PORT` to use another port.

Before handing off a change, run the checks relevant to it:

```bash
npm run check            # JavaScript syntax checks
npm run security:check   # npm audit plus repo security posture checks
npm test                 # 59 engine, coach, daily, cosmetics, UI, stats, ally, language, team-name, speed, prestige, iPhone PWA, and progression tests
npm run test:sim         # 250 full AI games; validates legal play/completion
npm run test:coach-sim   # slower coach-vs-hard-AI soundness check
npm run android:bundle   # regenerate ignored android/assets/
npm run android:apk      # Gradle debug APK for local Android installs
npm run android:aab      # Gradle release Android App Bundle for Play Console upload
```

Verified for this handoff on June 30, 2026:

- `npm run check`: pass
- `npm run security:check`: pass
- `npm test`: 59/59 pass
- `npm run android:apk`: pass; output `android/app/build/outputs/apk/debug/app-debug.apk`
- `npm run android:aab`: pass; output `android/app/build/outputs/bundle/release/app-release.aab`
- Browser smoke test at 390×844: Settings → About opens, shows `Version 2.28 (39)`, and has no horizontal overflow.
- S24+ Wi-Fi ADB install: `com.offlineeuchre.cardgame` version `2.28` / code `39` installed and launched successfully after the premium order-up recipient cue and pickup/discard bug fixes.
- S24+ active user package check: only `com.offlineeuchre.cardgame` remains; `com.offlineeuchre.cardgame.debug` was removed to avoid duplicate app icons.
- Release signing with private PKCS12 upload keystore outside the repo: pass; `jarsigner -verify` reports `jar verified`
- Static no-domain privacy page: `docs/privacy-policy.html` added and covered by tests.
- Play listing assets generated: 1024×500 feature graphic, five 432×864 phone screenshots, five 1080×1920 7-inch tablet screenshots, and five 1200×1920 10-inch tablet screenshots under `docs/play-store/assets/`.
- Bug fixes covered by tests: discarded card preview centers inside the shaded discard target; Slow/Fast game speed is normalized, persisted, and refreshed from storage.
- Bug fixes covered by tests: order-up drawer shows a compact premium cue for who receives the turned-up card and which team they are on; dealer receives the turned-up card before pickup animation completes when another player orders it up alone.

Previously verified on June 25, 2026:

- `npm run test:sim`: 250/250 games complete with legal plays
- `npm run test:coach-sim`: coach team won 35/40 games
- `npm run android:bundle`: pass
- Browser UI audit: Daily Deal hub, menu, progression screens, tournament copy, bid/coach overlays, and gameplay HUD verified at 320×568 and 390×844 without console errors
- Gameplay polish audit: enlarged bidding-hand cards fit both phone sizes, bid sheets remain fully visible, the score/trump cluster is centered, the 320 px HUD has no horizontal overflow, and contract/status copy uses natural team-neutral wording
- Daily determinism check: two complete seeded AI runs produced identical 269-event transcripts and final scores

The simulation commands currently print Node's `MODULE_TYPELESS_PACKAGE_JSON` warning because browser modules are ES modules while `package.json` does not declare `"type": "module"`.

## Gameplay rules and invariants

- Seats advance clockwise: human seat 0, west seat 1, ally seat 2, east seat 3.
- `TEAM_OF(seat)` is `seat % 2`; team 0 is always the player's team.
- The left bower has trump's effective suit and must follow trump, not its printed suit.
- Bidding has two rounds. Round two cannot call the turned-down suit.
- If all four players pass in both rounds, the hand is redealt. This app does **not** use stick-the-dealer.
- Going alone benches the caller's partner and each trick has three players.
- Makers score 1 for 3–4 tricks, 2 for a five-trick march, or 4 for an alone march. Defenders score 2 for a euchre.
- Legal follow-suit enforcement derives the live led suit from `trickPile[0]` via `currentLedSuit(state)`. The cached `state.ledSuit` exists for compatibility/UI state, but must not be the only authority because saved/resumed or timing-edge states can drift.
- Mutating game transitions and legality checks belong in `js/engine.js`; card/suit comparison rules belong in `js/cards.js`. UI code should not duplicate either.
- Keep engine state serializable because autosaves and coach worker messages use plain structured data.
- `resultStatsRecorded` travels with saved engine state so resuming a result screen cannot double-count the hand or game.

## Features

### Solo

- Human plus selected AI ally against two AI opponents.
- Easy/Normal/Hard bidding and play profiles.
- Save-and-resume slot independent from Train and Tournament saves.
- Last-trick review, rules/help, sound, haptics, animations, and reduced-motion support.
- Compact-phone layouts keep menus, the gameplay HUD, sheets, dialogs, and progression grids usable without horizontal overflow.
- The app includes a few hidden cosmetic Easter eggs. They may award hidden badges or temporary visual flourishes, but they must not change gameplay rules, odds, AI behavior, or progression balance.
- On short screens, home-card descriptions collapse automatically so every primary destination remains visible without scrolling.
- Bidding sheets show a larger preview of the player's hand without crowding the available actions.
- During round-one bidding, the bid drawer shows a full-bright preview of the turned-up card, not just a text label, so the order-up decision is visually obvious.
- Dealer discard is intentionally distinct from trick play: the hand enters discard mode, cards are labelled as discard actions, the center discard zone is visible, a card requires a second tap to confirm, and the discard flight should be readable without feeling sluggish. The discarded card settles in the center of the shaded discard target.
- Dealer discard must not dim the player's hand; the discardable cards stay full-strength while the center table cue explains the temporary mode.
- Gameplay pace is user-selectable in Settings and persists under `euchre.feedback.v2`. Slow is the default and stretches gameplay waits for newer players; Fast uses the previous timing scale. Quips are fire-and-forget flavor, coach auto-advance should not wait on partner praise, deal animations use short stagger timing, and trick-play delays route through the shared speed-aware pacing helper.
- Audio feedback distinguishes hand outcomes: euchring an opponent uses a bright celebratory sting, while getting euchred keeps a heavier negative thud.
- Frequent card-play taps use a softened low-volume felt cue so repeated card plays are less abrasive than hand/result sounds.
- Sound and haptics use distinct outcome language for card taps, bids, won/lost tricks, made/lost hands, euchres, marches, game win/loss, and rewards. All remain governed by the existing Settings toggles.
- The centered score/trump display uses equal-width score pills so the trump badge stays on the true centerline; long team names truncate visually while remaining available as title text.
- End-of-hand opponent quips use the original table-bubble treatment, but they must never delay the result screen; wrapped side bubbles and an on-felt clamp keep lines from clipping off-screen.
- Hand and game result modals include a premium summary: outcome-specific title, why the hand swung, caller, trick split, point swing, and score. Train still adds coach recap details underneath.
- Contract and status messages share a spaced footer, while the gameplay score/trump cluster stays viewport-centered independently of visible action buttons; on compact screens Last Trick, Hint, and Help group into one small pill to avoid crowding the score.

### Train

- Same base game as Solo.
- Coach evaluates every human bid and play using PIMC-style sampled hidden-card worlds.
- Grades: optimal, good, inaccuracy, mistake, and blunder.
- Shows the recommended choice and a contextual explanation.
- Coach sheets are progressive-disclosure: the first visible coaching line is an action-first "do this, not that" recommendation, and the deeper explanation, card comparison, concept, principle, mistake cost, and drill sit behind a "Read the reasoning" expander.
- Bid coaching must never describe the dealer as “your partner”; same-suit corrections should name the real issue, such as going alone vs bringing your partner.
- Optional hint and auto-advance for optimal decisions; the in-game coach sheet mirrors the saved auto-advance state every time it opens.
- Per-hand and per-game recaps feed persistent coach accuracy, rank progression, and the weakest lesson concept to practice. Game-end Train recaps include a Mastery Path card with current rank, game/career accuracy, next Master gate, and one focused drill.
- Web builds evaluate in `coach.worker.js`; unsupported environments fall back to the main thread. Android intentionally uses synchronous evaluation.

### Daily Deal

- The local calendar date deterministically selects the ally, two opponents, difficulty, every deal, and any randomized AI style decisions.
- Everyone receives the same challenge without a server or network connection.
- The first run is the only official attempt and is resumable; leaving without saving records a forfeit.
- After the official result is locked, players may replay the same seeded game for practice only. Replays do not replace the official score and do not affect Daily score, streaks, bests, history, or shared career stats.
- Scores reward winning, point margin, euchres, and successful lone hands while penalizing extra hands.
- Local history tracks official results, personal best, and consecutive non-forfeited daily completions.
- The fixed daily ally may be a character the player has not recruited yet.

### Tournaments and progression

Tournament order: The Cellar → The Parlour → The Highrise → The Vault → The Masters.

- Each cup contains three matches with fixed opponents and difficulty.
- Tournament face-offs present the event context before the deal: venue, difficulty, opponent team, and cup reward at stake.
- Tournament hands and games contribute to the same career stats, streaks, ranks, and applicable badges as Solo and Train.
- Cup wins unlock a themed card pack, badge, title, and the next cup.
- Completing all five cups unlocks Prestige Seasons. Starting a Prestige Season resets the tournament ladder only; earned cups, titles, packs, rivals, stats, badges, and history remain kept. Clearing The Masters during a Prestige Season completes that season, awards a prestige title, and opens the next season loop.
- Achievements now cover early milestones and long-tail mastery: wins, games played, hands played, points, euchres dealt, marches, lone hands, win streaks, coach accuracy, cup clears, rival sweep, prestige cup wins, and multiple prestige-season clears. Some are intentionally very hard.
- Beating rivals records head-to-head results; beaten rivals become selectable allies.
- Recruited allies retain distinct visible styles: conservative callers, trump attackers, card counters, wildcards, and frequent/rare lone-hand players.
- Card packs: Classic Green, Midnight, Obsidian Holo, Crimson Club, Royale, Neon Nights, and Gilded Master.
- Settings includes an Appearance row that summarizes the equipped card pack with a mini preview and opens Card Packs; the Card Packs back button returns to the hub that opened it.
- Pack thumbnails are theme-isolated, tournament rewards use a dedicated full-size card-back reveal, and foil packs use static highlights rather than continuous animation. Live card faces for foil/gold packs must keep overflow visible so play-state badges such as LEAD and discard labels do not clip.
- Tournament reward reveals list the earned card pack, title, and badge so the cup win feels like a claimed prize rather than a plain alert.
- Ranks are Novice, Sharp, Shark, and Master. Master requires 50 wins and, after at least 50 graded moves, 70% coach accuracy.
- Solo, Train, official Daily Deal attempts, and Tournament play all update the shared game/hand career stats; cup progression and daily history remain separately persisted.

## Architecture

The browser loads `index.html` → `js/main.js` → `js/ui.js`. `ui.js` coordinates screens and delegates rules, AI, coaching, persistence helpers, and effects to focused modules.

| Path | Responsibility |
| --- | --- |
| `index.html` | All screens, sheets, dialogs, and PWA registration |
| `css/style.css` | Responsive layout, animation, table venues, and card-pack themes |
| `js/cards.js` | Deck, bowers, effective suits, legal following, card/trick strength |
| `js/engine.js` | Pure mutable game state machine and scoring |
| `js/ai.js` | Difficulty-based bidding/play plus character styles |
| `js/coach.js` | Sampled move evaluation, EV comparison, grading, explanations |
| `js/coach.worker.js` | Off-main-thread coach execution for the web build |
| `js/coach-client.js` | Worker façade with synchronous fallback |
| `js/ui.js` | Main controller, rendering, input, game loop, saves, and progression wiring |
| `js/stats.js` | Stats, badges, ranks, achievement thresholds, and storage |
| `js/profile.js` | Sanitized player/team identity |
| `js/tournaments.js` | Cup catalog, unlock gates, progress, and Prestige Season state |
| `js/daily.js` | Date seeding, deterministic RNG, official history, scoring, streaks |
| `js/cosmetics.js` | Pack ownership/selection and DOM theme application |
| `js/personalities.js` | Character roster, AI styles, dialogue, and deterministic opponent team names |
| `js/portraits.js` | Generated SVG portrait markup |
| `js/rivals.js` | Rival catalog, dialogue, and head-to-head records |
| `js/allies.js` | Ally selection/unlock rules, AI profile mapping, and visible style descriptions |
| `js/career.js` | Earned titles and cups |
| `js/events.js` | Small internal event bus |
| `js/juice.js` | Sound, haptics, confetti, flashes, and celebrations |
| `server.js` | No-cache Express development server |
| `sw.js` | Network-first PWA cache with offline fallback |
| `ios/` | iPhone Home Screen/PWA install guidance and supported viewport notes |
| `test/` | Node tests and full-game simulations |
| `android/` | Native wrapper, Gradle/App Bundle project, legacy direct APK script, resources, and WebView asset bundler |
| `docs/` | Draft privacy policy markdown, static no-domain privacy site, and Play Store handoff materials/assets |

`js/ui.js` is currently the largest and most coupled file. Prefer putting new pure rules or persistence logic in a focused module with tests, while leaving DOM orchestration in `ui.js`.

## Game state and persistence

`newGame()` creates the canonical engine state. Important phases are:

`idle → bid1 → discard/play` or `bid1 → bid2 → play`; completed hands enter `handEnd`, passed-out hands enter `redeal`, and a score of 10+ enters `gameEnd`.

All user data is browser/WebView `localStorage` under the `euchre.` prefix:

| Key | Contents |
| --- | --- |
| `euchre.saves.v1` | Map of independent `ai`, `train`, and `tour` autosaves |
| `euchre.feedback.v2` | Sound, haptics, language, game speed, training auto-advance, per-mode difficulty |
| `euchre.stats.v1` | Games, hands, scoring, streaks, coach accuracy, cup/prestige counts, badges |
| `euchre.profile.v1` | Player and team names |
| `euchre.cosmetics.v1` | Owned and active card pack |
| `euchre.tournaments.v1` | Cup rounds cleared/completed plus Prestige Season state |
| `euchre.rivals.v1` | Rival wins, losses, and beaten state |
| `euchre.career.v1` | Titles, active title, and cups won |
| `euchre.ally.v1` | Selected ally |
| `euchre.daily.v1` | Official Daily Deal scores, results, and history |
| `euchre.seenWelcome` | First-run welcome dismissal |

There are no formal storage migrations. If a persisted shape changes, preserve backward-compatible defaults, bump the affected key/version when necessary, and document the migration here. “Reset everything” deletes every local key beginning with `euchre.`.

## PWA and Android

### PWA

- `manifest.json` configures a portrait standalone app.
- `index.html` includes iOS Home Screen metadata, Apple touch icon, and recent-iPhone launch images.
- iPhone install path is Safari → Share → Add to Home Screen. See `ios/README.md`.
- `sw.js` precaches the app shell and uses network-first fetches with cache fallback.
- When changing shell assets or caching behavior, update the `SHELL` list and bump the `CACHE` name so installed clients receive the change.

### Android

```bash
npm run android:bundle
npm run android:apk
npm run android:aab
```

Gradle builds run `android/bundle.js` automatically before native packaging, so `npm run android:bundle` is only needed when you want to stage WebView assets without building Android.

Outputs:

- Debug APK for local installs: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release Android App Bundle for Play Console: `android/app/build/outputs/bundle/release/app-release.aab`

Release signing is configured through environment variables. Without them, `npm run android:aab` still produces an unsigned release bundle for local validation.

The current private upload keystore and environment script were generated outside the repo at `C:\Users\Amrit\Documents\Euchre Play Store Secrets`. Back up that folder securely before uploading the first Play release. Do not commit or share those files.

```powershell
$env:EUCHRE_RELEASE_KEYSTORE="C:\path\to\upload-keystore.p12"
$env:EUCHRE_RELEASE_STORE_PASSWORD="store-password"
$env:EUCHRE_RELEASE_KEY_ALIAS="upload"
$env:EUCHRE_RELEASE_KEY_PASSWORD="key-password"
npm run android:aab
```

The legacy direct APK builder is still available for comparison:

```bash
npm run android:build:legacy
```

On PowerShell, if `npm run android:build:legacy` fails because the `C:\Program Files\Git\bin\bash.exe` path is split incorrectly, use:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' 'android/build.sh'
```

- `android/bundle.js` concatenates modules in dependency order, strips imports/exports, injects worker/namespace shims, transforms `index.html`, and stages ignored `android/assets/`.
- The WebView cannot load the normal `file://` ES-module/worker setup, so Android runs coach evaluation synchronously.
- `android/gradlew` builds with Gradle 8.9 and Android Gradle Plugin 8.7.3. The Gradle source set points at the existing `android/AndroidManifest.xml`, `android/java/`, `android/res/`, and generated `android/assets/` paths.
- Gradle uses application id `com.offlineeuchre.cardgame`, compile SDK 35, target SDK 35, min SDK 24, Java 17, `versionCode` 39, and `versionName` 2.28.
- `android/build.sh` is the legacy no-Gradle direct APK builder. It uses Android SDK Build Tools 35.0.1, platform 35, Java 17, min SDK 24, and target SDK 35.
- The legacy script contains Windows-specific default paths for the Android SDK, Android Studio JBR, and Git Bash. Environment variables can override SDK/JBR locations.
- Legacy output is `android/build/euchre.apk`, signed with a local debug keystore.
- Android app versioning is duplicated in `android/app/build.gradle` for Gradle builds and `android/AndroidManifest.xml` for the legacy direct build; keep them in sync until the legacy path is removed.
- Re-run the bundle whenever web assets change before testing or building Android.
- Gradle prints a warning that the manifest `package` attribute is ignored for namespace purposes. That attribute remains for the legacy direct build.

Development phone update over Wi-Fi ADB:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" mdns services
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect PHONE_IP:ADB_PORT
npm run android:apk
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s PHONE_IP:ADB_PORT install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Use the legacy direct APK when installing the final application id without the Gradle debug `.debug` suffix:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' 'android/build.sh'
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s PHONE_IP:ADB_PORT install -r android\build\euchre.apk
```

### Release and update process

For every Play Store candidate:

1. Confirm the permanent `applicationId`, `versionCode`, and `versionName` in `android/app/build.gradle`.
2. Keep `APP_INFO` in `js/ui.js` and the legacy manifest version in `android/AndroidManifest.xml` in sync until app metadata is centralized or the legacy build is removed.
3. Update `README.md` with feature, storage, verification, and known-risk changes made in the release.
4. Run `npm run check`, `npm run security:check`, `npm test`, and `npm run android:aab`.
5. For gameplay, AI, coach, persistence, or UI-flow changes, also run the relevant simulations and a phone-sized browser smoke test.
6. Build the release bundle with the real upload keystore environment variables set.
7. Upload the `.aab` to an internal or closed testing track first, review Play pre-launch results, then promote when the release is clean.
8. Tag or otherwise record the shipped `versionCode`, `versionName`, commit/branch, upload date, and Play track.

For bug-fix releases:

- Fix narrowly and add or update the smallest meaningful regression test.
- Always increment `versionCode`; increment `versionName` as a patch release when the change is user-visible or store-facing.
- Re-run at least `npm run check`, `npm run security:check`, `npm test`, and `npm run android:aab`.
- Document the fix and verification in this README before upload.
- If the bug affects saved data or local storage shape, preserve backward-compatible defaults or add a versioned migration and document it in the persistence section.

## Play Store readiness

Current release-readiness status:

- The app can now produce a Play Console upload format: `app-release.aab`.
- The app now has an in-app About/Privacy/Support screen describing the current local-only data posture.
- Permanent Android application id selected: `com.offlineeuchre.cardgame`.
- Support email selected: `abhotoia@gmail.com`.
- Privacy policy exists at `docs/privacy-policy.md`, with a static page at `docs/privacy-policy.html`. Public URL for Play Console: `https://bhotoia.github.io/Euchre/privacy-policy.html`.
- A real PKCS12 upload keystore and env script exist outside the repo at `C:\Users\Amrit\Documents\Euchre Play Store Secrets`; they still need secure backup before first upload.
- Play Store draft materials exist under `docs/play-store/`: listing copy, release notes, App content notes, Data Safety worksheet, content-rating notes, security notes, asset manifest, feature graphic, phone screenshots, and tablet screenshots.
- Public privacy policy URL: `https://bhotoia.github.io/Euchre/privacy-policy.html`.
- The app currently has no backend, login, cloud sync, telemetry, ads, or Play Games integration. This keeps the initial Data Safety posture simpler, but Play Console declarations and a privacy policy are still required before listing.
- If Google sign-in, Play Games Services, cloud saves, achievements, leaderboards, analytics, ads, or crash reporting are added, update the privacy policy, Play Data Safety answers, and README storage/account sections in the same change.
- Security health checks are scripted with `npm run security:check`; keep that gate green before each Play upload or track promotion.

## Known limitations and risks

- No online play, pass-and-play, backend, cloud sync, account recovery, or cross-device progression. Pass-and-play is intentionally out of scope.
- No automated browser/end-to-end, accessibility, service-worker, Play Console pre-launch, or Android instrumentation tests.
- `ui.js` is a large controller, so apparently small UI changes can affect game-loop cancellation, modal focus/inert state, autosaving, and Android back behavior.
- The Android bundler is regex/concatenation based. New import patterns, duplicate top-level names, or changed dependency order can break only the Android build.
- The Play Store release path is packaging-ready but not store-submitted: the app still needs a hosted privacy policy URL, Play Console declarations, final free/paid choice, and internal/closed track testing.
- Service-worker cache invalidation is manual.
- Storage schema migration is manual.
- AI and coach quality are heuristic/statistical. Deterministic unit tests should use seeded RNG; strength claims should also be checked with simulations.
- The repository currently has no commits and all project files are untracked. Preserve user work and inspect `git status` before making changes.

## Change checklist for future agents

1. Inspect `git status` and avoid overwriting unrelated work.
2. Keep card rules in `cards.js`, transitions/scoring in `engine.js`, and new testable logic outside `ui.js`.
3. Add or update deterministic tests for rules, AI/progression behavior, and persistence helpers.
4. Run `npm run check`, `npm run security:check`, and `npm test`; run simulations for AI/coach changes.
5. Smoke-test the affected browser flow at a phone-sized viewport.
6. Run `npm run android:bundle` for web changes and test `npm run android:apk` for Android-sensitive changes. Run `npm run android:aab` before Play Store handoff.
7. Bump the service-worker cache when cached assets change.
8. Update this README so its feature list, architecture, commands, persistence table, limitations, and verification status remain truthful.
