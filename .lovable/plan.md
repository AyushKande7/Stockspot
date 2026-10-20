# Make StockSpot stand out with a live Smart Basket

## What will change
- Add a shopper-facing Smart Basket to the grocery catalogue, so judges can see StockSpot do more than search one item at a time.
- Let shoppers add real listed products and set quantities, then compare the lowest-cost complete basket from one store with the lowest-cost plan across stores.
- Respect each store’s available quantity: do not recommend a store for an item when it cannot fulfill the requested amount. Show store names, costs, stock fit, and existing distance details when available.
- Include a one-tap demo basket made from products currently in the catalogue, with an easy reset. It will not invent products, prices, or store data and will work without a shopper account.
- Keep the existing dark/light themes, shopper and store-owner sign-ins, and store inventory editing intact.

## Not included
- Delivery, checkout, payments, or road-route directions.
- New accounts, database tables, or fabricated demonstration inventory.
- Changes unrelated to the shopper’s basket comparison and its presentation flow.

## Technical details
- Reuse the public catalogue’s current product, price, quantity, store, and distance data; implement basket comparisons as a small, testable client-side calculation.
- Add tests for complete-store selection, split-store totals, unavailable/insufficient stock, and the no-complete-plan case.
- Verify the real catalogue-to-basket flow, mobile layout, existing search and theme controls, and a successful production preview build.
