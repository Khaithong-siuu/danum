"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

export type ReelData = {
  id: number;
  kind: "video" | "photo";
  mediaUrl: string;
  mediaCount: number;
  caption: string | null;
  likeCount: number;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  author: Person | null;
  isOwner: boolean;
  liked: boolean;
  saved: boolean;
  music: {
    title: string;
    artist: string;
    url: string;
    artworkUrl: string | null;
    start: number;
    length: number;
  } | null;
};

const ICONS = {
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  comment: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  bookmark: "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z",
  send: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
  eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
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
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full bg-white/20"
      style={{ width: size, height: size }}
    />
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-auto max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-neutral-900/95 text-white backdrop-blur-xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-neutral-900/95 px-4 pb-3 pt-2 text-center">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/30" />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <div className="px-4">{children}</div>
      </div>
    </div>
  );
}

export function ReelsViewer({
  reels,
  startIndex,
  chatTargets,
  userId,
  toggleLike,
  toggleSave,
  recordView,
  getLikers,
  sendToChat,
  deleteReel,
  getComments,
  addComment,
  toggleCommentLike,
  deleteComment,
}: {
  reels: ReelData[];
  startIndex: number;
  chatTargets: ChatTarget[];
  userId: string;
  toggleLike: (id: number) => Promise<void>;
  toggleSave: (id: number) => Promise<void>;
  recordView: (id: number) => Promise<void>;
  getLikers: (id: number) => Promise<Person[]>;
  sendToChat: (conversationId: string, reelId: number) => Promise<boolean>;
  deleteReel: (id: number) => Promise<void>;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());
  const viewed = useRef(new Set<number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [items, setItems] = useState<ReelData[]>(reels);
  const [active, setActive] = useState(startIndex);
  const [soundOn, setSoundOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  const [sheet, setSheet] = useState<{
    type: "likers" | "share" | "comments";
    reelId: number;
  } | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [likers, setLikers] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const current = items[Math.min(active, Math.max(0, items.length - 1))];

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  // Open on the requested reel
  useEffect(() => {
    const el = containerRef.current?.children[startIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which reel is on screen
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) setActive(index);
          }
        }
      },
      { root, threshold: 0.6 }
    );

    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    setPaused(false);
    setClipProgress(0);
  }, [active]);

  // Play the video and music for the post on screen, pause the rest
  useEffect(() => {
    const music = current?.music ?? null;

    videoRefs.current.forEach((video, id) => {
      if (current && id === current.id && !paused) {
        // A chosen song replaces the video's own sound
        video.muted = !soundOn || !!music;
        void video.play().catch(() => {});
      } else {
        video.pause();
        if (!current || id !== current.id) video.currentTime = 0;
      }
    });

    const audio = audioRef.current;
    if (!audio) return;

    if (music && soundOn && !paused) {
      const changed = audio.dataset.src !== music.url;
      if (changed) {
        audio.src = music.url;
        audio.dataset.src = music.url;
      }
      if (
        changed ||
        audio.currentTime < music.start ||
        audio.currentTime >= music.start + music.length
      ) {
        audio.currentTime = music.start;
      }
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [current, soundOn, paused]);

  // Loop the chosen music clip
  useEffect(() => {
    const audio = audioRef.current;
    const music = current?.music ?? null;
    if (!audio || !music) return;

    const onTime = () => {
      const end = music.start + music.length;
      if (audio.currentTime >= end) audio.currentTime = music.start;
      setClipProgress(
        Math.min(1, Math.max(0, (audio.currentTime - music.start) / music.length))
      );
    };

    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
  }, [current]);

  // Count a view after 1.5 seconds on a post
  useEffect(() => {
    if (!current || current.isOwner || viewed.current.has(current.id)) return;

    const id = current.id;
    const timer = setTimeout(() => {
      viewed.current.add(id);
      void recordView(id).catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [current, recordView]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  function patch(id: number, changes: Partial<ReelData>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  // Sound has to be switched on by a tap on iPhone, so start playback right here
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);

    if (!next || !current) return;

    if (current.music && audioRef.current) {
      const audio = audioRef.current;
      audio.src = current.music.url;
      audio.dataset.src = current.music.url;
      audio.currentTime = current.music.start;
      void audio.play().catch(() => {});
    } else if (current.kind === "video") {
      const video = videoRefs.current.get(current.id);
      if (video) {
        video.muted = false;
        void video.play().catch(() => {});
      }
    }
  }

  async function handleLike(r: ReelData) {
    const next = !r.liked;
    patch(r.id, {
      liked: next,
      likeCount: Math.max(0, r.likeCount + (next ? 1 : -1)),
    });
    try {
      await toggleLike(r.id);
    } catch {
      patch(r.id, { liked: r.liked, likeCount: r.likeCount });
    }
  }

  async function handleSave(r: ReelData) {
    const next = !r.saved;
    patch(r.id, { saved: next });
    showToast(next ? "Saved" : "Removed from saved");
    try {
      await toggleSave(r.id);
    } catch {
      patch(r.id, { saved: r.saved });
    }
  }

  function openLikers(id: number) {
    setSheet({ type: "likers", reelId: id });
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

  async function sendTo(target: ChatTarget, reelId: number) {
    const key = `${reelId}:${target.conversationId}`;
    if (sent.has(key)) return;

    const ok = await sendToChat(target.conversationId, reelId).catch(() => false);

    if (ok) setSent((prev) => new Set(prev).add(key));
    else showToast("Couldn't send. Try again.");
  }

  async function remove(r: ReelData) {
    if (!window.confirm("Delete this post?")) return;
    await deleteReel(r.id);
    setItems((prev) => prev.filter((x) => x.id !== r.id));
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
        <p className="text-lg font-semibold">No reels yet</p>
        <Link
          href="/reels/new"
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white"
        >
          Post the first one
        </Link>
        <Link href="/" className="text-sm text-white/70">
          Back to feed
        </Link>
      </div>
    );
  }

  const sheetReelId = sheet?.reelId ?? null;

  return (
    <div className="relative h-[100dvh] w-full bg-black text-white">
      <audio ref={audioRef} preload="auto" />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="Back to feed"
          className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur-md"
        >
          ←
        </Link>
        <span className="text-base font-semibold drop-shadow">Reels</span>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            className="rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur-md"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <Link
            href="/reels/saved"
            aria-label="Saved"
            className="rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur-md"
          >
            🔖
          </Link>
          <Link
            href="/reels/new"
            aria-label="New post"
            className="rounded-full bg-black/40 px-3 py-1.5 text-sm font-bold backdrop-blur-md"
          >
            ＋
          </Link>
        </div>
      </div>

      {/* Progress of the music clip */}
      {current?.music && soundOn && (
        <div
          className="absolute inset-x-4 z-30 h-0.5 rounded bg-white/30"
          style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3rem)" }}
        >
          <div
            className="h-full rounded bg-white"
            style={{ width: `${clipProgress * 100}%` }}
          />
        </div>
      )}

      {/* Posts */}
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((r, i) => (
          <section
            key={r.id}
            data-index={i}
            className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
          >
            {r.kind === "video" ? (
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(r.id, el);
                  else videoRefs.current.delete(r.id);
                }}
                src={r.mediaUrl}
                className="absolute inset-0 h-full w-full object-contain"
                playsInline
                loop
                muted
                preload={Math.abs(i - active) <= 1 ? "auto" : "metadata"}
              />
            ) : (
              <Image
                src={r.mediaUrl}
                alt={r.caption || "Photo"}
                fill
                className="object-contain"
                sizes="100vw"
                priority={i === startIndex}
              />
            )}

            {/* Tap to pause or play */}
            <button
              type="button"
              aria-label="Play or pause"
              onClick={() => setPaused((p) => !p)}
              className="absolute inset-0 z-10"
            />

            {paused && i === active && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="rounded-full bg-black/50 px-5 py-4 text-3xl backdrop-blur-md">
                  ❚❚
                </span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-64 bg-gradient-to-t from-black/70 to-transparent" />

            {/* Actions */}
            <div
              className="absolute right-3 z-20 flex flex-col items-center gap-5"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleLike(r)}
                  aria-label={r.liked ? "Unlike" : "Like"}
                  className={`transition active:scale-125 ${
                    r.liked ? "text-red-500" : "text-white"
                  }`}
                >
                  <Icon name="heart" filled={r.liked} className="h-8 w-8" />
                </button>
                <button
                  type="button"
                  onClick={() => openLikers(r.id)}
                  aria-label="See who liked this"
                  className="mt-0.5 text-xs font-semibold"
                >
                  {formatCount(r.likeCount)}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSheet({ type: "comments", reelId: r.id })}
                aria-label="Comments"
                className="flex flex-col items-center"
              >
                <Icon name="comment" filled className="h-7 w-7" />
                <span className="mt-0.5 text-xs font-semibold">
                  {formatCount(r.commentCount)}
                </span>
              </button>

              <div className="flex flex-col items-center">
                <Icon name="eye" filled className="h-7 w-7" />
                <span className="mt-0.5 text-xs font-semibold">
                  {formatCount(r.viewCount)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSheet({ type: "share", reelId: r.id })}
                aria-label="Send to a chat"
                className="flex flex-col items-center"
              >
                <Icon name="send" filled className="h-7 w-7" />
                <span className="mt-0.5 text-xs font-semibold">Send</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave(r)}
                aria-label={r.saved ? "Remove from saved" : "Save"}
                className="flex flex-col items-center"
              >
                <Icon name="bookmark" filled={r.saved} className="h-7 w-7" />
                <span className="mt-0.5 text-xs font-semibold">
                  {r.saved ? "Saved" : "Save"}
                </span>
              </button>
            </div>

            {/* Author, caption, music */}
            <div
              className="absolute left-4 right-20 z-20"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            >
              {r.author && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/u/${r.author.username}`}
                    className="flex items-center gap-2"
                  >
                    <Avatar url={r.author.avatarUrl} size={36} />
                    <span className="font-semibold">{r.author.username}</span>
                  </Link>
                  <span className="text-xs text-white/70">
                    {timeAgo(r.createdAt)}
                  </span>
                  {r.isOwner ? (
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      className="ml-auto text-xs font-medium text-red-400"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReportId(r.id)}
                      className="ml-auto text-xs font-medium text-white/70"
                    >
                      Report
                    </button>
                  )}
                </div>
              )}

              {r.caption && (
                <p className="mt-2 line-clamp-3 text-sm">{r.caption}</p>
              )}

              {r.mediaCount > 1 && (
                <Link
                  href={`/p/${r.id}`}
                  className="mr-2 mt-2 inline-block rounded-full bg-black/40 px-3 py-1 text-xs backdrop-blur-md"
                >
                  ⧉ {r.mediaCount} photos and videos · Open post
                </Link>
              )}

              {r.music && (
                <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-black/40 py-1 pl-1 pr-3 text-xs backdrop-blur-md">
                  {r.music.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.music.artworkUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="pl-2">♪</span>
                  )}
                  <span className="truncate">
                    {r.music.title} · {r.music.artist}
                    {!soundOn && " · tap 🔇 for sound"}
                  </span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Report a post */}
      {reportId !== null && (
        <ReportSheet
          targetType="post"
          targetId={String(reportId)}
          onClose={() => setReportId(null)}
        />
      )}

      {/* Comments */}
      {sheet?.type === "comments" && sheetReelId !== null && (
        <CommentsSheet
          postId={sheetReelId}
          userId={userId}
          onClose={() => setSheet(null)}
          onCountChange={(delta) =>
            setItems((prev) =>
              prev.map((r) =>
                r.id === sheetReelId
                  ? { ...r, commentCount: Math.max(0, r.commentCount + delta) }
                  : r
              )
            )
          }
          getComments={getComments}
          addComment={addComment}
          toggleCommentLike={toggleCommentLike}
          deleteComment={deleteComment}
        />
      )}

      {/* Who liked */}
      {sheet?.type === "likers" && (
        <Sheet title="Likes" onClose={() => setSheet(null)}>
          {likers === null ? (
            <p className="py-6 text-center text-sm text-white/60">Loading...</p>
          ) : likers.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/60">
              No likes yet.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
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

      {/* Send to a chat */}
      {sheet?.type === "share" && sheetReelId !== null && (
        <Sheet title="Send to" onClose={() => setSheet(null)}>
          {chatTargets.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/60">
              You have no chats yet. Start one from Messages, then send posts here.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {chatTargets.map((t) => {
                const done = sent.has(`${sheetReelId}:${t.conversationId}`);
                return (
                  <li
                    key={t.conversationId}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar url={t.avatarUrl} size={40} />
                    <span className="flex-1 truncate font-medium">
                      {t.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => sendTo(t, sheetReelId)}
                      disabled={done}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                        done ? "bg-white/10 text-white/60" : "bg-brand text-white"
                      }`}
                    >
                      {done ? "Sent ✓" : "Send"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => copyLink(sheetReelId)}
              className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-medium"
            >
              Copy link
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => nativeShare(sheetReelId)}
                className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-medium"
              >
                More…
              </button>
            )}
          </div>
        </Sheet>
      )}

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-[60] -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black">
          {toast}
        </div>
      )}
    </div>
  );
}