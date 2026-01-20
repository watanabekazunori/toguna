import { createBrowserClient } from '@supabase/ssr'

// ブラウザ環境でのみインスタンスを保持
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // サーバーサイドでは毎回新しいインスタンスを作成（SSRでは使わないが念のため）
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // クライアントサイドではシングルトン
  if (supabaseInstance) {
    return supabaseInstance
  }

  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return supabaseInstance
}
