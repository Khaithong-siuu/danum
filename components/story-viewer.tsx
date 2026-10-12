"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/time";

export type StoryItem = {
  id: number;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
};

const DURATION_MS = 5000;
const TICK_MS = 50;

export function StoryViewer({
  initialStories,
  startIndex,
  author,
  isOwner,
  markViewed,
  deleteStory,
}: {
  initialStories: StoryItem[];
  startIndex: number;
  author: { username: string; avatarUrl: string | null };
  isOwner: boolean;
  markViewed: (storyId: number) => Promise<void>;
  deleteStory: (storyId: number) => Promise<void>;
}) {
  const router = useRouter();
  const [stories, setStories] = useState(initialStories);
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdStart = useRef(0);

  const story = stories[index];
  const storyId = story?.id;

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex(index + 1);
      setProgress(0);
    } else {
      router.push("/");
    }
  }, [index, stories.length, router]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex(index - 1);
    setProgress(0);
  }, [index]);

  // Progress timer
  useEffect(() => {
    if (paused || !story) return;
    const id = setInterval(
      () => setProgress((p) => Math.min(1, p + TICK_MS / DURATION_MS)),
      TICK_MS
    );
    return () => clearInterval(id);
  }, [paused, story]);

  // Advance when the bar fills
  useEffect(() => {
    if (progress >= 1) goNext();
  }, [progress, goNext]);

  // Record that this story was seen
  useEffect(() => {
    if (storyId !== undefined) void markViewed(storyId);
  }, [storyId, markViewed]);

  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, router]);

  async function handleDelete() {
    if (!story) return;
    if (!window.confirm("Delete this story?")) return;

    setPaused(true);
    const id = story.id;
    await deleteStory(id);

    const remaining = stories.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      router.push("/");
      return;
    }

    setStories(remaining);
    setIndex(Math.min(index, remaining.length - 1));
    setProgress(0);
    setPaused(false);
  }

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="relative mx-auto h-full w-full max-w-md overflow-hidden">
        {/* Image */}
        <Image
          key={story.id}
          src={story.imageUrl}
          alt={story.caption || "Story"}
          fill
          priority
          className="object-contain"
          sizes="(max-width: 448px) 100vw, 448px"
        />

        {/* Tap zones: left third = back, rest = next. Hold to pause. */}
        <div
          className="absolute inset-0 z-10 flex"
          onPointerDown={() => {
            holdStart.current = Date.now();
            setPaused(true);
          }}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          <button
            type="button"
            aria-label="Previous story"
            className="h-full w-1/3"
            onClick={() => {
              if (Date.now() - holdStart.current < 250) goPrev();
            }}
          />
          <button
            type="button"
            aria-label="Next story"
            className="h-full w-2/3"
            onClick={() => {
              if (Date.now() - holdStart.current < 250) goNext();
            }}
          />
        </div>

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-3 pb-8">
          <div className="flex gap-1">
            {stories.map((s, i) => (
              <div
                key={s.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <div
                  className="h-full bg-white"
                  style={{
                    width:
                      i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {author.avatarUrl ? (
                <Image
                  src={author.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-white/20" />
              )}
              <span className="text-sm font-semibold text-white">
                {author.username}
              </span>
              <span className="text-xs text-white/70">
                {timeAgo(story.createdAt)}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-4">
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm font-medium text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              )}
              <Link
                href="/"
                aria-label="Close stories"
                className="text-2xl leading-none text-white"
              >
                ×
              </Link>
            </div>
          </div>
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
            <p className="text-center text-white">{story.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}