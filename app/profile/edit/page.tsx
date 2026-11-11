import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { ThemeSettings } from "@/components/theme-settings";
import { AvatarThemeFields } from "@/components/avatar-theme-fields";
import { LogoutRow } from "@/components/logout-row";
import { isHexColor } from "@/lib/pfp-theme";
import { isStorageImageUrl } from "@/lib/safe-url";
import {
  DEFAULT_ADJUST,
  normalizeAdjust,
} from "@/lib/theme-image";
import { BackLink, PageLoading, PageTitle, SectionLabel } from "@/components/page-chrome";

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const THEME_SOURCES = ["none", "pfp", "image"] as const;
type ThemeSource = (typeof THEME_SOURCES)[number];

type Supabase = Awaited<ReturnType<typeof createClient>>;

function fail(message: string): never {
  redirect(`/profile/edit?error=${encodeURIComponent(message)}`);
}

// Returns: string = valid URL, null = empty (clear it), undefined = invalid
function normalizeWebsite(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

async function uploadImage(
  supabase: Supabase,
  userId: string,
  file: File,
  label: string,
  tag: string
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    fail(`${label} must be an image file.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    fail(`${label} must be smaller than 5 MB.`);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}-${tag}${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("photos").upload(path, file);

  if (error) {
    fail(`Could not upload your ${label.toLowerCase()}. Please try again.`);
  }

  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

async function updateProfile(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const username = ((formData.get("username") as string) || "").trim();
  const full_name = ((formData.get("full_name") as string) || "").trim().slice(0, 60);
  const bio = ((formData.get("bio") as string) || "").trim().slice(0, 160);
  const websiteInput = ((formData.get("website") as string) || "").slice(0, 200);
  const removeAvatar = formData.get("remove_avatar") === "on";
  const removeThemeImage = formData.get("remove_theme_image") === "on";
  const avatarFile = formData.get("avatar") as File | null;
  const themeFile = formData.get("theme_image") as File | null;

  const requested = (formData.get("theme_source") as string) || "none";
  const requestedSource: ThemeSource = (THEME_SOURCES as readonly string[]).includes(
    requested
  )
    ? (requested as ThemeSource)
    : "none";

  const themeColorRaw = ((formData.get("theme_color") as string) || "").trim();
  const validColor = isHexColor(themeColorRaw) ? themeColorRaw.toLowerCase() : null;

  if (!USERNAME_REGEX.test(username)) {
    fail(
      "Username must be 3–30 characters: letters, numbers, dots and underscores only."
    );
  }

  const website = normalizeWebsite(websiteInput);
  if (website === undefined) {
    fail("Please enter a valid website URL.");
  }

  // What the profile currently has, so removals and fallbacks work correctly
  const { data: existing } = await supabase
    .from("profiles")
    .select(
      "avatar_url, theme_image_url, theme_image_x, theme_image_y, theme_image_zoom, theme_image_fade"
    )
    .eq("id", user.id)
    .maybeSingle();

  // Uploads
  let newAvatarUrl: string | null = null;
  if (avatarFile && avatarFile.size > 0) {
    newAvatarUrl = await uploadImage(
      supabase,
      user.id,
      avatarFile,
      "Profile picture",
      ""
    );
  }

  let newThemeImageUrl: string | null = null;
  if (themeFile && themeFile.size > 0) {
    newThemeImageUrl = await uploadImage(
      supabase,
      user.id,
      themeFile,
      "Theme image",
      "theme-"
    );
  }

  const finalAvatar =
    newAvatarUrl ?? (removeAvatar ? null : existing?.avatar_url ?? null);
  const finalThemeImage =
    newThemeImageUrl ?? (removeThemeImage ? null : existing?.theme_image_url ?? null);

  // Image adjustments. The sliders only exist in the form while the image
  // source is selected, so when they are absent keep what is already saved
  // (a brand new image starts from the defaults).
  const savedAdjust = normalizeAdjust({
    x: existing?.theme_image_x,
    y: existing?.theme_image_y,
    zoom: existing?.theme_image_zoom,
    fade: existing?.theme_image_fade,
  });
  const adjust = normalizeAdjust(
    {
      x: formData.get("theme_image_x"),
      y: formData.get("theme_image_y"),
      zoom: formData.get("theme_image_zoom"),
      fade: formData.get("theme_image_fade"),
    },
    newThemeImageUrl ? DEFAULT_ADJUST : savedAdjust
  );

  // Work out which theme source is actually usable
  let source: ThemeSource = requestedSource;
  if (source === "pfp" && !finalAvatar) source = "none";
  if (source === "image" && !finalThemeImage) source = "none";

  let colorProblem = false;
  if (source !== "none" && !validColor) {
    colorProblem = true;
    source = "none";
  }

  const profileData: Record<string, string | number | null> = {
    id: user.id,
    username,
    full_name,
    bio: bio || null,
    website,
    avatar_url: finalAvatar,
    theme_source: source,
    theme_color: source === "none" ? null : validColor,
    theme_image_url: finalThemeImage,
    theme_image_x: adjust.x,
    theme_image_y: adjust.y,
    theme_image_zoom: adjust.zoom,
    theme_image_fade: adjust.fade,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(profileData);

  if (error) {
    if (error.code === "23505") {
      fail("That username is already taken.");
    }
    fail("Could not save your profile. Please try again.");
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/");

  if (colorProblem) {
    fail(
      "Profile saved, but we couldn't read colors from your image, so the theme is off."
    );
  }

  redirect("/profile/edit?saved=1");
}

async function ProfileContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, bio, website, theme_source, theme_color, theme_image_url, theme_image_x, theme_image_y, theme_image_zoom, theme_image_fade"
    )
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = isStorageImageUrl(profile?.avatar_url) ? profile.avatar_url : null;
  const themeImageUrl = isStorageImageUrl(profile?.theme_image_url)
    ? profile.theme_image_url
    : null;
  const themeColor = profile?.theme_color;
  const savedSource = profile?.theme_source;
  const initialSource: ThemeSource = (THEME_SOURCES as readonly string[]).includes(
    savedSource
  )
    ? (savedSource as ThemeSource)
    : "none";

  const initialAdjust = normalizeAdjust({
    x: profile?.theme_image_x,
    y: profile?.theme_image_y,
    zoom: profile?.theme_image_zoom,
    fade: profile?.theme_image_fade,
  });

  const profileHref = profile?.username ? `/u/${profile.username}` : null;

  const field =
    "h-11 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 text-base transition-all placeholder:text-foreground/35 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/25 md:text-sm";
  const label = "mb-1.5 block text-sm font-semibold";

  return (
    <div className="mx-auto mt-6 max-w-md px-4 pb-32">
      <BackLink href={profileHref ?? "/"}>Profile</BackLink>

      <PageTitle>Edit profile</PageTitle>

      {saved && (
        <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-600 animate-in fade-in-0">
          Profile saved.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 animate-in fade-in-0">
          {error}
        </div>
      )}

      {/* Account */}
      <section className="mb-7">
        <SectionLabel>Account</SectionLabel>
        <div className="glass-card rounded-[22px] px-4 py-3.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">Email</span>
            <span className="truncate text-foreground/60">{user.email}</span>
          </div>
          <p className="mt-1.5 text-xs text-foreground/45">
            Only you can see your email. It is never shown on your public profile.
          </p>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-7">
        <SectionLabel>Appearance</SectionLabel>
        <div className="glass-card rounded-[22px] p-4">
          <ThemeSettings />
        </div>
      </section>

      <form action={updateProfile} className="space-y-7">
        <section>
          <SectionLabel>Photo and theme</SectionLabel>
          <AvatarThemeFields
            avatarUrl={avatarUrl}
            themeImageUrl={themeImageUrl}
            initialSource={initialSource}
            initialColor={isHexColor(themeColor) ? themeColor : null}
            initialAdjust={initialAdjust}
          />
        </section>

        <section>
          <SectionLabel>About you</SectionLabel>
          <div className="glass-card space-y-4 rounded-[22px] p-4">
            <div>
              <label htmlFor="username" className={label}>
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                defaultValue={profile?.username || ""}
                className={field}
                placeholder="Choose a username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9._]{3,30}"
                title="3–30 characters: letters, numbers, dots and underscores"
              />
            </div>

            <div>
              <label htmlFor="full_name" className={label}>
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                name="full_name"
                defaultValue={profile?.full_name || ""}
                className={field}
                placeholder="Your full name"
                maxLength={60}
              />
            </div>

            <div>
              <label htmlFor="bio" className={label}>
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                defaultValue={profile?.bio || ""}
                className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2.5 text-base transition-all placeholder:text-foreground/35 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/25 md:text-sm"
                placeholder="Tell people about yourself"
                rows={3}
                maxLength={160}
              />
              <p className="mt-1 text-xs text-foreground/45">Up to 160 characters.</p>
            </div>

            <div>
              <label htmlFor="website" className={label}>
                Website
              </label>
              <input
                id="website"
                type="text"
                name="website"
                defaultValue={profile?.website || ""}
                className={field}
                placeholder="example.com"
                maxLength={200}
              />
            </div>
          </div>
        </section>

        {/* Save bar stays in reach above the tab bar */}
        <div className="glass-bar sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 rounded-3xl border p-1.5 shadow-lg md:bottom-4">
          <button
            type="submit"
            className="h-12 w-full rounded-[20px] bg-brand text-[15px] font-semibold text-white shadow-lg shadow-brand/30 transition-all hover:opacity-95 active:scale-[0.98]"
          >
            Save changes
          </button>
        </div>
      </form>

      <div className="mt-8">
        <LogoutRow />
      </div>
    </div>
  );
}

export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  );
}