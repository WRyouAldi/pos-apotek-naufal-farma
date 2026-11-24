# Migration Progress — POS Apotek Naufal Farma → Expo Native Android

**Status:** Expo scaffold + feature map + SQLite schema v1 committed; dependency install/build/device verification pending; cashier transaction migration not started.  
**Target:** Android APK only. Full native UI/UX redesign.  
**Source of truth:** Existing Capacitor application on `main`.  
**Working branch:** `migration/expo-native-android`.  
**Rule:** Never commit migration work to `main`. Do not merge or replace the Capacitor app until release gates at the end of this document pass and the user explicitly approves.

## Product and architecture decisions

- Build a separate Expo + React Native application in an isolated directory (recommended: `native/`) or a clearly isolated migration workspace. Do not overwrite the Vite/Capacitor entry point.
- Final APK must use native React Native screens. A DOM/WebView shell may be used only as a short-lived migration bridge/baseline if useful; it is not an acceptable final screen or release architecture.
- Android is the only shipping platform in this project scope. Do not spend effort on iOS-specific glass effects or App Store release.
- Offline-first remains mandatory. Use Expo SQLite for products, sales, stock movements, and durable local data. Use SecureStore only if credentials are introduced; do not store ordinary inventory data there.
- Keep the existing product, sale, and movement domain semantics. Preserve transaction atomicity and audit history.
- Cashier rule: do not reintroduce the previously requested cashier stock validation. This must be explicitly reconciled with inventory consistency: checkout still writes a single atomic sale + stock movement and applies the agreed stock policy without blocking the cashier based on available stock. Stock-out operations in inventory may retain their own validation.
- Preserve pharmacy identity (Naufal Farma), light/dark themes, emerald pharmacy palette, accessible contrast, and a visual-forward layout. Redesign interactions for Android touch, safe areas, keyboard, back behavior, and portrait/landscape.
- Do not add cloud sync, login/roles, or backend dependencies as part of this migration unless separately approved. Existing catalog CSV import is not equivalent to transaction cloud sync.

## Repository baseline (observed)

- Current app: React 18 + TypeScript + Vite + Capacitor 6.
- Local database: Dexie / IndexedDB database named `naufal-farma-pos`.
- Domain entities: Product, Sale, Movement (MASUK, KELUAR, PENJUALAN).
- Current integrations include `html5-qrcode`, jsPDF, Capacitor Filesystem/Share, CSV import, JSON backup/restore.
- Existing source includes `src/App.tsx`, `src/db.ts`, `src/style.css`, and `src/ui.tsx`.
- Existing CSS and web UI are not portable as native styles. Do not carry forward legacy CSS selectors or web-only layout assumptions.
- Existing Android build uses Capacitor/Gradle. Expo build configuration and EAS Android APK profile will be created separately.
- No Expo migration build, SQLite data migration, physical-device test, or APK verification has been run yet.

## Worklist and order

### Assess / foundation (do first)

- [ ] Confirm repository default branch and record exact baseline commit SHA before implementation.
- [ ] Inventory every current route, tab, modal, action, input, report, and permission flow from the running Capacitor app.
- [ ] Capture a functional baseline for all screens and workflows; document expected outcomes, not only screenshots.
- [x] Define typed Product, Sale, SaleItem, Movement, MovementType, and legacy backup envelope in `native/src/domain/models.ts`.
- [x] Define SQLite schema v1, indexes, constraints, normalized sale items, and `PRAGMA user_version` migration in `native/src/db/`.
- [ ] Define migration format from Dexie IndexedDB and a safe export/import path. Never assume the Android WebView's IndexedDB is automatically visible to the native SQLite database.
- [ ] Define rollback and backup procedure before any destructive data migration.
- [x] Scaffold isolated Expo SDK 58 / React Native 0.88 workspace in `native/` with TypeScript, Expo Router, Android-only app config, temporary side-by-side package ID, and APK EAS profiles. (Install/build still pending)
- [ ] Set up native design tokens: pharmacy emerald, neutral surfaces, semantic status colors, typography, spacing, radii, elevation, light/dark mode, accessibility contrast.
- [ ] Establish CI checks: lint/typecheck, unit tests, Expo export/build, Android APK artifact, and migration tests.

### Native foundation

- [ ] Implement Expo Router native navigation and Android back handling.
- [ ] Implement reusable native components using `@expo/ui` where appropriate, React Native primitives for custom layouts, and virtualized lists for large catalogs.
- [ ] Implement safe-area handling, keyboard avoidance, orientation responsiveness, loading/empty/error/success states, haptics, and reduced-motion behavior.
- [ ] Implement theme persistence and system/light/dark theme behavior.
- [ ] Implement SQLite database initialization, schema migrations, repositories, and atomic transaction helpers.
- [ ] Implement database integrity checks and deterministic seed/test fixtures.

### Nativize-now screens (one screen per iteration)

- [ ] Dashboard: sales summary, quick actions, low-stock insight, date scope, refresh/loading/empty states.
- [ ] Cashier: product search, barcode entry, cart, quantity/price controls, payment/checkout, receipt; preserve agreed no-stock-blocking cashier behavior.
- [ ] Price check: barcode/manual search and clear result states; no unnecessary “barcode scanned” notification.
- [ ] Master products: complete create/read/update/delete, validation, search/filter, category, supplier, shelf, prices, stock, minimum stock, barcode.
- [ ] Stock-in: supplier/cost/quantity entry, atomic product update and MASUK movement.
- [ ] Stock-out: item/quantity/cost reporting and KELUAR movement, with inventory-specific stock rules.
- [ ] Sales reports: date filters, totals, transaction details, item breakdown, PDF export.
- [ ] Inventory movement reports: complete MASUK/KELUAR details including item name, quantity, purchase cost, line totals, and report grand total.
- [ ] Backup/restore: JSON export/import with schema version, validation, confirmation, transaction safety, and recovery tests.
- [ ] Settings: theme, pharmacy identity, data tools, app/build information, and safe destructive-action confirmation.

### Native integrations

- [ ] Replace `html5-qrcode` with `expo-camera` barcode scanning; handle permission denial, camera unavailable, lifecycle cleanup, torch if supported, and manual fallback.
- [ ] Replace Capacitor file APIs with Expo-compatible file APIs and Android document/share intents.
- [ ] Implement PDF generation and validate actual saved/opened PDF files on Android (not merely a successful share-sheet invocation).
- [ ] Implement CSV import with encoding/header/invalid-row handling and explicit import summary.
- [ ] Implement JSON backup/restore with checksums or integrity validation where practical, duplicate handling, and rollback.
- [ ] Verify offline behavior after force-close/relaunch and after device restart.

### Data migration and compatibility

- [ ] Define explicit Dexie-to-SQLite mapping for Product, Sale, Sale.items, and Movement.
- [ ] Export legacy data to a versioned JSON package from the existing Capacitor app.
- [ ] Import into SQLite in one controlled transaction; preserve IDs, timestamps, codes, quantities, prices, costs, notes, and movement types.
- [ ] Reconcile product stock against opening stock plus stock movements and sales; report discrepancies rather than silently changing data.
- [ ] Test empty, normal, large, malformed, duplicate, and interrupted migration cases.
- [ ] Verify counts and financial totals before/after migration.
- [ ] Keep original IndexedDB data and legacy APK/repository untouched until user approves retirement.

### Android verification

- [ ] Install and run on a physical Android device; emulator-only success is insufficient.
- [ ] Verify portrait and landscape on cashier, product list, reports, and barcode scanner.
- [ ] Verify small and large screen dimensions, font scaling, touch target sizes, contrast, and screen-reader labels.
- [ ] Verify app cold start, background/resume, process death, offline relaunch, and database recovery.
- [ ] Verify camera permission grant/deny/retry and scanner lifecycle.
- [ ] Verify PDF save/open/share, CSV import, JSON backup/restore, and Android system file picker.
- [ ] Run transaction tests for checkout, stock-in, stock-out, refunds/voids if supported, and simultaneous/double taps.
- [ ] Verify no accidental duplicate sale or partial stock mutation on interrupted checkout.
- [ ] Capture screenshots and short recordings for critical flows; compare behavior and content against the legacy app baseline.

### Release gates — all must pass

- [ ] TypeScript/typecheck and lint pass.
- [ ] Unit/integration tests pass, including SQLite transaction and migration tests.
- [ ] Expo Android production APK builds successfully in CI.
- [ ] APK installs and launches on a physical Android device.
- [ ] All core screens and buttons perform real actions; no placeholder controls.
- [ ] Cashier, stock movements, reports, PDF, barcode, backup, restore, and offline persistence pass end-to-end tests.
- [ ] Data migration reconciliation passes with zero unexplained discrepancies.
- [ ] Portrait/landscape and light/dark verification pass.
- [ ] No critical/high severity defects remain.
- [ ] User reviews the APK and explicitly approves migration cutover.

## Branch and release safety

1. All Expo work stays on `migration/expo-native-android` (or child branches from it).
2. Keep the existing Capacitor source and build workflow intact as the rollback path.
3. Never push migration commits to `main`; never change the repository default branch during migration.
4. Do not delete Capacitor dependencies, Android project, workflows, or source files until cutover is approved.
5. After all release gates pass, open a draft PR for review. Merge only after explicit user approval.
6. Retain a tagged/archived Capacitor release and a tested backup/export before any eventual retirement.

## Progress reporting format

For each screen/phase, record: status, changed files, tests run, device/build evidence, known defects, and rollback notes. Mark an item done only after runtime verification, not merely after code compiles.



## Work log — 2026-11-25

### Completed in `migration/expo-native-android`

- Added isolated Expo SDK 58 app under `native/`; root Capacitor/Vite project files were not changed.
- Added Android-only app config. Migration APK uses `com.naufalfarma.pos.native` so it can coexist with the legacy `com.naufalfarma.pos` app during testing.
- Added Expo Router root and a minimal native foundation screen; this is not a port of the business screens.
- Added `native/FEATURE-MAP.md` documenting legacy screen behavior, reports, barcode, PDF, CSV, JSON backup/restore, offline behavior, and the one-way GitHub catalog CSV sync.
- Added typed domain models and SQLite schema v1 (`products`, `sales`, `sale_items`, `movements`, `app_meta`) with indexes and initialization migration.
- Deliberately did not implement checkout or import legacy data in this phase.

### Verification status

- GitHub file writes completed on the migration branch.
- Expo dependency installation, TypeScript check, Expo Doctor, Android build, and physical-device runtime verification have **not** been run in this environment. Do not treat this scaffold as a verified APK.
- The legacy source currently has stock checks in the product picker and checkout. Native cashier must follow the user's previously approved no-stock-blocking rule; stock-out remains a separate inventory operation.
- SQLite schema intentionally permits negative product stock so the future cashier can apply that rule without a database constraint blocking the transaction.

### Next bounded tasks

1. Run the Expo agent CLI in a project-capable environment; align SDK 58 dependencies and generate the lockfile.
2. Run TypeScript + Expo Doctor; correct any SDK/config incompatibility.
3. Add database repository tests and verify schema initialization on Android.
4. Only then design and implement the cashier transaction service with one atomic sale + sale-item + movement + stock adjustment transaction. Do not port UI checkout until the service tests pass.
