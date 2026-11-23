# Naufal Farma — Apple Design rules

This project applies selected principles from `emilkowalski/skills` → `apple-design` to the existing React/Capacitor pharmacy POS.

## Design intent
- Calm, trustworthy pharmacy interface; green remains the product identity.
- Floating translucent material is reserved for navigation, toolbar, and modal scrims.
- Transaction content, prices, quantities, forms, and reports remain opaque and high contrast.
- Use the native system font stack for platform-tuned rendering.
- Feedback begins on press, not after a delayed transition.
- Interactions use short, restrained easing. There are no drag/swipe gestures in the current POS flow, so a gesture spring engine is not introduced without a real gesture use case.

## Interaction rules
1. Buttons give immediate pressed feedback and never delay the action.
2. Menus and dialogs appear from their visual source/anchor and remain dismissible.
3. Existing navigation and Android back-button behavior are preserved.
4. Reduced motion removes movement while retaining state/color feedback.
5. Reduced transparency disables blur and restores solid surfaces.
6. Increased contrast strengthens outlines and active-state boundaries.
7. Touch targets remain at least 48px wherever the existing layout allows.

## Materials
- Header and mobile dock: translucent, saturated blur, bright edge and restrained shadow.
- Desktop navigation: heavier translucent structural surface.
- Product lists, totals, forms and report tables: solid surfaces for reliable reading.
- Modal: dimming scrim and a short materialization transition.

## Scope and invariants
- CSS-only presentation layer loaded after the existing Hallmark theme.
- No changes to cashier, checkout, pricing, inventory, Dexie, CSV sync, barcode scanning, PDF or CRUD logic.
- Verify on narrow Android portrait, landscape, tablet and desktop before release.
- Do not claim visual QA complete until screenshots are reviewed at those sizes.

## Source
Design guidance: https://github.com/emilkowalski/skills/tree/main/skills/apple-design
