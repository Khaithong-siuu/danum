"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sheet } from "@/components/sheet";
import { CommentsSheet } from "@/components/comments-sheet";
import { ReportSheet } from "@/components/report-sheet";
import type { AddResult, CommentData } from "@/lib/comments";
import { formatCount } from "@/lib/reels";
import { timeAgo } from "@/lib/time";

export type Person = { username: string; avatarUrl: string | null };

export type ChatTarget = {
  conversationId: string;
  username: string;
  avatarUrl: string | null;
};

export type FeedMedia = { id: number; kind: "photo" | "video"; url: string };

export type FeedMusic = {
  title: string;
  artist: string;
  url: string;
  artworkUrl: string | null;
  start: number;
  length: number;
};

export type FeedPost = {
  id: number;
  createdAt: string;
  caption: string | null;
  author: Person | null;
  isOwner: boolean;
  media: FeedMedia[];
  likeCount: number;
  viewCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  music: FeedMusic | null;
  previewComments: { id: number; username: string; content: string }[];
};

const ICONS = {
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  comment: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  bookmark: "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z",
  send: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
} as const;

function Icon({
  name,
  filled = false,
  className = "h-7 w-7",
}: {
  name: keyof typeof ICONS;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function Avatar({ url, size }: { url: string | null; size: number }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="shrink-0 rounded-full bg-foreground/10"
      style={{ width: size, height: size }}
    />
  );
}

function PostCard({
  post,
  index,
  musicPlaying,
  onLike,
  onSave,
  onView,
  onDelete,
  onReport,
  onOpenLikers,
  onOpenComments,
  onOpenShare,
  onToggleMusic,
  onStopMusic,
}: {
  post: FeedPost;
  index: number;
  musicPlaying: boolean;
  onLike: (p: FeedPost) => void;
  onSave: (p: FeedPost) => void;
  onView: (id: number) => void;
  onDelete: (p: FeedPost) => void;
  onReport: (id: number) => void;
  onOpenLikers: (id: number) => void;
  onOpenComments: (id: number) => void;
  onOpenShare: (id: number) => void;
  onToggleMusic: (p: FeedPost) => void;
  onStopMusic: (id: number) => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [slide, setSlide] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const [pop, setPop] = useState(false);

  // Know when this post is on screen
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stop its song when it scrolls away
  useEffect(() => {
    if (!inView && musicPlaying) onStopMusic(post.id);
  }, [inView, musicPlaying, onStopMusic, post.id]);

  // Videos play only while visible; a chosen song replaces their own sound
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.querySelectorAll("video").forEach((v) => {
      const i = Number(v.dataset.slide);
      v.muted = !!post.music || videoMuted;
      if (inView && i === slide) void v.play().catch(() => {});
      else v.pause();
    });
  }, [inView, slide, videoMuted, post.music, post.media.length]);

  // Count a view after 1.5 seconds on screen
  useEffect(() => {
    if (!inView || post.isOwner) return;
    const timer = setTimeout(() => onView(post.id), 1500);
    return () => clearTimeout(timer);
  }, [inView, post.id, post.isOwner, onView]);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  function handleDoubleTap() {
    if (!post.liked) onLike(post);
    setPop(true);
    setTimeout(() => setPop(false), 700);
  }

  const current = post.media[slide];

  return (
    <article
      ref={cardRef}
      id={`post-${post.id}`}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar url={post.author?.avatarUrl ?? null} size={44} />
          <div className="leading-tight">
            {post.author ? (
              <Link
                href={`/u/${post.author.username}`}
                className="font-semibold hover:underline"
              >
                {post.author.username}
              </Link>
            ) : (
              <p className="font-semibold">Anonymous</p>
            )}
            <p className="text-xs text-foreground/50">{timeAgo(post.createdAt)}</p>
          </div>
        </div>

        {post.isOwner ? (
          <button
            type="button"
            onClick={() => onDelete(post)}
            className="text-sm text-red-500"
          >
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReport(post.id)}
            className="text-sm text-foreground/50 hover:text-foreground"
          >
            Report
          </button>
        )}
      </div>

      {/* Media: swipe sideways for more */}
      <div className="relative" onDoubleClick={handleDoubleTap}>
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {post.media.map((m, i) => (
            <div
              key={m.id}
              className="relative aspect-square w-full shrink-0 snap-center bg-foreground/5"
            >
              {m.kind === "photo" ? (
                <Image
                  src={m.url}
                  alt={post.caption || "Post"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 576px"
                  priority={index === 0 && i === 0}
                />
              ) : (
                <video
                  data-slide={i}
                  src={m.url}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  loop
                  muted
                  preload="metadata"
                />
              )}
            </div>
          ))}
        </div>

        {post.media.length > 1 && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
            {Math.min(slide + 1, post.media.length)}/{post.media.length}
          </span>
        )}

        {current?.kind === "video" && !post.music && (
          <button
            type="button"
            onClick={() => setVideoMuted((m) => !m)}
            aria-label={videoMuted ? "Turn sound on" : "Turn sound off"}
            className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-sm text-white"
          >
            {videoMuted ? "🔇" : "🔊"}
          </button>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={`text-red-500 transition-all duration-300 ${
              pop ? "scale-100 opacity-90" : "scale-50 opacity-0"
            }`}
          >
            <Icon name="heart" filled className="h-24 w-24" />
          </span>
        </div>
      </div>

      {post.media.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-3">
          {post.media.map((m, i) => (
            <span
              key={m.id}
              className={`h-1.5 w-1.5 rounded-full ${
                i === slide ? "bg-brand" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onLike(post)}
            aria-label={post.liked ? "Unlike" : "Like"}
            className={`transition active:scale-125 ${
              post.liked ? "text-red-500" : ""
            }`}
          >
            <Icon name="heart" filled={post.liked} />
          </button>
          <button
            type="button"
            onClick={() => onOpenComments(post.id)}
            aria-label="Comments"
          >
            <Icon name="comment" />
          </button>
          <button
            type="button"
            onClick={() => onOpenShare(post.id)}
            aria-label="Send"
          >
            <Icon name="send" filled />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSave(post)}
          aria-label={post.saved ? "Remove from saved" : "Save"}
        >
          <Icon name="bookmark" filled={post.saved} />
        </button>
      </div>

      <div className="px-4 pt-2 text-sm">
        <button
          type="button"
          onClick={() => onOpenLikers(post.id)}
          className="font-semibold"
        >
          {formatCount(post.likeCount)} {post.likeCount === 1 ? "like" : "likes"}
        </button>
        <span className="text-foreground/60">
          {" "}
          · {formatCount(post.viewCount)} {post.viewCount === 1 ? "view" : "views"}
        </span>
      </div>

      {post.caption && (
        <p className="whitespace-pre-wrap break-words px-4 pt-1 text-sm">
          <span className="mr-2 font-semibold">
            {post.author?.username ?? "Anonymous"}
          </span>
          {post.caption}
        </p>
      )}

      {post.music && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => onToggleMusic(post)}
            className="inline-flex max-w-full items-center gap-2 rounded-full bg-foreground/10 py-1 pl-1 pr-3 text-xs"
          >
            {post.music.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.music.artworkUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="pl-2">♪</span>
            )}
            <span className="truncate">
              {post.music.title} · {post.music.artist}
            </span>
            <span aria-hidden="true">{musicPlaying ? "❚❚" : "▶"}</span>
          </button>
        </div>
      )}

      {/* Comments preview */}
      <div className="space-y-1 px-4 pb-4 pt-2 text-sm">
        {post.commentCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenComments(post.id)}
            className="text-foreground/60"
          >
            View all {formatCount(post.commentCount)}{" "}
            {post.commentCount === 1 ? "comment" : "comments"}
          </button>
        )}

        {post.previewComments.map((c) => (
          <p key={c.id} className="truncate">
            <span className="mr-2 font-semibold">{c.username}</span>
            {c.content}
          </p>
        ))}

        <button
          type="button"
          onClick={() => onOpenComments(post.id)}
          className="block text-foreground/50"
        >
          Add a comment...
        </button>
      </div>
    </article>
  );
}

export function FeedList({
  posts,
  chatTargets,
  userId,
  toggleLike,
  toggleSave,
  recordView,
  getLikers,
  sendToChat,
  deletePost,
  getComments,
  addComment,
  toggleCommentLike,
  deleteComment,
}: {
  posts: FeedPost[];
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
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const viewed = useRef(new Set<number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [items, setItems] = useState<FeedPost[]>(posts);
  const [sheet, setSheet] = useState<{
    type: "likers" | "share" | "comments";
    postId: number;
  } | null>(null);
  const [reportPostId, setReportPostId] = useState<number | null>(null);
  const [likers, setLikers] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  function patch(id: number, changes: Partial<FeedPost>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  // Music: one song at a time, looping the clip the poster chose
  function toggleMusic(post: FeedPost) {
    const audio = audioRef.current;
    const music = post.music;
    if (!audio || !music) return;

    if (playingId === post.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    audio.pause();
    audio.src = music.url;
    audio.currentTime = music.start;
    void audio.play().catch(() => setPlayingId(null));
    setPlayingId(post.id);
  }

  const stopMusic = useCallback(
    (id: number) => {
      if (playingId !== id) return;
      audioRef.current?.pause();
      setPlayingId(null);
    },
    [playingId]
  );

  function onAudioTime() {
    const audio = audioRef.current;
    const music = items.find((p) => p.id === playingId)?.music;
    if (audio && music && audio.currentTime >= music.start + music.length) {
      audio.currentTime = music.start;
    }
  }

  const onView = useCallback(
    (id: number) => {
      if (viewed.current.has(id)) return;
      viewed.current.add(id);
      void recordView(id).catch(() => {});
    },
    [recordView]
  );

  async function handleLike(p: FeedPost) {
    const next = !p.liked;
    patch(p.id, {
      liked: next,
      likeCount: Math.max(0, p.likeCount + (next ? 1 : -1)),
    });
    try {
      await toggleLike(p.id);
    } catch {
      patch(p.id, { liked: p.liked, likeCount: p.likeCount });
    }
  }

  async function handleSave(p: FeedPost) {
    const next = !p.saved;
    patch(p.id, { saved: next });
    showToast(next ? "Saved" : "Removed from saved");
    try {
      await toggleSave(p.id);
    } catch {
      patch(p.id, { saved: p.saved });
    }
  }

  function openLikers(id: number) {
    setSheet({ type: "likers", postId: id });
    setLikers(null);
    getLikers(id)
      .then(setLikers)
      .catch(() => setLikers([]));
  }

  async function copyLink(id: number) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${id}`);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy the link");
    }
  }

  async function nativeShare(id: number) {
    try {
      await navigator.share({
        title: "Danum",
        url: `${window.location.origin}/p/${id}`,
      });
    } catch {
      // the share sheet was closed
    }
  }

  async function sendTo(target: ChatTarget, postId: number) {
    const key = `${postId}:${target.conversationId}`;
    if (sent.has(key)) return;

    const ok = await sendToChat(target.conversationId, postId).catch(() => false);

    if (ok) setSent((prev) => new Set(prev).add(key));
    else showToast("Couldn't send. Try again.");
  }

  async function remove(p: FeedPost) {
    if (!window.confirm("Delete this post?")) return;
    await deletePost(p.id);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-foreground/60">
        <p className="mb-4 text-xl">No posts yet</p>
        <Link href="/reels/new" className="text-brand hover:underline">
          Create the first post →
        </Link>
      </div>
    );
  }

  const sheetPostId = sheet?.postId ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-10 pb-24 md:pb-10">
      <audio ref={audioRef} preload="auto" onTimeUpdate={onAudioTime} />

      {items.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          index={index}
          musicPlaying={playingId === post.id}
          onLike={handleLike}
          onSave={handleSave}
          onView={onView}
          onDelete={remove}
          onReport={setReportPostId}
          onOpenLikers={openLikers}
          onOpenComments={(id) => setSheet({ type: "comments", postId: id })}
          onOpenShare={(id) => setSheet({ type: "share", postId: id })}
          onToggleMusic={toggleMusic}
          onStopMusic={stopMusic}
        />
      ))}

      {reportPostId !== null && (
        <ReportSheet
          targetType="post"
          targetId={String(reportPostId)}
          onClose={() => setReportPostId(null)}
        />
      )}

      {sheet?.type === "comments" && sheetPostId !== null && (
        <CommentsSheet
          postId={sheetPostId}
          userId={userId}
          onClose={() => setSheet(null)}
          onCountChange={(delta) =>
            setItems((prev) =>
              prev.map((p) =>
                p.id === sheetPostId
                  ? { ...p, commentCount: Math.max(0, p.commentCount + delta) }
                  : p
              )
            )
          }
          getComments={getComments}
          addComment={addComment}
          toggleCommentLike={toggleCommentLike}
          deleteComment={deleteComment}
        />
      )}

      {sheet?.type === "likers" && (
        <Sheet title="Likes" onClose={() => setSheet(null)}>
          {likers === null ? (
            <p className="py-6 text-center text-sm text-foreground/50">Loading...</p>
          ) : likers.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/50">
              No likes yet.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/10 pb-4">
              {likers.map((p) => (
                <li key={p.username}>
                  <Link
                    href={`/u/${p.username}`}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar url={p.avatarUrl} size={40} />
                    <span className="font-medium">{p.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {sheet?.type === "share" && sheetPostId !== null && (
        <Sheet title="Send to" onClose={() => setSheet(null)}>
          {chatTargets.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/50">
              You have no chats yet. Start one from Messages, then send posts here.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {chatTargets.map((t) => {
                const done = sent.has(`${sheetPostId}:${t.conversationId}`);
                return (
                  <li
                    key={t.conversationId}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar url={t.avatarUrl} size={40} />
                    <span className="flex-1 truncate font-medium">{t.username}</span>
                    <button
                      type="button"
                      onClick={() => sendTo(t, sheetPostId)}
                      disabled={done}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                        done
                          ? "bg-foreground/10 text-foreground/50"
                          : "bg-brand text-white"
                      }`}
                    >
                      {done ? "Sent ✓" : "Send"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex gap-2 pb-4">
            <button
              type="button"
              onClick={() => copyLink(sheetPostId)}
              className="flex-1 rounded-xl bg-foreground/10 py-2 text-sm font-medium"
            >
              Copy link
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => nativeShare(sheetPostId)}
                className="flex-1 rounded-xl bg-foreground/10 py-2 text-sm font-medium"
              >
                More…
              </button>
            )}
          </div>
        </Sheet>
      )}

      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
          {toast}
        </div>
      )}
    </div>
  );
}