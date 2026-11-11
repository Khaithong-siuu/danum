"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  FeedList,
  type ChatTarget,
  type FeedPost,
  type Person,
} from "@/components/feed-list";
import type { AddResult, CommentData } from "@/lib/comments";

export type GridPost = {
  id: number;
  kind: string;
  media_url: string;
  caption: string | null;
  multi: boolean;
};

/** Everything the post card needs to like, comment, share and so on. */
export type ViewerData = {
  feed: FeedPost[];
  chatTargets: ChatTarget[];
  userId: string;
  toggleLike: (id: number) => Promise<void>;
  toggleSave: (id: number) => Promise<void>;
  recordView: (id: number) => Promise<void>;
  getLikers: (id: number) => Promise<Person[]>;
  sendToChat: (conversationId: string, postId: number) => Promise<boolean>;
  deletePost: (id: number) => Promise<void>;
  getComments: (postId: number) => Promise<CommentData[]>;
  addComment: (input: {
    postId: number;
    parentId: number | null;
    content: string;
    imagePath: string | null;
  }) => Promise<AddResult>;
  toggleCommentLike: (id: number) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
};

function PlayBadge() {
  return (
    <svg viewBox="0 0 24 24" className="ml-px h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
    </svg>
  );
}

function StackBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

function Tile({ post }: { post: GridPost }) {
  return (
    <>
      {post.kind === "video" ? (
        <video
          src={`${post.media_url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <Image
          src={post.media_url}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 33vw, 192px"
        />
      )}
      {(post.kind === "video" || post.multi) && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
          {post.multi ? <StackBadge /> : <PlayBadge />}
        </span>
      )}
    </>
  );
}

const tileClass =
  "relative aspect-square overflow-hidden bg-foreground/5 transition active:opacity-80";

/**
 * Posts grid. Tap a post to open it as a floating card over a blurred
 * copy of the page: swipe left / right for the next or previous post,
 * swipe down (or tap outside the card) to close. The card is the same one
 * used in the feed, so likes, comments, share and save all work.
 */
export function ProfilePosts({
  posts,
  viewer,
}: {
  posts: GridPost[];
  viewer: ViewerData | null;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [dragY, setDragY] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const touch = useRef<{
    x: number;
    y: number;
    vertical: boolean | null;
    atTop: boolean;
  } | null>(null);

  const feed = viewer?.feed ?? [];

  const close = useCallback(() => {
    setDragY(0);
    setOpen(false);
  }, []);

  function openPost(postId: number) {
    const i = feed.findIndex((p) => p.id === postId);
    if (i < 0) return;
    setIndex(i);
    setOpen(true);
  }

  // Jump to the tapped post as soon as the viewer mounts
  useEffect(() => {
    if (!open) return;
    const el = scroller.current;
    if (el) el.scrollLeft = index * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock page scroll + keyboard support while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      const el = scroller.current;
      if (e.key === "Escape") close();
      if (el && e.key === "ArrowRight") el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
      if (el && e.key === "ArrowLeft") el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    touch.current = {
      x: t.clientX,
      y: t.clientY,
      vertical: null,
      atTop: e.currentTarget.scrollTop <= 0,
    };
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (s.vertical === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.vertical = Math.abs(dy) > Math.abs(dx);
    }
    // Only pull the card down when it is already scrolled to its top
    if (s.vertical && s.atTop && dy > 0) setDragY(dy);
  }

  function onTouchEnd() {
    if (dragY > 110) close();
    else setDragY(0);
    touch.current = null;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[20px]">
        {posts.map((post) =>
          viewer && feed.some((p) => p.id === post.id) ? (
            <button
              key={post.id}
              type="button"
              onClick={() => openPost(post.id)}
              aria-label={post.caption ? `Open post: ${post.caption}` : "Open post"}
              className={tileClass}
            >
              <Tile post={post} />
            </button>
          ) : (
            <Link key={post.id} href={`/p/${post.id}`} className={tileClass}>
              <Tile post={post} />
            </Link>
          )
        )}
      </div>

      {viewer && open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Post viewer"
          // No transform at rest: a transform would trap the comment and
          // share sheets (position: fixed) inside this box.
          className="fixed inset-0 z-[55] bg-black/55 text-white backdrop-blur-2xl animate-in fade-in-0 duration-200"
          style={
            dragY > 0
              ? {
                  transform: `translateY(${dragY}px) scale(${1 - Math.min(dragY, 300) / 3000})`,
                  opacity: 1 - Math.min(dragY, 300) / 500,
                }
              : undefined
          }
        >
          <div
            ref={scroller}
            onScroll={onScroll}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {feed.map((post, i) => (
              <div
                key={post.id}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={(e) => {
                  if (e.target === e.currentTarget) close();
                }}
                className="flex h-full w-full shrink-0 snap-center snap-always flex-col overflow-y-auto overscroll-contain px-4 pb-8 pt-[calc(env(safe-area-inset-top)+4.5rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {Math.abs(i - index) <= 1 && (
                  <div className="mx-auto my-auto w-full max-w-md text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.45)] [&>div:first-child]:!max-w-none [&>div:first-child]:!pb-0">
                    <FeedList
                      posts={[post]}
                      chatTargets={viewer.chatTargets}
                      userId={viewer.userId}
                      toggleLike={viewer.toggleLike}
                      toggleSave={viewer.toggleSave}
                      recordView={viewer.recordView}
                      getLikers={viewer.getLikers}
                      sendToChat={viewer.sendToChat}
                      deletePost={viewer.deletePost}
                      getComments={viewer.getComments}
                      addComment={viewer.addComment}
                      toggleCommentLike={viewer.toggleCommentLike}
                      deleteComment={viewer.deleteComment}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-2xl transition active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums backdrop-blur-2xl">
              {index + 1} / {feed.length}
            </span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
