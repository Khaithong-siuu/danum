"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/lib/music";
import { MusicPicker, type MusicChoice } from "@/components/music-picker";
import {
  CAPTION_MAX,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  PHOTO_TYPES,
  VIDEO_TYPES,
  type ReelKind,
} from "@/lib/reels";

type CreateReel = (input: {
  kind: string;
  path: string;
  caption: string;
  durationSeconds: number | null;
  musicTrackId: number | null;
  musicStart: number;
  musicLength: number;
}) => Promise<{ ok: boolean; error?: string }>;

export function NewReelForm({
  userId,
  searchMusic,
  createReel,
}: {
  userId: string;
  searchMusic: (query: string) => Promise<Track[]>;
  createReel: CreateReel;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [kind, setKind] = useState<ReelKind>("video");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState<MusicChoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the temporary preview when it changes or the page closes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetFile() {
    setFile(null);
    setPreviewUrl(null);
    setDuration(null);
  }

  function chooseKind(next: ReelKind) {
    if (next === kind) return;
    resetFile();
    setError(null);
    setKind(next);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];

    setError(null);
    resetFile();

    if (!f) return;

    const allowed = kind === "video" ? VIDEO_TYPES : PHOTO_TYPES;
    if (!allowed.includes(f.type)) {
      setError(
        kind === "video"
          ? "Choose an MP4, MOV or WebM video."
          : "Choose a JPG, PNG or WebP photo."
      );
      input.value = "";
      return;
    }

    const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (f.size > maxBytes) {
      setError(
        `That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`
      );
      input.value = "";
      return;
    }

    const url = URL.createObjectURL(f);

    if (kind === "photo") {
      setFile(f);
      setPreviewUrl(url);
      return;
    }

    // Read the video length before accepting it
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Math.ceil(probe.duration);

      if (!Number.isFinite(seconds) || seconds < 1) {
        setError("We couldn't read that video.");
        URL.revokeObjectURL(url);
        input.value = "";
        return;
      }
      if (seconds > MAX_VIDEO_SECONDS) {
        setError(
          `Reels can be up to ${MAX_VIDEO_SECONDS} seconds. Yours is ${seconds}.`
        );
        URL.revokeObjectURL(url);
        input.value = "";
        return;
      }

      setDuration(seconds);
      setFile(f);
      setPreviewUrl(url);
    };
    probe.onerror = () => {
      setError("We couldn't read that video.");
      URL.revokeObjectURL(url);
      input.value = "";
    };
    probe.src = url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setError(null);

    const rawExt = (file.name.split(".").pop() || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const ext =
      rawExt.length >= 2 && rawExt.length <= 5
        ? rawExt
        : kind === "video"
          ? "mp4"
          : "jpg";

    const path = `${userId}-reel-${Date.now()}.${ext}`;

    // The file goes straight from the phone to storage, so big videos work
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setUploading(false);
      setError("Upload failed. The file may be too large (limit 50 MB for video).");
      return;
    }

    const result = await createReel({
      kind,
      path,
      caption,
      durationSeconds: kind === "video" ? duration : null,
      musicTrackId: music ? music.track.id : null,
      musicStart: music ? music.start : 0,
      musicLength: music ? music.length : 15,
    }).catch(() => ({ ok: false, error: "Could not save your post." }));

    if (!result.ok) {
      setUploading(false);
      setError(result.error ?? "Could not save your post.");
      return;
    }

    router.push("/reels");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Video or photo */}
      <div className="grid grid-cols-2 rounded-xl bg-foreground/10 p-1 text-sm font-medium">
        {(
          [
            ["video", "🎬 Video"],
            ["photo", "🖼 Photo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => chooseKind(value)}
            className={`rounded-lg py-2 transition ${
              kind === value ? "bg-background shadow-sm" : "text-foreground/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* File */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          {kind === "video" ? "Video" : "Photo"}
        </label>
        <input
          key={kind}
          type="file"
          accept={
            kind === "video"
              ? "video/mp4,video/quicktime,video/webm"
              : "image/jpeg,image/png,image/webp"
          }
          onChange={handleFile}
          className="w-full"
        />
        <p className="mt-1 text-xs text-foreground/50">
          {kind === "video"
            ? `MP4, MOV or WebM, up to ${MAX_VIDEO_SECONDS} seconds and 50 MB.`
            : "JPG, PNG or WebP, up to 10 MB."}
        </p>
      </div>

      {previewUrl && (
        <div className="mx-auto max-w-[240px] overflow-hidden rounded-2xl bg-black">
          {kind === "video" ? (
            <video
              src={previewUrl}
              controls
              playsInline
              muted
              className="max-h-[50dvh] w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-[50dvh] w-full object-contain"
            />
          )}
        </div>
      )}

      {/* Music: optional for both */}
      <div className="space-y-2">
        <MusicPicker search={searchMusic} value={music} onChange={setMusic} />
        {kind === "video" && music && (
          <p className="text-xs text-foreground/50">
            Your song plays instead of the video&apos;s own sound.
          </p>
        )}
      </div>

      {/* Caption */}
      <div>
        <label className="mb-1 block text-sm font-medium">Caption (optional)</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={CAPTION_MAX}
          rows={3}
          placeholder="Write a caption..."
          className="w-full resize-none rounded border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
      >
        {uploading ? "Uploading..." : "Share"}
      </button>
    </form>
  );
}