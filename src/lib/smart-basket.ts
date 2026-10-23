export type BasketStore = {
  id: string;
  name: string;
  currency: string;
  address?: string;
  city?: string;
};

export type BasketListing = {
  id: string;
  price: number;
  quantity: number;
  store: BasketStore | null;
};

export type BasketProduct = {
  id: string;
  name: string;
  unit: string;
  listings: BasketListing[];
};

export type BasketSelection = {
  productId: string;
  quantity: number;
};

export type BasketPlanLine = {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  listingId: string;
  store: BasketStore;
  lineTotal: number;
};

export type BasketPlan = {
  currency: string;
  total: number;
  lines: BasketPlanLine[];
  stores: BasketStore[];
};

export type BasketCurrencyPlans = {
  currency: string;
  bestSingleStore: BasketPlan | null;
  lowestSplit: BasketPlan | null;
};

function validSelection(selection: BasketSelection) {
  return Number.isInteger(selection.quantity) && selection.quantity > 0;
}

export function calculateBasketPlans(
  products: BasketProduct[],
  selections: BasketSelection[],
): BasketCurrencyPlans[] {
  const selected = selections.filter(validSelection);
  if (selected.length === 0) return [];

  const productById = new Map(products.map((product) => [product.id, product]));
  const requested = selected.flatMap((selection) => {
    const product = productById.get(selection.productId);
    if (!product) return [];
    const offers = product.listings.filter(
      (listing) =>
        listing.store &&
        Number.isFinite(listing.price) &&
        listing.price >= 0 &&
        Number.isInteger(listing.quantity) &&
        listing.quantity >= selection.quantity,
    );
    return [{ product, quantity: selection.quantity, offers }];
  });
  if (requested.length !== selected.length || requested.some((item) => item.offers.length === 0)) {
    return [];
  }

  const currencies = [...new Set(requested.flatMap((item) => item.offers.map((offer) => offer.store?.currency ?? "")))]
    .filter(Boolean)
    .sort();

  return currencies.map((currency) => {
    const currencyItems = requested.map((item) => ({
      ...item,
      offers: item.offers.filter((offer) => offer.store?.currency === currency),
    }));

    const splitLines: BasketPlanLine[] = [];
    let splitPossible = true;
    for (const item of currencyItems) {
      const listing = [...item.offers].sort((a, b) => a.price - b.price)[0];
      if (!listing?.store) {
        splitPossible = false;
        break;
      }
      splitLines.push({
        productId: item.product.id,
        name: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        listingId: listing.id,
        store: listing.store,
        lineTotal: listing.price * item.quantity,
      });
    }

    const singleStorePlans: BasketPlan[] = [];
    const stores = new Map<string, BasketStore>();
    for (const item of currencyItems) {
      for (const offer of item.offers) {
        if (offer.store) stores.set(offer.store.id, offer.store);
      }
    }
    for (const store of stores.values()) {
      const lines: BasketPlanLine[] = [];
      let complete = true;
      for (const item of currencyItems) {
        const listing = item.offers.find((offer) => offer.store?.id === store.id);
        if (!listing) {
          complete = false;
          break;
        }
        lines.push({
          productId: item.product.id,
          name: item.product.name,
          unit: item.product.unit,
          quantity: item.quantity,
          listingId: listing.id,
          store,
          lineTotal: listing.price * item.quantity,
        });
      }
      if (complete) {
        singleStorePlans.push({ currency, total: lines.reduce((sum, line) => sum + line.lineTotal, 0), lines, stores: [store] });
      }
    }
    singleStorePlans.sort((a, b) => a.total - b.total);

    const splitStores = new Map<string, BasketStore>();
    for (const line of splitLines) splitStores.set(line.store.id, line.store);
    const lowestSplit = splitPossible
      ? {
          currency,
          total: splitLines.reduce((sum, line) => sum + line.lineTotal, 0),
          lines: splitLines,
          stores: [...splitStores.values()],
        }
      : null;

    return { currency, bestSingleStore: singleStorePlans[0] ?? null, lowestSplit };
  });
}