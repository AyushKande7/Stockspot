import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { reportConnectionFailure } from "@/lib/connectivity";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — StockSpot" },
      { name: "description", content: "Set a new password for your StockSpot grocery account." },
      { property: "og:title", content: "Reset password — StockSpot" },
      { property: "og:description", content: "Choose a new password for your StockSpot account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const readRecoveryLink = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      setRecoveryLink(params.get("type") === "recovery");
    };
    readRecoveryLink();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryLink(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Those passwords don’t match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      reportConnectionFailure(error);
      toast.error(error.message);
      return;
    }
    setSaved(true);
    toast.success("Your password has been updated.");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 hero-grid" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><ShoppingBasket className="size-5" /></span>
          <span className="font-display text-xl font-bold">StockSpot</span>
        </Link>
        <section className="glow-panel border border-border p-6">
          <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><KeyRound className="size-5" /></span>
          <h1 className="mt-4 font-display text-2xl font-bold">Set a new password</h1>
          {saved ? (
            <div className="mt-4 space-y-4">
              <p role="status" className="text-sm text-muted-foreground">Your password is updated and you’re signed in.</p>
              <Button className="w-full" onClick={() => void navigate({ to: "/dashboard", replace: true })}>Continue to StockSpot</Button>
            </div>
          ) : !recoveryLink ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">Open the password-reset link from your email to continue.</p>
              <Button asChild variant="outline" className="w-full"><Link to="/auth">Back to sign in</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required value={confirm} onChange={(event) => setConfirm(event.target.value)} aria-invalid={confirm.length > 0 && confirm !== password} />
                {confirm.length > 0 && confirm !== password && <p className="text-xs text-destructive">Passwords don’t match.</p>}
              </div>
              <Button type="submit" className="w-full" disabled={busy || password.length < 6 || password !== confirm}>{busy ? "Updating password…" : "Update password"}</Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}