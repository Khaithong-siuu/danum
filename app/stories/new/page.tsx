import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function fail(message: string): never {
  redirect(`/stories/new?error=${encodeURIComponent(message)}`);
}

async function createStory(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const file = formData.get("image") as File | null;
  const caption = ((formData.get("caption") as string) || "").trim().slice(0, 140);

  if (!file || file.size === 0) {
    fail("Choose an image for your story.");
  }
  if (!file.type.startsWith("image/")) {
    fail("Your story must be an image file.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    fail("Your story image must be smaller than 5 MB.");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}-story-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file);

  if (uploadError) {
    fail("Could not upload your story. Please try again.");
  }

  const { data } = supabase.storage.from("photos").getPublicUrl(path);

  const { error } = await supabase.from("stories").insert({
    user_id: user.id,
    image_url: data.publicUrl,
    caption: caption || null,
  });

  if (error) {
    fail("Could not save your story. Please try again.");
  }

  revalidatePath("/");
  redirect("/");
}

async function NewStoryContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="max-w-md mx-auto mt-6 p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-2">Add to your story</h1>
      <p className="mb-6 text-sm text-foreground/60">
        Stories disappear 24 hours after you post them.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form action={createStory} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Image</label>
          <input
            type="file"
            name="image"
            accept="image/*"
            required
            className="w-full"
          />
          <p className="mt-1 text-xs text-foreground/50">
            Images only, up to 5 MB. Tall images work best.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Caption (optional)</label>
          <input
            type="text"
            name="caption"
            maxLength={140}
            className="w-full border rounded px-3 py-2 bg-background"
            placeholder="Say something..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-brand text-white py-2 rounded hover:opacity-90 transition"
        >
          Share story
        </button>
      </form>
    </div>
  );
}

export default function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <NewStoryContent searchParams={searchParams} />
    </Suspense>
  );
}