"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleFollow(targetId: string): Promise<void> {
  if (!UUID_REGEX.test(targetId)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id === targetId) return;

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) return;

  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: targetId });
  }

  revalidatePath("/");
}