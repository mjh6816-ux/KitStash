import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  // Browser client — always use the anon key.
  //
  // For production (hosted on Vercel or similar):
  //   - Only set NEXT_PUBLIC_SUPABASE_ANON_KEY (never expose the service role key publicly).
  //   - All privileged reads/writes (inventory, allocations, storage uploads) are done via Server Actions
  //     using the private SUPABASE_SERVICE_ROLE_KEY on the server.
  //   - This is the correct & secure pattern.
  //
  // The previous LAN/phone hack that exposed the service role key is no longer needed once the app
  // is deployed behind HTTPS with proper server actions.
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
