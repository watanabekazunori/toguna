/**
 * コール画面メインページ — 左ペイン: 当日コールリスト / 右ペイン: 46項目入力 + AI候補 (APPOINTER 向け)
 */
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server-tenant'
import { CallPageClient } from './CallPageClient'

/** ロール確認 + データ初期取得を Server Component で行い、Client Component に渡す */
export default async function CallPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('lifull_users')
    .select('id, name, role, team_name, zoom_phone_user_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/lifull/unauthorized')
  if (profile.role !== 'APPOINTER' && profile.role !== 'ADMIN') {
    redirect('/lifull/unauthorized')
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <CallPageClient
        appointerUserId={profile.id}
        appointerName={profile.name}
        zoomPhoneUserId={profile.zoom_phone_user_id ?? undefined}
      />
    </Suspense>
  )
}
