import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { BackLink, PageLoading, PageTitle } from "@/components/page-chrome";

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
    <div className="mx-auto max-w-md px-4 pb-10 pt-safe-3">
      <BackLink href="/reels">Reels</BackLink>

      <PageTitle>Saved</PageTitle>

      {items.length === 0 ? (
        <p className="py-16 text-center text-foreground/60">
          Nothing saved yet. Tap the bookmark on a post to keep it here.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((r) => (
            <Link
              key={r.id}
              href={`/p/${r.id}`}
              className="relative aspect-[9/16] overflow-hidden rounded-xl bg-foreground/10 transition active:scale-[0.97]"
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
                  <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
                    <svg
                      viewBox="0 0 24 24"
                      className="ml-px h-2.5 w-2.5"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
                    </svg>
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
    <Suspense fallback={<PageLoading />}>
      <SavedContent />
    </Suspense>
  );
}