import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "customer" | "store_owner";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useAccountType(userId: string | undefined) {
  const [role, setRole] = useState<AccountType | null>(null);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      return;
    }
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!active) return;
        const roles = (data ?? []).map((r) => r.role as AccountType);
        setRole(roles.includes("store_owner") ? "store_owner" : "customer");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return role;
}
