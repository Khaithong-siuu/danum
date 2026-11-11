import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildThemeCss, isHexColor } from "@/lib/pfp-theme";
import { isStorageImageUrl } from "@/lib/safe-url";
import { imageStyle, normalizeAdjust } from "@/lib/theme-image";
import { FollowButton } from "@/components/follow-button";
import { ProfileActions } from "@/components/profile-actions";
import { ProfileHero } from "@/components/profile-hero";
import { ProfilePosts } from "@/components/profile-posts";
import { SiteLogo } from "@/components/site-logo";
import { getStoryRing } from "@/lib/story-ring";
import { loadFeed } from "@/lib/feed";
import { toggleFollow } from "@/app/actions/follows";
import {
  deletePost,
  getLikers,
  recordView,
  sendToChat,
  toggleLike,
  toggleSave,
} from "@/app/actions/posts";
import {
  addComment,
  deleteComment,
  getComments,
  toggleCommentLike,
} from "@/app/actions/comments";

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

  const storyRing = iBlocked
    ? "none"
    : await getStoryRing(supabase, profile.id, user?.id ?? null);

  // Everything the floating post card needs (likes, comments, share).
  // Signed-out visitors just get links to the post pages.
  const feedData = !iBlocked && posts.length > 0 ? await loadFeed({ authorId: profile.id }) : null;

  const followersHref = `/u/${profile.username}/follows?tab=followers`;
  const followingHref = `/u/${profile.username}/follows?tab=following`;

  return (
    <main
      className={`min-h-app bg-background text-foreground ${
        themed ? "pfp-theme" : ""
      }`}
    >
      {themed && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}

      <nav className="sticky top-0 z-50 border-b glass-bar pt-safe">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <SiteLogo />
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 pb-6 pt-4">
        <div className="mb-8">
          <ProfileHero
            username={profile.username}
            fullName={profile.full_name}
            bio={profile.bio}
            website={profile.website}
            storyRing={storyRing}
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
              <>
                <Link
                  href="/profile/edit"
                  className="flex-1 rounded-xl bg-foreground/[0.07] py-2 text-center text-sm font-semibold transition hover:bg-foreground/[0.12] active:scale-95"
                >
                  Edit profile
                </Link>
                <Link
                  href="/reels/saved"
                  className="flex-1 rounded-xl bg-foreground/[0.07] py-2 text-center text-sm font-semibold transition hover:bg-foreground/[0.12] active:scale-95"
                >
                  Saved
                </Link>
              </>
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

        {!iBlocked && (
          <div className="mb-3 flex justify-center border-b border-foreground/[0.08]">
            <span className="-mb-px flex items-center gap-2 border-b-2 border-brand px-6 pb-2.5 text-[13px] font-semibold text-brand">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
              </svg>
              Posts
            </span>
          </div>
        )}

        {iBlocked ? (
          <p className="py-16 text-center text-foreground/60">
            You&apos;ve blocked this account. Their posts are hidden from you, and
            they can&apos;t message you or follow you. Use the ⋯ menu to unblock.
          </p>
        ) : posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-foreground/55">
            {isOwner ? "Your posts will show up here." : "No posts yet."}
          </p>
        ) : (
          <ProfilePosts
            viewer={
              feedData
                ? {
                    feed: feedData.posts,
                    chatTargets: feedData.chatTargets,
                    userId: feedData.userId,
                    toggleLike,
                    toggleSave,
                    recordView,
                    getLikers,
                    sendToChat,
                    deletePost,
                    getComments,
                    addComment,
                    toggleCommentLike,
                    deleteComment,
                  }
                : null
            }
            posts={posts.map((p) => ({
              id: p.id,
              kind: p.kind,
              media_url: p.media_url,
              caption: p.caption,
              multi: multi.has(p.id),
            }))}
          />
        )}
      </div>
    </main>
  );
}