# Naufal Farma — Modular Rebuild Blueprint

## Direction
A ground-up product and architecture rebuild. Existing screens and CSS are migration references only, not a design or code template. Preserve business invariants and user data; replace presentation, navigation, assets, motion, and module boundaries.

## Product principles
- Pharmacy-first workflow: fast cashier, reliable catalog, auditable inventory movements, trustworthy reports.
- Visual-first but operationally dense: visual hierarchy supports scanning; prices, quantities, stock states, and totals remain explicit.
- Adaptive navigation: bottom bar on compact portrait, rail/sidebar on landscape and wide layouts.
- Light and dark themes share semantic tokens.
- Motion is purposeful, interruptible, and respects reduced-motion settings.
- Offline-first local operation, explicit sync status, resilient import/export and backup/restore.

## Target architecture
src/
  app/
    bootstrap/          # providers and startup
    shell/              # responsive shell and navigation
    routing/            # route registry and lazy feature mounting
    domain/             # entities, policies, use cases, repository contracts
    infrastructure/     # Dexie, sync, filesystem, scanner, PDF adapters
    features/           # dashboard, cashier, price-check, catalog, inventory, reports, settings
    shared/             # components, hooks, format, assets, motion
  design-system.css     # sole global style entry

## Module contracts
- Features expose route metadata and a screen entry point.
- Screens call feature use-cases; they do not access Dexie, filesystem, scanner, or network directly.
- Domain rules are framework-independent and contain no React or browser APIs.
- Infrastructure implements repository/service contracts and owns platform-specific behavior.
- Shared UI has no pharmacy business logic.
- Feature-to-feature imports are prohibited; cross-feature work goes through domain use-cases or app-level orchestration.
- A feature can be replaced by changing its route registration and adapter wiring.

## Data and business invariants
- Keep the existing IndexedDB database name and version-1 stores during migration.
- Never destructively recreate the database or silently discard products, sales, or movements.
- Cashier continues to permit negative stock as previously requested; quantity must remain positive.
- Product overrides and deleted-code handling during CSV sync remain explicit and tested.
- Movement records preserve type, quantity, unit cost, timestamp, and note.
- Reports and PDFs derive from persisted records, not UI-only state.
- Backup restore validates all records before writing and must be transactional.

## Visual system
- Clinical Minimal Pro: warm ivory + sage + emerald in light mode; graphite-teal + mint in dark mode.
- Editorial pharmacy artwork is used for hero/feature entry points, not behind dense operational data.
- Local SVG/optimized raster assets; no remote runtime dependency.
- Motion primitives: route transition, modal spring, cart feedback, scanner state, sync feedback, toast; respect reduced motion.
- CSS layers: semantic tokens, primitives, layout, feature layers; no legacy compatibility layer after migration.

## Migration sequence
1. Establish domain and infrastructure boundaries without changing the running app.
2. Extract CSV, sync, backup/restore, scanner, PDF, cashier and inventory use-cases behind adapters.
3. Build the new shell, responsive navigation, token system, primitives, asset set and motion layer.
4. Rebuild feature screens one by one against the new contracts.
5. Remove the old monolithic App, old component styles and temporary compatibility facade.
6. Verify data migration, business flows, production build, Android portrait/landscape and APK artifact.

## Acceptance gates
- TypeScript + production build pass on every migration slice.
- No loss of existing IndexedDB records; test with populated database.
- Cashier, scanner, CSV sync/import/export, CRUD, stock movement, reports/PDF and backup/restore are regression-tested.
- Light/dark contrast and Android safe-area/keyboard/rotation are verified.
- Do not claim physical-device validation until tested on an actual Android device.