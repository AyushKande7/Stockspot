import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, MapPin, Minus, Package, Plus, Search, ShoppingBasket, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import freshMarketImage from "@/assets/grocery-fresh-market.jpg";
import { formatStorePrice } from "@/lib/money";
import { calculateBasketPlans, type BasketProduct, type BasketSelection } from "@/lib/smart-basket";
import { MapViewToggle, StoreMap, type StorePin } from "@/components/StoreMap";
import { reportConnectionFailure } from "@/lib/connectivity";
import { signProductImagePaths } from "@/lib/product-images";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrocerLink — Compare groceries and store stock nearby" },
      {
        name: "description",
        content:
          "Browse groceries, compare prices and see live quantities, locations and store details from nearby shops.",
      },
      { property: "og:title", content: "GrocerLink — Compare groceries and store stock nearby" },
      {
        property: "og:description",
        content: "Browse groceries and compare live stock, prices and nearby store details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type StoreInfo = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  opening_hours: string | null;
  contact_email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  currency: string;
};

type StockListing = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  image_url: string | null;
  imageUrl: string | null;
  stores: StoreInfo | null;
  distanceKm?: number | null;
};

type ProductGroup = {
  id: string;
  name: string;
  category: string;
  unit: string;
  imageUrl: string | null;
  listings: StockListing[];
};

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getCategory(listing: StockListing) {
  const searchable = `${listing.name} ${listing.category}`.toLowerCase();
  if (/fruit|vegetable|produce|tomato|onion|potato|apple|banana|spinach|carrot/.test(searchable)) {
    return "Fresh produce";
  }
  if (/milk|dairy|egg|butter|cheese|yogurt|curd/.test(searchable)) return "Dairy & eggs";
  if (/bread|bakery|cake|biscuit|cookie/.test(searchable)) return "Bakery";
  if (/rice|grain|staple|pulse|lentil|flour|oil|sugar|salt|spice|dal/.test(searchable)) {
    return "Pantry staples";
  }
  return "Other";
}

function groupListings(listings: StockListing[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const listing of listings) {
    const id = `${listing.name.trim().toLowerCase()}|${listing.unit.trim().toLowerCase()}`;
    const existing = groups.get(id);
    if (existing) {
      existing.listings.push(listing);
    } else {
      groups.set(id, {
        id,
        name: listing.name,
        category: getCategory(listing),
        unit: listing.unit,
        listings: [listing],
      });
    }
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    listings: [...group.listings].sort((a, b) => {
      if ((a.quantity > 0) !== (b.quantity > 0)) return a.quantity > 0 ? -1 : 1;
      if ((a.stores?.currency ?? "INR") !== (b.stores?.currency ?? "INR")) return 0;
      return Number(a.price) - Number(b.price);
    }),
  }));
}

const CATEGORIES = ["All items", "Fresh produce", "Dairy & eggs", "Pantry staples", "Bakery", "Other"];
const SUGGESTIONS = ["Milk", "Rice", "Tomatoes", "Eggs", "Bread", "Sugar"];
function Index() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All items");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selections, setSelections] = useState<BasketSelection[]>([]);
  const [showBasket, setShowBasket] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const results = useQuery({
    queryKey: ["storefront-catalogue"],
    queryFn: async (): Promise<StockListing[]> => {
      const request = supabase
        .from("inventory_items")
        .select(
          "id, name, category, price, quantity, unit, image_url, stores(id, name, address, city, phone, opening_hours, contact_email, website, latitude, longitude, currency)",
        )
        .order("quantity", { ascending: false });
      const allListings: StockListing[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await request.range(offset, offset + 499);
        if (error) {
          reportConnectionFailure(error);
          throw error;
        }
        allListings.push(...((data ?? []) as unknown as StockListing[]));
        if ((data ?? []).length < 500) break;
      }
      const signed = await signProductImagePaths(
        allListings.map((listing) => listing.image_url ?? ""),
      );
      return allListings.map((listing) => ({
        ...listing,
        imageUrl: listing.image_url ? signed.get(listing.image_url) ?? null : null,
      }));
    },
  });

  const storeLocations = useQuery({
    queryKey: ["public-store-locations"],
    queryFn: async (): Promise<StorePin[]> => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, address, city, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) {
        reportConnectionFailure(error);
        throw error;
      }
      return (data ?? []).map((store) => ({
        ...store,
        latitude: Number(store.latitude),
        longitude: Number(store.longitude),
      }));
    },
  });

  const withDistance = (results.data ?? []).map((r) => ({
    ...r,
    distanceKm:
      here && r.stores?.latitude != null && r.stores.longitude != null
        ? distanceKm(here, { lat: r.stores.latitude, lng: r.stores.longitude })
        : null,
  }));
  const allProducts = groupListings(withDistance).map((product) => ({
    ...product,
    listings: here
      ? [...product.listings].sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) return 0;
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        })
      : product.listings,
  })).map((product) => ({
    ...product,
    listings: [...product.listings].sort((a, b) => {
      const aInStock = a.quantity > 0;
      const bInStock = b.quantity > 0;
      if (aInStock !== bInStock) return aInStock ? -1 : 1;
      if ((a.stores?.currency ?? "INR") !== (b.stores?.currency ?? "INR")) return 0;
      return Number(a.price) - Number(b.price);
    }),
  }));
  const products = allProducts.filter((product) => {
    const matchesTerm = !query.trim() || product.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === "All items" || product.category === category;
    return matchesTerm && matchesCategory;
  });

  const basketProducts: BasketProduct[] = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
    unit: product.unit,
    listings: product.listings.map((listing) => ({
      id: listing.id,
      price: Number(listing.price),
      quantity: Number(listing.quantity),
      store: listing.stores
        ? {
            id: listing.stores.id,
            name: listing.stores.name,
            address: listing.stores.address,
            city: listing.stores.city,
            currency: listing.stores.currency ?? "INR",
          }
        : null,
    })),
  }));
  const basketPlans = useMemo(() => calculateBasketPlans(basketProducts, selections), [JSON.stringify(basketProducts), selections]);
  const chosenCount = selections.reduce((count, selection) => count + selection.quantity, 0);

  function setProductQuantity(productId: string, quantity: number) {
    setSelections((current) => {
      const remaining = current.filter((selection) => selection.productId !== productId);
      return quantity > 0 ? [...remaining, { productId, quantity }] : remaining;
    });
  }

  function fillDemoBasket() {
    const demo = basketProducts
      .filter((product) => product.listings.some((listing) => listing.quantity > 0))
      .slice(0, 3)
      .map((product) => ({ productId: product.id, quantity: 1 }));
    if (demo.length === 0) {
      toast.error("There are no in-stock items to add yet.");
      return;
    }
    setSelections(demo);
    setShowBasket(true);
  }

  const mapStores = storeLocations.data ?? [];

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGettingLocation(false);
        toast.success("Nearby stores are now sorted by distance.");
      },
      () => {
        setGettingLocation(false);
        toast.error("Location access is off. You can still browse store addresses and stock.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl items-stretch md:min-h-64 md:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-center px-4 py-8 sm:px-6 md:py-10 lg:px-8">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <ShoppingBasket className="size-3.5" /> Store stock & prices
            </Badge>
            <h1 className="text-balance font-display text-3xl font-bold leading-tight sm:text-4xl">
              Groceries at great value.
            </h1>
            <p className="mt-2 max-w-lg text-sm text-primary-foreground/80 sm:text-base">
              Compare what nearby stores have on their shelves, then shop in person.
            </p>
            <form
              className="mt-5 flex w-full max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(term.trim());
              setCategory("All items");
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search milk, rice, cooking oil…"
                aria-label="Search for a grocery item"
                className="h-11 border-background bg-background pl-9 text-foreground"
              />
            </div>
            <Button type="submit" variant="secondary" className="h-11 shrink-0">
              Search
            </Button>
          </form>
            <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-primary-foreground/80">
              <span className="mr-1">Popular:</span>
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 px-1.5 text-primary-foreground"
                  onClick={() => {
                    setTerm(suggestion);
                    setQuery(suggestion);
                    setCategory("All items");
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
          <div className="hidden min-h-56 overflow-hidden md:block">
            <img
              src={freshMarketImage}
              alt="Fresh tomatoes, greens, rice, milk, potatoes, onions and bread"
              width={1536}
              height={1024}
              className="size-full object-cover object-right"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">GrocerLink prices</p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              {query ? `Results for “${query}”` : "Groceries near you"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={showBasket ? "secondary" : "outline"} size="sm" onClick={() => setShowBasket((open) => !open)}>
            <ShoppingBasket className="size-4" />
            Basket{chosenCount > 0 ? ` · ${chosenCount}` : ""}
          </Button>
          <MapViewToggle map={showMap} onChange={setShowMap} />
          <Button
            type="button"
            variant={here ? "secondary" : "outline"}
            size="sm"
            onClick={useCurrentLocation}
            disabled={gettingLocation}
          >
            <MapPin className="size-4" />
            {gettingLocation ? "Finding location…" : here ? "Using my location" : "Use my location"}
          </Button>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Grocery categories">
          {CATEGORIES.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        {showBasket && (
          <BasketPanel
            selections={selections}
            products={basketProducts}
            plans={basketPlans}
            onRemove={(productId) => setProductQuantity(productId, 0)}
            onDemo={fillDemoBasket}
            onClose={() => setShowBasket(false)}
          />
        )}

        {showMap && (
          <section className="mt-4 space-y-3" aria-label="Store map">
            <StoreMap stores={mapStores} />
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {mapStores.map((store) => (
                <p key={store.id} className="flex gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span><span className="font-medium text-foreground">{store.name}</span> · {[store.address, store.city].filter(Boolean).join(", ")}</span>
                </p>
              ))}
              {mapStores.length === 0 && <p className="text-sm text-muted-foreground">Store addresses are shown with each item when locations have not been pinned yet.</p>}
            </div>
          </section>
        )}

        {results.isPending ? (
          <p className="py-14 text-center text-sm text-muted-foreground">Checking nearby shelves…</p>
        ) : results.isError ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">Store listings couldn’t load. Check your connection and try again.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void results.refetch()}>Try again</Button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-14 text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {query ? `No stores list “${query}” yet.` : "No groceries in this category yet."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another item or choose a different category.
            </p>
            {query && (
              <Button
                variant="link"
                onClick={() => {
                  setTerm("");
                  setQuery("");
                  setCategory("All items");
                }}
                className="mt-2"
              >
                Browse all groceries
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
              <p className="text-sm text-muted-foreground">
                {products.length} {products.length === 1 ? "item" : "items"} · Live store prices and quantities
              </p>
              {here && (
                <p className="flex items-center gap-1.5 text-xs text-primary">
                  <MapPin className="size-3.5" /> Straight-line distances from your location
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 items-stretch gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selectedQuantity={selections.find((selection) => selection.productId === product.id)?.quantity ?? 0}
                    maxAvailable={Math.max(0, ...product.listings.map((listing) => listing.quantity))}
                    onQuantityChange={(quantity) => setProductQuantity(product.id, quantity)}
                  />
              ))}
            </div>
          </>
        )}

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border py-5">
          <p className="text-sm text-muted-foreground">
            Prices and stock are provided by each store. Availability may change.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Own a store? Manage your stock</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}

function ProductCard({ product, selectedQuantity, maxAvailable, onQuantityChange }: { product: ProductGroup; selectedQuantity: number; maxAvailable: number; onQuantityChange: (quantity: number) => void }) {
  const [showAll, setShowAll] = useState(false);
  const currencies = [...new Set(product.listings.map((listing) => listing.stores?.currency ?? "INR"))];
  const lowestPrice = currencies.length === 1
    ? [...product.listings].filter((listing) => listing.quantity > 0).sort((a, b) => Number(a.price) - Number(b.price))[0] ?? product.listings[0]
    : null;
  const visibleListings = showAll ? product.listings : product.listings.slice(0, 3);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
      <div className="flex min-h-36 items-center justify-between gap-3 bg-muted/50 px-5 py-4">
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-2 max-w-full truncate text-[10px]">
            {product.category}
          </Badge>
          <h3 className="text-balance font-display text-base font-semibold leading-snug">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Price per {product.unit}</p>
        </div>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {product.category === "Fresh produce" ? (
            <ShoppingBasket className="size-6" />
          ) : product.category === "Dairy & eggs" ? (
            <Sun className="size-6" />
          ) : (
            <Package className="size-6" />
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {currencies.length > 1 ? "Prices in local currencies" : lowestPrice && lowestPrice.quantity > 0 ? "Best in-stock price" : "Store prices"}
          </p>
          {lowestPrice && lowestPrice.quantity > 0 && (
            <p className="font-display text-xl font-bold text-primary">
              {formatStorePrice(Number(lowestPrice.price), lowestPrice.stores?.currency ?? "INR")}
            </p>
          )}
        </div>
        <ul className="space-y-2">
          {visibleListings.map((listing) => (
            <li
              key={listing.id}
              className={`rounded-md border p-2.5 ${listing.id === lowestPrice?.id && listing.quantity > 0 ? "border-primary/40 bg-accent/60" : "border-border bg-background"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-semibold">
                  {listing.stores?.name ?? "Store"}
                </p>
                <p className="shrink-0 text-right font-semibold tabular-nums">
              {formatStorePrice(Number(listing.price), listing.stores?.currency ?? "INR")}
                </p>
              </div>
              <p className="mt-1 flex items-start gap-1.5 break-words text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {[listing.stores?.address, listing.stores?.city].filter(Boolean).join(", ") ||
                    "Address not provided"}
                  {typeof listing.distanceKm === "number" && (
                    <span className="text-primary"> · {listing.distanceKm.toFixed(1)} km</span>
                  )}
                </span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                <span
                  className={listing.quantity > 0 ? "font-medium text-success" : "text-muted-foreground"}
                >
                  {listing.quantity > 0
                    ? `${listing.quantity} ${listing.unit} in stock`
                    : "Out of stock"}
                </span>
                {listing.stores?.opening_hours && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" /> {listing.stores.opening_hours}
                  </span>
                )}
              </div>
              {listing.stores?.phone && (
                <a href={`tel:${listing.stores.phone}`} className="mt-1.5 block text-xs text-primary">
                  {listing.stores.phone}
                </a>
              )}
              {listing.stores?.contact_email && (
                <a href={`mailto:${listing.stores.contact_email}`} className="mt-1 block break-all text-xs text-primary">
                  {listing.stores.contact_email}
                </a>
              )}
              {listing.stores?.website && (
                <a
                  href={listing.stores.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1 break-all text-xs text-primary"
                >
                  <Globe className="size-3 shrink-0" />
                  {listing.stores.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </li>
          ))}
        </ul>
        {product.listings.length > 3 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "Show fewer stores" : `Compare all ${product.listings.length} stores`}
          </Button>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Add to basket</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label={`Remove one ${product.name}`} disabled={selectedQuantity === 0} onClick={() => onQuantityChange(selectedQuantity - 1)}>
              <Minus className="size-4" />
            </Button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{selectedQuantity}</span>
            <Button type="button" variant="secondary" size="icon" aria-label={`Add one ${product.name}`} disabled={selectedQuantity >= maxAvailable} onClick={() => onQuantityChange(selectedQuantity + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function BasketPanel({
  selections,
  products,
  plans,
  onRemove,
  onDemo,
  onClose,
}: {
  selections: BasketSelection[];
  products: BasketProduct[];
  plans: ReturnType<typeof calculateBasketPlans>;
  onRemove: (productId: string) => void;
  onDemo: () => void;
  onClose: () => void;
}) {
  const selectedProducts = selections.flatMap((selection) => {
    const product = products.find((entry) => entry.id === selection.productId);
    return product ? [{ product, quantity: selection.quantity }] : [];
  });

  return (
    <section className="mt-5 border-y border-border py-5" aria-label="Smart Basket">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Plan a store visit</p>
          <h3 className="mt-1 font-display text-xl font-bold">Smart Basket</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onDemo}>Fill demo basket</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {selectedProducts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Choose items below to compare where your whole basket fits.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {selectedProducts.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-2">
                <span>{quantity} × {product.name} ({product.unit})</span>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${product.name} from basket`} onClick={() => onRemove(product.id)}>
                  <Minus className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          {plans.length === 0 ? (
            <p className="mt-4 border-l-2 border-warning pl-3 text-sm text-muted-foreground">
              No store can fill every requested amount right now. Reduce a quantity or remove an item.
            </p>
          ) : (
            <div className="mt-5 grid gap-5 border-t border-border pt-4 lg:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.currency} className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{plan.currency} · matching stock only</p>
                  {!plan.bestSingleStore && !plan.lowestSplit ? (
                    <p className="mt-2 text-sm text-muted-foreground">No complete {plan.currency} basket is available.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {plan.bestSingleStore && <BasketPlanSummary title="One store" description={plan.bestSingleStore.stores[0]?.name ?? "Store"} plan={plan.bestSingleStore} />}
                      {plan.lowestSplit && <BasketPlanSummary title="Split plan" description={`${plan.lowestSplit.stores.length} ${plan.lowestSplit.stores.length === 1 ? "store" : "stores"}`} plan={plan.lowestSplit} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {plans.length > 1 && <p className="mt-3 text-xs text-muted-foreground">Each currency is compared separately. No exchange rates are assumed.</p>}
        </>
      )}
    </section>
  );
}

function BasketPlanSummary({ title, description, plan }: { title: string; description: string; plan: NonNullable<ReturnType<typeof calculateBasketPlans>[number]["bestSingleStore"]> | NonNullable<ReturnType<typeof calculateBasketPlans>[number]["lowestSplit"]> }) {
  return (
    <div className="border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="break-words text-xs text-muted-foreground">{description}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-bold text-primary">{formatStorePrice(plan.total, plan.currency)}</p>
      </div>
      <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
        {plan.lines.map((line) => (
          <li key={line.productId} className="flex justify-between gap-2">
            <span className="min-w-0 break-words">{line.quantity} × {line.name} ({line.unit}) · {line.store.name}</span>
            <span className="shrink-0 tabular-nums">{formatStorePrice(line.lineTotal, plan.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
