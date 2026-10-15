import { useEffect, useState } from "react";
import { rows, type Row } from "@/data/models";
import { resolveRoleAccounts } from "@/lib/admin-role";
import { supabase } from "@/lib/supabase";

export function useRoleAccounts(source: unknown, viewer: string | null) {
  const [state, setState] = useState<{
    source: unknown;
    viewer: string;
    data: Row[];
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!Array.isArray(source) || !viewer) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void resolveRoleAccounts(rows(source), async (ids) => {
      // Uses the signed-in session and existing profiles_read RLS policy.
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, account_status")
        .in("id", ids)
        .abortSignal(controller.signal);
      if (error)
        throw new Error(
          "Could not load account names. Check your connection and try again.",
        );
      return data || [];
    })
      .then(
        (data) => {
          if (active) setState({ source, viewer, data, error: "" });
        },
        (error: unknown) => {
          if (active)
            setState({
              source,
              viewer,
              data: [],
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load account names.",
            });
        },
      )
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [source, viewer]);

  const current =
    state && state.source === source && state.viewer === viewer ? state : null;
  return {
    data: current?.data || [],
    loading: !!viewer && Array.isArray(source) && !current,
    error: current?.error || "",
  };
}
