# Naufal Farma POS — Apple Design

The runtime loads one standalone stylesheet: `src/design-system.css`. The previous `src/apple-design.css` and `src/style.css` stylesheets are removed from the active design system. HTML entry metadata enables light and dark color schemes; React applies the selected theme through `data-theme` on the document element.

## Design system
- Pharmacy identity uses emerald as the primary action color with separate light and dark semantic tokens.
- A single stylesheet owns the app shell, navigation, buttons, forms, cards, tables, dialogs, reports, inventory views and dashboard components.
- Translucent materials are limited to app chrome; transactional content and data surfaces keep readable contrast.
- Shared component states cover hover, pressed, disabled, focus-visible and reduced-motion preferences.
- Mobile safe-area insets, portrait and landscape layouts, reduced transparency and increased contrast are addressed.

## Responsive targets
- Desktop/tablet: persistent side navigation and flexible content column.
- Mobile portrait: six-item bottom navigation, two-column dashboard metrics and stacked content.
- Compact landscape: reduced-height header and navigation with denser metrics; narrow landscape uses a compact bottom dock.

## Invariants
This is a presentation-only migration. Preserve cashier and checkout behavior, pricing, inventory, Dexie/IndexedDB, CSV import/export and GitHub sync, barcode scanning, PDF reports, master-product CRUD, and Android navigation.

## Glass-HQ Liquid Glass
- The app integrates `@glass-sdk/liquid-glass` through its vanilla scene API. The React wrapper is not used because the package React entry requires React 19 while this app remains on React 18.
- GPU glass is limited to the app header and primary navigation. Progressive blur edges are placed at the content-facing edge of each surface.
- The scene follows the app light/dark setting. Transaction panels, inputs, prices, tables and dialogs retain solid/high-contrast surfaces.
- CSS surfaces remain the fallback when WebGL2/OffscreenCanvas is unavailable or reduced transparency is requested.
- Android WebView GPU performance and screenshot-level visual output still require device validation; successful CI build alone does not establish that audit.

## Verification
The GitHub Actions Android workflow is triggered by commits on the working branch. Portrait and landscape rules have been reviewed statically; physical-device and emulator visual QA are not claimed until performed.

Source guidance: https://github.com/emilkowalski/skills/tree/main/skills/apple-design
