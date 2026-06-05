"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PASSWORD = process.env.SITE_PASSWORD;

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const submitted = (formData.get("password") as string) || "";
  const redirectTo = (formData.get("redirect") as string) || "/";

  if (!PASSWORD) {
    redirect(redirectTo);
  }

  if (submitted !== PASSWORD) {
    return { error: "Incorrect password. Please try again." };
  }

  // Success — set a simple httpOnly cookie sentinel.
  const cookieStore = await cookies();
  cookieStore.set("kitstash_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  });

  // Redirect back to where they were trying to go (or home)
  redirect(redirectTo);
}

// Simple action for the layout-based gate (works even if /login route 404s in some deploys)
export async function unlockWithPassword(formData: FormData) {
  const submitted = (formData.get("password") as string) || "";
  const redirectTo = (formData.get("redirect") as string) || "/";

  if (!PASSWORD || submitted !== PASSWORD) {
    // Wrong pw - redirect back to trigger the gate form again (with error indicator via query)
    const target = new URL(redirectTo, "http://localhost");
    target.searchParams.set("pwerror", "1");
    redirect(target.pathname + target.search);
  }

  const cookieStore = await cookies();
  cookieStore.set("kitstash_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });

  redirect(redirectTo);
}
