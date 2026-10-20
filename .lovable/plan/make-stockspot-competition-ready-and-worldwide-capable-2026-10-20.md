# Make StockSpot competition-ready and worldwide-capable

## What will change
- Add a Smart Basket to the public grocery catalogue. Shoppers can add real listed products and quantities, then compare the cheapest complete basket at one store with a split-store option. Respect each store’s available quantity, show clear totals and store details, and never invent stock or prices.
- Include a one-tap demo basket drawn only from products currently in the catalogue, with a simple reset and no shopper login required.
- Add Google Maps to store setup so owners can select and review their actual store pin, and give shoppers a map view of stores that have saved coordinates. Keep addresses and catalogue browsing usable when location is unavailable.
- Improve the sign-in and account-creation experience with clearer shopper/store choice, show/hide password, useful input feedback and loading/error states, plus a complete password-reset flow.
- Show a dedicated connection-lost screen with a retry action when the internet or service is unavailable; keep it distinct from the 404 page for a missing address.
- Lay groundwork for worldwide use: store and display prices in each store’s chosen currency, use locale-aware number formatting, and make language and quantity-unit handling ready for localization. Prevent misleading basket comparisons across different currencies; do not invent exchange rates or translations.
- Preserve StockSpot’s existing themes, public catalogue, account roles, and store inventory controls.

## Not included
- Delivery, checkout, payments, road directions, automatic currency conversion, or fabricated store/product data.
- Offline browsing or cached app-shell behavior; the connection-lost screen will explain the outage and offer retry, not promise the app works without internet.
- Full translation of every screen or automated translation of store-entered product names.
- Unrelated redesigns or a new social-login provider.

## Technical details
- Calculate basket options from the catalogue’s real prices and quantities in a small testable module. Cover one-store completion, split-store totals, insufficient stock, no valid plan, and mixed-currency safeguards.
- Keep display names in user profile data and keep shopper/store-owner roles in the protected role table; never use profile fields as permissions.
- Reuse existing store coordinates for mapping and straight-line distances. Google Maps needs an available project connection; if none is accessible, connection setup is a required step before live map display can be verified.
- Keep password recovery on a public reset page and use the existing account system’s recovery process.
- Verify the shopper search-to-basket flow, sign-in/reset states, store pin selection and save, shopper map/list behavior, connection-lost recovery and distinct missing-page handling, responsive phone layout, and successful production preview build. Live Google Maps rendering must be checked on an authorized published origin.
