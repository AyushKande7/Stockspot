import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useAccountType } from "@/lib/use-session";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StockSpot" },
      { name: "description", content: "Manage your store details and keep item stock and prices current." },
      { property: "og:title", content: "Dashboard — StockSpot" },
      { property: "og:description", content: "Manage your store stock on StockSpot." },
    ],
  }),
  component: Dashboard,
});

type StoreRow = {
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

type ItemRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
};

function Dashboard() {
  const { user } = useSession();
  const role = useAccountType(user?.id);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {role === "store_owner" ? (
          <StoreDashboard userId={user!.id} />
        ) : (
          <CustomerHome />
        )}
      </main>
    </div>
  );
}

function CustomerHome() {
  return (
    <div className="glow-panel rounded-2xl border border-border p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Search className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">You're signed in as a shopper</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Search any grocery item to see which stores have it in stock right now, how much they have,
        the price, and where they are.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Search for an item</Link>
      </Button>
    </div>
  );
}

function StoreDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const storeQuery = useQuery({
    queryKey: ["my-store", userId],
    queryFn: async (): Promise<StoreRow | null> => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, address, city, phone, opening_hours, contact_email, website, latitude, longitude")
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (storeQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your store…</p>;
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-store", userId] });

  if (!storeQuery.data) {
    return <StoreProfileForm userId={userId} onSaved={refresh} />;
  }

  return <InventoryManager store={storeQuery.data} onSaved={refresh} />;
}

function StoreProfileForm({
  userId,
  store,
  onSaved,
}: {
  userId?: string;
  store?: StoreRow;
  onSaved: () => void;
}) {
  const [name, setName] = useState(store?.name ?? "");
  const [address, setAddress] = useState(store?.address ?? "");
  const [city, setCity] = useState(store?.city ?? "");
  const [phone, setPhone] = useState(store?.phone ?? "");
  const [email, setEmail] = useState(store?.contact_email ?? "");
  const [website, setWebsite] = useState(store?.website ?? "");
  const [hours, setHours] = useState(store?.opening_hours ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    store?.latitude != null && store.longitude != null
      ? { lat: store.latitude, lng: store.longitude }
      : null,
  );
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Store location captured");
      },
      () => toast.error("Couldn't get your location"),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name,
      address,
      city,
      phone: phone || null,
      contact_email: email || null,
      website: website || null,
      opening_hours: hours || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    };
    const { error } = store
      ? await supabase.from("stores").update(payload).eq("id", store.id)
      : await supabase.from("stores").insert({ ...payload, owner_id: userId! });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(store ? "Store profile updated" : "Store created");
    onSaved();
  }

  return (
    <div className={store ? "rounded-2xl border border-border bg-card p-6" : "glow-panel mx-auto max-w-lg rounded-2xl border border-border p-6"}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <StoreIcon className="size-5" />
      </span>
      <h2 className="mt-4 text-2xl font-bold">{store ? "Store profile" : "Set up your store"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customers see this info alongside your stock in search results.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="store-name">Store name</Label>
          <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-address">Address</Label>
          <Input id="store-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="store-city">City</Label>
            <Input id="store-city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-phone">Phone (optional)</Label>
            <Input id="store-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-email">Contact email (optional)</Label>
            <Input id="store-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-website">Website (optional)</Label>
            <Input id="store-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-hours">Opening hours</Label>
          <Input
            id="store-hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Mon–Sat 8:00–21:00, Sun 9:00–14:00"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={useMyLocation}>
            <MapPin className="size-4" /> Use my current location
          </Button>
          <span className="text-xs text-muted-foreground">
            {coords ? `Pinned at ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Lets customers see how far you are"}
          </span>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : store ? "Save profile" : "Create store"}
        </Button>
      </form>
    </div>
  );
}

function InventoryManager({ store, onSaved }: { store: StoreRow; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const key = ["inventory", store.id];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pc");
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);

  const items = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ItemRow[]> => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, category, price, quantity, unit")
        .eq("store_id", store.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("inventory_items").insert({
      store_id: store.id,
      name: name.trim(),
      category,
      unit,
      price: Number(price) || 0,
      quantity: Number(quantity) || 0,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setPrice("");
    setQuantity("");
    toast.success("Item added");
    queryClient.invalidateQueries({ queryKey: key });
  }

  async function updateQuantity(item: ItemRow, next: number) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: Math.max(0, next) })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: key });
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item removed");
    queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="space-y-8">
      {editing ? (
        <StoreProfileForm
          store={store}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      ) : (
        <div className="glow-panel rounded-2xl border border-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your store</p>
              <h1 className="mt-1 text-3xl font-bold">{store.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {store.address}, {store.city}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {store.opening_hours ?? "Opening hours not set"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[store.phone, store.contact_email, store.website].filter(Boolean).join(" · ") ||
                  "No contact info added"}
              </p>
              {store.latitude == null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pin your location so shoppers see the distance.
                </p>
              )}
            </div>
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={addItem} className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="size-4 text-primary" /> Add stock
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="item-name">Item</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tomatoes" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-category">Category</Label>
            <Input id="item-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-price">Price</Label>
            <Input id="item-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-qty">Quantity</Label>
            <Input id="item-qty" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-unit">Unit</Label>
            <Input id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / pc / L" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Adding…" : "Add item"}
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="size-4 text-primary" /> Current stock
        </h2>
        {items.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : items.data && items.data.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {items.data.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category} · {Number(item.price).toFixed(2)} per {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => updateQuantity(item, item.quantity - 1)}>
                    −
                  </Button>
                  <span className="w-16 text-center text-sm tabular-nums">
                    {item.quantity} {item.unit}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => updateQuantity(item, item.quantity + 1)}>
                    +
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No items yet — add your first one above.</p>
        )}
      </div>
    </div>
  );
}
