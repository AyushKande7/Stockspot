import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Search, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StockSpot — See which store has your item in stock" },
      {
        name: "description",
        content:
          "Search a grocery item and instantly compare stock levels, prices and addresses across nearby stores.",
      },
      { property: "og:title", content: "StockSpot — See which store has your item in stock" },
      {
        property: "og:description",
        content: "Live grocery stock and prices from stores near you, in one search.",
      },
    ],
  }),
  component: Index,
});

type Result = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  stores: { id: string; name: string; address: string; city: string; phone: string | null } | null;
};

const SUGGESTIONS = ["Milk", "Rice", "Tomatoes", "Eggs", "Bread", "Sugar"];

function Index() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  const results = useQuery({
    queryKey: ["search", query],
    enabled: query.trim().length > 0,
    queryFn: async (): Promise<Result[]> => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, category, price, quantity, unit, stores(id, name, address, city, phone)")
        .ilike("name", `%${query.trim()}%`)
        .order("quantity", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Result[];
    },
  });

  const inStock = (results.data ?? []).filter((r) => r.quantity > 0);
  const outOfStock = (results.data ?? []).filter((r) => r.quantity === 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 hero-grid" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <ShoppingBasket className="size-3.5" /> Live store stock
          </Badge>
          <h1 className="text-balance text-4xl font-bold leading-tight sm:text-6xl">
            Find who actually has it{" "}
            <span className="text-primary">in stock</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground">
            Type a grocery item and see every store that carries it — how many they have left,
            the price, and where to go.
          </p>

          <form
            className="mx-auto mt-8 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(term);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search milk, rice, tomatoes…"
                aria-label="Search for a grocery item"
                className="h-12 pl-9 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12">
              Search
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTerm(s);
                  setQuery(s);
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-12">
        {!query ? (
          <EmptyPitch />
        ) : results.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Checking stores…</p>
        ) : (results.data ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No store has listed “{query}” yet.
          </p>
        ) : (
          <div className="space-y-8">
            <ResultList title={`Available now (${inStock.length})`} items={inStock} />
            {outOfStock.length > 0 && (
              <ResultList title={`Out of stock (${outOfStock.length})`} items={outOfStock} muted />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ResultList({ title, items, muted }: { title: string; items: Result[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50 ${muted ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold">{item.stores?.name ?? "Store"}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {item.stores?.address}
                  {item.stores?.city ? `, ${item.stores.city}` : ""}
                </p>
                {item.stores?.phone && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {item.stores.phone}
                  </p>
                )}
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Item: </span>
                  {item.name}
                  <span className="text-muted-foreground"> · {item.category}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-primary">
                  {Number(item.price).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">per {item.unit}</p>
                <Badge
                  variant={item.quantity > 0 ? "default" : "secondary"}
                  className="mt-2"
                >
                  {item.quantity > 0 ? `${item.quantity} ${item.unit} left` : "Out of stock"}
                </Badge>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyPitch() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { title: "Search once", body: "One item name, every store that stocks it." },
        { title: "See real numbers", body: "Quantity left, unit price, and the store address." },
        { title: "Stores stay current", body: "Shop owners update stock from their own dashboard." },
      ].map((c) => (
        <div key={c.title} className="glow-panel rounded-2xl border border-border p-5">
          <h2 className="font-display text-base font-semibold">{c.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
        </div>
      ))}
      <div className="sm:col-span-3 text-center">
        <Button asChild variant="secondary">
          <Link to="/auth">Own a store? List your stock</Link>
        </Button>
      </div>
    </div>
  );
}
