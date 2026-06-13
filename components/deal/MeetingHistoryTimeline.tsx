/**
 * 商談履歴タイムライン — meeting_seq 横並び表示、各 seq クリックで詳細 modal、diff 比較
 */
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { YomiBadge } from './YomiBadge'
import { type Yomi, MEETING_NG_LABELS, type MeetingNgCode } from '@/lib/validation/meeting-schema'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export interface MeetingRecord {
  id: string
  meeting_seq: number
  scheduled_at: string | null
  meeting_type: 'phone' | 'web' | null
  status: 'done' | 'rescheduled' | 'disappeared'
  contact_person_name?: string | null
  meeting_content?: string | null
  next_content?: string | null
  meeting_result?: 'ok' | 'ng' | null
  ng_reason_code?: MeetingNgCode | null
  yomi?: Yomi | null
  yomi_rate?: number | null
  proposal_plan?: string | null
  b_yomi_date?: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  done: '完了',
  rescheduled: 'リスケ',
  disappeared: '消滅',
}

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  rescheduled: 'bg-yellow-100 text-yellow-700',
  disappeared: 'bg-red-100 text-red-700',
}

interface DiffField {
  label: string
  before: string | null
  after: string | null
}

function DiffView({ before, after }: { before: string | null; after: string | null }) {
  if (before === after) return <span className="text-slate-700">{after ?? '—'}</span>
  return (
    <span className="space-x-1">
      {before && (
        <span className="line-through text-red-500 opacity-70">{before}</span>
      )}
      {after && (
        <>
          <span className="text-slate-400">→</span>
          <span className="text-green-700 font-medium">{after}</span>
        </>
      )}
      {!after && <span className="text-slate-400 italic">削除</span>}
    </span>
  )
}

interface MeetingHistoryTimelineProps {
  meetings: MeetingRecord[]
  /** 前の seq との diff を表示するか */
  showDiff?: boolean
}

/** 商談履歴を seq 横並びタイムラインで表示、クリックで詳細 modal */
export function MeetingHistoryTimeline({ meetings, showDiff = true }: MeetingHistoryTimelineProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null)

  const sorted = [...meetings].sort((a, b) => a.meeting_seq - b.meeting_seq)

  const getDiff = (current: MeetingRecord): DiffField[] => {
    const prev = sorted.find((m) => m.meeting_seq === current.meeting_seq - 1)
    if (!prev) return []
    const fields: DiffField[] = []
    if (prev.yomi !== current.yomi) {
      fields.push({ label: 'ヨミ', before: prev.yomi, after: current.yomi ?? null })
    }
    if (prev.meeting_result !== current.meeting_result) {
      fields.push({
        label: '商談結果',
        before: prev.meeting_result,
        after: current.meeting_result ?? null,
      })
    }
    if (prev.proposal_plan !== current.proposal_plan) {
      fields.push({
        label: '提案プラン',
        before: prev.proposal_plan ?? null,
        after: current.proposal_plan ?? null,
      })
    }
    return fields
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        商談履歴がありません
      </div>
    )
  }

  return (
    <>
      {/* 横スクロールタイムライン */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-stretch gap-0 pb-2">
          {sorted.map((meeting, i) => {
            const diff = showDiff ? getDiff(meeting) : []
            const scheduledLabel = meeting.scheduled_at
              ? format(new Date(meeting.scheduled_at), 'M/d(E)', { locale: ja })
              : '日時未定'

            return (
              <div key={meeting.id} className="flex items-center">
                {/* ノード */}
                <button
                  type="button"
                  className="flex flex-col items-center gap-1.5 w-28 shrink-0 group"
                  onClick={() => setSelectedMeeting(meeting)}
                  aria-label={`商談${meeting.meeting_seq}の詳細を表示`}
                >
                  {/* seq バッジ */}
                  <div
                    className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110',
                      meeting.meeting_result === 'ng'
                        ? 'bg-red-500 text-white'
                        : meeting.status === 'rescheduled'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-blue-600 text-white',
                    ].join(' ')}
                  >
                    {meeting.meeting_seq}
                  </div>

                  {/* 日付 */}
                  <span className="text-xs text-slate-500 flex items-center gap-0.5">
                    <CalendarDays className="h-3 w-3" />
                    {scheduledLabel}
                  </span>

                  {/* ヨミバッジ */}
                  {meeting.yomi && (
                    <YomiBadge
                      yomi={meeting.yomi}
                      customRate={meeting.yomi_rate ?? undefined}
                      compact
                    />
                  )}

                  {/* ステータス */}
                  <Badge
                    className={[
                      'text-xs px-1.5 py-0',
                      STATUS_COLORS[meeting.status] ?? '',
                    ].join(' ')}
                    variant="outline"
                  >
                    {STATUS_LABELS[meeting.status] ?? meeting.status}
                  </Badge>

                  {/* diff ハイライト */}
                  {diff.length > 0 && (
                    <div className="flex flex-col gap-0.5 w-full">
                      {diff.map((d) => (
                        <div key={d.label} className="text-xs bg-amber-50 rounded px-1 py-0.5 text-center">
                          <span className="text-slate-400">{d.label}: </span>
                          <DiffView before={d.before} after={d.after} />
                        </div>
                      ))}
                    </div>
                  )}
                </button>

                {/* コネクタライン */}
                {i < sorted.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mx-1" />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* 詳細 Modal */}
      <Dialog open={!!selectedMeeting} onOpenChange={(o) => !o && setSelectedMeeting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              商談 #{selectedMeeting?.meeting_seq} 詳細
              {selectedMeeting?.yomi && (
                <YomiBadge
                  yomi={selectedMeeting.yomi}
                  customRate={selectedMeeting.yomi_rate ?? undefined}
                  className="ml-2"
                />
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedMeeting && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">商談日時</p>
                  <p className="font-medium">
                    {selectedMeeting.scheduled_at
                      ? format(new Date(selectedMeeting.scheduled_at), 'yyyy/MM/dd HH:mm', { locale: ja })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">形式</p>
                  <p className="font-medium">
                    {selectedMeeting.meeting_type === 'phone' ? '電話' : selectedMeeting.meeting_type === 'web' ? 'Web' : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">担当者</p>
                  <p className="font-medium">{selectedMeeting.contact_person_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">商談結果</p>
                  <p className="font-medium">
                    {selectedMeeting.meeting_result === 'ok' ? '継続' :
                      selectedMeeting.meeting_result === 'ng' ? 'NG' : '—'}
                  </p>
                </div>
                {selectedMeeting.ng_reason_code && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">NG理由</p>
                    <p className="font-medium text-red-600">
                      {MEETING_NG_LABELS[selectedMeeting.ng_reason_code]}
                    </p>
                  </div>
                )}
                {selectedMeeting.b_yomi_date && (
                  <div>
                    <p className="text-xs text-slate-500">口頭合意日</p>
                    <p className="font-medium text-blue-700">{selectedMeeting.b_yomi_date}</p>
                  </div>
                )}
              </div>
              {selectedMeeting.meeting_content && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">商談内容</p>
                  <p className="text-sm whitespace-pre-wrap bg-slate-50 rounded p-2">
                    {selectedMeeting.meeting_content}
                  </p>
                </div>
              )}
              {selectedMeeting.next_content && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">次回内容</p>
                  <p className="text-sm whitespace-pre-wrap bg-slate-50 rounded p-2">
                    {selectedMeeting.next_content}
                  </p>
                </div>
              )}
              {/* 前回との diff */}
              {showDiff && getDiff(selectedMeeting).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">前回からの変更</p>
                  <div className="space-y-1 bg-amber-50 rounded p-2">
                    {getDiff(selectedMeeting).map((d) => (
                      <div key={d.label} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 w-20 shrink-0">{d.label}:</span>
                        <DiffView before={d.before} after={d.after} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
