import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTrack, searchTracks, type Track } from "@/lib/music";
import {
  CAPTION_MAX,
  MAX_PREVIEW_SECONDS,
  MIN_CLIP_SECONDS,
  clamp,
  isOwnReelPath,
} from "@/lib/reels";
import { NewReelForm } from "@/components/new-reel-form";

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

type CreateInput = {
  paths: string[];
  caption: string;
  musicTrackId: number | null;
  musicStart: number;
  musicLength: number;
};

async function searchMusic(query: string): Promise<Track[]> {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return searchTracks(String(query ?? ""));
}

async function createPost(
  input: CreateInput
): Promise<{ ok: boolean; error?: string }> {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Please sign in again." };

  const paths = Array.isArray(input.paths) ? input.paths : [];

  if (paths.length < 1 || paths.length > 10 || new Set(paths).size !== paths.length) {
    return { ok: false, error: "Add between 1 and 10 photos or videos." };
  }

  // Every file must be one this user just uploaded, so nobody can attach other media
  const media: { kind: "photo" | "video"; url: string }[] = [];

  for (const path of paths) {
    if (!isOwnReelPath(path, user.id)) {
      return { ok: false, error: "One of the uploads isn't valid." };
    }

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const kind = VIDEO_EXTENSIONS.has(ext)
      ? "video"
      : PHOTO_EXTENSIONS.has(ext)
        ? "photo"
        : null;

    if (!kind) return { ok: false, error: "That file type isn't supported." };

    media.push({
      kind,
      url: supabase.storage.from("photos").getPublicUrl(path).data.publicUrl,
    });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reels")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= 10) {
    return { ok: false, error: "You're posting too quickly. Try again later." };
  }

  const caption = String(input.caption ?? "").trim().slice(0, CAPTION_MAX);

  // Music is optional. The song is looked up again here, so its title and
  // preview link always come from Apple, never from the browser.
  let music: {
    music_track_id: number;
    music_title: string;
    music_artist: string;
    music_preview_url: string;
    music_artwork_url: string | null;
    music_start: number;
    music_length: number;
  } | null = null;

  if (Number.isInteger(input.musicTrackId)) {
    const track = await getTrack(input.musicTrackId as number);

    if (track) {
      const length = clamp(
        Math.round(Number(input.musicLength) || 15),
        MIN_CLIP_SECONDS,
        MAX_PREVIEW_SECONDS
      );
      const start = clamp(
        Math.round(Number(input.musicStart) || 0),
        0,
        MAX_PREVIEW_SECONDS - length
      );

      music = {
        music_track_id: track.id,
        music_title: track.title,
        music_artist: track.artist,
        music_preview_url: track.previewUrl,
        music_artwork_url: track.artworkUrl,
        music_start: start,
        music_length: length,
      };
    }
  }

  const { data: post, error } = await supabase
    .from("reels")
    .insert({
      user_id: user.id,
      kind: media[0].kind,
      media_url: media[0].url,
      caption: caption || null,
      ...(music ?? {}),
    })
    .select("id")
    .single();

  if (error || !post) {
    return { ok: false, error: "Could not save your post. Please try again." };
  }

  const { error: mediaError } = await supabase.from("post_media").insert(
    media.map((m, i) => ({
      post_id: post.id,
      sort_order: i,
      kind: m.kind,
      url: m.url,
    }))
  );

  if (mediaError) {
    await supabase.from("reels").delete().eq("id", post.id).eq("user_id", user.id);
    return { ok: false, error: "Could not save your post. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/reels");
  return { ok: true };
}

async function NewPostContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="mx-auto mt-6 max-w-md p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="mb-6 mt-4 text-3xl font-bold">New post</h1>

      <NewReelForm
        userId={user.id}
        searchMusic={searchMusic}
        createPost={createPost}
      />
    </div>
  );
}

export default function NewReelPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <NewPostContent />
    </Suspense>
  );
}