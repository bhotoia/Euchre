# Data Safety Draft

Last updated: June 30, 2026

Use this as the Play Console Data safety worksheet for the current app version. Re-check every answer before submitting because Play policy wording can change.

## Current app behavior

- No account system.
- No backend service.
- No Internet permission in the Android manifest.
- No ads, analytics, telemetry, crash reporting SDK, or third-party SDK.
- No online multiplayer or social features.
- Local app data is stored only in WebView/browser `localStorage` under the `euchre.` prefix.
- The only Android permission currently requested is `android.permission.VIBRATE`.

## Data collection and sharing

Recommended current answers:

- Does the app collect or share any required user data types? No.
- Is any user data shared with third parties? No.
- Is data encrypted in transit? Not applicable because this app does not transmit user data.
- Can users request data deletion? No server-side request path is needed because no data is collected by the developer. The app provides local deletion through Settings reset controls, and Android system settings can clear app storage.

## Local-only data disclosed in privacy policy

This local data is not transmitted to the developer in the current version:

- Player and team names entered in the app
- Saved games
- Sound, haptics, language, game speed, difficulty, and coaching preferences
- Career stats, badges, ranks, trophies, titles, card packs, allies, rivals, tournament progress, prestige progress, and Daily Deal history

## Future-change trigger

If any of these are added, update this file, the privacy policy, in-app About copy, README, and Play Console declarations in the same release:

- Google sign-in
- Play Games Services
- Cloud saves
- Achievements or leaderboards backed by an online service
- Analytics
- Crash reporting
- Ads
- Remote config
- Online multiplayer
- Any backend API
