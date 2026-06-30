# Security Health Check Notes

Last updated: June 30, 2026

## Current posture

- No Internet permission.
- No backend endpoints.
- No third-party SDKs.
- No ads, analytics, telemetry, or crash reporting.
- `android:allowBackup="false"`.
- WebView file/content access is disabled in native code.
- JavaScript bridge exposes only local haptic feedback.
- Private signing files are outside the repo and ignored by git patterns.
- `npm audit --audit-level=moderate` currently reports 0 vulnerabilities.

## Repeatable command

```bash
npm run security:check
```

The command runs `npm audit` and `scripts/security-health-check.mjs`.

## Before adding account features

Do not add Google sign-in or Play Games Services casually. Adding them changes the Data safety posture, privacy policy, app-access declarations, QA matrix, and likely the support burden. For the first Play listing, the simpler offline/no-account release is lower risk.
