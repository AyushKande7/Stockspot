# Prepare StockSpot for a college competition

## What will change
- Add a Smart Basket to the public grocery catalogue: shoppers choose real listed items and quantities, then compare the cheapest single-store basket with a split-store alternative.
- Respect each store’s available quantity; clearly show total cost, store, stock fit, and distance when location data is available. Add a one-tap demo basket using only products already in the catalogue, with a reset and no account requirement.
- Make sign-in and account creation feel more interactive and clear, including a visible account-type choice, show/hide password, stronger field feedback, clear loading/error states, and a password-reset flow.
- Add Google Maps to store location setup so owners can choose and review a map pin, and let shoppers see mapped stores from available location coordinates alongside the existing catalogue.
- Preserve the current dark/light themes, account roles, inventory controls, and no-delivery model.

## Not included
- Delivery, checkout, payments, invented products or prices, or unrelated redesigns.
- Driving directions or distance estimates when store coordinates are unavailable.
- Google sign-in; this request is for an improved sign-in experience, not a new identity provider.

## Technical details
- Calculate basket comparisons from the public catalogue data already loaded by the app. Keep the calculation small and testable, including complete-store, split-store, insufficient-stock, and no-valid-plan cases.
- Reuse stored store coordinates for Maps and the existing straight-line distance behavior. Use the Google Maps Platform connector for map display and store-pin selection; connector setup will be needed if no accessible connection exists.
- Keep sign-in work within the current authentication flow and use its supported password-reset email process.
- Verify the catalogue-to-basket flow, sign-in and reset states, store pin selection/save, shopper map/list behavior, phone layout, and a successful production preview build. Live Maps rendering must be checked on an authorized published origin.
