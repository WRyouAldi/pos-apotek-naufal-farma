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
