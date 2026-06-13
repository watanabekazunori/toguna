/**
 * 商談詳細ページ — deal 概要 + meeting_seq タイムライン + 商談入力フォーム + 引き継ぎリンク (CLOSER 向け)
 */
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server-tenant'
import { DealDetailClient } from './DealDetailClient'

interface DealPageProps {
  params: { id: string }
}

/** 商談詳細 Server Component — 認証・ロール確認・初期データ取得 */
export default async function DealDetailPage({ params }: DealPageProps) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('lifull_users')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/lifull/unauthorized')

  const allowedRoles = ['CLOSER', 'MANAGER', 'ADMIN']
  if (!allowedRoles.includes(profile.role)) redirect('/lifull/unauthorized')

  // Deal + Company 基本情報
  const { data: deal } = await supabase
    .from('lifull_deals')
    .select(
      `
      id,
      company_id,
      appointer_user_id,
      closer_user_id,
      appointed_at,
      appointment_kind,
      appointment_type,
      status,
      latest_yomi,
      contact_person_name,
      notes,
      approval_no,
      created_at,
      lifull_companies (
        id,
        company_name,
        phone,
        address,
        industry,
        representative_name
      )
    `,
    )
    .eq('id', params.id)
    .single()

  if (!deal) notFound()

  // CLOSER は自分の担当商談のみアクセス可 (MANAGER/ADMIN は全件)
  if (profile.role === 'CLOSER' && deal.closer_user_id !== profile.id) {
    redirect('/lifull/unauthorized')
  }

  // 商談履歴
  const { data: meetings } = await supabase
    .from('lifull_meetings')
    .select('*')
    .eq('deal_id', params.id)
    .order('meeting_seq', { ascending: true })

  // 次の meeting_seq
  const nextSeq = meetings ? Math.max(0, ...meetings.map((m) => m.meeting_seq)) + 1 : 1

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <DealDetailClient
        deal={deal as Parameters<typeof DealDetailClient>[0]['deal']}
        meetings={(meetings ?? []) as Parameters<typeof DealDetailClient>[0]['meetings']}
        nextMeetingSeq={nextSeq}
        closerUserId={profile.id}
        viewerRole={profile.role}
      />
    </Suspense>
  )
}
