import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { FollowButton } from "@/components/follow-button";
import { toggleFollow } from "@/app/actions/follows";

async function FollowsContent({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  const active = tab === "following" ? "following" : "followers";

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
    .select("id, username")
    .eq("username", name)
    .maybeSingle();

  if (!profile) notFound();

  const { data: rows } =
    active === "followers"
      ? await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(200);

  const ids = (rows ?? []).map((r) =>
    active === "followers"
      ? ((r as { follower_id: string }).follower_id as string)
      : ((r as { following_id: string }).following_id as string)
  );

  const [profilesRes, mineRes] = ids.length
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const iFollow = new Set(
    ((mineRes.data ?? []) as { following_id: string }[]).map((f) => f.following_id)
  );

  const people = ids.flatMap((id) => {
    const p = (
      (profilesRes.data ?? []) as {
        id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
      }[]
    ).find((x) => x.id === id);
    return p?.username ? [p] : [];
  });

  const base = `/u/${profile.username}/follows`;

  return (
    <div className="mx-auto mt-6 max-w-md p-6">
      <Link
        href={`/u/${profile.username}`}
        className="text-sm text-foreground/60 hover:text-foreground"
      >
        ← {profile.username}
      </Link>

      <div className="mb-4 mt-4 grid grid-cols-2 rounded-xl bg-foreground/10 p-1 text-center text-sm font-medium">
        <Link
          href={`${base}?tab=followers`}
          className={`rounded-lg py-2 ${
            active === "followers" ? "bg-background shadow-sm" : "text-foreground/60"
          }`}
        >
          Followers
        </Link>
        <Link
          href={`${base}?tab=following`}
          className={`rounded-lg py-2 ${
            active === "following" ? "bg-background shadow-sm" : "text-foreground/60"
          }`}
        >
          Following
        </Link>
      </div>

      {people.length === 0 ? (
        <p className="py-16 text-center text-foreground/60">
          {active === "followers" ? "No followers yet." : "Not following anyone yet."}
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

                {p.id !== user.id && (
                  <FollowButton
                    targetId={p.id}
                    initialFollowing={iFollow.has(p.id)}
                    toggleFollow={toggleFollow}
                    compact
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function FollowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <FollowsContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}