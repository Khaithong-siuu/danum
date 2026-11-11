import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { ACCENT_COOKIE, DEFAULT_ACCENT, isAccent } from "@/lib/theme";
import { getMySuspension } from "@/lib/suspension";
import { SuspendedNotice } from "@/components/suspended-notice";
import { TabBar } from "@/components/tab-bar";
import { NativeChrome } from "@/components/native-chrome";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Danum",
  description: "Share your moments!",
  appleWebApp: {
    capable: true,
    title: "Danum",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The on-screen keyboard shrinks the page instead of covering the input bar
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const saved = cookieStore.get(ACCENT_COOKIE)?.value;
  const accent = isAccent(saved) ? saved : DEFAULT_ACCENT;

  // A suspended account sees only this notice, on every page
  const suspension = await getMySuspension();

  // The tab bar is for signed-in people; it also needs your username so your
  // own profile page lights up the Profile tab
  let signedIn = false;
  let myUsername: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const uid = data?.claims?.sub;
    if (uid) {
      signedIn = true;
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .maybeSingle();
      myUsername = (p?.username as string | undefined) ?? null;
    }
  } catch {
    // no tab bar if we cannot tell who is signed in
  }

  return (
    <html lang="en" data-accent={accent} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NativeChrome />
          {suspension ? (
            <SuspendedNotice
              reason={suspension.reason}
              expiresAt={suspension.expiresAt}
            />
          ) : (
            <>
              {children}
              {signedIn && <TabBar username={myUsername} />}
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}