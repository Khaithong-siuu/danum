"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CommentsSheet } from "@/components/comments-sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
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

/* ------------------------------------------------------------------ */
/*  Icons (stroke icons, SF-Symbols-like weight)                       */
/* ------------------------------------------------------------------ */

const ICONS = {
  heart: [
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  ],
  comment: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  eye: [
    "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  volumeOn: [
    "M11 5 6 9H2v6h4l5 4V5Z",
    "M15.54 8.46a5 5 0 0 1 0 7.07",
    "M19.07 4.93a10 10 0 0 1 0 14.14",
  ],
  volumeOff: ["M11 5 6 9H2v6h4l5 4V5Z", "m22 9-6 6", "m16 9 6 6"],
  back: ["m15 18-6-6 6-6"],
  plus: ["M12 5v14", "M5 12h14"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  ],
  flag: [
    "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
    "M4 22v-7",
  ],
  layers: ["m12 2 10 5-10 5L2 7l10-5Z", "m2 17 10 5 10-5", "m2 12 10 5 10-5"],
  check: ["M20 6 9 17l-5-5"],
  music: [
    "M9 18V5l12-2v13",
    "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    "M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
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

/* Frosted-glass surface used by every floating control on the reels */
const GLASS =
  "border border-white/15 bg-white/10 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]";
const ROUND_BTN =
  "flex items-center justify-center rounded-full text-white transition hover:bg-white/20 active:scale-90";

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
      className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="mx-auto max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-x border-t border-white/15 bg-neutral-900/70 text-white shadow-[0_-8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-neutral-900/60 px-4 pb-3 pt-2.5 text-center backdrop-blur-3xl">
          <div className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-white/30" />
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
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const [items, setItems] = useState<ReelData[]>(reels);
  const [active, setActive] = useState(startIndex);
  const [soundOn, setSoundOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [sheet, setSheet] = useState<{
    type: "likers" | "share" | "comments";
    reelId: number;
  } | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [confirmReel, setConfirmReel] = useState<ReelData | null>(null);
  const [likers, setLikers] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ id: number; key: number } | null>(null);

  const current = items[Math.min(active, Math.max(0, items.length - 1))];
  const currentId = current?.id;
  const currentKind = current?.kind;

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  // Clear any pending timers when leaving the page
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (burstTimer.current) clearTimeout(burstTimer.current);
    };
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

  // Progress of the video on screen
  useEffect(() => {
    setVideoProgress(0);
    if (currentId === undefined || currentKind !== "video") return;

    const video = videoRefs.current.get(currentId);
    if (!video) return;

    const onTime = () => {
      if (video.duration) setVideoProgress(video.currentTime / video.duration);
    };

    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [currentId, currentKind]);

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

  function triggerBurst(id: number) {
    setBurst({ id, key: Date.now() });
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(null), 800);
  }

  // One tap pauses or plays, a quick second tap likes
  function handleTap(r: ReelData) {
    const now = Date.now();

    if (now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      if (!r.liked) void handleLike(r);
      triggerBurst(r.id);
      return;
    }

    lastTap.current = now;
    tapTimer.current = setTimeout(() => setPaused((p) => !p), 280);
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

  async function confirmRemove() {
    const r = confirmReel;
    if (!r) return;

    setConfirmReel(null);
    try {
      await deleteReel(r.id);
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      showToast("Post deleted");
    } catch {
      showToast("Couldn't delete. Try again.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-black p-8 text-center text-white">
        <div className={`${GLASS} flex h-20 w-20 items-center justify-center rounded-full`}>
          <Icon name="plus" className="h-9 w-9" strokeWidth={1.6} />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight">No reels yet</p>
          <p className="mt-1 text-sm text-white/60">
            Be the first to share something.
          </p>
        </div>
        <Link
          href="/reels/new"
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition active:scale-95"
        >
          Create a post
        </Link>
        <Link href="/" className="text-sm text-white/60">
          Back to feed
        </Link>
      </div>
    );
  }

  const sheetReelId = sheet?.reelId ?? null;

  const progress =
    current?.music && soundOn
      ? clipProgress
      : current?.kind === "video"
        ? videoProgress
        : null;

  return (
    <div className="relative h-[100dvh] w-full bg-black text-white">
      <audio ref={audioRef} preload="auto" />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="Back to feed"
          className={`pointer-events-auto h-10 w-10 ${GLASS} ${ROUND_BTN}`}
        >
          <Icon name="back" className="h-5 w-5" strokeWidth={2.2} />
        </Link>

        <span className="text-[17px] font-semibold tracking-tight drop-shadow-md">
          Reels
        </span>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            className={`h-10 w-10 ${GLASS} ${ROUND_BTN}`}
          >
            <Icon name={soundOn ? "volumeOn" : "volumeOff"} className="h-5 w-5" />
          </button>
          <Link
            href="/reels/saved"
            aria-label="Saved"
            className={`h-10 w-10 ${GLASS} ${ROUND_BTN}`}
          >
            <Icon name="bookmark" className="h-5 w-5" />
          </Link>
          <Link
            href="/reels/new"
            aria-label="New post"
            className={`h-10 w-10 ${GLASS} ${ROUND_BTN}`}
          >
            <Icon name="plus" className="h-5 w-5" strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      {/* Progress of the video or music clip */}
      {progress !== null && (
        <div
          className="pointer-events-none absolute inset-x-4 z-30 h-[3px] overflow-hidden rounded-full bg-white/25 backdrop-blur-sm"
          style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.25rem)" }}
        >
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Posts */}
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((r, i) => {
          const isActive = i === active;
          const playing = soundOn && !paused && isActive;

          return (
            <section
              key={r.id}
              data-index={i}
              className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-neutral-950"
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
                <>
                  {/* Soft blurred copy fills the bars around the photo */}
                  <Image
                    src={r.mediaUrl}
                    alt=""
                    fill
                    aria-hidden="true"
                    className="scale-125 object-cover opacity-60 blur-3xl"
                    sizes="100vw"
                  />
                  <Image
                    src={r.mediaUrl}
                    alt={r.caption || "Photo"}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority={i === startIndex}
                  />
                </>
              )}

              {/* Tap to pause or play, double tap to like */}
              <button
                type="button"
                aria-label="Play or pause"
                onClick={() => handleTap(r)}
                className="absolute inset-0 z-10"
              />

              {paused && isActive && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <span
                    className={`${GLASS} flex h-20 w-20 items-center justify-center rounded-full animate-in fade-in-0 zoom-in-50 duration-200`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="ml-1 h-9 w-9"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
                    </svg>
                  </span>
                </div>
              )}

              {burst?.id === r.id && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <Icon
                    key={burst.key}
                    name="heart"
                    filled
                    className="h-28 w-28 animate-heart-burst text-[#ff3b5c] drop-shadow-[0_8px_30px_rgba(255,59,92,0.55)]"
                  />
                </div>
              )}

              {/* Readability gradients */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-32 bg-gradient-to-b from-black/50 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-80 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

              {/* Actions */}
              <div
                className="absolute right-3 z-20 flex flex-col items-center gap-4"
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
              >
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLike(r)}
                    aria-label={r.liked ? "Unlike" : "Like"}
                    className={`h-12 w-12 ${GLASS} ${ROUND_BTN} ${
                      r.liked ? "text-[#ff3b5c]" : ""
                    }`}
                  >
                    <Icon
                      key={r.liked ? "on" : "off"}
                      name="heart"
                      filled={r.liked}
                      className={`h-6 w-6 ${r.liked ? "animate-like-pop" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openLikers(r.id)}
                    aria-label="See who liked this"
                    className="text-[11px] font-semibold tabular-nums drop-shadow"
                  >
                    {formatCount(r.likeCount)}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSheet({ type: "comments", reelId: r.id })}
                    aria-label="Comments"
                    className={`h-12 w-12 ${GLASS} ${ROUND_BTN}`}
                  >
                    <Icon name="comment" className="h-6 w-6" />
                  </button>
                  <span className="text-[11px] font-semibold tabular-nums drop-shadow">
                    {formatCount(r.commentCount)}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSheet({ type: "share", reelId: r.id })}
                    aria-label="Send to a chat"
                    className={`h-12 w-12 ${GLASS} ${ROUND_BTN}`}
                  >
                    <Icon name="send" className="h-6 w-6" />
                  </button>
                  <span className="text-[11px] font-semibold drop-shadow">
                    Send
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSave(r)}
                    aria-label={r.saved ? "Remove from saved" : "Save"}
                    className={`h-12 w-12 ${GLASS} ${ROUND_BTN}`}
                  >
                    <Icon name="bookmark" filled={r.saved} className="h-6 w-6" />
                  </button>
                  <span className="text-[11px] font-semibold drop-shadow">
                    {r.saved ? "Saved" : "Save"}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-white/70">
                  <Icon name="eye" className="h-4 w-4" />
                  <span className="text-[11px] font-semibold tabular-nums">
                    {formatCount(r.viewCount)}
                  </span>
                </div>
              </div>

              {/* Author, caption, music */}
              <div
                className="absolute left-4 right-[4.75rem] z-20"
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
              >
                {r.author && (
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/u/${r.author.username}`}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <span className="shrink-0 rounded-full ring-2 ring-white/40">
                        <Avatar url={r.author.avatarUrl} size={36} />
                      </span>
                      <span className="truncate text-[15px] font-semibold drop-shadow">
                        {r.author.username}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs text-white/70">
                      {timeAgo(r.createdAt)}
                    </span>

                    <div className="ml-auto shrink-0">
                      {r.isOwner ? (
                        <button
                          type="button"
                          onClick={() => setConfirmReel(r)}
                          className={`${GLASS} flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-red-300 transition active:scale-95`}
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReportId(r.id)}
                          aria-label="Report"
                          className={`${GLASS} flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white/80 transition active:scale-95`}
                        >
                          <Icon name="flag" className="h-3.5 w-3.5" />
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {r.caption && (
                  <p
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded(expanded === r.id ? null : r.id);
                      }
                    }}
                    className={`mt-2.5 cursor-pointer text-sm leading-snug drop-shadow ${
                      expanded === r.id ? "" : "line-clamp-2"
                    }`}
                  >
                    <EmojiText text={r.caption} />
                  </p>
                )}

                {r.mediaCount > 1 && (
                  <Link
                    href={`/p/${r.id}`}
                    className={`${GLASS} mt-2.5 mr-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium`}
                  >
                    <Icon name="layers" className="h-3.5 w-3.5" />
                    {r.mediaCount} items · View post
                  </Link>
                )}

                {r.music && (
                  <div
                    className={`${GLASS} mt-2.5 inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-xs text-white`}
                  >
                    {r.music.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.music.artworkUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={`h-7 w-7 shrink-0 rounded-full object-cover ${
                          playing ? "animate-vinyl" : ""
                        }`}
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <Icon name="music" className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="truncate">
                      {r.music.title} · {r.music.artist}
                    </span>
                    {!soundOn && (
                      <Icon
                        name="volumeOff"
                        className="h-3.5 w-3.5 shrink-0 text-white/70"
                      />
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmReel !== null}
        title="Delete this post?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmReel(null)}
        onConfirm={() => void confirmRemove()}
      />

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
                      className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
                        done ? "bg-white/10 text-white/60" : "bg-brand text-white"
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

          <div className="mt-3 flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => copyLink(sheetReelId)}
              className="flex-1 rounded-xl border border-white/10 bg-white/10 py-2.5 text-sm font-medium backdrop-blur-md transition-all hover:bg-white/15 active:scale-95"
            >
              Copy link
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => nativeShare(sheetReelId)}
                className="flex-1 rounded-xl border border-white/10 bg-white/10 py-2.5 text-sm font-medium backdrop-blur-md transition-all hover:bg-white/15 active:scale-95"
              >
                More…
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center"
          style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.75rem)" }}
        >
          <div
            className={`${GLASS} flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white animate-in fade-in-0 slide-in-from-top-2 duration-300`}
          >
            <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}