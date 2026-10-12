import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildThemeCss, isHexColor } from "@/lib/pfp-theme";
import { isStorageImageUrl } from "@/lib/safe-url";
import { fadeGradient, imageStyle, normalizeAdjust } from "@/lib/theme-image";
import { formatCount } from "@/lib/reels";
import { FollowButton } from "@/components/follow-button";
import { ProfileActions } from "@/components/profile-actions";
import { toggleFollow } from "@/app/actions/follows";

export default async function PublicProfilePage({
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

  // Public columns only, never email
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, bio, website, theme_source, theme_color, theme_image_url, theme_image_x, theme_image_y, theme_image_zoom, theme_image_fade"
    )
    .eq("username", name)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = user?.id === profile.id;

  // Blocks: you blocked them, or they blocked you
  let iBlocked = false;
  let blockedMe = false;

  if (user && !isOwner) {
    const { data: mine } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", profile.id)
      .maybeSingle();

    iBlocked = !!mine;

    if (!iBlocked) {
      const { data: pair } = await supabase.rpc("is_blocked_pair", {
        a: user.id,
        b: profile.id,
      });
      blockedMe = pair === true;
    }
  }

  // If they blocked you, their profile doesn't exist as far as you can tell
  if (blockedMe) notFound();

  const [followersRes, followingRes, postsCountRes, postsRes] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("reels")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("reels")
      .select("id, kind, media_url, caption")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  let isFollowing = false;
  if (user && !isOwner && !iBlocked) {
    const { data: row } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    isFollowing = !!row;
  }

  const posts = (postsRes.data ?? []).filter((p) => isStorageImageUrl(p.media_url));
  const postIds = posts.map((p) => p.id);

  // Posts with more than one photo or video get a small badge
  const { data: extraMedia } = postIds.length
    ? await supabase
        .from("post_media")
        .select("post_id")
        .in("post_id", postIds)
        .gt("sort_order", 0)
    : { data: [] as { post_id: number }[] };

  const multi = new Set((extraMedia ?? []).map((m) => m.post_id));

  const avatarUrl = isStorageImageUrl(profile.avatar_url) ? profile.avatar_url : null;

  // The color is re-validated here, so a bad value can never reach the CSS
  const themeCss =
    profile.theme_source !== "none" && isHexColor(profile.theme_color)
      ? buildThemeCss(profile.theme_color, ".pfp-theme")
      : "";
  const themed = themeCss !== "";

  const coverUrl =
    themed &&
    profile.theme_source === "image" &&
    isStorageImageUrl(profile.theme_image_url)
      ? profile.theme_image_url
      : null;

  // Clamped again here, so out-of-range values written to the API are harmless
  const adjust = normalizeAdjust({
    x: profile.theme_image_x,
    y: profile.theme_image_y,
    zoom: profile.theme_image_zoom,
    fade: profile.theme_image_fade,
  });

  const followersHref = `/u/${profile.username}/follows?tab=followers`;
  const followingHref = `/u/${profile.username}/follows?tab=following`;

  return (
    <main
      className={`min-h-screen bg-background text-foreground ${
        themed ? "pfp-theme" : ""
      }`}
    >
      {themed && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}

      <nav className="sticky top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Danum
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 py-8">
        <section className="mb-8">
          {/* Cover image that fades into the page background */}
          {coverUrl && (
            <div className="relative h-44 overflow-hidden rounded-2xl">
              <Image
                src={coverUrl}
                alt=""
                fill
                priority
                className="object-cover"
                style={imageStyle(adjust)}
                sizes="(max-width: 640px) 100vw, 576px"
              />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: fadeGradient(adjust) }}
              />
            </div>
          )}

          <div
            className={`flex items-start gap-5 rounded-2xl p-5 ${
              coverUrl ? "relative -mt-14" : ""
            }`}
            style={
              themed && !coverUrl
                ? {
                    backgroundImage:
                      "linear-gradient(to bottom, hsl(var(--brand) / 0.18), transparent)",
                  }
                : undefined
            }
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${profile.username} avatar`}
                width={88}
                height={88}
                className="h-[88px] w-[88px] shrink-0 rounded-full object-cover"
                style={
                  themed
                    ? {
                        boxShadow:
                          "0 0 0 3px hsl(var(--background)), 0 0 0 6px hsl(var(--brand))",
                      }
                    : undefined
                }
              />
            ) : (
              <div className="h-[88px] w-[88px] shrink-0 rounded-full bg-foreground/10" />
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{profile.username}</h1>
              {profile.full_name && (
                <p className="text-sm text-foreground/70">{profile.full_name}</p>
              )}

              <div className="mt-2 flex gap-5 text-sm">
                <span>
                  <strong>{formatCount(postsCountRes.count ?? 0)}</strong>{" "}
                  <span className="text-foreground/60">posts</span>
                </span>
                <Link href={followersHref} className="hover:underline">
                  <strong>{formatCount(followersRes.count ?? 0)}</strong>{" "}
                  <span className="text-foreground/60">followers</span>
                </Link>
                <Link href={followingHref} className="hover:underline">
                  <strong>{formatCount(followingRes.count ?? 0)}</strong>{" "}
                  <span className="text-foreground/60">following</span>
                </Link>
              </div>

              {profile.bio && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1 block truncate text-sm text-brand hover:underline"
                >
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}

              <div className="mt-3 flex items-center gap-2">
                {isOwner ? (
                  <Link
                    href="/profile"
                    className="inline-block rounded-lg border border-foreground/20 px-3 py-1 text-sm font-medium hover:bg-foreground/5"
                  >
                    Edit profile
                  </Link>
                ) : user ? (
                  <>
                    {!iBlocked && (
                      <FollowButton
                        targetId={profile.id}
                        initialFollowing={isFollowing}
                        toggleFollow={toggleFollow}
                      />
                    )}
                    <ProfileActions
                      targetId={profile.id}
                      username={profile.username}
                      initiallyBlocked={iBlocked}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {iBlocked ? (
          <p className="py-16 text-center text-foreground/60">
            You&apos;ve blocked this account. Their posts are hidden from you, and
            they can&apos;t message you or follow you. Use the ⋯ menu to unblock.
          </p>
        ) : posts.length === 0 ? (
          <p className="py-16 text-center text-foreground/60">No posts yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/p/${post.id}`}
                className="relative aspect-square overflow-hidden bg-foreground/5"
              >
                {post.kind === "video" ? (
                  <video
                    src={`${post.media_url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={post.media_url}
                    alt={post.caption || "Post"}
                    fill
                    className="object-cover transition hover:opacity-90"
                    sizes="(max-width: 640px) 33vw, 192px"
                  />
                )}

                {(post.kind === "video" || multi.has(post.id)) && (
                  <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {multi.has(post.id) ? "⧉" : "▶"}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}