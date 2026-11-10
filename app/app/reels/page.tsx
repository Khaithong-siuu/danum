import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { isArtworkUrl, isPreviewUrl } from "@/lib/reels";
import {
  ReelsViewer,
  type ChatTarget,
  type ReelData,
} from "@/components/reels-viewer";
import {
  deletePost,
  getLikers,
  recordView,
  sendToChat,
  toggleLike,
  toggleSave,
} from "@/app/actions/posts";
import {
  addComment,
  deleteComment,
  getComments,
  toggleCommentLike,
} from "@/app/actions/comments";

const REEL_COLUMNS =
  "id, user_id, kind, media_url, caption, duration_seconds, music_title, music_artist, music_preview_url, music_artwork_url, music_start, music_length, like_count, view_count, comment_count, created_at";

async function ReelsContent({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start } = await searchParams;
  const startId = start && /^\d{1,12}$/.test(start) ? Number(start) : null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: recent } = await supabase
    .from("reels")
    .select(REEL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(30);

  let rows = recent ?? [];

  // A shared reel might be older than the newest 30
  if (startId && !rows.some((r) => r.id === startId)) {
    const { data: one } = await supabase
      .from("reels")
      .select(REEL_COLUMNS)
      .eq("id", startId)
      .maybeSingle();
    if (one) rows = [one, ...rows];
  }

  // Only media from our own storage is ever rendered
  rows = rows.filter(
    (r) =>
      (r.kind === "video" || r.kind === "photo") && isStorageImageUrl(r.media_url)
  );

  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.user_id))];

  const [likesRes, savesRes, profilesRes, mediaRes] = await Promise.all([
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
    supabase.from("post_media").select("post_id").in("post_id", ids),
  ]);

  const likedSet = new Set((likesRes.data ?? []).map((l) => l.reel_id));
  const savedSet = new Set((savesRes.data ?? []).map((s) => s.reel_id));

  const mediaCount = new Map<number, number>();
  for (const m of mediaRes.data ?? []) {
    mediaCount.set(m.post_id, (mediaCount.get(m.post_id) ?? 0) + 1);
  }

  const reels: ReelData[] = rows.map((r) => {
    const p = profilesRes.data?.find((x) => x.id === r.user_id);

    return {
      id: r.id,
      kind: r.kind,
      mediaUrl: r.media_url,
      mediaCount: Math.max(1, mediaCount.get(r.id) ?? 1),
      caption: r.caption,
      likeCount: r.like_count,
      viewCount: r.view_count,
      commentCount: r.comment_count,
      createdAt: r.created_at,
      author: p?.username
        ? {
            username: p.username,
            avatarUrl: isStorageImageUrl(p.avatar_url) ? p.avatar_url : null,
          }
        : null,
      isOwner: r.user_id === user.id,
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
    };
  });

  const startIndex = startId
    ? Math.max(0, reels.findIndex((r) => r.id === startId))
    : 0;

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
      const p = others?.find((o) => o.id === otherId);
      if (!p?.username) return [];
      return [
        {
          conversationId: c.id as string,
          username: p.username,
          avatarUrl: isStorageImageUrl(p.avatar_url) ? p.avatar_url : null,
        },
      ];
    });
  }

  return (
    <ReelsViewer
      reels={reels}
      startIndex={startIndex}
      chatTargets={chatTargets}
      userId={user.id}
      toggleLike={toggleLike}
      toggleSave={toggleSave}
      recordView={recordView}
      getLikers={getLikers}
      sendToChat={sendToChat}
      deleteReel={deletePost}
      getComments={getComments}
      addComment={addComment}
      toggleCommentLike={toggleCommentLike}
      deleteComment={deleteComment}
    />
  );
}

export default function ReelsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-black" />}>
      <ReelsContent searchParams={searchParams} />
    </Suspense>
  );
}