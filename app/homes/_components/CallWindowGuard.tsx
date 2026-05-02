'use client'

import { useEffect, useState } from 'react'
import { getSetting } from '@/lib/homes/api'

interface Props {
  children: React.ReactNode
}

interface CallWindow {
  start: string
  end: string
  first_call_at: string
}

const DEFAULT_WINDOW: CallWindow = {
  start: '09:30',
  end: '18:30',
  first_call_at: '09:55',
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function nowHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function CallWindowGuard({ children }: Props) {
  const [window, setWindow] = useState<CallWindow>(DEFAULT_WINDOW)
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    let active = true
    getSetting<CallWindow>('call_window')
      .then((v) => {
        if (active && v) setWindow({ ...DEFAULT_WINDOW, ...v })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const nowStr = nowHHMM(now)
  const nowMin = toMinutes(nowStr)
  const startMin = toMinutes(window.start)
  const endMin = toMinutes(window.end)
  const firstMin = toMinutes(window.first_call_at)

  const beforeFirst = nowMin < firstMin
  const afterEnd = nowMin > endMin
  const blocked = beforeFirst || afterEnd

  let message = ''
  let sub = ''
  if (beforeFirst) {
    const diff = firstMin - nowMin
    message = `コール開始時刻まであと ${diff} 分`
    sub = `初回架電可能: ${window.first_call_at} / 営業時間 ${window.start}〜${window.end}`
  } else if (afterEnd) {
    message = '営業時間外です'
    sub = `営業時間 ${window.start} 〜 ${window.end}`
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ pointerEvents: blocked ? 'none' : 'auto', opacity: blocked ? 0.4 : 1 }}>
        {children}
      </div>
      {blocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div
            className="ink-card"
            style={{
              background: 'var(--bg-tint)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: 28,
              minWidth: 320,
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              現在 {nowStr}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{message}</div>
            <div className="caption muted">{sub}</div>
            <div className="caption muted" style={{ marginTop: 12 }}>
              コール開始は {window.first_call_at} から
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CallWindowGuard
