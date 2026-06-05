import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";
import { TopNav, BottomNav, GlobalSearchWrapper } from "@/components/AppChrome";
import { unlockWithPassword } from "@/app/login/actions";

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
    // Render a full-page gate form using the server action. This ensures the gate works
    // regardless of proxy.ts deployment state or /login route existence.
    return (
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
          <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
            <div className="w-full max-w-sm">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
                  <span className="text-3xl">🛠️</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-[-1.5px] text-white">KitStash</h1>
                <p className="mt-2 text-sm text-zinc-400">Workbench access protected</p>
              </div>

              <div className="card p-8">
                <h2 className="mb-2 text-xl font-semibold text-white">Enter password</h2>
                <p className="mb-6 text-sm text-zinc-400">This is a personal tool. Please enter the shared password to continue.</p>

                <form action={unlockWithPassword} className="space-y-4">
                  <input type="hidden" name="redirect" value={pathname} />
                  <div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Password"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-white text-zinc-950 font-medium py-3 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition text-sm"
                  >
                    Unlock Workbench
                  </button>
                </form>
              </div>

              <p className="mt-6 text-center text-[10px] text-zinc-500">
                Protected with a simple password gate • Works on any Vercel plan
              </p>
            </div>
          </div>
        </body>
      </html>
    );
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
