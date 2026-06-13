/**
 * LIFULLモジュール用ネストレイアウト — サイドバー + ヘッダー + メインの3ペイン構成
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseLifullRole } from '@/lib/lifull-roles'
import { RoleSidebar } from '@/components/layout/RoleSidebar'
import { Header } from '@/components/layout/Header'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface LifullLayoutProps {
  children: ReactNode
}

export default async function LifullLayout({ children }: LifullLayoutProps) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const rawRole = session.user.user_metadata?.role as string | undefined
  const role = rawRole ? parseLifullRole(rawRole) : null

  if (!role) {
    redirect('/login?error=role_not_assigned')
  }

  const tenantId = (session.user.user_metadata?.tenant_id as string) ?? 'lifull_homes'
  const userEmail = session.user.email
  const userName = (session.user.user_metadata?.full_name as string) ?? userEmail ?? '未設定'
  const userId = session.user.id

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* サイドバー: Server Componentで初期ロールを渡し、クライアント側でcollapse管理 */}
      <RoleSidebar role={role} tenantId={tenantId} />

      {/* メインエリア */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ヘッダー */}
        <Header
          role={role}
          tenantId={tenantId}
          userName={userName}
          userEmail={userEmail}
          userId={userId}
        />

        {/* メインコンテンツ */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
