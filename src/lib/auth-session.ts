import type { SupabaseClient } from "@supabase/supabase-js";

type SessionAuth = Pick<SupabaseClient["auth"], "signOut" | "getSession">;

/**
 * The Auth SDK can clear this device's session even when remote revocation fails.
 * Check the remaining local session before deciding whether sign-out failed.
 */
export async function signOutCurrentDevice(
  auth: SessionAuth,
): Promise<{ remoteConfirmed: boolean }> {
  const { error } = await auth.signOut({ scope: "local" });
  if (error) {
    const remaining = await auth.getSession();
    if (remaining.error || remaining.data.session) throw error;
    return { remoteConfirmed: false };
  }
  return { remoteConfirmed: true };
}
