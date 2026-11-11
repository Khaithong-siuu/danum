"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { processPhoto, type MediaKind } from "@/lib/media";
import {
  FilterStrip,
  MediaActions,
  MediaStage,
  MediaTray,
  useMediaItems,
} from "@/components/media-picker";

const ALLOW_LIST: MediaKind[] = ["photo"];
const MAX_STORIES = 10;

type CreateStory = (input: {
  path: string;
  caption: string;
}) => Promise<{ ok: boolean; error?: string }>;

export function NewStoryForm({
  userId,
  action,
}: {
  userId: string;
  action: CreateStory;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const media = useMediaItems({ allow: ALLOW_LIST, max: MAX_STORIES });
  const { active } = media;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (media.items.length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    media.setError(null);

    const queue = [...media.items];
    setProgress({ done: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      try {
        const file = await processPhoto(item.file, item.filter);
        // Offset by i so every story in the run gets its own file name
        const path = `${userId}-story-${Date.now() + i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(path, file, { contentType: "image/jpeg", upsert: false });

        if (uploadError) throw new Error("Could not upload your story.");

        const res = await action({ path, caption: item.caption });
        if (!res.ok) throw new Error(res.error || "Could not save your story.");

        // This one is live: take it off the list so a retry doesn't repeat it
        media.remove(item.id);
        setProgress({ done: i + 1, total: queue.length });
      } catch (err) {
        setSubmitting(false);
        setProgress(null);
        setError(
          (err instanceof Error ? err.message : "Couldn't share your story.") +
            (i > 0 ? ` ${i} of ${queue.length} were shared.` : "")
        );
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  const count = media.items.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <MediaStage
        item={active}
        shape="story"
        caption={active?.caption}
        busy={submitting}
        onRemove={active ? () => media.remove(active.id) : undefined}
      />

      <MediaActions
        allow={ALLOW_LIST}
        multiple
        disabled={submitting || media.reading}
        onFiles={(files) => void media.add(files)}
      />

      <MediaTray
        items={media.items}
        activeId={active?.id ?? null}
        numbered
        disabled={submitting}
        onSelect={media.setActiveId}
        onRemove={media.remove}
      />

      {media.reading && (
        <p className="text-center text-xs text-foreground/50">Reading your photos…</p>
      )}

      <FilterStrip
        item={active}
        onChange={(filter) => active && media.update(active.id, { filter })}
      />

      {active && (
        <div className="glass-card rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="story-caption" className="text-sm font-semibold">
              Caption{count > 1 ? " for this photo" : ""}
            </label>
            <span className="text-xs tabular-nums text-foreground/40">
              {active.caption.length}/140
            </span>
          </div>
          <input
            id="story-caption"
            type="text"
            value={active.caption}
            onChange={(e) => media.update(active.id, { caption: e.target.value })}
            maxLength={140}
            placeholder="Add a caption"
            disabled={submitting}
            className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2.5 text-sm transition-all focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      )}

      {(error || media.error) && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 animate-in fade-in-0">
          {error || media.error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 pb-[max(0.75rem,var(--sab))] pt-3 glass-bar border-t">
        <button
          type="submit"
          disabled={count === 0 || submitting}
          className="liquid-brand flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>
                Sharing{progress ? ` ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ""}…
              </span>
            </>
          ) : (
            <span>
              {count > 1 ? `Share ${count} stories` : "Share to your story"}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
