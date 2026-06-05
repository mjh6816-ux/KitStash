import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";
import { TopNav, BottomNav, GlobalSearchWrapper } from "@/components/AppChrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KitStash",
    template: "%s | KitStash",
  },
  description: "Scale model inventory & project tracker for the workbench. Track kits, aftermarket parts, paints, and build allocations with automatic stock deduction.",
  icons: {
    icon: [
      { url: "/icons/icon-512-racecar-v2.png", sizes: "512x512" },
      { url: "/icons/icon-512-racecar-v2.jpg", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png" },
      { url: "/icons/apple-touch-icon.jpg" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KitStash",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#18181b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pw = process.env.SITE_PASSWORD;
  const cookieStore = await cookies();
  const auth = cookieStore.get("kitstash_auth")?.value;
  const needsAuth = !!pw && auth !== "1";

  if (needsAuth) {
    const headersList = await headers();
    const pathname = headersList.get("x-current-pathname") || "/";
    // Redirect unauthenticated users to the dedicated /login gate page (preserves ?redirect=).
    // Skip for /login itself so the login page (with its form) can render.
    if (pathname !== "/login" && !pathname.startsWith("/login")) {
      const redirectTarget = pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      redirect(`/login${redirectTarget}`);
    }
    // (For /login we fall through so app/login/page.tsx renders the nice gate UI.)
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        <TopNav />

        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>

        <BottomNav />

        <Toaster position="top-center" richColors closeButton />
        {/* Global search modal (opens via CustomEvent from nav buttons) */}
        <GlobalSearchWrapper>
          <GlobalSearch />
        </GlobalSearchWrapper>
      </body>
    </html>
  );
}
