"use server";

import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import {
  COMMENT_MAX,
  isOwnCommentPath,
  type AddResult,
  type CommentData,
} from "@/lib/comments";

type Row = {
  id: number;
  user_id: string;
  parent_id: number | null;
  content: string;
  image_url: string | null;
  like_count: number;
  created_at: string;
};

type Author = { id: string; username: string | null; avatar_url: string | null };

const COLUMNS = "id, user_id, parent_id, content, image_url, like_count, created_at";

function build(
  row: Row,
  authors: Map<string, Author>,
  liked: Set<number>,
  meId: string,
  postOwnerId: string
): CommentData {
  const p = authors.get(row.user_id);

  return {
    id: row.id,
    parentId: row.parent_id,
    content: row.content,
    imageUrl: isStorageImageUrl(row.image_url) ? row.image_url : null,
    likeCount: row.like_count,
    liked: liked.has(row.id),
    createdAt: row.created_at,
    author: p?.username
      ? {
          username: p.username,
          avatarUrl: isStorageImageUrl(p.avatar_url) ? p.avatar_url : null,
        }
      : null,
    mine: row.user_id === meId,
    canDelete: row.user_id === meId || postOwnerId === meId,
  };
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getComments(postId: number): Promise<CommentData[]> {
  if (!Number.isInteger(postId)) return [];

  const { supabase, user } = await currentUser();
  if (!user) return [];

  const { data: post } = await supabase
    .from("reels")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return [];

  const { data: rows } = await supabase
    .from("reel_comments")
    .select(COLUMNS)
    .eq("reel_id", postId)
    .order("created_at", { ascending: true })
    .limit(300);

  const list = (rows ?? []) as Row[];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.id);
  const authorIds = [...new Set(list.map((r) => r.user_id))];

  const [likesRes, profilesRes] = await Promise.all([
    supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", ids),
    supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds),
  ]);

  const liked = new Set((likesRes.data ?? []).map((l) => l.comment_id as number));
  const authors = new Map(
    ((profilesRes.data ?? []) as Author[]).map((p) => [p.id, p])
  );

  return list.map((r) => build(r, authors, liked, user.id, post.user_id as string));
}

export async function addComment(input: {
  postId: number;
  parentId: number | null;
  content: string;
  imagePath: string | null;
}): Promise<AddResult> {
  const fail = (error: string): AddResult => ({ ok: false, error });

  const { supabase, user } = await currentUser();
  if (!user) return fail("Please sign in again.");

  if (!Number.isInteger(input.postId)) return fail("That post doesn't exist.");

  const content = String(input.content ?? "").trim().slice(0, COMMENT_MAX);

  // The image must be one this user just uploaded; the address is built here
  let imageUrl: string | null = null;
  if (input.imagePath) {
    if (!isOwnCommentPath(input.imagePath, user.id)) {
      return fail("That image isn't valid.");
    }
    imageUrl = supabase.storage.from("photos").getPublicUrl(input.imagePath).data
      .publicUrl;
  }

  if (!content && !imageUrl) return fail("Write something or add an image.");

  const { data: post } = await supabase
    .from("reels")
    .select("user_id")
    .eq("id", input.postId)
    .maybeSingle();

  if (!post) return fail("That post doesn't exist.");

  // Replies stay one level deep: replying to a reply attaches to its parent
  let parentId: number | null = null;
  if (input.parentId !== null && input.parentId !== undefined) {
    if (!Number.isInteger(input.parentId)) return fail("Invalid reply.");

    const { data: parent } = await supabase
      .from("reel_comments")
      .select("id, reel_id, parent_id")
      .eq("id", input.parentId)
      .maybeSingle();

    if (!parent || parent.reel_id !== input.postId) {
      return fail("That comment no longer exists.");
    }
    parentId = (parent.parent_id as number | null) ?? (parent.id as number);
  }

  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reel_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= 10) return fail("You're commenting too quickly. Slow down.");

  const { data: row, error } = await supabase
    .from("reel_comments")
    .insert({
      reel_id: input.postId,
      user_id: user.id,
      parent_id: parentId,
      content,
      image_url: imageUrl,
    })
    .select(COLUMNS)
    .single();

  if (error || !row) return fail("Could not post your comment.");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const authors = new Map<string, Author>(me ? [[user.id, me as Author]] : []);

  return {
    ok: true,
    comment: build(row as Row, authors, new Set(), user.id, post.user_id as string),
  };
}

export async function toggleCommentLike(commentId: number): Promise<void> {
  if (!Number.isInteger(commentId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: user.id });
  }
}

export async function deleteComment(commentId: number): Promise<void> {
  if (!Number.isInteger(commentId)) return;

  const { supabase, user } = await currentUser();
  if (!user) return;

  // Row Level Security allows this only for the author or the post owner
  await supabase.from("reel_comments").delete().eq("id", commentId);
}