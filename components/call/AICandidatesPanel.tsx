/**
 * AI コール結果候補パネル — 確度%バー付き最大3件、ホットキー 1/2/3 で1クリック確定
 */
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, CheckCircle2, AlertCircle, Keyboard } from 'lucide-react'
import type { AISuggestion } from '@/lib/validation/call-entry-schema'
import { ResultPrimaryEnum, ResultSecondaryEnum, NgReasonCodeEnum } from '@/lib/validation/call-entry-schema'

const RESULT_PRIMARY_LABELS: Record<string, string> = {
  no_answer: '無応答',
  absent: '不在',
  reception_ng: '受付NG',
  contact: 'コンタクト',
}

const RESULT_SECONDARY_LABELS: Record<string, string> = {
  appointment: 'アポ獲得',
  lead: 'アポネタ',
  recall: '再架電',
  document_send: '資料送付',
  ng: 'NG',
}

const NG_REASON_LABELS: Record<string, string> = {
  listing_ng: '掲載NG',
  sourcing_ng: '仕入NG',
  current_ng: '現状NG',
  other_media_ng: '他媒体NG',
  sales_ng: '営業NG',
  timing_ng: '時期NG',
  workload_ng: '工数NG',
  price_ng: '金額NG',
  homes_ng: 'HOMESNG',
  closed_business: '廃業',
  duplicate: '重複',
  other: 'その他',
}

function buildLabel(s: AISuggestion): string {
  const p = RESULT_PRIMARY_LABELS[s.result_primary] ?? s.result_primary
  if (!s.result_secondary) return p
  const sec = RESULT_SECONDARY_LABELS[s.result_secondary] ?? s.result_secondary
  if (s.ng_reason_code) {
    const ng = NG_REASON_LABELS[s.ng_reason_code] ?? s.ng_reason_code
    return `${p} → ${sec} — ${ng}`
  }
  return `${p} → ${sec}`
}

interface AICandidatesPanelProps {
  suggestions: AISuggestion[]
  isLoading: boolean
  isFailed: boolean
  isTimedOut: boolean
  elapsedSec: number
  activityId: string | null
  onConfirm: (suggestion: AISuggestion, index: number) => void
}

/** AI コール結果候補 3件表示パネル、ホットキー 1/2/3 で即時確定 */
export function AICandidatesPanel({
  suggestions,
  isLoading,
  isFailed,
  isTimedOut,
  elapsedSec,
  activityId,
  onConfirm,
}: AICandidatesPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [confirmedIndex, setConfirmedIndex] = useState<number | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // 確度 < 5% は非表示
  const visibleSuggestions = suggestions.filter((s) => s.confidence >= 0.05).slice(0, 3)

  // ホットキー 1/2/3 で候補確定
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!['1', '2', '3'].includes(e.key)) return
      const idx = parseInt(e.key, 10) - 1
      if (visibleSuggestions[idx]) {
        e.preventDefault()
        handleConfirm(idx)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visibleSuggestions])

  const handleConfirm = (index: number) => {
    const suggestion = visibleSuggestions[index]
    if (!suggestion) return
    startTransition(() => {
      setConfirmedIndex(index)
      onConfirm(suggestion, index)
    })
  }

  const handleOverride = (index: number) => {
    setOverrideIndex(index)
    setOverrideNote('')
    setOverrideOpen(true)
  }

  const handleOverrideConfirm = () => {
    if (overrideIndex === null) return
    const suggestion = visibleSuggestions[overrideIndex]
    if (!suggestion) return
    startTransition(() => {
      setConfirmedIndex(overrideIndex)
      onConfirm({ ...suggestion, reason: overrideNote || suggestion.reason }, overrideIndex)
    })
    setOverrideOpen(false)
  }

  if (isTimedOut || isFailed) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            AI 候補の生成に失敗しました。手動入力に切り替えます。
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Bot className="h-4 w-4" />
            AI 候補を生成中... ({elapsedSec}秒 / 最大60秒)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={(elapsedSec / 60) * 100} className="h-1.5" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (visibleSuggestions.length === 0) {
    return null
  }

  return (
    <>
      <Card
        ref={containerRef}
        className="sticky top-4 border-blue-200 bg-blue-50/50 shadow-sm"
        aria-label="AI コール結果候補"
        aria-live="polite"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-blue-800">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI 候補 (通話完了)
            </span>
            <span className="flex items-center gap-1 text-xs text-blue-600 font-normal">
              <Keyboard className="h-3 w-3" />
              キー 1/2/3 で確定
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleSuggestions.map((s, i) => {
            const pct = Math.round(s.confidence * 100)
            const isConfirmed = confirmedIndex === i
            return (
              <div
                key={i}
                className={[
                  'rounded-lg border p-3 transition-all',
                  isConfirmed
                    ? 'border-green-400 bg-green-50'
                    : 'border-blue-200 bg-white hover:border-blue-400',
                ].join(' ')}
                aria-keyshortcuts={String(i + 1)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className="shrink-0 text-xs font-bold border-blue-300 text-blue-700"
                    >
                      {i + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate">{buildLabel(s)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
                    {isConfirmed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-3 text-xs"
                          onClick={() => handleConfirm(i)}
                          disabled={isPending || confirmedIndex !== null}
                          aria-label={`候補${i + 1}を確定`}
                        >
                          確定
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOverride(i)}
                          disabled={isPending || confirmedIndex !== null}
                          aria-label={`候補${i + 1}を修正して確定`}
                        >
                          修正
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <Progress
                    value={pct}
                    className={['h-1 w-full', i === 0 ? 'text-blue-500' : 'text-blue-300'].join(' ')}
                  />
                </div>
                {s.reason && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{s.reason}</p>
                )}
              </div>
            )
          })}
          <div className="pt-1 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 h-7"
              onClick={() => {
                setConfirmedIndex(null)
              }}
            >
              手動入力に切替 (Esc)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Override モーダル */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>候補を修正して確定</DialogTitle>
          </DialogHeader>
          {overrideIndex !== null && visibleSuggestions[overrideIndex] && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                AI 候補: <strong>{buildLabel(visibleSuggestions[overrideIndex])}</strong>
              </p>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">修正メモ (任意)</label>
                <textarea
                  className="w-full rounded-md border border-slate-200 text-sm p-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="修正理由や補足を入力..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleOverrideConfirm} disabled={isPending}>
              修正して確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
