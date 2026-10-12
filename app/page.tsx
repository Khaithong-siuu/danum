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
        <Link href="/search" className="text-brand hover:underline">
          Find people →
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

      <div className="mx-auto mb-6 grid max-w-xl grid-cols-2 rounded-xl bg-foreground/10 p-1 text-center text-sm font-medium">
        <Link
          href="/"
          className={`rounded-lg py-2 transition ${
            !following ? "bg-background shadow-sm" : "text-foreground/60"
          }`}
        >
          For you
        </Link>
        <Link
          href="/?tab=following"
          className={`rounded-lg py-2 transition ${
            following ? "bg-background shadow-sm" : "text-foreground/60"
          }`}
        >
          Following
        </Link>
      </div>

      <Suspense
        key={following ? "following" : "all"}
        fallback={
          <div className="py-20 text-center text-foreground/50">
            Loading posts...
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
      <nav className="sticky top-0 z-40 border-b border-foreground/10 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Danum
          </Link>

          <div className="flex items-center">
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