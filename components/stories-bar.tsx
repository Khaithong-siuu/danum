import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";

type RingState = "unseen" | "seen" | "none";

function Ring({
  state,
  children,
}: {
  state: RingState;
  children: React.ReactNode;
}) {
  const bg =
    state === "unseen"
      ? "bg-brand"
      : state === "seen"
        ? "bg-foreground/25"
        : "bg-transparent";

  return (
    <div className={`rounded-full p-[3px] ${bg}`}>
      <div className="rounded-full bg-background p-[2px]">{children}</div>
    </div>
  );
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  return url ? (
    <Image
      src={url}
      alt={alt}
      width={56}
      height={56}
      className="h-14 w-14 rounded-full object-cover"
    />
  ) : (
    <div className="h-14 w-14 rounded-full bg-foreground/10" />
  );
}

export async function StoriesBar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Stories are for signed-in users
  if (!user) return null;

  // Only you and the people you follow
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const allowed = [user.id, ...(follows ?? []).map((f) => f.following_id as string)];

  const { data: stories } = await supabase
    .from("stories")
    .select("id, user_id, created_at")
    .in("user_id", allowed)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const list = stories ?? [];
  const storyIds = list.map((s) => s.id);

  const { data: views } = storyIds.length
    ? await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", user.id)
        .in("story_id", storyIds)
    : { data: [] as { story_id: number }[] };

  const seen = new Set((views ?? []).map((v) => v.story_id));

  // Group active stories by author
  const byUser = new Map<string, { latest: string; allSeen: boolean }>();
  for (const s of list) {
    const group = byUser.get(s.user_id) ?? { latest: s.created_at, allSeen: true };
    if (!seen.has(s.id)) group.allSeen = false;
    if (s.created_at > group.latest) group.latest = s.created_at;
    byUser.set(s.user_id, group);
  }

  const userIds = [...new Set([user.id, ...byUser.keys()])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", userIds);

  const own = profiles?.find((p) => p.id === user.id) ?? null;
  const ownGroup = byUser.get(user.id);
  const ownAvatar = own && isStorageImageUrl(own.avatar_url) ? own.avatar_url : null;

  // Everyone else: unseen first, then most recent
  const others = [...byUser.entries()]
    .filter(([id]) => id !== user.id)
    .map(([id, group]) => ({
      id,
      group,
      profile: profiles?.find((p) => p.id === id) ?? null,
    }))
    .filter((x) => !!x.profile?.username)
    .sort(
      (a, b) =>
        Number(a.group.allSeen) - Number(b.group.allSeen) ||
        (a.group.latest < b.group.latest ? 1 : -1)
    );

  const ownHref =
    ownGroup && own?.username ? `/stories/${own.username}` : "/stories/new";

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {/* Your story */}
      <div className="relative w-16 shrink-0 text-center">
        <Link href={ownHref} className="block">
          <Ring state={ownGroup ? (ownGroup.allSeen ? "seen" : "unseen") : "none"}>
            <Avatar url={ownAvatar} alt="Your story" />
          </Ring>
          <p className="mt-1 truncate text-xs">Your story</p>
        </Link>
        <Link
          href="/stories/new"
          aria-label="Add to your story"
          className="absolute right-0 top-11 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white ring-2 ring-background"
        >
          +
        </Link>
      </div>

      {/* Stories from people you follow */}
      {others.map(({ id, group, profile }) => {
        const avatar = isStorageImageUrl(profile?.avatar_url)
          ? profile.avatar_url
          : null;

        return (
          <Link
            key={id}
            href={`/stories/${profile?.username}`}
            className="block w-16 shrink-0 text-center"
          >
            <Ring state={group.allSeen ? "seen" : "unseen"}>
              <Avatar url={avatar} alt={`${profile?.username} story`} />
            </Ring>
            <p className="mt-1 truncate text-xs">{profile?.username}</p>
          </Link>
        );
      })}
    </div>
  );
}