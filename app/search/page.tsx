import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { FollowButton } from "@/components/follow-button";
import { toggleFollow } from "@/app/actions/follows";

async function SearchContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().replace(/^@/, "").slice(0, 30);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let query = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .not("username", "is", null)
    .neq("id", user.id);

  if (term) {
    // Wildcard characters typed by the user are escaped so they match literally
    const escaped = term.replace(/[\\%_]/g, "\\$&");
    query = query.ilike("username", `%${escaped}%`).limit(30);
  } else {
    query = query.order("updated_at", { ascending: false }).limit(20);
  }

  const { data: found } = await query;

  const people = (found ?? []) as {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  }[];

  const { data: mine } = people.length
    ? await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in(
          "following_id",
          people.map((p) => p.id)
        )
    : { data: [] as { following_id: string }[] };

  const iFollow = new Set((mine ?? []).map((f) => f.following_id as string));

  return (
    <div className="mx-auto mt-6 max-w-md p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="mb-4 mt-4 text-3xl font-bold">Find people</h1>

      <form action="/search" method="get" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={term}
          maxLength={30}
          placeholder="Search by username"
          className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">
        {term ? "Results" : "People on Danum"}
      </p>

      {people.length === 0 ? (
        <p className="py-12 text-center text-foreground/60">
          {term ? "No one found with that username." : "No one else is here yet."}
        </p>
      ) : (
        <ul className="divide-y divide-foreground/10">
          {people.map((p) => {
            const avatar = isStorageImageUrl(p.avatar_url) ? p.avatar_url : null;

            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <Link
                  href={`/u/${p.username}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-full bg-foreground/10" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.username}</span>
                    {p.full_name && (
                      <span className="block truncate text-sm text-foreground/60">
                        {p.full_name}
                      </span>
                    )}
                  </span>
                </Link>

                <FollowButton
                  targetId={p.id}
                  initialFollowing={iFollow.has(p.id)}
                  toggleFollow={toggleFollow}
                  compact
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}