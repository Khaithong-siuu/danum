import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { StoryViewer, type StoryItem } from "@/components/story-viewer";

async function markViewed(storyId: number) {
  "use server";

  if (!Number.isInteger(storyId)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, viewer_id: user.id },
      { onConflict: "story_id,viewer_id", ignoreDuplicates: true }
    );
}

async function deleteStory(storyId: number) {
  "use server";

  if (!Number.isInteger(storyId)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: story } = await supabase
    .from("stories")
    .select("image_url")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!story) return;

  await supabase.from("stories").delete().eq("id", storyId).eq("user_id", user.id);

  // Best effort: remove the file too, but only if it is one of this user's story files
  const marker = "/storage/v1/object/public/photos/";
  const i = story.image_url.indexOf(marker);
  if (i !== -1) {
    try {
      const path = decodeURIComponent(story.image_url.slice(i + marker.length));
      if (path.startsWith(`${user.id}-story-`)) {
        await supabase.storage.from("photos").remove([path]);
      }
    } catch {
      // ignore: the story row is already gone
    }
  }

  revalidatePath("/");
}

async function StoryContent({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let name = username;
  try {
    name = decodeURIComponent(username);
  } catch {
    // keep the raw value if it isn't valid URL encoding
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", name)
    .maybeSingle();

  if (!profile) notFound();

  const { data: rows } = await supabase
    .from("stories")
    .select("id, image_url, caption, created_at")
    .eq("user_id", profile.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  // Only images from our own storage are ever rendered
  const stories: StoryItem[] = (rows ?? [])
    .filter((r) => isStorageImageUrl(r.image_url))
    .map((r) => ({
      id: r.id,
      imageUrl: r.image_url,
      caption: r.caption,
      createdAt: r.created_at,
    }));

  if (stories.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">No active stories</p>
        <p className="text-sm text-foreground/60">
          {profile.username} hasn&apos;t posted a story in the last 24 hours.
        </p>
        <Link href="/" className="text-brand hover:underline">
          Back to feed
        </Link>
      </div>
    );
  }

  // Start at the first story this viewer hasn't seen yet
  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", user.id)
    .in(
      "story_id",
      stories.map((s) => s.id)
    );

  const seen = new Set((views ?? []).map((v) => v.story_id));
  const firstUnseen = stories.findIndex((s) => !seen.has(s.id));
  const startIndex = firstUnseen === -1 ? 0 : firstUnseen;

  const avatarUrl = isStorageImageUrl(profile.avatar_url) ? profile.avatar_url : null;

  return (
    <StoryViewer
      initialStories={stories}
      startIndex={startIndex}
      author={{ username: profile.username, avatarUrl }}
      isOwner={user.id === profile.id}
      markViewed={markViewed}
      deleteStory={deleteStory}
    />
  );
}

export default function StoryPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <StoryContent params={params} />
    </Suspense>
  );
}