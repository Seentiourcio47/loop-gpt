# Loop GPT — Joint Mobile Delivery Plan (Android APK + iOS, tested together)

Status: PLAN v1 (2026-09-05) · Owner: Chris + ops agents
North star: **one codebase, both stores, one shared QA pipeline**, shipping from the
existing Next.js product instead of a costly rewrite.

---

## 1. Strategy Decision — Capacitor-first shell (recommended), Expo RN later if needed

| Option | Time-to-store | UX fidelity | Risk | Verdict |
|---|---|---|---|---|
| **A. Capacitor wraps our Next.js web app** | **~2 weeks** | 95% (we already designed mobile-first w/ safe-areas) | Low | ✅ **v1 ship** |
| B. Expo React Native rewrite of chat surfaces | 6–8 weeks | 98% | Medium (reimplement streaming/UI kit) | ⏳ v2 candidate |
| C. KMP dual-client (previous roadmap idea) | 10–14 weeks | Native-parallax | High (two UI stacks) | ❌ drop for now |

Rationale: our web app already is the product (Aurora skin, PWA meta, safe-area insets,
drawer mobile nav). Capacitor gives the WebView a **native container** with push,
biometrics, camera/file intents, status-bar theming, splash — store-ready shells for
**both** platforms from one repo. Streaming SSE + audio mic need capacitor plugins
(`capacitor-http`, `@capacitor-community/http` not required; SSE works via fetch in WKWebView/Chrome).

Shared core = `frontend/app/lib/api.ts` (auth headers, streaming client) → extracted
into `packages/shared-core` (Week 1) so future RN only swaps the view layer.

## 2. Phased Timeline (two-week critical path)

**Week 1 — Foundation**
- [ ] `mobile/` workspace: `npx cap init LoopGPT io.loopgpt.app` (bundle ids: android
      `cyou.looggpt.app` ← **fix tld typo before store signup!**, ios `cyou.loopgpt.app`)
- [ ] Web build target: add `output: 'export'`-compatible passes OR cap-serve current
      Node build via `capacitor.config.server.url` pointing to **staging** web
      (`https://staging.loop-gpt.cyou`) — hybrid first, static-export second.
- [ ] Extract `lib/api.ts` + analytics into shared-core; smoke-test imports.
- [ ] Plugins: Splash (branded aurora splash), StatusBar (dark ink #06060a), Biometric
      login (iOS FaceID/Touch + Android Keystore — maps to existing JWT refresh),
      PushNotifications scaffolding (needs FCM + APNs keys ← **user-side console work**).

**Week 2 — Dual build + joint test**
- [ ] Android: signed `.aab` + universal `.apk` (debug + release). Keystore generated +
      stored in `mobile/android/keystore/` (**never in git**; password in Railway env/1Password).
- [ ] iOS: Xcode archive → TestFlight. Signing: **individual dev account first**
      ($99, no D-U-N-S needed) — org/DUNS remains future upgrade.
- [ ] Joint QA: one test matrix (below) executed by 5 internal testers × both platforms ×
      same staging tenant. Bugs triaged as `web+mobile` labels so fixes land once.
- [ ] Store art kit from Aurora: 512px icon (sparkle), 1024px iOS icon, feature graphic,
      6 screenshots/device — generated from landing assets.

## 3. Joint Test Matrix (both platforms, one checklist)

| Area | Cases |
|---|---|
| Auth | email signup/login, Google OAuth (in-app browser!), token refresh, biometric unlock, logout wipes |
| Chat | SSE streaming survives screen-rotate/backgrounding, long-thread scroll perf, model switch Std⇄Large mid-convo |
| Rich content | image artifacts render + save to Photos/Gallery, PDF/doc download shares to OS sheet |
| Voice/media | mic permission + transcription, video create flow progress UI |
| Network flanks | airplane-mode recovery, tunnel-drop resume (our SSE rehydration), notification push payload |
| Brand | splash, icons, dark-mode status bar, zero "GLM/provider" leaks anywhere (guardrail probe script on-device) |

Automated smoke nightly: our existing `byok.mjs` + `bisect4.mjs` suites run against staging
pointed at by the mobile builds' env, so **backend regressions surface before testers do**.

## 4. Rollout

- Android: Play **internal testing** (≤20 testers, no review wait) → closed test 12-tester
  cohort (personal acct constraint) → production staged 10→100%.
- iOS: TestFlight internal (instant) → external brief review → phased release.
- Both consumption endpoints point at production `/v1` with a dedicated
  `mobile-release` scoped key. Crash reporting wired (Sentry already in web deps).

## 5. Immediate user-side prerequisites (parallel to Week 1)

1. Google Play Console seat ($25) + invite `chrisdemonxxx@gmail.com`.
2. Apple Developer ($99, individual; enable 2FA; App Store Connect API key).
3. Firebase project (FCM for Android push) — sender ID later into Railway envs.
4. Confirm final bundle ids + app names (display: `Loop GPT`).

Agents-run next concrete step: scaffold `mobile/` Capacitor workspace + splash/icon
assets + debuggable Android APK wired to staging (deliverable: signed debug APK you can
sideload today).
