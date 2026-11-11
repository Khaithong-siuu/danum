import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmojiText } from "@/components/emoji-text";
import { formatCount } from "@/lib/reels";
import type { StoryRing } from "@/lib/story-ring";

type Stat = { label: string; value: number; href?: string };

function StatCell({ stat }: { stat: Stat }) {
  const inner = (
    <>
      <span className="block text-[19px] font-bold tabular-nums leading-tight">
        {formatCount(stat.value)}
      </span>
      <span className="block text-[13px] text-foreground/55">{stat.label}</span>
    </>
  );

  return stat.href ? (
    <Link href={stat.href} className="block text-center transition active:opacity-60">
      {inner}
    </Link>
  ) : (
    <div className="text-center">{inner}</div>
  );
}

function AvatarImage({ url, username }: { url: string | null; username: string }) {
  return url ? (
    <Image
      src={url}
      alt={`${username} avatar`}
      width={96}
      height={96}
      priority
      className="h-[88px] w-[88px] rounded-full object-cover"
    />
  ) : (
    <div className="h-[88px] w-[88px] rounded-full bg-foreground/10" />
  );
}

/**
 * Profile header shared by your own profile and public profiles.
 * Instagram-style layout (avatar left, stats right, bio below, buttons
 * under that) on a glass card. The ring around the avatar only exists
 * when the person has an active story.
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
  storyRing = "none",
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
  storyRing?: StoryRing;
  titleAs?: "h1" | "h2";
  children?: ReactNode;
}) {
  const Title = titleAs;
  const hasStory = storyRing !== "none";

  const avatar = hasStory ? (
    <Link
      href={`/stories/${encodeURIComponent(username)}`}
      aria-label={`Watch ${username}'s story`}
      className={`block rounded-full p-[3px] transition active:scale-95 ${
        storyRing === "unseen"
          ? "gradient-border-story shadow-lg shadow-pink-500/20"
          : "bg-foreground/25"
      }`}
    >
      <span className="block rounded-full bg-card p-[3px]">
        <AvatarImage url={avatarUrl} username={username} />
      </span>
    </Link>
  ) : (
    <div className="rounded-full p-[3px]">
      <AvatarImage url={avatarUrl} username={username} />
    </div>
  );

  return (
    <section className="glass-card relative overflow-hidden rounded-[28px]">
      {/* Ambient backdrop: their theme picture, or a soft brand glow.
          Fades out downwards, so the card never ends in a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
        }}
      >
        {coverUrl ? (
          <>
            <Image
              src={coverUrl}
              alt=""
              fill
              className="object-cover"
              style={coverStyle}
              sizes="(max-width: 640px) 100vw, 576px"
            />
            <div className="absolute inset-0 bg-card/55" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(70% 90% at 12% 0%, hsl(var(--brand) / 0.28), transparent 70%), radial-gradient(60% 80% at 100% 0%, hsl(285 85% 62% / 0.18), transparent 70%)",
            }}
          />
        )}
      </div>

      <div className="relative px-5 pb-5 pt-5">
        <Title className="mb-4 truncate text-[17px] font-semibold tracking-tight">
          {username}
        </Title>

        <div className="flex items-center gap-5">
          <div className="shrink-0">{avatar}</div>
          <div className="grid flex-1 grid-cols-3 gap-1">
            {stats.map((s) => (
              <StatCell key={s.label} stat={s} />
            ))}
          </div>
        </div>

        {(fullName || bio || website) && (
          <div className="mt-4 text-[14px] leading-snug">
            {fullName && <p className="font-semibold">{fullName}</p>}
            {bio && (
              <p className="mt-0.5 whitespace-pre-wrap text-foreground/85">
                <EmojiText text={bio} />
              </p>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-0.5 block truncate font-medium text-brand hover:underline"
              >
                {website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}

        {children && <div className="mt-4 flex items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}
