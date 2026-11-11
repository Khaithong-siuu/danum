import { redirect } from "next/navigation";

// This used to be the Supabase starter demo page. Anyone who lands here
// (old login redirects, email links) now goes straight to the feed.
export default function ProtectedPage() {
  redirect("/");
}
