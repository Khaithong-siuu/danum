"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // The database only touches your own notifications
  await supabase.rpc("mark_notifications_read");
}