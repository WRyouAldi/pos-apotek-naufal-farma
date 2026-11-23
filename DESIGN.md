# Naufal Farma POS — Apple Design

The runtime loads one stylesheet: `src/apple-design.css`. This file owns the application shell, component presentation, theme tokens, responsive behavior, motion and accessibility. `src/style.css` is removed and is not imported. No Hallmark or third-party CSS runtime is required.

## Design system
- Pharmacy identity uses emerald as the primary action color, with distinct light and dark semantic palettes.
- Component surfaces use shared tokens for canvas, surface, text, border, elevation, radius, blur and motion.
- Translucent materials are limited to navigation and floating surfaces; transaction data, prices, forms and reports retain solid contrast.
- Buttons, fields, cards, tables, product pickers, reports, settings and dialogs use shared component dimensions and interaction states.
- System typography, safe-area spacing, touch targets, visible keyboard focus, reduced motion, reduced transparency and increased contrast are supported.

## Responsive targets
- Desktop/tablet: persistent side navigation and flexible content column.
- Mobile portrait: six-item bottom navigation, two-column dashboard metrics and stacked content.
- Compact landscape: reduced-height top bar and navigation, denser metrics, and reserved space for the bottom dock on narrow devices.

## Invariants
Presentation-only migration. Preserve cashier and checkout behavior, pricing, inventory, Dexie/IndexedDB, CSV import/export and GitHub sync, barcode scanning, PDF reports, master-product CRUD, and Android navigation.

## Audit note
The previous component styling is being consolidated into this single owned stylesheet. The semantic Apple Design tokens and responsive overrides are now the final source of visual decisions; a complete visual rewrite of every historical selector and screenshot-based device QA are still separate verification tasks.

Source guidance: https://github.com/emilkowalski/skills/tree/main/skills/apple-design

## Glass-HQ Liquid Glass
- The app integrates @glass-sdk/liquid-glass through its vanilla scene API. The React wrapper is intentionally not used because the package React entry requires React 19 while this app remains on React 18.
- GPU glass is limited to the sticky app header and primary navigation dock. Progressive blur edges are placed at the content-facing edge of each surface.
- The scene follows the app data-theme light/dark setting. Transaction panels, inputs, prices, tables and dialogs remain opaque/high-contrast.
- Existing CSS glass remains the fallback when WebGL2/OffscreenCanvas is unavailable or reduced transparency is requested. No cashier, inventory, CSV, barcode, PDF or navigation logic is changed.
- Android WebView GPU performance and visual output still require device-level validation; a successful web build alone does not establish that audit.
