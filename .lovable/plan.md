# Make StockSpot installable on phones

## What will change
- Add the standard home-screen installation details for StockSpot, including its app name, matching green-and-black colors, and phone-sized app icons.
- Add the browser and Apple device tags needed to make installation and app-icon display work across Android and iPhone.
- Keep StockSpot as a website that can be added to a phone’s home screen; this does not create an App Store or Play Store download.

## Not included
- Offline use, background syncing, or service-worker caching.
- Delivery, checkout, or changes to store/customer accounts.

## Technical details
- Add a web app manifest and 192px/512px PNG icons under `public/`.
- Add manifest, theme-color, Apple touch icon, and favicon references in the shared document head.
- Check the preview for valid manifest/icon responses and confirm the homepage still loads.
