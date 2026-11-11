import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildThemeCss, isHexColor } from "@/lib/pfp-theme";
import { isStorageImageUrl } from "@/lib/safe-url";
import { imageStyle, normalizeAdjust } from "@/lib/theme-image";
import { FollowButton } from "@/components/follow-button";
import { ProfileActions } from "@/components/profile-actions";
import { ProfileHero } from "@/components/profile-hero";
import { SiteLogo } from "@/components/site-logo";
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

      <nav className="sticky top-0 z-50 border-b glass-bar">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <SiteLogo />
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-8">
          <ProfileHero
            username={profile.username}
            fullName={profile.full_name}
            bio={profile.bio}
            website={profile.website}
            avatarUrl={avatarUrl}
            coverUrl={coverUrl}
            coverStyle={imageStyle(adjust)}
            stats={[
              { label: "Posts", value: postsCountRes.count ?? 0 },
              {
                label: "Followers",
                value: followersRes.count ?? 0,
                href: followersHref,
              },
              {
                label: "Following",
                value: followingRes.count ?? 0,
                href: followingHref,
              },
            ]}
          >
            {isOwner ? (
              <Link
                href="/profile"
                className="rounded-full bg-foreground/[0.07] px-5 py-2 text-sm font-semibold transition hover:bg-foreground/[0.12] active:scale-95"
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
          </ProfileHero>
        </div>

        {iBlocked ? (
          <p className="py-16 text-center text-foreground/60">
            You&apos;ve blocked this account. Their posts are hidden from you, and
            they can&apos;t message you or follow you. Use the ⋯ menu to unblock.
          </p>
        ) : posts.length === 0 ? (
          <p className="py-16 text-center text-foreground/60">No posts yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/p/${post.id}`}
                className="relative aspect-square overflow-hidden rounded-xl bg-foreground/5 transition active:scale-[0.97]"
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
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
                    {multi.has(post.id) ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m12 2 10 5-10 5L2 7l10-5Z" />
                        <path d="m2 17 10 5 10-5" />
                        <path d="m2 12 10 5 10-5" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="ml-px h-2.5 w-2.5"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
                      </svg>
                    )}
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