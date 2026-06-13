/**
 * 商談詳細 Client Component — deal 概要 + 対応履歴タブ + 商談入力 + 引き継ぎリンク
 */
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { MeetingEntryForm } from '@/components/deal/MeetingEntryForm'
import { MeetingHistoryTimeline } from '@/components/deal/MeetingHistoryTimeline'
import { YomiBadge } from '@/components/deal/YomiBadge'
import type { MeetingRecord } from '@/components/deal/MeetingHistoryTimeline'
import type { MeetingEntryValues, Yomi } from '@/lib/validation/meeting-schema'
import { Building2, Calendar, FileText, ArrowRight, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Company {
  id: string
  company_name: string
  phone: string
  address?: string | null
  industry?: string | null
  representative_name?: string | null
}

interface Deal {
  id: string
  company_id: string
  appointer_user_id?: string | null
  closer_user_id?: string | null
  appointed_at: string
  appointment_kind?: string | null
  appointment_type?: string | null
  status: string
  latest_yomi?: Yomi | null
  contact_person_name?: string | null
  notes?: string | null
  approval_no?: string | null
  created_at: string
  lifull_companies: Company | null
}

interface DealDetailClientProps {
  deal: Deal
  meetings: MeetingRecord[]
  nextMeetingSeq: number
  closerUserId: string
  viewerRole: string
}

const DEAL_STATUS_LABELS: Record<string, string> = {
  meeting_scheduled: '商談予定',
  rescheduled: 'リスケ',
  disappeared: '消滅',
  lost: '失注',
  won: '受注',
  c_yomi_following: 'C追客',
}

const DEAL_STATUS_COLORS: Record<string, string> = {
  meeting_scheduled: 'bg-blue-100 text-blue-700',
  rescheduled: 'bg-yellow-100 text-yellow-700',
  disappeared: 'bg-red-100 text-red-700',
  lost: 'bg-gray-100 text-gray-600',
  won: 'bg-purple-100 text-purple-700',
  c_yomi_following: 'bg-cyan-100 text-cyan-700',
}

/** 商談詳細 Client Component */
export function DealDetailClient({
  deal,
  meetings,
  nextMeetingSeq,
  closerUserId,
  viewerRole,
}: DealDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<string>('history')

  const company = deal.lifull_companies

  const handleMeetingSubmit = async (values: MeetingEntryValues, seq: number) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/lifull/deals/${deal.id}/meetings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, meeting_seq: seq }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.detail ?? '商談の保存に失敗しました')
        }
        const data = await res.json()
        toast.success(`商談 #${seq} を保存しました`)

        // B ヨミ確定 → collections 通知
        if (values.yomi === 'B' || values.yomi === 'b_circle') {
          toast.info('口頭合意B確定: 申込書回収管理を自動作成しました', {
            duration: 6000,
            action: {
              label: '確認する',
              onClick: () => router.push(`/lifull/collections/${data.collection_id}`),
            },
          })
        }

        // タブを履歴に戻す & ページリフレッシュ
        setActiveTab('history')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '保存エラー')
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ヘッダ: Deal 概要 */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">
              {company?.company_name ?? '—'}
            </h1>
            <Badge
              className={[
                DEAL_STATUS_COLORS[deal.status] ?? 'bg-slate-100 text-slate-600',
              ].join(' ')}
              variant="outline"
            >
              {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
            </Badge>
            {deal.latest_yomi && <YomiBadge yomi={deal.latest_yomi} />}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {company?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {company.phone}
              </span>
            )}
            {company?.industry && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {company.industry}
              </span>
            )}
            {deal.appointed_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                アポ: {format(new Date(deal.appointed_at), 'yyyy/MM/dd', { locale: ja })}
              </span>
            )}
          </div>
          {deal.approval_no && (
            <p className="text-xs text-slate-400">稟議番号: {deal.approval_no}</p>
          )}
        </div>

        {/* アクション */}
        <div className="flex gap-2 shrink-0">
          <Link href={`/lifull/handoff/${deal.id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              引き継ぎ起票
            </Button>
          </Link>
          {(deal.status === 'won' || deal.latest_yomi === 'B' || deal.latest_yomi === 'b_circle') && (
            <Link href={`/lifull/collections?deal_id=${deal.id}`}>
              <Button size="sm" className="gap-2">
                <ArrowRight className="h-4 w-4" />
                申込書回収へ
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Separator />

      {/* 会社情報サマリ */}
      {company && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">代表者</p>
                <p className="font-medium">{company.representative_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">業種</p>
                <p className="font-medium">{company.industry ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">担当者</p>
                <p className="font-medium">{deal.contact_person_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">商談形式</p>
                <p className="font-medium">
                  {deal.appointment_type === 'phone' ? '電話' : deal.appointment_type === 'web' ? 'Web' : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* タブ: 対応履歴 / 商談入力 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="history">
            対応履歴
            {meetings.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {meetings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="new-meeting">
            商談入力
            <Badge variant="outline" className="ml-2 text-xs border-blue-300 text-blue-700">
              #{nextMeetingSeq}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* 対応履歴タブ */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">商談履歴タイムライン</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingHistoryTimeline meetings={meetings} showDiff />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 商談入力タブ */}
        <TabsContent value="new-meeting" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">商談 #{nextMeetingSeq} 入力</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingEntryForm
                dealId={deal.id}
                meetingSeq={nextMeetingSeq}
                closerUserId={closerUserId}
                onSubmit={handleMeetingSubmit}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 備考 */}
      {deal.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">備考</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{deal.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
