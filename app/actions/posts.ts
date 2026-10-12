"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { isOwnReelPath } from "@/lib/reels";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function toggleLike(postId: number): Promise<void> {
  if (!Number.isInteger(postId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("reel_likes")
    .select("reel_id")
    .eq("reel_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("reel_likes")
      .delete()
      .eq("reel_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase.from("reel_likes").insert({ reel_id: postId, user_id: user.id });
  }
}

export async function toggleSave(postId: number): Promise<void> {
  if (!Number.isInteger(postId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("reel_saves")
    .select("reel_id")
    .eq("reel_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("reel_saves")
      .delete()
      .eq("reel_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase.from("reel_saves").insert({ reel_id: postId, user_id: user.id });
  }
}

export async function recordView(postId: number): Promise<void> {
  if (!Number.isInteger(postId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  await supabase.rpc("record_reel_view", { reel: postId });
}

export async function getLikers(
  postId: number
): Promise<{ username: string; avatarUrl: string | null }[]> {
  if (!Number.isInteger(postId)) return [];

  const { supabase, user } = await currentUser();
  if (!user) return [];

  const { data: likes } = await supabase
    .from("reel_likes")
    .select("user_id")
    .eq("reel_id", postId)
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = (likes ?? []).map((l) => l.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);

  return ids.flatMap((id) => {
    const p = profiles?.find((x) => x.id === id);
    if (!p?.username) return [];
    return [
      {
        username: p.username as string,
        avatarUrl: isStorageImageUrl(p.avatar_url) ? (p.avatar_url as string) : null,
      },
    ];
  });
}

export async function sendToChat(
  conversationId: string,
  postId: number
): Promise<boolean> {
  if (!UUID_REGEX.test(conversationId) || !Number.isInteger(postId)) return false;

  const { supabase, user } = await currentUser();
  if (!user) return false;

  // Row Level Security only allows this if you are a member of the conversation
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    content: `[reel:${postId}]`,
  });

  return !error;
}

export async function deletePost(postId: number): Promise<void> {
  if (!Number.isInteger(postId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  const { data: post } = await supabase
    .from("reels")
    .select("id, media_url")
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) return;

  const { data: media } = await supabase
    .from("post_media")
    .select("url")
    .eq("post_id", postId);

  const urls: string[] = [
    post.media_url as string,
    ...(media ?? []).map((m) => m.url as string),
  ];

  await supabase.from("reels").delete().eq("id", postId).eq("user_id", user.id);

  // Best effort: remove files, but only this user's own post uploads
  const marker = "/storage/v1/object/public/photos/";
  const paths = new Set<string>();

  for (const url of urls) {
    const i = typeof url === "string" ? url.indexOf(marker) : -1;
    if (i === -1) continue;
    try {
      const path = decodeURIComponent(url.slice(i + marker.length));
      if (isOwnReelPath(path, user.id)) paths.add(path);
    } catch {
      // ignore unreadable addresses
    }
  }

  if (paths.size > 0) {
    await supabase.storage.from("photos").remove([...paths]);
  }

  revalidatePath("/");
  revalidatePath("/reels");
}