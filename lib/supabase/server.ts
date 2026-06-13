// @supabase/ssr の createServerClient と名前が衝突しないよう、import 側を rename
import { createServerClient as createSsrServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function createClient() {
  const cookieStore = await cookies()

  return createSsrServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

// Compat alias for lifull modules (Phase 6 統合互換)
// 既存 toguna は createClient、新規 lifull は createServerClient を期待。同じ関数を両名で export。
export { createClient as createServerClient }
