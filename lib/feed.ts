import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { isArtworkUrl, isPreviewUrl } from "@/lib/reels";
import type { ChatTarget, FeedMedia, FeedPost } from "@/components/feed-list";

const POST_COLUMNS =
  "id, user_id, kind, media_url, caption, music_title, music_artist, music_preview_url, music_artwork_url, music_start, music_length, like_count, view_count, comment_count, created_at";

export type FeedData = {
  userId: string;
  posts: FeedPost[];
  chatTargets: ChatTarget[];
};

/**
 * Loads posts in the shape the feed needs.
 * - { postId } loads a single post
 * - { followingOnly } loads posts by people you follow, plus your own
 * Returns null when nobody is signed in.
 */
export async function loadFeed(
  filter: { postId?: number; followingOnly?: boolean } = {}
): Promise<FeedData | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let query = supabase.from("reels").select(POST_COLUMNS);

  if (typeof filter.postId === "number") {
    query = query.eq("id", filter.postId);
  } else {
    if (filter.followingOnly) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const authorIds = [
        user.id,
        ...(follows ?? []).map((f) => f.following_id as string),
      ];
      query = query.in("user_id", authorIds);
    }
    query = query.order("created_at", { ascending: false }).limit(30);
  }

  const { data: rows } = await query;

  const list = rows ?? [];
  const ids = list.map((r) => r.id);
  const authorIds = [...new Set(list.map((r) => r.user_id))];

  const [mediaRes, likesRes, savesRes, profilesRes, commentsRes] = await Promise.all([
    supabase
      .from("post_media")
      .select("id, post_id, sort_order, kind, url")
      .in("post_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("reel_likes")
      .select("reel_id")
      .eq("user_id", user.id)
      .in("reel_id", ids),
    supabase
      .from("reel_saves")
      .select("reel_id")
      .eq("user_id", user.id)
      .in("reel_id", ids),
    supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds),
    supabase
      .from("reel_comments")
      .select("id, reel_id, user_id, content, created_at")
      .in("reel_id", ids)
      .is("parent_id", null)
      .neq("content", "")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  // Names for the two-line comment previews
  const previewRows = commentsRes.data ?? [];
  const previewUserIds = [...new Set(previewRows.map((c) => c.user_id))];
  const { data: previewProfiles } = previewUserIds.length
    ? await supabase.from("profiles").select("id, username").in("id", previewUserIds)
    : { data: [] as { id: string; username: string | null }[] };

  const likedSet = new Set((likesRes.data ?? []).map((l) => l.reel_id));
  const savedSet = new Set((savesRes.data ?? []).map((s) => s.reel_id));

  const posts: FeedPost[] = list.flatMap((r) => {
    // Every media address must come from our own storage
    let media: FeedMedia[] = (mediaRes.data ?? [])
      .filter(
        (m) =>
          m.post_id === r.id &&
          (m.kind === "photo" || m.kind === "video") &&
          isStorageImageUrl(m.url)
      )
      .map((m) => ({
        id: m.id as number,
        kind: m.kind as "photo" | "video",
        url: m.url as string,
      }));

    if (media.length === 0 && isStorageImageUrl(r.media_url)) {
      media = [
        {
          id: -r.id,
          kind: r.kind === "video" ? "video" : "photo",
          url: r.media_url as string,
        },
      ];
    }

    if (media.length === 0) return [];

    const p = profilesRes.data?.find((x) => x.id === r.user_id);

    const previewComments = previewRows
      .filter((c) => c.reel_id === r.id)
      .slice(0, 2)
      .reverse()
      .flatMap((c) => {
        const name = previewProfiles?.find((x) => x.id === c.user_id)?.username;
        return name
          ? [
              {
                id: c.id as number,
                username: name as string,
                content: c.content as string,
              },
            ]
          : [];
      });

    return [
      {
        id: r.id,
        createdAt: r.created_at,
        caption: r.caption,
        author: p?.username
          ? {
              username: p.username,
              avatarUrl: isStorageImageUrl(p.avatar_url) ? p.avatar_url : null,
            }
          : null,
        isOwner: r.user_id === user.id,
        media,
        likeCount: r.like_count,
        viewCount: r.view_count,
        commentCount: r.comment_count,
        liked: likedSet.has(r.id),
        saved: savedSet.has(r.id),
        music:
          isPreviewUrl(r.music_preview_url) && r.music_length
            ? {
                title: r.music_title ?? "Unknown song",
                artist: r.music_artist ?? "",
                url: r.music_preview_url,
                artworkUrl: isArtworkUrl(r.music_artwork_url)
                  ? r.music_artwork_url
                  : null,
                start: r.music_start ?? 0,
                length: r.music_length,
              }
            : null,
        previewComments,
      },
    ];
  });

  // People you can send a post to: your existing chats
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  const convIds = (mine ?? []).map((m) => m.conversation_id);
  let chatTargets: ChatTarget[] = [];

  if (convIds.length > 0) {
    const [{ data: convs }, { data: members }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id")
        .in("id", convIds)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", user.id),
    ]);

    const otherIds = [...new Set((members ?? []).map((m) => m.user_id))];

    const { data: others } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", otherIds)
      : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };

    chatTargets = (convs ?? []).flatMap((c) => {
      const otherId = members?.find((m) => m.conversation_id === c.id)?.user_id;
      const o = others?.find((x) => x.id === otherId);
      if (!o?.username) return [];
      return [
        {
          conversationId: c.id as string,
          username: o.username,
          avatarUrl: isStorageImageUrl(o.avatar_url) ? o.avatar_url : null,
        },
      ];
    });
  }

  return { userId: user.id, posts, chatTargets };
}