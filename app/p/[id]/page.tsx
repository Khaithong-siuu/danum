import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { FeedList } from "@/components/feed-list";
import { loadFeed } from "@/lib/feed";
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
import { PageLoading } from "@/components/page-chrome";

async function PostContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d{1,12}$/.test(id)) notFound();

  const data = await loadFeed({ postId: Number(id) });

  if (!data) {
    redirect("/auth/login");
  }

  if (data.posts.length === 0) notFound();

  return (
    <FeedList
      posts={data.posts}
      chatTargets={data.chatTargets}
      userId={data.userId}
      toggleLike={toggleLike}
      toggleSave={toggleSave}
      recordView={recordView}
      getLikers={getLikers}
      sendToChat={sendToChat}
      deletePost={deletePost}
      getComments={getComments}
      addComment={addComment}
      toggleCommentLike={toggleCommentLike}
      deleteComment={deleteComment}
    />
  );
}

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 border-b glass-bar shadow-sm">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Link
            href="/"
            aria-label="Back to feed"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.06] transition-all hover:bg-foreground/[0.1] active:scale-90"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <span className="text-[17px] font-semibold tracking-tight">Post</span>
        </div>
      </nav>

      <div className="px-4 pt-6">
        <Suspense
          fallback={<PageLoading />}
        >
          <PostContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}