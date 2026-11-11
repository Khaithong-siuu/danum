import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { timeAgo } from "@/lib/time";
import { BackLink, PageTitle } from "@/components/page-chrome";
import { FollowButton } from "@/components/follow-button";
import { MarkNotificationsRead } from "@/components/mark-notifications-read";
import { toggleFollow } from "@/app/actions/follows";
import { markNotificationsRead } from "@/app/actions/notifications";

type NotificationType = "like" | "comment" | "reply" | "comment_like" | "follow";

type Row = {
  id: number;
  actor_id: string;
  type: NotificationType;
  post_id: number | null;
  comment_id: number | null;
  created_at: string;
  read_at: string | null;
};

type Actor = { id: string; username: string; avatarUrl: string | null };

type LikesItem = {
  kind: "likes";
  key: string;
  postId: number;
  actors: Actor[];
  createdAt: string;
  unread: boolean;
};

type SingleItem = {
  kind: "single";
  key: string;
  row: Row;
  actor: Actor;
  unread: boolean;
};

type Item = LikesItem | SingleItem;

type PostPreview = { id: number; kind: string; media_url: string };
type CommentPreview = { id: number; content: string; image_url: string | null };

function likesWho(actors: Actor[]): string {
  const [a, b] = actors;
  if (actors.length === 1) return a.username;
  if (actors.length === 2) return `${a.username} and ${b.username}`;
  return `${a.username}, ${b.username} and ${actors.length - 2} others`;
}

function snippet(c: CommentPreview | undefined): string {
  if (!c) return "";
  const text = c.content.trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return c.image_url ? "Photo" : "";
}

function Avatar({ url }: { url: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
    />
  ) : (
    <div className="h-11 w-11 shrink-0 rounded-full bg-foreground/10" />
  );
}

function Thumb({ post }: { post: PostPreview | undefined }) {
  if (!post || !isStorageImageUrl(post.media_url)) return null;

  return (
    <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-foreground/10">
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
          alt=""
          fill
          className="object-cover"
          sizes="44px"
        />
      )}
    </span>
  );
}

async function NotificationsContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: rowsData } = await supabase
    .from("notifications")
    .select("id, actor_id, type, post_id, comment_id, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (rowsData ?? []) as Row[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const postIds = [
    ...new Set(rows.map((r) => r.post_id).filter((x): x is number => x !== null)),
  ];
  const commentIds = [
    ...new Set(rows.map((r) => r.comment_id).filter((x): x is number => x !== null)),
  ];

  const [profilesRes, postsRes, commentsRes, followingRes] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, username, avatar_url").in("id", actorIds)
      : Promise.resolve({
          data: [] as { id: string; username: string | null; avatar_url: string | null }[],
        }),
    postIds.length
      ? supabase.from("reels").select("id, kind, media_url").in("id", postIds)
      : Promise.resolve({ data: [] as PostPreview[] }),
    commentIds.length
      ? supabase
          .from("reel_comments")
          .select("id, content, image_url")
          .in("id", commentIds)
      : Promise.resolve({ data: [] as CommentPreview[] }),
    actorIds.length
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", actorIds)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
  ]);

  // Suspended or removed accounts have no readable profile, so they are skipped
  const actors = new Map<string, Actor>();
  for (const p of profilesRes.data ?? []) {
    if (p.username) {
      actors.set(p.id, {
        id: p.id,
        username: p.username,
        avatarUrl: isStorageImageUrl(p.avatar_url) ? p.avatar_url : null,
      });
    }
  }

  const posts = new Map<number, PostPreview>(
    ((postsRes.data ?? []) as PostPreview[]).map((p) => [p.id, p])
  );
  const comments = new Map<number, CommentPreview>(
    ((commentsRes.data ?? []) as CommentPreview[]).map((c) => [c.id, c])
  );
  const iFollow = new Set(
    ((followingRes.data ?? []) as { following_id: string }[]).map((f) => f.following_id)
  );

  // Likes on the same post are grouped into one line
  const items: Item[] = [];
  const likeGroups = new Map<number, LikesItem>();

  for (const row of rows) {
    const actor = actors.get(row.actor_id);
    if (!actor) continue;

    // The post was deleted, or you can no longer see it
    if (row.post_id !== null && !posts.has(row.post_id)) continue;

    const unread = row.read_at === null;

    if (row.type === "like" && row.post_id !== null) {
      const group = likeGroups.get(row.post_id);

      if (group) {
        group.actors.push(actor);
        if (unread) group.unread = true;
      } else {
        const created: LikesItem = {
          kind: "likes",
          key: `likes-${row.post_id}`,
          postId: row.post_id,
          actors: [actor],
          createdAt: row.created_at,
          unread,
        };
        likeGroups.set(row.post_id, created);
        items.push(created);
      }
      continue;
    }

    items.push({ kind: "single", key: `n-${row.id}`, row, actor, unread });
  }

  const fresh = items.filter((i) => i.unread);
  const earlier = items.filter((i) => !i.unread);

  function renderItem(item: Item) {
    let href: string;
    let who: string;
    let what: string;
    let post: PostPreview | undefined;
    let avatarUrl: string | null;
    let time: string;
    let followTarget: Actor | null = null;

    if (item.kind === "likes") {
      href = `/p/${item.postId}`;
      who = likesWho(item.actors);
      what = "liked your post.";
      post = posts.get(item.postId);
      avatarUrl = item.actors[0].avatarUrl;
      time = item.createdAt;
    } else {
      const { row, actor } = item;
      const text = snippet(row.comment_id !== null ? comments.get(row.comment_id) : undefined);

      who = actor.username;
      avatarUrl = actor.avatarUrl;
      time = row.created_at;
      post = row.post_id !== null ? posts.get(row.post_id) : undefined;
      href = row.post_id !== null ? `/p/${row.post_id}` : `/u/${actor.username}`;

      if (row.type === "comment") what = text ? `commented: ${text}` : "commented on your post.";
      else if (row.type === "reply") what = text ? `replied: ${text}` : "replied to your comment.";
      else if (row.type === "comment_like")
        what = text ? `liked your comment: ${text}` : "liked your comment.";
      else {
        what = "started following you.";
        followTarget = actor;
      }
    }

    return (
      <li
        key={item.key}
        className={`glass-card flex items-center gap-3 rounded-[22px] p-3 transition-all duration-200 active:scale-[0.99] ${
          item.unread ? "ring-1 ring-brand/30" : ""
        }`}
      >
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar url={avatarUrl} />
          <p className="min-w-0 flex-1 break-words text-[15px] leading-snug">
            <span className="font-semibold">{who}</span> {what}{" "}
            <span className="whitespace-nowrap text-foreground/45">{timeAgo(time)}</span>
            {item.unread && (
              <span
                className="ml-1.5 inline-block h-2 w-2 rounded-full bg-brand align-middle"
                aria-label="New"
              />
            )}
          </p>
          {!followTarget && <Thumb post={post} />}
        </Link>

        {followTarget && (
          <FollowButton
            targetId={followTarget.id}
            initialFollowing={iFollow.has(followTarget.id)}
            toggleFollow={toggleFollow}
            compact
          />
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-safe-3">
      <BackLink href="/">Feed</BackLink>

      <PageTitle>Activity</PageTitle>

      {rows.some((r) => r.read_at === null) && (
        <MarkNotificationsRead markRead={markNotificationsRead} />
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center text-foreground/60">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/50">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
              <path d="M10 19a2 2 0 0 0 4 0" />
            </svg>
          </div>
          <p className="mb-1 text-lg font-semibold text-foreground">No activity yet</p>
          <p className="max-w-xs text-sm">
            Likes, comments, replies and new followers will show up here.
          </p>
        </div>
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="mb-7">
              <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wider text-foreground/45">
                New
              </h2>
              <ul className="space-y-2">{fresh.map(renderItem)}</ul>
            </section>
          )}

          {earlier.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wider text-foreground/45">
                Earlier
              </h2>
              <ul className="space-y-2">{earlier.map(renderItem)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <main className="min-h-app bg-background">
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <NotificationsContent />
      </Suspense>
    </main>
  );
}