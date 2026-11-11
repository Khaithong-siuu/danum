import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmojiText } from "@/components/emoji-text";
import { formatCount } from "@/lib/reels";

type Stat = { label: string; value: number; href?: string };

function StatCell({ stat }: { stat: Stat }) {
  const inner = (
    <>
      <p className="text-lg font-bold tabular-nums leading-tight">
        {formatCount(stat.value)}
      </p>
      <p className="text-xs text-foreground/50">{stat.label}</p>
    </>
  );

  return stat.href ? (
    <Link
      href={stat.href}
      className="block rounded-xl transition active:bg-foreground/[0.06]"
    >
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

/**
 * Header card shared by your own profile and public profiles: cover,
 * avatar with a gradient ring, name, bio, stats and action buttons.
 */
export function ProfileHero({
  username,
  fullName,
  bio,
  website,
  avatarUrl,
  coverUrl,
  coverStyle,
  stats,
  titleAs = "h1",
  children,
}: {
  username: string;
  fullName?: string | null;
  bio?: string | null;
  website?: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverStyle?: CSSProperties;
  stats: Stat[];
  titleAs?: "h1" | "h2";
  children?: ReactNode;
}) {
  const Title = titleAs;

  return (
    <section className="glass-card overflow-hidden rounded-[32px]">
      {/* Cover: the picture they chose, or a soft color wash. It always
          melts into the card so nothing ends in a hard edge. */}
      <div className="relative h-40 overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            className="object-cover"
            style={coverStyle}
            sizes="(max-width: 640px) 100vw, 576px"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(110% 120% at 15% 0%, hsl(var(--brand) / 0.55), transparent 60%), radial-gradient(90% 100% at 95% 10%, hsl(285 85% 62% / 0.4), transparent 55%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/30 to-card" />
      </div>

      {/* relative + z-10 keeps the avatar above the cover */}
      <div className="relative z-10 -mt-14 px-5 pb-5 text-center">
        <div className="mx-auto w-fit rounded-full bg-gradient-to-tr from-brand to-fuchsia-500 p-[3px] shadow-lg shadow-brand/25">
          <div className="rounded-full bg-card p-[3px]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${username} avatar`}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-foreground/10" />
            )}
          </div>
        </div>

        <Title className="mt-3 text-2xl font-bold tracking-tight">{username}</Title>
        {fullName && <p className="text-sm text-foreground/60">{fullName}</p>}

        {bio && (
          <p className="mx-auto mt-2 max-w-xs whitespace-pre-wrap text-sm leading-snug text-foreground/80">
            <EmojiText text={bio} />
          </p>
        )}

        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mx-auto mt-1 block max-w-xs truncate text-sm font-medium text-brand hover:underline"
          >
            {website.replace(/^https?:\/\//, "")}
          </a>
        )}

        <div className="mt-5 grid grid-cols-3 divide-x divide-foreground/[0.08] rounded-2xl bg-foreground/[0.04] py-2.5">
          {stats.map((s) => (
            <StatCell key={s.label} stat={s} />
          ))}
        </div>

        {children && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
