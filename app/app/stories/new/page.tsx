import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewStoryForm } from "@/components/new-story-form";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function createStory(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please log in first." };
  }

  const file = formData.get("image") as File | null;
  const caption = ((formData.get("caption") as string) || "").trim().slice(0, 140);

  if (!file || file.size === 0) {
    return { ok: false, error: "Choose an image for your story." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Your story must be an image file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Your story image must be smaller than 5 MB." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}-story-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file);

  if (uploadError) {
    return { ok: false, error: "Could not upload your story. Please try again." };
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
    <div className="mx-auto max-w-md p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition hover:text-foreground"
      >
        <span>←</span>
        <span>Back to feed</span>
      </Link>

      <div className="my-6">
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Add to your story
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Stories disappear after 24 hours. Express yourself!
        </p>
      </div>

      <NewStoryForm action={createStory} />
    </div>
  );
}

export default function NewStoryPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<div className="p-10 text-center text-foreground/50">Loading...</div>}>
        <NewStoryContent />
      </Suspense>
    </main>
  );
}