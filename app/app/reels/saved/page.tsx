import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";

async function SavedContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: saves } = await supabase
    .from("reel_saves")
    .select("reel_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const ids = (saves ?? []).map((s) => s.reel_id);

  const { data: reels } = ids.length
    ? await supabase.from("reels").select("id, kind, media_url").in("id", ids)
    : { data: [] as { id: number; kind: string; media_url: string }[] };

  // Keep the order you saved them in
  const items = ids.flatMap((id) => {
    const r = reels?.find((x) => x.id === id);
    return r && isStorageImageUrl(r.media_url) ? [r] : [];
  });

  return (
    <div className="mx-auto mt-6 max-w-md p-6">
      <Link
        href="/reels"
        className="text-sm text-foreground/60 hover:text-foreground"
      >
        ← Back to reels
      </Link>

      <h1 className="mb-6 mt-4 text-3xl font-bold">Saved</h1>

      {items.length === 0 ? (
        <p className="py-16 text-center text-foreground/60">
          Nothing saved yet. Tap the bookmark on a post to keep it here.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {items.map((r) => (
            <Link
              key={r.id}
              href={`/p/${r.id}`}
              className="relative aspect-[9/16] overflow-hidden bg-foreground/10"
            >
              {r.kind === "photo" ? (
                <Image
                  src={r.media_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 160px"
                />
              ) : (
                <>
                  <video
                    src={`${r.media_url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    ▶
                  </span>
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SavedContent />
    </Suspense>
  );
}