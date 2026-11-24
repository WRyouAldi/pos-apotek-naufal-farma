# Migration Goal — POS Apotek Naufal Farma (Native Android Expo)

Goal: migrate POS Apotek Naufal Farma from React/Vite/Capacitor 6 to a fully redesigned native Android application using Expo + React Native. Follow the installed Expo `expo-web-to-native` skill and this repository's `migration-progress.md` worklist. Android APK is the only shipping target.

At the start of each iteration:
1. Re-read `skills://plugins/expo2/expo-web-to-native/skill.md` and the relevant references: `false-friends.md`, `native-patterns.md`, and `verify-on-device.md`.
2. Read `migration-progress.md`; select the first unchecked task in dependency order.
3. Work only on the branch `migration/expo-native-android` or a child branch. Never modify `main`.
4. Implement one bounded task or one screen per iteration. Keep the app buildable and update `migration-progress.md` with files changed, tests, evidence, and blockers.
5. Prefer native Android UX: Expo Router, `@expo/ui` for native controls where suitable, React Native primitives for custom layouts, virtualized lists for large datasets, safe-area and keyboard handling, haptics, and reduced-motion support. Do not ship HTML/CSS web screens or a WebView as the final app.
6. Use Expo SQLite for offline-first products, sales, and stock movements. Preserve atomic transaction semantics and create a tested Dexie-to-SQLite migration path before any data cutover.
7. Keep the pharmacy's Naufal Farma identity, emerald palette, accessible light/dark themes, visual-forward design, and portrait/landscape behavior.
8. Preserve the explicit cashier requirement: do not block cashier checkout with stock-availability validation. Keep checkout writes atomic and record sale/stock movement consistently. Inventory stock-out may retain its separate validation.
9. Replace web-only camera, PDF, file, and browser APIs with Expo/native Android modules. Verify real device behavior.
10. Verify by running the app, not only by compiling. Use an Android emulator and physical device. For critical flows capture runtime evidence and short motion recordings as appropriate. Do not mark a task complete on build success alone.

Important constraints:
- The existing Capacitor application on `main` is the rollback baseline and must remain untouched.
- Do not delete or refactor the Capacitor app while creating the Expo app.
- Do not change the default branch, merge, or cut over without the user's explicit approval.
- Do not introduce cloud sync, authentication, roles, or a backend without separate approval.
- No secrets or production data in source control.

Stop conditions:
- If no unchecked tasks remain, summarize completed work, test/device evidence, outstanding risks, and the proposed cutover PR.
- If blocked by missing hardware, credentials, data, or external access, mark the task blocked with the exact unlock needed and continue only with independent tasks.
- Never claim APK/device verification unless the actual build/install/run was performed.
