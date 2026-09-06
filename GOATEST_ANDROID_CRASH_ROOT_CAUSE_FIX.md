# GOATEST ANDROID CRASH ROOT-CAUSE FIX

## 1. CURRENT CRASH CAPTURE

- timestamp: 2026-09-06 19:11:43.427 and 19:12:04.613
- PID: 16579 and 17121
- signal/exception: uncaught `IllegalStateException`, wrapped in `RuntimeException`/`InvocationTargetException`
- crashing thread: `CapacitorPlugins`
- library/class: `com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin`
- function: `PushNotificationsPlugin.register()`
- exact stack evidence: `FirebaseMessaging.getInstance()` threw `Default FirebaseApp is not initialized in this process com.goatest.app`

The same pre-fix process also produced a separate native tombstone at 2026-09-06 19:12:16.766: PID 17121, `SIGILL` in `libwebviewchromium.so` during `WV.qi1.onTrimMemory`. Older tombstones contain the same historical WebView signature. Both records predate the corrected installation.

## 2. ROOT CAUSE

- exact cause: the app invoked Capacitor `PushNotifications.register()` without native Firebase resources. The Android plugin called `FirebaseMessaging.getInstance()` and terminated the process on an uncaught `IllegalStateException`.
- trigger: app notification initialization reached push registration while `google-services.json`/generated native `google_app_id` was absent.
- evidence: fresh crash-buffer entries named `PushNotificationsPlugin.register`, `FirebaseMessaging.getInstance`, and `Default FirebaseApp is not initialized`.

## 3. FIX IMPLEMENTED

- files changed:
  - `home/android/app/src/main/java/com/goatest/app/MainActivity.java`
  - `home/src/services/androidNotificationService.ts`
- exact change: exposed a native capability check for the generated `google_app_id` resource. Push listeners and `PushNotifications.register()` now run only when native Firebase is configured. Local notifications still initialize and operate normally.
- why it fixes the crash: the unsafe Capacitor FCM call is never made in the current APK configuration. When valid native Firebase resources are later supplied, the existing FCM path remains available.

The same `MainActivity.java` also retains the lifecycle hardening from the previous fix: unknown routes never exit, WebView calls are guarded, polling stops on lifecycle pause/stop/destroy, and renderer loss does not finish the Activity.

## 4. REGRESSION CHECK

- authentication: build/runtime launch verified; authenticated flow not available on emulator
- Home: startup shell verified
- Settings: not executed; no source changes
- Reports: not executed; no source changes
- Test: not executed; no source changes
- SHB: not executed; no source changes
- Compare: not executed; no source changes
- Condition: not executed; no source changes
- CRIB: not executed; no source changes
- AI: not executed; no source changes
- PDF: not executed; no source changes
- notifications: initialization crash path fixed; local notification feature preserved
- BLE: not executed; no source changes
- background/foreground: passed
- lock/unlock: passed

## 5. STRESS TEST

- 20 navigation cycles: not available because authenticated navigation was unavailable on the emulator
- 20 background cycles: passed; no current crash-buffer entries
- 20 lock/unlock cycles: passed; emulator voice overlay was dismissed and GOATEST resumed normally
- notification test: unsafe FCM startup path exercised before fix; corrected startup path survived without crash
- cold start: passed
- crash scan: passed after corrected APK installation

## 6. NEW CRASHES

NEW CRASHES: NONE

The corrected APK was installed at 2026-09-06 19:17:43. The latest tombstone remains 19:12, before the corrected installation. The post-fix crash buffer is empty for GOATEST.

## 7. FINAL VERDICT

PASS for the captured recurring application crash.

The proven current crash was an FCM native-registration configuration failure, and it is fixed without disabling local notifications or changing FCM backend architecture. The historical Android System WebView `SIGILL` was not reproduced in the post-fix run; it remains separate historical evidence.
