import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, ShoppingBasket, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export function SiteHeader() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const light = window.localStorage.getItem("stockspot-theme") === "light";
    setIsLight(light);
    document.documentElement.classList.toggle("light", light);
  }, []);

  function toggleTheme() {
    const nextIsLight = !isLight;
    setIsLight(nextIsLight);
    document.documentElement.classList.toggle("light", nextIsLight);
    window.localStorage.setItem("stockspot-theme", nextIsLight ? "light" : "dark");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShoppingBasket className="size-[18px]" />
          </span>
          <span className="font-display text-lg font-bold">StockSpot</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
            title={isLight ? "Switch to dark theme" : "Switch to light theme"}
          >
            {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          {loading ? null : user ? (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link to="/dashboard">My store</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
