import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStorageImageUrl } from "@/lib/safe-url";
import { timeAgo } from "@/lib/time";
import { AdminUserActions } from "@/components/admin-user-actions";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type SuspensionRow = {
  user_id: string;
  reason: string;
  created_at: string;
  expires_at: string | null;
};

function AccountRow({
  id,
  profile,
  suspension,
  reportCount,
}: {
  id: string;
  profile: Profile | undefined;
  suspension: SuspensionRow | undefined;
  reportCount: number;
}) {
  const username = profile?.username ?? null;
  const avatar = isStorageImageUrl(profile?.avatar_url) ? profile.avatar_url : null;

  return (
    <li className="rounded-2xl border border-foreground/10 p-4">
      <div className="mb-3 flex items-center gap-3">
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

        <div className="min-w-0 flex-1">
          {username ? (
            <Link
              href={`/u/${username}`}
              className="block truncate font-semibold hover:underline"
            >
              {username}
            </Link>
          ) : (
            <p className="truncate font-semibold text-foreground/60">
              Account {id.slice(0, 8)}
            </p>
          )}
          {profile?.full_name && (
            <p className="truncate text-sm text-foreground/60">{profile.full_name}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          {suspension && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-600">
              Suspended
            </span>
          )}
          {reportCount > 0 && (
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium">
              {reportCount} open {reportCount === 1 ? "report" : "reports"}
            </span>
          )}
        </div>
      </div>

      {suspension && (
        <div className="mb-3 rounded-lg bg-foreground/5 p-3 text-sm">
          <p className="break-words">{suspension.reason}</p>
          <p className="mt-1 text-xs text-foreground/50">
            Since {timeAgo(suspension.created_at)} ·{" "}
            {suspension.expires_at
              ? `ends ${new Date(suspension.expires_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : "until lifted"}
          </p>
        </div>
      )}

      <AdminUserActions
        targetId={id}
        username={username ?? "this account"}
        suspended={!!suspension}
      />
    </li>
  );
}

async function UsersContent({
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

  // For everyone who isn't an admin, this page simply doesn't exist
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  // Accounts that are suspended right now
  const { data: suspensionRows } = await supabase
    .from("suspensions")
    .select("user_id, reason, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const nowMs = Date.now();
  const suspensions = new Map<string, SuspensionRow>(
    ((suspensionRows ?? []) as SuspensionRow[])
      .filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > nowMs)
      .map((s) => [s.user_id, s])
  );

  // Accounts with open reports (a report on a post or comment counts against its author)
  const { data: openReports } = await supabase
    .from("reports")
    .select("target_type, target_id")
    .eq("status", "open")
    .limit(500);

  const reports = (openReports ?? []) as { target_type: string; target_id: string }[];

  const postIds = [
    ...new Set(
      reports
        .filter((r) => r.target_type === "post" && /^\d{1,12}$/.test(r.target_id))
        .map((r) => Number(r.target_id))
    ),
  ];
  const commentIds = [
    ...new Set(
      reports
        .filter((r) => r.target_type === "comment" && /^\d{1,12}$/.test(r.target_id))
        .map((r) => Number(r.target_id))
    ),
  ];

  const [postsRes, commentsRes] = await Promise.all([
    postIds.length
      ? supabase.from("reels").select("id, user_id").in("id", postIds)
      : Promise.resolve({ data: [] as { id: number; user_id: string }[] }),
    commentIds.length
      ? supabase.from("reel_comments").select("id, user_id").in("id", commentIds)
      : Promise.resolve({ data: [] as { id: number; user_id: string }[] }),
  ]);

  const postOwner = new Map((postsRes.data ?? []).map((p) => [p.id, p.user_id]));
  const commentOwner = new Map((commentsRes.data ?? []).map((c) => [c.id, c.user_id]));

  const reportCounts = new Map<string, number>();
  const bump = (id: string | undefined) => {
    if (id) reportCounts.set(id, (reportCounts.get(id) ?? 0) + 1);
  };

  for (const r of reports) {
    if (r.target_type === "user" && UUID_REGEX.test(r.target_id)) bump(r.target_id);
    else if (r.target_type === "post") bump(postOwner.get(Number(r.target_id)));
    else if (r.target_type === "comment") bump(commentOwner.get(Number(r.target_id)));
  }

  // Search by username
  let found: Profile[] = [];
  if (term) {
    // Wildcard characters typed by the admin are escaped so they match literally
    const escaped = term.replace(/[\\%_]/g, "\\$&");
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .ilike("username", `%${escaped}%`)
      .limit(20);
    found = (data ?? []) as Profile[];
  }

  // Names and pictures for everyone shown
  const ids = new Set<string>([
    ...suspensions.keys(),
    ...reportCounts.keys(),
    ...found.map((f) => f.id),
  ]);

  const { data: profileRows } = ids.size
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", [...ids])
    : { data: [] as Profile[] };

  const profiles = new Map(((profileRows ?? []) as Profile[]).map((p) => [p.id, p]));

  const suspendedIds = [...suspensions.keys()];
  const reportedIds = [...reportCounts.keys()]
    .filter((id) => !suspensions.has(id))
    .sort((a, b) => (reportCounts.get(b) ?? 0) - (reportCounts.get(a) ?? 0));

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex gap-4 text-sm text-foreground/60">
        <Link href="/" className="hover:text-foreground">
          ← Feed
        </Link>
        <Link href="/admin/reports" className="hover:text-foreground">
          Reports
        </Link>
      </div>

      <h1 className="mb-4 mt-4 text-3xl font-bold">Accounts</h1>

      <form action="/admin/users" method="get" className="mb-8 flex gap-2">
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

      {term && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground/50">
            Results for &ldquo;{term}&rdquo;
          </h2>
          {found.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/60">
              No accounts found.
            </p>
          ) : (
            <ul className="space-y-3">
              {found.map((p) => (
                <AccountRow
                  key={p.id}
                  id={p.id}
                  profile={profiles.get(p.id) ?? p}
                  suspension={suspensions.get(p.id)}
                  reportCount={reportCounts.get(p.id) ?? 0}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground/50">
          Suspended now ({suspendedIds.length})
        </h2>
        {suspendedIds.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/60">
            No suspended accounts.
          </p>
        ) : (
          <ul className="space-y-3">
            {suspendedIds.map((id) => (
              <AccountRow
                key={id}
                id={id}
                profile={profiles.get(id)}
                suspension={suspensions.get(id)}
                reportCount={reportCounts.get(id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground/50">
          Accounts with open reports ({reportedIds.length})
        </h2>
        {reportedIds.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/60">
            No open reports against any account.
          </p>
        ) : (
          <ul className="space-y-3">
            {reportedIds.map((id) => (
              <AccountRow
                key={id}
                id={id}
                profile={profiles.get(id)}
                suspension={undefined}
                reportCount={reportCounts.get(id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}