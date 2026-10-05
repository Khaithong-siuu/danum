import { createClient } from "@/lib/supabase/server";
import { AuthButton } from "@/components/auth-button";
import { BottomNav } from "@/components/bottom-nav";
import { DeleteButton } from "@/components/delete-button";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";

async function toggleLike(postId: number) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
  }
  revalidatePath("/");
}

async function deletePost(postId: number) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
  revalidatePath("/");
}

async function addComment(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const postId = Number(formData.get("postId"));
  const content = formData.get("content") as string;

  if (!content.trim()) return;

  await supabase.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    content: content.trim(),
  });

  revalidatePath("/");
}

async function Feed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-20 text-foreground/60">
        <p className="text-xl mb-4">No posts yet</p>
        <Link href="/create" className="text-blue-500 hover:underline">
          Create the first post →
        </Link>
      </div>
    );
  }

  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  const postIds = posts.map((p) => p.id);

  const { data: likes } = await supabase
    .from("likes")
    .select("*")
    .in("post_id", postIds);

  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  // Get comment authors
  const commentUserIds = [...new Set(comments?.map((c) => c.user_id) || [])];
  const { data: commentProfiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", commentUserIds);

  const postsWithData = posts.map((post) => {
    const postLikes = likes?.filter((l) => l.post_id === post.id) || [];
    const postComments = comments?.filter((c) => c.post_id === post.id) || [];

    return {
      ...post,
      profile: profiles?.find((p) => p.id === post.user_id) || null,
      likeCount: postLikes.length,
      isLiked: user ? postLikes.some((l) => l.user_id === user.id) : false,
      isOwner: user ? post.user_id === user.id : false,
      comments: postComments.map((c) => ({
        ...c,
        profile: commentProfiles?.find((p) => p.id === c.user_id) || null,
      })),
    };
  });

  return (
    <div className="max-w-xl mx-auto space-y-10 pb-24 md:pb-10">
      {postsWithData.map((post) => (
        <article
          key={post.id}
          className="border border-foreground/10 rounded-2xl overflow-hidden bg-background shadow-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {post.profile?.avatar_url ? (
                <Image
                  src={post.profile.avatar_url}
                  alt="Avatar"
                  width={44}
                  height={44}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-foreground/10" />
              )}
              <p className="font-semibold">
                {post.profile?.username || "Anonymous"}
              </p>
            </div>

            {post.isOwner && (
              <DeleteButton postId={post.id} deleteAction={deletePost} />
            )}
          </div>

          {/* Image */}
          <div className="relative w-full aspect-square bg-foreground/5">
            <Image
              src={post.image_url}
              alt={post.caption || "Post"}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 576px"
              priority
            />
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="px-4 pt-4 pb-2">
              <p>
                <span className="font-semibold mr-2">
                  {post.profile?.username || "Anonymous"}
                </span>
                {post.caption}
              </p>
            </div>
          )}

          {/* Likes */}
          <div className="px-4 pb-3 flex items-center gap-3">
            <form action={toggleLike.bind(null, post.id)}>
              <button
                type="submit"
                className="text-2xl transition-transform duration-200 active:scale-125 hover:scale-110"
              >
                {post.isLiked ? "❤️" : "🤍"}
              </button>
            </form>
            <span className="text-sm font-medium text-foreground/80">
              {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
            </span>
          </div>

          {/* Comments */}
          <div className="px-4 pb-4 space-y-2">
            {post.comments.map((comment: any) => (
              <div key={comment.id} className="text-sm">
                <span className="font-semibold mr-2">
                  {comment.profile?.username || "Anonymous"}
                </span>
                {comment.content}
              </div>
            ))}

            {/* Add comment form */}
            {user && (
              <form action={addComment} className="flex gap-2 mt-3">
                <input type="hidden" name="postId" value={post.id} />
                <input
                  type="text"
                  name="content"
                  placeholder="Add a comment..."
                  className="flex-1 border rounded-full px-4 py-2 text-sm bg-background"
                  required
                />
                <button
                  type="submit"
                  className="text-blue-500 font-semibold text-sm px-2"
                >
                  Post
                </button>
              </form>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="max-w-xl mx-auto flex justify-between items-center px-4 h-14">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Danum
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium">
            <Link href="/create" className="hover:opacity-70 transition hidden md:block">
              + New
            </Link>
            <Link href="/profile" className="hover:opacity-70 transition hidden md:block">
              Profile
            </Link>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </nav>

      <div className="pt-8 px-4">
        <Suspense fallback={<div className="text-center py-20 text-foreground/50">Loading posts...</div>}>
          <Feed />
        </Suspense>
      </div>

      <BottomNav />
    </main>
  );
}