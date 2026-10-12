import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { ACCENT_COOKIE, DEFAULT_ACCENT, isAccent } from "@/lib/theme";
import { getMySuspension } from "@/lib/suspension";
import { SuspendedNotice } from "@/components/suspended-notice";
import "./globals.css";

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

  return (
    <html lang="en" data-accent={accent} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {suspension ? (
            <SuspendedNotice
              reason={suspension.reason}
              expiresAt={suspension.expiresAt}
            />
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}