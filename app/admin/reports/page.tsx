import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { timeAgo } from "@/lib/time";
import { REPORT_REASONS } from "@/lib/safety";
import { AdminReportActions } from "@/components/admin-report-actions";

type ReportRow = {
  id: number;
  reporter_id: string;
  target_type: "post" | "comment" | "user";
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

type Group = {
  key: string;
  type: "post" | "comment" | "user";
  id: string;
  reports: ReportRow[];
};

type Profile = { id: string; username: string | null; avatar_url: string | null };

const REASON_LABELS = new Map<string, string>(
  REPORT_REASONS.map((r) => [r.key, r.label])
);

async function ReportsContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const done = tab === "done";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // For everyone who isn't an admin, this page simply doesn't exist
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const { data: rows } = await supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
    .in("status", done ? ["reviewed", "dismissed"] : ["open"])
    .order("created_at", { ascending: false })
    .limit(300);

  const reports = (rows ?? []) as ReportRow[];

  // One card per reported thing, newest report first
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();

  for (const r of reports) {
    const key = `${r.target_type}:${r.target_id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, type: r.target_type, id: r.target_id, reports: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.reports.push(r);
  }

  const postIds = groups
    .filter((g) => g.type === "post" && /^\d{1,12}$/.test(g.id))
    .map((g) => Number(g.id));
  const commentIds = groups
    .filter((g) => g.type === "comment" && /^\d{1,12}$/.test(g.id))
    .map((g) => Number(g.id));

  const [postsRes, commentsRes] = await Promise.all([
    postIds.length
      ? supabase
          .from("reels")
          .select("id, user_id, kind, media_url, caption")
          .in("id", postIds)
      : Promise.resolve({ data: [] as { id: number; user_id: string; kind: string; media_url: string; caption: string | null }[] }),
    commentIds.length
      ? supabase
          .from("reel_comments")
          .select("id, reel_id, user_id, content, image_url")
          .in("id", commentIds)
      : Promise.resolve({ data: [] as { id: number; reel_id: number; user_id: string; content: string; image_url: string | null }[] }),
  ]);

  const posts = new Map((postsRes.data ?? []).map((p) => [p.id, p]));
  const comments = new Map((commentsRes.data ?? []).map((c) => [c.id, c]));

  // Names for reporters, authors and reported accounts
  const profileIds = new Set<string>();
  reports.forEach((r) => profileIds.add(r.reporter_id));
  (postsRes.data ?? []).forEach((p) => profileIds.add(p.user_id));
  (commentsRes.data ?? []).forEach((c) => profileIds.add(c.user_id));
  groups
    .filter((g) => g.type === "user")
    .forEach((g) => profileIds.add(g.id));

  const { data: profileRows } = profileIds.size
    ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", [...profileIds].filter((id) => /^[0-9a-f-]{36}$/i.test(id)))
    : { data: [] as Profile[] };

  const profiles = new Map(((profileRows ?? []) as Profile[]).map((p) => [p.id, p]));
  const nameOf = (id: string) => profiles.get(id)?.username ?? "unknown";

  const tabClass = (active: boolean) =>
    `rounded-lg py-2 ${active ? "bg-background shadow-sm" : "text-foreground/60"}`;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="mb-4 mt-4 text-3xl font-bold">Reports</h1>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-foreground/10 p-1 text-center text-sm font-medium">
        <Link href="/admin/reports" className={tabClass(!done)}>
          Open
        </Link>
        <Link href="/admin/reports?tab=done" className={tabClass(done)}>
          Resolved
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-foreground/60">
          {done ? "Nothing resolved yet." : "No open reports. 🎉"}
        </p>
      ) : (
        <ul className="space-y-4">
          {groups.map((g) => {
            const post = g.type === "post" ? posts.get(Number(g.id)) : undefined;
            const comment =
              g.type === "comment" ? comments.get(Number(g.id)) : undefined;
            const reportedUser = g.type === "user" ? profiles.get(g.id) : undefined;

            // How many times each reason was given
            const reasonCounts = new Map<string, number>();
            g.reports.forEach((r) =>
              reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + 1)
            );

            const missing =
              (g.type === "post" && !post) ||
              (g.type === "comment" && !comment) ||
              (g.type === "user" && !reportedUser);

            return (
              <li
                key={g.key}
                className="rounded-2xl border border-foreground/10 p-4"
              >
                <div className="mb-3 flex items-center justify-between text-xs text-foreground/60">
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium uppercase tracking-wide">
                    {g.type}
                  </span>
                  <span>
                    {g.reports.length} {g.reports.length === 1 ? "report" : "reports"} ·{" "}
                    {timeAgo(g.reports[0].created_at)}
                  </span>
                </div>

                {/* What was reported */}
                {missing ? (
                  <p className="mb-3 text-sm text-foreground/60">
                    This {g.type} no longer exists, or you can&apos;t see it.
                  </p>
                ) : g.type === "post" && post ? (
                  <div className="mb-3 flex gap-3">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-foreground/10">
                      {isStorageImageUrl(post.media_url) &&
                        (post.kind === "video" ? (
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
                            sizes="96px"
                          />
                        ))}
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">by {nameOf(post.user_id)}</p>
                      {post.caption && (
                        <p className="line-clamp-3 break-words text-foreground/80">
                          {post.caption}
                        </p>
                      )}
                      <Link
                        href={`/p/${g.id}`}
                        className="mt-1 inline-block text-brand hover:underline"
                      >
                        Open post →
                      </Link>
                    </div>
                  </div>
                ) : g.type === "comment" && comment ? (
                  <div className="mb-3 text-sm">
                    <p className="font-semibold">by {nameOf(comment.user_id)}</p>
                    {comment.content && (
                      <p className="whitespace-pre-wrap break-words text-foreground/80">
                        {comment.content}
                      </p>
                    )}
                    {isStorageImageUrl(comment.image_url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={comment.image_url}
                        alt="Comment attachment"
                        className="mt-2 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    <Link
                      href={`/p/${comment.reel_id}`}
                      className="mt-1 inline-block text-brand hover:underline"
                    >
                      Open the post →
                    </Link>
                  </div>
                ) : reportedUser ? (
                  <div className="mb-3 flex items-center gap-3 text-sm">
                    {isStorageImageUrl(reportedUser.avatar_url) ? (
                      <Image
                        src={reportedUser.avatar_url}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-foreground/10" />
                    )}
                    <div>
                      <p className="font-semibold">{reportedUser.username}</p>
                      <Link
                        href={`/u/${reportedUser.username}`}
                        className="text-brand hover:underline"
                      >
                        Open profile →
                      </Link>
                    </div>
                  </div>
                ) : null}

                {/* Why */}
                <div className="mb-3 space-y-1 text-sm">
                  <p className="font-medium">
                    {[...reasonCounts.entries()]
                      .map(
                        ([reason, n]) =>
                          `${REASON_LABELS.get(reason) ?? reason}${n > 1 ? ` ×${n}` : ""}`
                      )
                      .join(" · ")}
                  </p>
                  {g.reports
                    .filter((r) => r.details)
                    .slice(0, 3)
                    .map((r) => (
                      <p key={r.id} className="text-foreground/70">
                        <span className="text-foreground/50">
                          {nameOf(r.reporter_id)}:
                        </span>{" "}
                        {r.details}
                      </p>
                    ))}
                </div>

                {done ? (
                  <p className="text-xs text-foreground/50">
                    Status: {g.reports[0].status}
                  </p>
                ) : (
                  <AdminReportActions
                    targetType={g.type}
                    targetId={g.id}
                    canRemove={g.type !== "user" && !missing}
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

export default function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}