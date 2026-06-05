# KitStash Security Notes

This document records the security posture and known items for the KitStash project (a single-user personal workbench inventory tool).

## Supabase Security Advisor

As of the latest run:

- ✅ **Critical "Table publicly accessible" (rls_disabled_in_public)** — **Resolved**
  - RLS enabled on all user data tables (`kits`, `aftermarket_parts`, `paints`, `projects`, `project_allocations`, etc.).
  - Policies restrict access to the single `SUPABASE_USER_ID`.
  - See `enable-rls-all-tables.sql` (run in Supabase SQL Editor).

- ✅ **Function Search Path Mutable** (for `public.update_updated_at_column`) — **Resolved**
  - Fixed via `ALTER FUNCTION ... SET search_path = ''`.
  - See `fix-function-search-path.sql`.

- ⚠️ **Leaked Password Protection** — Not enabled (Supabase Pro feature only)
  - This feature checks passwords against Have I Been Pwned during Auth signups.
  - **Impact for KitStash**: Very low.
    - This is a personal/single-user app.
    - Primary protection is the app-level shared password gate (see DEPLOY.md `SITE_PASSWORD`).
    - Data access is primarily via service role key from server actions + RLS policies.
    - No public user registration flow exists.
  - Can be enabled if you upgrade to Supabase Pro.

## Other Security Measures

- **Deployment protection**: A simple shared-password gate is implemented at the Edge using Next.js middleware (see `SITE_PASSWORD` in `.env.example` and `DEPLOY.md`). This works on all plans (Hobby included) and protects the entire app before any page or server action runs. Vercel built-in Deployment Protection (Password or Authentication) can be layered on top if desired.
- **Database access**: 
  - Browser uses anon key (subject to RLS).
  - Server actions use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS by design) for privileged operations.
- **Single user model**: All data is scoped to one fixed `SUPABASE_USER_ID` (set via environment variable).

## Recommendations

- Keep `SUPABASE_USER_ID` as an environment variable (never hardcode in production).
- Regularly review the Supabase Security Advisor after schema changes.
- The RLS policies and search path fix were added in response to the May 2026 Supabase security email.

## Scripts

Helpful SQL scripts (run in Supabase SQL Editor):

- `enable-rls-all-tables.sql` — Enables RLS + policies
- `fix-function-search-path.sql` — Fixes mutable search_path warning

Last reviewed: after RLS + search_path scripts + lint cleanup pass (npm run lint clean, 0 errors).
