'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { listUpcomingActionsForUser } from '@/lib/homes/api'

interface Props {
  userId: string
}

interface Toast {
  id: string
  title: string
  body: string
  activityId: string
}

interface Action {
  id: string
  company_id: string
  recall_date: string | null
  recall_time: string | null
  appointment_date: string | null
  appointment_time: string | null
  result_secondary: string | null
  // Supabase は単一 FK でも配列として返す可能性があるため両方許容
  homes_companies?: { company_name: string } | { company_name: string }[] | null
}

function getCompanyName(a: Action): string {
  const c = a.homes_companies
  if (!c) return '対象企業'
  if (Array.isArray(c)) return c[0]?.company_name ?? '対象企業'
  return c.company_name ?? '対象企業'
}

function getActionTime(a: Action): Date | null {
  const d = a.appointment_date || a.recall_date
  const t = a.appointment_time || a.recall_time || '00:00'
  if (!d) return null
  const dt = new Date(`${d}T${t}`)
  return isNaN(dt.getTime()) ? null : dt
}

export function NextActionToaster({ userId }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notifiedRef = useRef<Set<string>>(new Set())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (toast: Toast) => {
      setToasts((prev) => {
        const next = [...prev, toast]
        return next.slice(-3)
      })
      setTimeout(() => removeToast(toast.id), 3000)
    },
    [removeToast]
  )

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true

    const tick = async () => {
      try {
        const actions = await listUpcomingActionsForUser(userId)
        if (!active) return
        const now = new Date()
        for (const a of actions as unknown as Action[]) {
          if (notifiedRef.current.has(a.id)) continue
          const at = getActionTime(a)
          if (!at) continue
          const diffMin = (at.getTime() - now.getTime()) / 60000
          if (diffMin <= 5 && diffMin >= 0) {
            const company = getCompanyName(a)
            const kind = a.result_secondary === 'appointment' ? 'アポ' : '次回行動'
            const title = `${kind}: ${company}`
            const body = `予定 ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')} (あと ${Math.max(0, Math.round(diffMin))} 分)`

            try {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(title, { body })
              }
            } catch {}

            pushToast({
              id: `${a.id}-${Date.now()}`,
              title,
              body,
              activityId: a.id,
            })
            notifiedRef.current.add(a.id)
          }
        }
      } catch {
        // silent
      }
    }

    tick()
    const id = setInterval(tick, 30_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [userId, pushToast])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="ink-card"
          style={{
            background: '#fff',
            borderLeft: '4px solid var(--warning)',
            padding: 14,
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div className="between" style={{ marginBottom: 4 }}>
            <strong style={{ fontSize: 13 }}>{t.title}</strong>
            <button
              className="ink-btn xs"
              onClick={() => removeToast(t.id)}
              style={{ marginLeft: 8 }}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          <div className="caption muted">{t.body}</div>
        </div>
      ))}
    </div>
  )
}

export default NextActionToaster
