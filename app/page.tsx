import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function KitStashHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-8">
      <div className="text-center">
        <div className="mb-4 inline-flex items-center rounded-full bg-amber-500/10 px-4 py-1 text-sm font-medium text-amber-400">
          Workbench Ready
        </div>
        <h1 className="mb-4 text-6xl font-semibold tracking-[-2.5px] text-white">KitStash</h1>
        <p className="mb-8 max-w-md text-xl text-zinc-400">
          Scale model inventory &amp; project tracker.<br />
          Built for the workbench.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="w-full sm:w-auto">
              Enter Dashboard <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/inventory">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              View Inventory
            </Button>
          </Link>
        </div>

        <p className="mt-10 text-xs text-zinc-500">
          Dark mode • Mobile-first • Ready for Supabase
        </p>
      </div>
    </div>
  );
}
