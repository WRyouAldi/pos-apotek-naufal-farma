# Naufal Farma — Expo Native Android

This is a **separate React Native / Expo application**. The existing Vite + Capacitor app at the repository root is intentionally preserved as the legacy fallback and behavior reference.

## Scope

- Android only; native React Native UI (no WebView-based final screens).
- Offline-first local persistence with Expo SQLite.
- Full native redesign; do not carry over legacy CSS or DOM components.
- Keep the existing Capacitor application and its build configuration untouched during migration.
- The cashier transaction flow has **not** been ported in this foundation commit.

## Toolchain baseline

- Expo SDK 58
- React Native 0.88
- React 19.3
- Node.js 22.13+
- Expo Router and Expo SQLite versions aligned to SDK 58

Use the Expo agent CLI for Expo commands:

```sh
npx --yes @expo/agent-cli@latest --help
npx --yes @expo/agent-cli@latest status
npx --yes @expo/agent-cli@latest install --fix
npx --yes @expo/agent-cli@latest docs:search "SQLite"
```

Then run:

```sh
npm install
npm run typecheck
npx expo-doctor
npx expo start --android
```

If the local environment cannot run Expo commands, do not mark the scaffold as build-verified.

## Android identity

The migration build uses temporary application ID `com.naufalfarma.pos.native` so the legacy Capacitor APK and native migration APK can be installed side-by-side for comparison. Revisit the final production application ID only during an approved cutover.

## SQLite baseline

Database: `naufal-farma-native.db`, schema version 1.

- `products`: mirrors the legacy Product fields and preserves integer Rupiah amounts.
- `sales`: transaction header.
- `sale_items`: normalized transaction line snapshots, retaining product code/name/quantity/sell price/cost.
- `movements`: MASUK, KELUAR, and PENJUALAN audit rows.
- `app_meta`: app-level metadata and future migration markers.

The schema intentionally does **not** constrain product stock to non-negative values. The cashier must not reintroduce an available-stock checkout blocker. Transaction creation and associated movement/stock updates must be implemented atomically in a later, separately tested phase.

No legacy data is imported or modified by this scaffold.
