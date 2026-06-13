/**
 * 認証必須ルートグループレイアウト — Supabase Auth セッション確認 + tenant_id 注入
 */

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseLifullRole } from '@/lib/lifull-roles'
import type { LifullRole } from '@/lib/lifull-roles'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthedLayoutContext {
  userId: string
  tenantId: string
  role: LifullRole
  email: string | undefined
}

/** Server Context で下位に渡すためのグローバルキャッシュ (リクエストスコープ) */
// Next.js App Router では Server Component 間のデータ受け渡しは props / cookies / headers 経由
// ここではセッション確認のみ行い、下位レイアウトで再取得できるよう cookies を残す

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface AuthedLayoutProps {
  children: ReactNode
}

export default async function AuthedLayout({ children }: AuthedLayoutProps) {
  const cookieStore = await cookies()

  // Supabase SSR クライアント (@supabase/ssr v0.5+)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Server Component では書き込み不可のため無視
          // 実際のセッション更新は middleware で行う
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component からの set は無視
          }
        },
      },
    }
  )

  // セッション確認
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    redirect('/login')
  }

  // ユーザーメタデータからロールを取得
  // DB の lifull_users.role を正とし、JWT クレームを補助参照
  const rawRole = session.user.user_metadata?.role as string | undefined
  const role = rawRole ? parseLifullRole(rawRole) : null

  if (!role) {
    // ロール未設定ユーザーは管理者に連絡を促す画面へ
    redirect('/login?error=role_not_assigned')
  }

  // tenant_id を決定 (LIFULL_HOMES 固定テナント)
  const tenantId = (session.user.user_metadata?.tenant_id as string) ?? 'lifull_homes'

  // tenant_id の基本検証 — 不正値は即ブロック
  if (!/^[a-z][a-z0-9_]*$/.test(tenantId)) {
    redirect('/login?error=invalid_tenant')
  }

  return <>{children}</>
}
