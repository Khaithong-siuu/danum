import type { SupabaseClient } from "@supabase/supabase-js";

export type StoryRing = "none" | "unseen" | "seen";

/**
 * Does this person have an active story the viewer can see?
 * "none"   -> no ring at all
 * "unseen" -> colorful ring (something new to watch)
 * "seen"   -> quiet grey ring (viewer already watched everything)
 */
export async function getStoryRing(
  supabase: SupabaseClient,
  profileId: string,
  viewerId: string | null
): Promise<StoryRing> {
  const { data: stories } = await supabase
    .from("stories")
    .select("id")
    .eq("user_id", profileId)
    .gt("expires_at", new Date().toISOString());

  const ids = (stories ?? []).map((s) => s.id as number);
  if (ids.length === 0) return "none";
  if (!viewerId) return "unseen";

  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", viewerId)
    .in("story_id", ids);

  const seen = new Set((views ?? []).map((v) => v.story_id as number));
  return ids.every((id) => seen.has(id)) ? "seen" : "unseen";
}
