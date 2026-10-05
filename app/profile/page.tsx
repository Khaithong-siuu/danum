import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import Image from "next/image";

async function updateProfile(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const username = formData.get("username") as string;
  const full_name = formData.get("full_name") as string;
  const file = formData.get("avatar") as File;

  let avatar_url = null;

  // Upload avatar if a file was selected
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(fileName, file);

    if (!uploadError) {
      const { data } = supabase.storage.from("photos").getPublicUrl(fileName);
      avatar_url = data.publicUrl;
    }
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    username,
    full_name,
    avatar_url: avatar_url || undefined,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/profile");
}

async function ProfileContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-md mx-auto mt-10 p-6">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

      {/* Show current avatar */}
      {profile?.avatar_url && (
        <div className="mb-6 flex justify-center">
          <Image
            src={profile.avatar_url}
            alt="Avatar"
            width={120}
            height={120}
            className="rounded-full object-cover"
          />
        </div>
      )}

      <p className="mb-4">
        <strong>Email:</strong> {user.email}
      </p>

      <form action={updateProfile} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Profile Picture</label>
          <input
            type="file"
            name="avatar"
            accept="image/*"
            className="w-full"
          />
        </div>

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
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}