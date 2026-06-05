# Deploying KitStash

This is the recommended path for getting a stable, always-on HTTPS URL you can use from your phone or anywhere (garage, travel, etc.).

The app is a single-user personal tool. We use a simple built-in shared password gate (via Edge proxy + server guard) for security. It works on all Vercel plans (including free Hobby) with zero extra cost. Vercel's built-in Deployment Protection can be layered on top optionally.

## Prerequisites
- A GitHub account (free)
- A Vercel account (free, sign in with GitHub)
- Your Supabase project credentials ready (URL, anon key, service role key, and your user UUID)

## Step 1: Initialize Git (if not done)

On your machine, in the `kit-stash` folder, you can run the helper:

```powershell
# Windows PowerShell (recommended)
.\init-git.ps1
```

Or do it manually:

```powershell
git init
git add .
git commit -m "Prepare for production deploy - env var user ID, cleaned hacks, vercel config"
```

Then create a **new empty repo** on GitHub (https://github.com/new). **Do not** check the boxes to add README, .gitignore, or license.

Push with (replace YOUR_USERNAME):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/KitStash.git
git branch -M main
git push -u origin main

**Note on repo name casing:** GitHub repo names are case-insensitive for access, but the "official" URL uses the casing you chose when creating the repo (often TitleCase like KitStash). If GitHub says "This repository moved" during push (as happened in the original deployment), just run:

git remote set-url origin https://github.com/YOUR_USERNAME/KitStash.git
git push -u origin main

(You can also update the remote in your local clone right after the first push. The author had to do `git remote set-url origin https://github.com/mjh6816-ux/KitStash.git` after the initial push to the lowercase version.)
```

## Step 2: Deploy on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repo (`kit-stash`)
3. Vercel will detect it as a Next.js project automatically.
4. **Do NOT deploy yet** — click "Configure" or go to the Environment Variables section first.

## Step 3: Set Environment Variables (critical)

In the Vercel import screen (or after import: Project → Settings → Environment Variables), add these **exactly**:

### Public variables (available to browser):
- `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL (e.g. https://xxx.supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the `anon` / `public` key from Supabase

### Secret / Server-only variables:
- `SUPABASE_SERVICE_ROLE_KEY` → the `service_role` key (mark this one as **Secret** or just don't prefix with NEXT_PUBLIC_)
- `SUPABASE_USER_ID` → your Supabase auth user UUID (the same one used locally, e.g. a8e4287a-040b-41dd-ba45-87f6a3c07395)

**Important**:
- Never set `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` in production.
- The `SUPABASE_USER_ID` replaces the old hardcoded value.

After adding the variables, trigger the deploy.

## Step 4: Enable Protection (security for personal use)

KitStash now includes a built-in shared password gate (via Next.js middleware) that works on **all Vercel plans** including free Hobby. This is the recommended reliable method.

### Recommended: Set `SITE_PASSWORD` (works everywhere)

1. In Vercel: Project → **Settings** → **Environment Variables**
2. Add a new variable:
   - Name: `SITE_PASSWORD`
   - Value: a strong password only you know
   - Environment: Production (and Preview if you want)
3. Redeploy the project (or push a commit).

On any device, visitors will now see a clean "Enter password" screen before the app loads. The cookie remembers the device for ~90 days.

You can also set `SITE_PASSWORD` in your local `.env.local` to protect `npm run dev`.

### Alternative / Additional: Vercel Deployment Protection

Vercel offers built-in options under **Settings → Deployment Protection** (in the sidebar).

- "Vercel Authentication" (login with Vercel account) is more limited.
- Full "Password Protection" (simple shared password) requires a **Pro plan + Advanced Deployment Protection add-on** or Enterprise.

If you have access to it, you can enable it in addition to (or instead of) the `SITE_PASSWORD` gate. The app-level gate is usually sufficient and free.

After enabling any protection, test from an incognito window and a different device/network.

## Step 5: Test from Phone (the whole point)

1. On your phone, open the production URL (https://your-project.vercel.app) **using mobile data** (not home Wi-Fi).
2. Enter the password.
3. Test:
   - Open Inventory → add a part using the camera button (should work reliably over HTTPS).
   - Global search
   - Projects + allocations
   - Dashboard / Reports
   - Export ZIP

If camera doesn't prompt, make sure you're on a secure origin (https) and using a modern browser (Chrome/Safari).

## Step 6: Ongoing updates

Every time you `git push` to the main branch, Vercel will automatically rebuild and deploy.

To update env vars later: Project → Settings → Environment Variables → Redeploy.

## Security Notes

See **[SECURITY.md](./SECURITY.md)** for the current state of the Supabase Security Advisor, RLS policies, and known items (including the one Pro-only warning that remains).

The main runtime protection for the deployed app is the built-in `SITE_PASSWORD` gate (middleware) + Supabase RLS policies scoped to your single user. Vercel Deployment Protection can be used in addition if you are on a paid plan.

## Optional next improvements (after it's working remotely)

- Add a real Supabase Auth login flow (we can implement this later).
- Custom domain (Vercel makes it easy).
- PWA support is complete: custom race-car themed icons (transparent PNGs for maskable), apple-touch-icon, installable on phone home screen. See [ICONS.md](./ICONS.md).
- Add more robust error boundaries or logging.

## Troubleshooting common issues

- **"Missing env var" errors**: Double-check the names match exactly (case sensitive). Redeploy after changing vars.
- **Camera not working**: Must be HTTPS. Password protection page is also HTTPS.
- **Old data / caching**: Hard refresh (Ctrl+Shift+R) or wait a minute after deploy.
- **Service role exposed**: Make sure you did **not** create a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` variable.

## Your current local setup still works

`npm run dev` continues to use `.env.local` exactly as before.

---

You're now set up to use KitStash reliably away from home.

If you run into any issues during the GitHub / Vercel steps, paste the error here and we'll fix it together.
