import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NewStoryForm } from "@/components/new-story-form";
import { BackLink, PageLoading, PageTitle } from "@/components/page-chrome";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The photo is already in storage (uploaded from the phone); this saves the story. */
async function createStory(input: {
  path: string;
  caption: string;
}): Promise<{ ok: boolean; error?: string }> {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please log in first." };
  }

  const path = String(input?.path ?? "");
  const caption = String(input?.caption ?? "").trim().slice(0, 140);

  // Only accept a file this user just uploaded for a story
  if (
    !UUID_REGEX.test(user.id) ||
    !new RegExp(`^${user.id}-story-\\d{10,16}\\.(jpg|jpeg|png|webp)$`, "i").test(path)
  ) {
    return { ok: false, error: "Upload isn't valid." };
  }

  const { data } = supabase.storage.from("photos").getPublicUrl(path);

  const { error } = await supabase.from("stories").insert({
    user_id: user.id,
    image_url: data.publicUrl,
    caption: caption || null,
  });

  if (error) {
    return { ok: false, error: "Could not save your story. Please try again." };
  }

  revalidatePath("/");
  return { ok: true };
}

async function NewStoryContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-safe-3">
      <BackLink href="/">Feed</BackLink>

      <PageTitle subtitle="Stories disappear after 24 hours.">
        Add to your story
      </PageTitle>

      <NewStoryForm userId={user.id} action={createStory} />
    </div>
  );
}

export default function NewStoryPage() {
  return (
    <main className="min-h-app bg-background">
      <Suspense fallback={<PageLoading />}>
        <NewStoryContent />
      </Suspense>
    </main>
  );
}