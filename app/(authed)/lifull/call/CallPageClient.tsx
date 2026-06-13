/**
 * コール画面 Client Component — 左右ペイン構成、AI候補 sticky 表示、Realtime 購読
 */
'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { CallList, type Company } from '@/components/call/CallList'
import { CallEntryForm } from '@/components/call/CallEntryForm'
import { AICandidatesPanel } from '@/components/call/AICandidatesPanel'
import { ZoomCallButton } from '@/components/call/ZoomCallButton'
import { useAIPipelineStatus } from '@/hooks/useAIPipelineStatus'
import type { CallEntryFormValues, AISuggestion } from '@/lib/validation/call-entry-schema'
import { Building2 } from 'lucide-react'

interface CallPageClientProps {
  appointerUserId: string
  appointerName: string
  zoomPhoneUserId?: string
}

/** コール画面メイン Client Component */
export function CallPageClient({
  appointerUserId,
  appointerName,
  zoomPhoneUserId,
}: CallPageClientProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [zoomCallId, setZoomCallId] = useState<string | undefined>()
  const [confirmedSuggestion, setConfirmedSuggestion] = useState<AISuggestion | null>(null)
  const [isPending, startTransition] = useTransition()
  const formKey = useRef(0) // フォームリセット用

  // AI pipeline Realtime 購読
  const { status, output, isLoading, isFailed, isTimedOut, elapsed_sec, reset: resetAI } =
    useAIPipelineStatus({
      activityId,
      onTimeout: () => {
        toast.warning('AI 候補の生成がタイムアウトしました。手動入力に切り替えます。')
      },
      onCompleted: (out) => {
        if (out.suggestions.length > 0) {
          toast.success(`AI 候補 ${out.suggestions.length} 件が生成されました`)
        }
      },
    })

  const handleCompanySelect = useCallback((company: Company) => {
    setSelectedCompany(company)
    setActivityId(null)
    setZoomCallId(undefined)
    setConfirmedSuggestion(null)
    resetAI()
    formKey.current += 1
  }, [resetAI])

  const handleCallStarted = useCallback((callId: string) => {
    setZoomCallId(callId)
  }, [])

  const handleCallEnded = useCallback((_callId: string, _durationSec: number) => {
    // Webhook 経由で AI pipeline が起動されるのを待つ
    toast.info('通話終了。AI 候補を生成中です...')
  }, [])

  const handleAIConfirm = useCallback(
    async (suggestion: AISuggestion, index: number) => {
      if (!activityId) return
      setConfirmedSuggestion(suggestion)
      try {
        const res = await fetch(`/api/lifull/activities/${activityId}/confirm-ai`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_suggestion_index: index }),
        })
        if (!res.ok) throw new Error()
        toast.success('AI 候補を確定しました')
      } catch {
        toast.error('AI 候補の確定に失敗しました')
        setConfirmedSuggestion(null)
      }
    },
    [activityId],
  )

  const handleFormSubmit = useCallback(
    async (values: CallEntryFormValues) => {
      startTransition(async () => {
        try {
          const res = await fetch('/api/lifull/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...values,
              zoom_call_id: zoomCallId,
            }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err?.detail ?? '保存に失敗しました')
          }
          const data = await res.json()
          setActivityId(data.activity_id)
          toast.success('コールを記録しました')

          if (data.deal_id) {
            toast.success('アポ獲得: 商談を自動起票しました', {
              action: {
                label: '商談を確認',
                onClick: () => window.open(`/lifull/deals/${data.deal_id}`, '_blank'),
              },
            })
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '保存エラー')
        }
      })
    },
    [zoomCallId],
  )

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* 左ペイン: コールリスト */}
      <aside className="w-72 shrink-0 border-r flex flex-col bg-white overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-slate-800">本日のコールリスト</h2>
          <p className="text-xs text-slate-500 mt-0.5">{appointerName}</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <CallList
            selectedCompanyId={selectedCompany?.id ?? null}
            onSelect={handleCompanySelect}
          />
        </div>
      </aside>

      {/* 右ペイン: 入力フォーム + AI候補 */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {!selectedCompany ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <Building2 className="h-12 w-12 text-slate-300" />
            <div>
              <p className="text-base font-medium text-slate-600">企業を選択してください</p>
              <p className="text-sm text-slate-400 mt-1">
                左のリストから架電する企業を選択すると、コール入力フォームが表示されます
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
            {/* ヘッダ */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedCompany.company_name}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">{selectedCompany.phone}</p>
              </div>
              <ZoomCallButton
                companyId={selectedCompany.id}
                phoneNumber={selectedCompany.phone}
                onCallStarted={handleCallStarted}
                onCallEnded={handleCallEnded}
              />
            </div>

            {/* AI 候補パネル (sticky top-4) */}
            <AICandidatesPanel
              suggestions={output?.suggestions ?? []}
              isLoading={isLoading}
              isFailed={isFailed}
              isTimedOut={isTimedOut}
              elapsedSec={elapsed_sec}
              activityId={activityId}
              onConfirm={handleAIConfirm}
            />

            {/* コール入力フォーム */}
            <CallEntryForm
              key={formKey.current}
              companyId={selectedCompany.id}
              listId={undefined}
              appointerUserId={appointerUserId}
              zoomCallId={zoomCallId}
              aiSuggestion={confirmedSuggestion}
              onSubmit={handleFormSubmit}
            />
          </div>
        )}
      </main>
    </div>
  )
}
