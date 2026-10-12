import { createClient } from "@/lib/supabase/server";

export type Suspension = { reason: string; expiresAt: string | null };

/** The signed-in user's active suspension, or null if they are in good standing. */
export async function getMySuspension(): Promise<Suspension | null> {
  try {
    const supabase = await createClient();

    const { data } = await supabase.auth.getClaims();
    const uid = data?.claims?.sub;
    if (!uid) return null;

    const { data: row } = await supabase
      .from("suspensions")
      .select("reason, expires_at")
      .eq("user_id", uid)
      .maybeSingle();

    if (!row) return null;

    // A timed suspension that has run out no longer counts
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }

    return { reason: row.reason as string, expiresAt: row.expires_at as string | null };
  } catch {
    return null;
  }
}