# Play Store Release Checklist

Last updated: June 30, 2026

## Local gates

- `npm run check`
- `npm run security:check`
- `npm test`
- `npm run android:aab`
- Signed AAB build after dot-sourcing the private release env file
- `jarsigner -verify` on the release AAB
- Phone smoke test over Wi-Fi ADB when app code changes

## Private signing files

Private files live outside the repo:

- Folder: `C:\Users\Amrit\Documents\Euchre Play Store Secrets`
- Active keystore: `euchre-upload-keystore.p12`
- Env script: `release-signing-env.ps1`

Back up that folder securely before uploading the first Play release. Losing the upload key can block future updates unless Play App Signing recovery is used.

## Build signed AAB

```powershell
. "$env:USERPROFILE\Documents\Euchre Play Store Secrets\release-signing-env.ps1"
cd "C:\Users\Amrit\Documents\Claude\euchreapp"
npm run android:aab
jarsigner -verify -verbose -certs android\app\build\outputs\bundle\release\app-release.aab
```

Upload:

```text
C:\Users\Amrit\Documents\Claude\euchreapp\android\app\build\outputs\bundle\release\app-release.aab
```

## Play Console fields

- Create app: app name `Euchre`, game, card category, free, support email `abhotoia@gmail.com`.
- Initial availability: United States and Canada.
- App content: privacy policy URL, ads declaration, app access/sign-in, target audience, content rating, Data safety, permissions.
- Store listing: app icon, feature graphic, screenshots, short description, full description, contact email.
- Release: internal testing first, then review pre-launch report, then closed/open/production track as appropriate.

## External blockers

- Play Console login/account access.
- Google Play Developer account creation and identity/payment verification.
- Developer account and track testing requirements, especially if using a newer personal developer account.
