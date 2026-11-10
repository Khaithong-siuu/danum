import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { StoriesBar } from "@/components/stories-bar";
import { MessagesLink } from "@/components/messages-link";
import { NotificationsLink } from "@/components/notifications-link";
import { UserMenuLink } from "@/components/user-menu-link";
import { IconLink } from "@/components/icon-link";
import { TabBar } from "@/components/tab-bar";
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

async function Feed({ following }: { following: boolean }) {
  const data = await loadFeed({ followingOnly: following });

  if (!data) {
    redirect("/auth/login");
  }

  if (following && data.posts.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center text-foreground/60">
        <p className="mb-2 text-lg font-medium text-foreground">Nothing here yet</p>
        <p className="mb-4 text-sm">Follow people to see their posts here.</p>
        <Link
          href="/search"
          className="inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition active:scale-95"
        >
          Find people
        </Link>
      </div>
    );
  }

  return (
    <FeedList
      key={following ? "following" : "all"}
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

async function HomeBody({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const following = tab === "following";

  return (
    <div className="px-4 pb-20 pt-6 md:pb-6">
      <div className="mx-auto mb-5 max-w-xl">
        <Suspense fallback={<div className="h-[92px]" />}>
          <StoriesBar />
        </Suspense>
      </div>

      <div className="mx-auto mb-6 grid max-w-xl grid-cols-2 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-1.5 text-center text-sm font-semibold backdrop-blur-lg">
        <Link
          href="/"
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            !following
              ? "bg-background text-foreground shadow-sm shadow-foreground/5 border border-foreground/10"
              : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]"
          }`}
        >
          <span>For you</span>
        </Link>
        <Link
          href="/?tab=following"
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
            following
              ? "bg-background text-foreground shadow-sm shadow-foreground/5 border border-foreground/10"
              : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]"
          }`}
        >
          <span>Following</span>
        </Link>
      </div>

      <Suspense
        key={following ? "following" : "all"}
        fallback={
          <div className="mx-auto max-w-xl space-y-8" aria-label="Loading posts">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="glass-card animate-pulse overflow-hidden rounded-[28px]"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-foreground/10" />
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded-full bg-foreground/10" />
                    <div className="h-2.5 w-16 rounded-full bg-foreground/[0.07]" />
                  </div>
                </div>
                <div className="aspect-square w-full bg-foreground/[0.06]" />
                <div className="h-16" />
              </div>
            ))}
          </div>
        }
      >
        <Feed following={following} />
      </Suspense>
    </div>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 border-b glass-bar pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-foreground">
            Danum
          </Link>

          <div className="flex items-center gap-1">
            {/* On a phone these live in the bottom tab bar */}
            <IconLink href="/search" name="search" label="Find people" hideOnMobile />
            <IconLink href="/reels" name="reels" label="Reels" hideOnMobile />
            <IconLink href="/reels/new" name="plus" label="New post" hideOnMobile />

            <Suspense>
              <NotificationsLink />
            </Suspense>
            <Suspense>
              <MessagesLink />
            </Suspense>
            <Suspense>
              <UserMenuLink />
            </Suspense>
          </div>
        </div>
      </nav>

      <Suspense fallback={<div className="py-20 text-center text-foreground/50">Loading...</div>}>
        <HomeBody searchParams={searchParams} />
      </Suspense>

      <TabBar />
    </main>
  );
}