# Make StockSpot installable and strengthen shopper/store account controls

## What will change
- Add the standard phone home-screen installation details for StockSpot, including its app name, matching colors, and phone-sized icons. This makes it installable from its website; it does not create an App Store or Play Store listing.
- Let signed-in customers and store owners permanently delete their own account from the account area, with a clear confirmation before removal.
- Show the straight-line distance from the shopper’s current location to each store when both locations are available; keep store address visible when distance cannot be calculated.

## Not included
- Offline use or app-store distribution.
- Driving-route mileage: the distance is direct point-to-point distance, not the road distance.
- Unrelated features or changes to inventory, pricing, or login.

## Technical details
- Add a web app manifest and 192px/512px PNG icons under `public/`, and add manifest, theme-color, and Apple icon references in the shared document head.
- Add account deletion through an authenticated server function that verifies the caller, then securely removes that account and its owned records; never use a browser-only credential or admin check.
- Reuse StockSpot’s existing current-location permission and point-to-point distance calculation on the catalogue results.
- Verify the public catalogue, distance display behavior, account deletion flow, and manifest/icon responses in the preview.
