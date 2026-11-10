// app/profile/page.tsx (and dynamic user profile counterpart)
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Settings, Grid, Bookmark, Heart } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Profile Header Card */}
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-tight">@{profile?.username || "profile"}</h1>
          <Link
            href="/settings"
            className="p-2 rounded-full hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border/50">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                {profile?.username?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 text-center">
            <div>
              <div className="font-bold text-lg">0</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>
            <div>
              <div className="font-bold text-lg">0</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
            <div>
              <div className="font-bold text-lg">0</div>
              <div className="text-xs text-muted-foreground">Following</div>
            </div>
          </div>
        </div>

        <div className="space-y-1 mb-6">
          <div className="font-semibold">{profile?.full_name || profile?.username}</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {profile?.bio || "No bio yet."}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/profile/edit"
            className="flex-1 py-2.5 px-4 rounded-2xl bg-muted/80 hover:bg-muted font-medium text-sm text-center transition-colors border border-border/50"
          >
            Edit Profile
          </Link>
          <Link
            href="/profile/share"
            className="flex-1 py-2.5 px-4 rounded-2xl bg-muted/80 hover:bg-muted font-medium text-sm text-center transition-colors border border-border/50"
          >
            Share Profile
          </Link>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex border-b border-border/50 mb-6">
        <button className="flex-1 pb-3 flex items-center justify-center gap-2 border-b-2 border-primary font-medium text-sm">
          <Grid className="w-4 h-4" />
          Posts
        </button>
        <button className="flex-1 pb-3 flex items-center justify-center gap-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground font-medium text-sm">
          <Bookmark className="w-4 h-4" />
          Saved
        </button>
      </div>

      {/* Empty State */}
      <div className="text-center py-16 bg-card/40 rounded-3xl border border-border/40">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
          <Grid className="w-6 h-6" />
        </div>
        <h3 className="font-semibold mb-1">No Posts Yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          When you share photos and reels, they will appear on your profile.
        </p>
      </div>
    </div>
  );
}