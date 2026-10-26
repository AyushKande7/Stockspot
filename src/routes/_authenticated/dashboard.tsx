import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, MapPin, Package, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useAccountType } from "@/lib/use-session";
import { deleteOwnAccount } from "@/lib/account.functions";
import { formatStoreNumber, formatStorePrice } from "@/lib/money";
import { StoreMap } from "@/components/StoreMap";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportConnectionFailure } from "@/lib/connectivity";
import {
  isProductImagePath,
  productImageUploadPath,
  signProductImagePaths,
  validateProductImage,
} from "@/lib/product-images";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrocerLink" },
      { name: "description", content: "Manage your store details and keep item stock and prices current." },
      { property: "og:title", content: "Dashboard — GrocerLink" },
      { property: "og:description", content: "Manage your store stock on GrocerLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  currency: string;
};

type ItemRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  image_url: string | null;
};

function Dashboard() {
  const { user } = useSession();
  const role = useAccountType(user?.id);

  if (!user || !role) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading your account…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {role === "store_owner" ? (
          <StoreDashboard userId={user.id} />
        ) : (
          <CustomerHome />
        )}
        <AccountDangerZone />
      </main>
    </div>
  );
}

function AccountDangerZone() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const deleteAccount = useServerFn(deleteOwnAccount);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  async function confirmDeletion() {
    setBusy(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut({ scope: "local" });
      await queryClient.cancelQueries();
      queryClient.clear();
      toast.success("Your account has been deleted.");
      await navigate({ to: "/", replace: true });
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your account could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Account</h2>
      <p className="mt-1 text-sm text-muted-foreground">Permanently remove your GrocerLink account and its associated store listings.</p>
      <Button type="button" variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <AlertDialog open={open} onOpenChange={(nextOpen) => !busy && setOpen(nextOpen)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account. Any store profile and inventory connected to it will also be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmDeletion} disabled={busy}>
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
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
        .select("id, name, address, city, phone, opening_hours, contact_email, website, latitude, longitude, currency")
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

const CURRENCY_OPTIONS: Array<[string, string]> = [
  ["AED", "UAE dirham"], ["AUD", "Australian dollar"], ["BDT", "Bangladeshi taka"], ["BRL", "Brazilian real"],
  ["CAD", "Canadian dollar"], ["CHF", "Swiss franc"], ["CNY", "Chinese yuan"], ["EUR", "Euro"],
  ["GBP", "British pound"], ["HKD", "Hong Kong dollar"], ["IDR", "Indonesian rupiah"], ["INR", "Indian rupee"],
  ["JPY", "Japanese yen"], ["KRW", "South Korean won"], ["MXN", "Mexican peso"], ["MYR", "Malaysian ringgit"],
  ["NZD", "New Zealand dollar"], ["PHP", "Philippine peso"], ["PKR", "Pakistani rupee"], ["SAR", "Saudi riyal"],
  ["SGD", "Singapore dollar"], ["THB", "Thai baht"], ["TRY", "Turkish lira"], ["USD", "US dollar"],
  ["ZAR", "South African rand"],
];

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
  const [currency, setCurrency] = useState<string>(store?.currency ?? "INR");
  const [busy, setBusy] = useState(false);
  const mapPins = useMemo(
    () => (coords ? [{ id: "selected-store", name: name || "Selected store", address, city, latitude: coords.lat, longitude: coords.lng }] : []),
    [coords, name, address, city],
  );

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
    if (!store && !userId) {
      setBusy(false);
      toast.error("Please sign in before creating a store.");
      return;
    }
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
      currency,
    };
    const saveResult = store
      ? await supabase.from("stores").update(payload).eq("id", store.id)
      : userId
        ? await supabase.from("stores").insert({ ...payload, owner_id: userId })
        : { error: new Error("Please sign in before creating a store.") };
    setBusy(false);
    if (saveResult.error) {
      reportConnectionFailure(saveResult.error);
      toast.error(saveResult.error.message);
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
        <div className="space-y-2">
          <Label htmlFor="store-currency">Store currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="store-currency" aria-label="Store currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map(([code, name]) => <SelectItem key={code} value={code}>{code} · {name}</SelectItem>)}
            </SelectContent>
          </Select>
          {store && currency !== store.currency && (
            <p className="text-xs text-warning">Changing currency only changes the price label; it does not convert your existing prices.</p>
          )}
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
            {coords ? `Pinned at ${formatStoreNumber(coords.lat)}, ${formatStoreNumber(coords.lng)}` : "Select your store on the map, or use your current location."}
          </span>
        </div>
        <StoreMap stores={mapPins} selectable selectedLocation={coords} onLocationSelect={setCoords} />
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const items = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ItemRow[]> => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, category, price, quantity, unit, image_url")
        .eq("store_id", store.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function pickImage(file: File | undefined) {
    if (!file) return;
    const problem = validateProductImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let image_url: string | null = null;
    if (imageFile) {
      const path = productImageUploadPath(store.id, imageFile);
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile, { contentType: imageFile.type });
      if (uploadError) {
        setBusy(false);
        reportConnectionFailure(uploadError);
        toast.error("The photo could not be uploaded. Try again.");
        return;
      }
      image_url = `product-images/${path}`;
    }
    const { error } = await supabase.from("inventory_items").insert({
      store_id: store.id,
      name: name.trim(),
      category,
      unit,
      price: Number(price) || 0,
      quantity: Number(quantity) || 0,
      image_url,
    });
    setBusy(false);
    if (error) {
      reportConnectionFailure(error);
      toast.error(error.message);
      return;
    }
    setName("");
    setPrice("");
    setQuantity("");
    clearImage();
    toast.success("Item added");
    queryClient.invalidateQueries({ queryKey: key });
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) {
      reportConnectionFailure(error);
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
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="item-image">Photo (optional)</Label>
            {imagePreview ? (
              <div className="flex items-center gap-3">
                <img src={imagePreview} alt="Item photo preview" className="size-14 rounded-lg border border-border object-cover" />
                <Button type="button" variant="outline" size="sm" onClick={clearImage}>Remove photo</Button>
              </div>
            ) : (
              <Input
                ref={imageInputRef}
                id="item-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            )}
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
                    {item.category} · {formatStorePrice(Number(item.price), store.currency)} per {item.unit}
                  </p>
                </div>
                <ItemStockEditor item={item} storeId={store.id} onSaved={() => queryClient.invalidateQueries({ queryKey: key })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>
                    <Trash2 className="size-4" />
                </Button>
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

function ItemStockEditor({ item, storeId, onSaved }: { item: ItemRow; storeId: string; onSaved: () => void }) {
  const [price, setPrice] = useState(String(item.price));
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isProductImagePath(item.image_url)) {
      setThumbUrl(null);
      return;
    }
    void signProductImagePaths([item.image_url]).then((map) => {
      if (!cancelled) setThumbUrl(item.image_url ? map.get(item.image_url) ?? null : null);
    });
    return () => {
      cancelled = true;
    };
  }, [item.image_url]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nextPrice = Number(price);
    const nextQuantity = Number(quantity);
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isInteger(nextQuantity) || nextQuantity < 0) {
      toast.error("Enter a valid price and whole-number stock quantity.");
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("inventory_items")
      .update({ price: nextPrice, quantity: nextQuantity })
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      reportConnectionFailure(error);
      toast.error(error.message);
      return;
    }
    toast.success(`${item.name} updated`);
    onSaved();
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    const problem = validateProductImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPhotoBusy(true);
    const path = productImageUploadPath(storeId, file);
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setPhotoBusy(false);
      reportConnectionFailure(uploadError);
      toast.error("The photo could not be uploaded. Try again.");
      return;
    }
    const { error } = await supabase
      .from("inventory_items")
      .update({ image_url: `product-images/${path}` })
      .eq("id", item.id);
    setPhotoBusy(false);
    if (error) {
      reportConnectionFailure(error);
      toast.error(error.message);
      return;
    }
    if (isProductImagePath(item.image_url)) {
      void supabase.storage.from("product-images").remove([item.image_url.replace("product-images/", "")]);
    }
    toast.success("Photo updated");
    onSaved();
  }

  async function removePhoto() {
    setPhotoBusy(true);
    const { error } = await supabase
      .from("inventory_items")
      .update({ image_url: null })
      .eq("id", item.id);
    setPhotoBusy(false);
    if (error) {
      reportConnectionFailure(error);
      toast.error(error.message);
      return;
    }
    if (isProductImagePath(item.image_url)) {
      void supabase.storage.from("product-images").remove([item.image_url.replace("product-images/", "")]);
    }
    toast.success("Photo removed");
    onSaved();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2">
        {thumbUrl ? (
          <img src={thumbUrl} alt={`Photo of ${item.name}`} className="size-11 rounded-md border border-border object-cover" />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImageIcon className="size-4" />
          </span>
        )}
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
            {item.image_url ? "Change photo" : "Add photo"}
          </Button>
          {item.image_url && (
            <Button type="button" variant="ghost" size="sm" disabled={photoBusy} onClick={removePhoto}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void changePhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div className="w-24 space-y-1">
          <Label htmlFor={`price-${item.id}`} className="text-xs">Price</Label>
          <Input id={`price-${item.id}`} type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} aria-label={`Price for ${item.name}`} />
        </div>
        <div className="w-24 space-y-1">
          <Label htmlFor={`quantity-${item.id}`} className="text-xs">Stock ({item.unit})</Label>
          <Input id={`quantity-${item.id}`} type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label={`Stock quantity for ${item.name}`} />
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
