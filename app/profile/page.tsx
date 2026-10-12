import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { ThemeSettings } from "@/components/theme-settings";
import { AvatarThemeFields } from "@/components/avatar-theme-fields";
import { isHexColor } from "@/lib/pfp-theme";
import { isStorageImageUrl } from "@/lib/safe-url";
import { DEFAULT_ADJUST, normalizeAdjust } from "@/lib/theme-image";

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const THEME_SOURCES = ["none", "pfp", "image"] as const;
type ThemeSource = (typeof THEME_SOURCES)[number];

type Supabase = Awaited<ReturnType<typeof createClient>>;

function fail(message: string): never {
  redirect(`/profile?error=${encodeURIComponent(message)}`);
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
  revalidatePath("/");

  if (colorProblem) {
    fail(
      "Profile saved, but we couldn't read colors from your image, so the theme is off."
    );
  }

  redirect("/profile?saved=1");
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

  return (
    <div className="max-w-md mx-auto mt-6 p-6">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back to feed
      </Link>

      <h1 className="text-3xl font-bold mt-4 mb-6">Your Profile</h1>

      {saved && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-600">
          Profile saved.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Show current avatar */}
      <div className="mb-6 flex justify-center">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Avatar"
            width={120}
            height={120}
            className="rounded-full object-cover w-[120px] h-[120px]"
          />
        ) : (
          <div className="w-[120px] h-[120px] rounded-full bg-foreground/10" />
        )}
      </div>

      {profile?.username && (
        <p className="mb-4 text-center">
          <Link
            href={`/u/${profile.username}`}
            className="text-sm text-brand hover:underline"
          >
            View public profile
          </Link>
        </p>
      )}

      <div className="mb-6 rounded-lg border border-foreground/10 px-4 py-3 text-sm">
        <p className="font-medium">Email</p>
        <p className="text-foreground/70">{user.email}</p>
        <p className="mt-1 text-xs text-foreground/50">
          Only you can see your email. It is never shown on your public profile.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-foreground/10 px-4 py-4">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <ThemeSettings />
      </div>

      <form action={updateProfile} className="space-y-4">
        <AvatarThemeFields
          avatarUrl={avatarUrl}
          themeImageUrl={themeImageUrl}
          initialSource={initialSource}
          initialColor={isHexColor(themeColor) ? themeColor : null}
          initialAdjust={initialAdjust}
        />

        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            name="username"
            defaultValue={profile?.username || ""}
            className="w-full border rounded px-3 py-2 bg-background"
            placeholder="Choose a username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9._]{3,30}"
            title="3–30 characters: letters, numbers, dots and underscores"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            type="text"
            name="full_name"
            defaultValue={profile?.full_name || ""}
            className="w-full border rounded px-3 py-2 bg-background"
            placeholder="Your full name"
            maxLength={60}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            name="bio"
            defaultValue={profile?.bio || ""}
            className="w-full border rounded px-3 py-2 bg-background resize-none"
            placeholder="Tell people about yourself"
            rows={3}
            maxLength={160}
          />
          <p className="mt-1 text-xs text-foreground/50">Up to 160 characters.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input
            type="text"
            name="website"
            defaultValue={profile?.website || ""}
            className="w-full border rounded px-3 py-2 bg-background"
            placeholder="example.com"
            maxLength={200}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-brand text-white py-2 rounded hover:opacity-90 transition"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading profile...</div>}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  );
}