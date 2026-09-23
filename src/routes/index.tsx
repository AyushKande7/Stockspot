import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, MapPin, Moon, Package, Search, ShoppingBasket, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import freshMarketImage from "@/assets/grocery-fresh-market.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StockSpot — Compare groceries and store stock nearby" },
      {
        name: "description",
        content:
          "Browse groceries, compare prices and see live quantities, locations and store details from nearby shops.",
      },
      { property: "og:title", content: "StockSpot — Compare groceries and store stock nearby" },
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
};

type StockListing = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  stores: StoreInfo | null;
  distanceKm?: number | null;
};

type ProductGroup = {
  id: string;
  name: string;
  category: string;
  unit: string;
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
      return Number(a.price) - Number(b.price);
    }),
  }));
}

const CATEGORIES = ["All items", "Fresh produce", "Dairy & eggs", "Pantry staples", "Bakery", "Other"];
const SUGGESTIONS = ["Milk", "Rice", "Tomatoes", "Eggs", "Bread", "Sugar"];
const indianRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function Index() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All items");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const results = useQuery({
    queryKey: ["storefront-catalogue", query],
    queryFn: async (): Promise<StockListing[]> => {
      let request = supabase
        .from("inventory_items")
        .select(
          "id, name, category, price, quantity, unit, stores(id, name, address, city, phone, opening_hours, contact_email, website, latitude, longitude)",
        )
        .order("quantity", { ascending: false })
        .limit(60);
      if (query.trim()) request = request.ilike("name", `%${query.trim()}%`);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as unknown as StockListing[];
    },
  });

  const withDistance = (results.data ?? []).map((r) => ({
    ...r,
    distanceKm:
      here && r.stores?.latitude != null && r.stores.longitude != null
        ? distanceKm(here, { lat: r.stores.latitude, lng: r.stores.longitude })
        : null,
  }));
  const products = groupListings(withDistance).filter(
    (product) => category === "All items" || product.category === category,
  );

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
            <p className="text-xs font-semibold uppercase text-primary">StockSpot prices</p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              {query ? `Results for “${query}”` : "Groceries near you"}
            </h2>
          </div>
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

        {results.isPending ? (
          <p className="py-14 text-center text-sm text-muted-foreground">Checking nearby shelves…</p>
        ) : results.isError ? (
          <p className="py-14 text-center text-sm text-muted-foreground">
            Store listings could not be loaded. Please try again in a moment.
          </p>
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
                  <MapPin className="size-3.5" /> Distances from your location
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 items-stretch gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
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

function ProductCard({ product }: { product: ProductGroup }) {
  const [showAll, setShowAll] = useState(false);
  const lowestPrice =
    [...product.listings]
      .filter((listing) => listing.quantity > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))[0] ?? product.listings[0];
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
            {lowestPrice && lowestPrice.quantity > 0 ? "Best in-stock price" : "Store prices"}
          </p>
          {lowestPrice && lowestPrice.quantity > 0 && (
            <p className="font-display text-xl font-bold text-primary">
              {indianRupees.format(Number(lowestPrice.price))}
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
                  {indianRupees.format(Number(listing.price))}
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
      </div>
    </article>
  );
}
