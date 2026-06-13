/**
 * ZoomPhone クリック発信ボタン — 通話中インジケータ、Webhook 待ち、AI候補生成完了通知
 */
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneOff, Loader2, Wifi } from 'lucide-react'

type CallState = 'idle' | 'calling' | 'connected' | 'ended' | 'error'

interface ZoomCallButtonProps {
  companyId: string
  phoneNumber: string
  /** 発信後に生成された call_id をフォーム state へ紐付けるコールバック */
  onCallStarted: (callId: string) => void
  /** 通話終了後のコールバック */
  onCallEnded?: (callId: string, durationSec: number) => void
  disabled?: boolean
}

/** ZoomPhone S2S OAuth クリック発信ボタン (Cmd+Shift+P ホットキー対応) */
export function ZoomCallButton({
  companyId,
  phoneNumber,
  onCallStarted,
  onCallEnded,
  disabled = false,
}: ZoomCallButtonProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [callId, setCallId] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCall = () => {
    if (callState !== 'idle') return
    startTransition(async () => {
      setCallState('calling')
      setErrorMsg(null)
      try {
        const res = await fetch('/api/lifull/zoom/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, phone_number: phoneNumber }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.detail ?? `発信失敗 (ZOOM-${res.status})`)
        }
        const data = await res.json()
        const newCallId: string = data.call_id
        setCallId(newCallId)
        setCallState('connected')
        setConnectedAt(new Date())
        onCallStarted(newCallId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '発信に失敗しました'
        setErrorMsg(msg)
        setCallState('error')
      }
    })
  }

  const handleEndCall = () => {
    if (!callId) return
    startTransition(async () => {
      try {
        await fetch(`/api/lifull/zoom/call/${callId}/end`, { method: 'POST' })
      } catch {
        // ベストエフォート
      }
      const durationSec = connectedAt
        ? Math.floor((Date.now() - connectedAt.getTime()) / 1000)
        : 0
      setCallState('ended')
      onCallEnded?.(callId, durationSec)
    })
  }

  const formatDuration = () => {
    if (!connectedAt) return ''
    const sec = Math.floor((Date.now() - connectedAt.getTime()) / 1000)
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-3">
      {callState === 'idle' && (
        <Button
          type="button"
          variant="default"
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleCall}
          disabled={disabled || isPending}
          aria-keyshortcuts="Meta+Shift+P"
          aria-label="ZoomPhoneで発信 (Cmd+Shift+P)"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          発信する
          <span className="text-xs opacity-70 hidden md:inline">⌘⇧P</span>
        </Button>
      )}

      {callState === 'calling' && (
        <Button type="button" variant="outline" disabled className="gap-2 border-green-300">
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
          発信中...
        </Button>
      )}

      {callState === 'connected' && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-green-500 text-green-700 gap-1.5 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            通話中 {formatDuration()}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Wifi className="h-3 w-3" />
            Webhook 待機中
          </Badge>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handleEndCall}
            disabled={isPending}
            aria-label="通話終了"
          >
            <PhoneOff className="h-4 w-4" />
            終了
          </Button>
        </div>
      )}

      {callState === 'ended' && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Wifi className="h-3 w-3 animate-pulse text-blue-500" />
            AI 候補生成中...
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCallState('idle')}
            className="text-xs"
          >
            再発信
          </Button>
        </div>
      )}

      {callState === 'error' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-red-600">{errorMsg ?? '発信エラー'}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-red-300 text-red-600"
            onClick={() => setCallState('idle')}
          >
            <Phone className="h-3.5 w-3.5" />
            再試行
          </Button>
        </div>
      )}

      {callId && (
        <span className="text-xs text-slate-400 hidden md:inline" aria-hidden="true">
          call_id: {callId.slice(0, 8)}…
        </span>
      )}
    </div>
  )
}
