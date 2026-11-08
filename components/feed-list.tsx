"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Sheet } from "@/components/sheet";
import { CommentsSheet } from "@/components/comments-sheet";
import { ReportSheet } from "@/components/report-sheet";
import { EmojiText } from "@/components/emoji-text";
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

/* Stroke icons, same set as the reels */
const ICONS = {
  heart: [
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  ],
  comment: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  volumeOn: [
    "M11 5 6 9H2v6h4l5 4V5Z",
    "M15.54 8.46a5 5 0 0 1 0 7.07",
    "M19.07 4.93a10 10 0 0 1 0 14.14",
  ],
  volumeOff: ["M11 5 6 9H2v6h4l5 4V5Z", "m22 9-6 6", "m16 9 6 6"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  ],
  flag: [
    "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
    "M4 22v-7",
  ],
  check: ["M20 6 9 17l-5-5"],
  music: [
    "M9 18V5l12-2v13",
    "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    "M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  plus: ["M12 5v14", "M5 12h14"],
} as const;

type IconName = keyof typeof ICONS;

function Icon({
  name,
  filled = false,
  className = "h-6 w-6",
  strokeWidth = 1.9,
}: {
  name: IconName;
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* Floating glass over photos and videos */
const GLASS_DARK =
  "border border-white/15 bg-black/35 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.25)]";

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
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inView, setInView] = useState(false);
  const [slide, setSlide] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const [pop, setPop] = useState(0);

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

  useEffect(() => {
    return () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    };
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
    setPop(Date.now());
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop(0), 800);
  }

  const current = post.media[slide];

  return (
    <article
      ref={cardRef}
      id={`post-${post.id}`}
      className="scroll-mt-20 overflow-hidden rounded-[28px] glass-card transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-full p-[2px] ring-2 ring-brand/25">
            <Avatar url={post.author?.avatarUrl ?? null} size={40} />
          </div>
          <div className="min-w-0 leading-tight">
            {post.author ? (
              <Link
                href={`/u/${post.author.username}`}
                className="block truncate font-semibold tracking-tight transition-colors hover:text-brand"
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
            className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500/15 active:scale-95"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReport(post.id)}
            aria-label="Report post"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"
          >
            <Icon name="flag" className="h-[18px] w-[18px]" />
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
          <span
            className={`${GLASS_DARK} pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums text-white`}
          >
            {Math.min(slide + 1, post.media.length)}/{post.media.length}
          </span>
        )}

        {current?.kind === "video" && !post.music && (
          <button
            type="button"
            onClick={() => setVideoMuted((m) => !m)}
            aria-label={videoMuted ? "Turn sound on" : "Turn sound off"}
            className={`${GLASS_DARK} absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-white transition active:scale-90`}
          >
            <Icon name={videoMuted ? "volumeOff" : "volumeOn"} className="h-[18px] w-[18px]" />
          </button>
        )}

        {pop !== 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Icon
              key={pop}
              name="heart"
              filled
              className="h-24 w-24 animate-heart-burst text-[#ff3b5c] drop-shadow-[0_8px_30px_rgba(255,59,92,0.55)]"
            />
          </div>
        )}
      </div>

      {post.media.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-3">
          {post.media.map((m, i) => (
            <span
              key={m.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === slide ? "w-4 bg-brand" : "w-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onLike(post)}
            aria-label={post.liked ? "Unlike" : "Like"}
            className={`transition-transform duration-200 active:scale-90 ${
              post.liked ? "text-[#ff3b5c]" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            <Icon
              key={post.liked ? "on" : "off"}
              name="heart"
              filled={post.liked}
              className={`h-[26px] w-[26px] ${post.liked ? "animate-like-pop" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => onOpenComments(post.id)}
            aria-label="Comments"
            className="text-foreground/80 transition-transform duration-200 hover:text-foreground active:scale-90"
          >
            <Icon name="comment" className="h-[26px] w-[26px]" />
          </button>
          <button
            type="button"
            onClick={() => onOpenShare(post.id)}
            aria-label="Send"
            className="text-foreground/80 transition-transform duration-200 hover:text-foreground active:scale-90"
          >
            <Icon name="send" className="h-[26px] w-[26px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSave(post)}
          aria-label={post.saved ? "Remove from saved" : "Save"}
          className={`transition-transform duration-200 active:scale-90 ${
            post.saved ? "text-brand" : "text-foreground/80 hover:text-foreground"
          }`}
        >
          <Icon name="bookmark" filled={post.saved} className="h-[26px] w-[26px]" />
        </button>
      </div>

      <div className="px-4 pt-2 text-sm">
        <button
          type="button"
          onClick={() => onOpenLikers(post.id)}
          className="font-semibold tabular-nums"
        >
          {formatCount(post.likeCount)} {post.likeCount === 1 ? "like" : "likes"}
        </button>
        <span className="text-foreground/50">
          {" "}
          · {formatCount(post.viewCount)} {post.viewCount === 1 ? "view" : "views"}
        </span>
      </div>

      {post.caption && (
        <p className="whitespace-pre-wrap break-words px-4 pt-1 text-sm leading-snug">
          <span className="mr-2 font-semibold">
            {post.author?.username ?? "Anonymous"}
          </span>
          <EmojiText text={post.caption} />
        </p>
      )}

      {post.music && (
        <div className="px-4 pt-2.5">
          <button
            type="button"
            onClick={() => onToggleMusic(post)}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/[0.08] bg-foreground/[0.04] py-1 pl-1 pr-3.5 text-xs font-medium backdrop-blur-md transition-all hover:bg-foreground/[0.08] active:scale-95"
          >
            {post.music.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.music.artworkUrl}
                alt=""
                referrerPolicy="no-referrer"
                className={`h-7 w-7 shrink-0 rounded-full object-cover ${
                  musicPlaying ? "animate-vinyl" : ""
                }`}
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                <Icon name="music" className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="truncate">
              {post.music.title} · {post.music.artist}
            </span>
            {musicPlaying ? (
              <div className="flex h-3 items-end gap-0.5">
                <span className="eq-bar w-0.5 rounded-full bg-brand" />
                <span className="eq-bar w-0.5 rounded-full bg-brand [animation-delay:0.2s]" />
                <span className="eq-bar w-0.5 rounded-full bg-brand [animation-delay:0.4s]" />
              </div>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3 shrink-0 text-foreground/50"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Comments preview */}
      <div className="space-y-1 px-4 pb-4 pt-2 text-sm">
        {post.commentCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenComments(post.id)}
            className="text-foreground/55"
          >
            View all {formatCount(post.commentCount)}{" "}
            {post.commentCount === 1 ? "comment" : "comments"}
          </button>
        )}

        {post.previewComments.map((c) => (
          <p key={c.id} className="truncate">
            <span className="mr-2 font-semibold">{c.username}</span>
            <EmojiText text={c.content} />
          </p>
        ))}

        <button
          type="button"
          onClick={() => onOpenComments(post.id)}
          className="block text-foreground/45"
        >
          Add a comment…
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
  const [confirmPost, setConfirmPost] = useState<FeedPost | null>(null);
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
      if (toastTimer.current) clearTimeout(toastTimer.current);
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

  async function confirmRemove() {
    const p = confirmPost;
    if (!p) return;

    setConfirmPost(null);
    try {
      await deletePost(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      showToast("Post deleted");
    } catch {
      showToast("Couldn't delete. Try again.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/20">
          <Icon name="plus" className="h-9 w-9" strokeWidth={1.6} />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight">No posts yet</p>
          <p className="mt-1 text-sm text-foreground/55">
            Share the first moment.
          </p>
        </div>
        <Link
          href="/reels/new"
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition active:scale-95"
        >
          Create a post
        </Link>
      </div>
    );
  }

  const sheetPostId = sheet?.postId ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-8 pb-24 md:pb-10">
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
          onDelete={setConfirmPost}
          onReport={setReportPostId}
          onOpenLikers={openLikers}
          onOpenComments={(id) => setSheet({ type: "comments", postId: id })}
          onOpenShare={(id) => setSheet({ type: "share", postId: id })}
          onToggleMusic={toggleMusic}
          onStopMusic={stopMusic}
        />
      ))}

      <ConfirmDialog
        open={confirmPost !== null}
        title="Delete this post?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmPost(null)}
        onConfirm={() => void confirmRemove()}
      />

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
                      className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
                        done
                          ? "bg-foreground/10 text-foreground/50"
                          : "bg-brand text-white"
                      }`}
                    >
                      {done ? (
                        <>
                          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                          Sent
                        </>
                      ) : (
                        "Send"
                      )}
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
              className="flex-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.06] py-2.5 text-sm font-medium backdrop-blur-sm transition-all hover:bg-foreground/[0.1] active:scale-95"
            >
              Copy link
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => nativeShare(sheetPostId)}
                className="flex-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.06] py-2.5 text-sm font-medium backdrop-blur-sm transition-all hover:bg-foreground/[0.1] active:scale-95"
              >
                More…
              </button>
            )}
          </div>
        </Sheet>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center">
          <div className="glass-dropdown flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <Icon name="check" className="h-4 w-4 text-brand" strokeWidth={2.4} />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}