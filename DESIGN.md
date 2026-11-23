# Naufal Farma POS — Apple Design

The application loads exactly one stylesheet: `src/apple-design.css`. It owns the app shell, all component styling, themes, responsive layouts, motion and accessibility. No legacy stylesheet, Hallmark theme, or third-party design CSS is loaded.

## Principles
- Calm, purposeful pharmacy interface with emerald identity.
- Native system typography and clear hierarchy.
- Translucent material is reserved for floating chrome; transaction data, prices, forms and reports remain legible.
- Immediate, restrained interaction feedback; no decorative gesture physics without a real gesture.
- Light and dark themes, safe-area insets, touch targets, keyboard focus, reduced motion, reduced transparency and increased contrast.

## Invariants
Presentation-only migration. Preserve cashier and checkout behavior, pricing, inventory, Dexie/IndexedDB, CSV import/export and GitHub sync, barcode scanning, PDF reports, master-product CRUD, and Android navigation.

Source: https://github.com/emilkowalski/skills/tree/main/skills/apple-design
