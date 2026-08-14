import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBasket, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession, type AccountType } from "@/lib/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — StockSpot grocery stock finder" },
      {
        name: "description",
        content: "Sign in as a shopper to find stock nearby, or as a store to keep your inventory up to date.",
      },
      { property: "og:title", content: "Sign in — StockSpot" },
      {
        property: "og:description",
        content: "Shopper and store logins for the StockSpot grocery stock finder.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [accountType, setAccountType] = useState<AccountType>("customer");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, account_type: accountType },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 hero-grid" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBasket className="size-5" />
          </span>
          <span className="font-display text-xl font-bold">StockSpot</span>
        </Link>

        <div className="glow-panel rounded-2xl border border-border p-6">
          <Tabs value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="customer" className="gap-2">
                <User className="size-4" /> Customer
              </TabsTrigger>
              <TabsTrigger value="store_owner" className="gap-2">
                <Store className="size-4" /> Store
              </TabsTrigger>
            </TabsList>
            <TabsContent value="customer" className="mt-4 text-sm text-muted-foreground">
              Search items and see live stock levels at stores near you.
            </TabsContent>
            <TabsContent value="store_owner" className="mt-4 text-sm text-muted-foreground">
              List your store and keep your stock and prices up to date.
            </TabsContent>
          </Tabs>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  {accountType === "store_owner" ? "Your name" : "Full name"}
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Kumar"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? `Create ${accountType === "store_owner" ? "store" : "customer"} account`
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
