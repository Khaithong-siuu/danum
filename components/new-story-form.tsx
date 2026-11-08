"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function NewStoryForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  function processFile(f: File) {
    setError(null);
    if (!f.type.startsWith("image/")) {
      setError("Please select a JPG, PNG or WebP image file.");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError("Story image must be smaller than 5 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || submitting) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("caption", caption);

    try {
      const res = await action(formData);
      if (!res.ok) {
        setSubmitting(false);
        setError(res.error || "Could not save your story.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setSubmitting(false);
      setError("Couldn't share your story. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 animate-in fade-in-0">
          {error}
        </div>
      )}

      {/* Dropzone or preview */}
      {!preview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`group relative flex aspect-[9/12] max-h-[420px] w-full flex-col items-center justify-center rounded-[28px] border border-dashed p-8 text-center transition-all ${
            isDragging
              ? "border-brand bg-brand/10 scale-[1.01]"
              : "border-foreground/20 bg-foreground/[0.02] hover:border-brand/50 hover:bg-brand/[0.04]"
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-brand/20 to-brand/5 text-3xl ring-1 ring-brand/20 transition-transform group-hover:scale-105">
            📸
          </div>

          <p className="text-base font-semibold tracking-tight">
            Choose a photo
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            or drag one here
          </p>
          <p className="mt-4 text-xs text-foreground/40">
            Vertical works best · JPG, PNG or WebP · up to 5 MB
          </p>
        </div>
      ) : (
        <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] bg-black shadow-2xl shadow-black/30 ring-1 ring-foreground/10">
          <div className="relative aspect-[9/16] w-full">
            <Image
              src={preview}
              alt="Story preview"
              fill
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
            {caption && (
              <div className="absolute inset-x-0 bottom-5 px-4 text-center">
                <span className="inline-block max-w-full rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-xl">
                  {caption}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove photo"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-sm text-white backdrop-blur-xl transition active:scale-90 hover:bg-black/60"
          >
            ✕
          </button>
        </div>
      )}

      {/* Caption */}
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="story-caption" className="text-sm font-semibold">
            Caption
          </label>
          <span className="text-xs tabular-nums text-foreground/40">
            {caption.length}/140
          </span>
        </div>
        <input
          id="story-caption"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={140}
          placeholder="Add a caption"
          className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2.5 text-sm transition-all focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Sharing…</span>
          </>
        ) : (
          <span>Share to your story</span>
        )}
      </button>
    </form>
  );
}