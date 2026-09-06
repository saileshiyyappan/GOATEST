# GOATEST App Lifecycle Audit

Date: 2026-09-06  
Scope: Android Activity lifecycle, Back navigation, WebView lifetime, and native crash evidence.

## Executive finding

The frequent “app closing” behavior was caused by the app intentionally finishing its Android Activity during ordinary Back navigation. It was not demonstrated to be a native crash.

`MainActivity.handleBack()` evaluated a JavaScript route handler and called `finish()` whenever the result was `"exit"`. The web app is a single-page application, so URL-path checks could miss valid in-app states. When that happened, one ordinary Back press terminated the Activity and returned to the launcher.

## Evidence

- The previous implementation contained a direct `finish()` call on the normal Back path.
- The route handler only recognized `/condition`, `/shb`, `/crib`, and `/home` before returning `"exit"`.
- The handler’s shell-tab check was restricted to the `/home` branch, which made it possible for a valid SPA tab state to fall through.
- A fresh device logcat scan after reproducing the flow showed no `FATAL EXCEPTION`, `AndroidRuntime`, native signal, or app ANR signature.
- With the fix installed, the first Back press kept focus on `com.goatest.app/com.goatest.app.MainActivity` and the crash scan passed.

## Corrective changes

`home/android/app/src/main/java/com/goatest/app/MainActivity.java` now:

- checks the active shell tab independently of the URL path;
- prevents accidental Activity termination on the first root-level Back press;
- requires a second Back press within two seconds before exiting;
- pauses the system-surface polling callback in `onPause()` and resumes it in `onResume()`;
- guards WebView access when the Capacitor bridge is not ready;
- continues removing callbacks during `onDestroy()`.

## Validation

- TypeScript lint: passed.
- Web production build: passed.
- Capacitor Android sync: passed.
- Gradle `assembleDebug`: passed.
- APK installation: passed.
- One-Back device smoke test: app remained in the foreground.
- Post-test crash scan: passed.

## Remaining lifecycle risks

Android may still recreate or kill an Activity under system memory pressure or process termination. That is separate from the confirmed accidental-close path and requires a long-duration/background stress test on representative devices.

The production AI path still requires deployment configuration outside this repository: a deployed HTTPS API URL in `VITE_API_BASE_URL` and the server-side `OPENROUTER_API_KEY`. Those values were not available for runtime verification in this workspace.
