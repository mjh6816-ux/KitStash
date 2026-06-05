import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect || "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <span className="text-3xl">🛠️</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-1.5px] text-white">
            KitStash
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Workbench access protected
          </p>
        </div>

        <div className="card p-8">
          <h2 className="mb-2 text-xl font-semibold text-white">
            Enter password
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            This is a personal tool. Please enter the shared password to continue.
          </p>

          <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
            <LoginForm redirectTo={redirectTo} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[10px] text-zinc-500">
          Protected with a simple password gate • Works on any Vercel plan
        </p>
      </div>
    </div>
  );
}
