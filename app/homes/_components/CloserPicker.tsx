'use client'

import { useEffect, useState } from 'react'
import { getCloserAvailability } from '@/lib/homes/api'
import type { HomesUser } from '@/lib/homes/types'

interface Props {
  date: string
  onPick: (closerId: string) => void
  selectedId?: string
}

interface Row {
  closer: HomesUser
  booked_count: number
  booked_slots: string[]
}

export function CloserPicker({ date, onPick, selectedId }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date) return
    let active = true
    setLoading(true)
    setError(null)
    getCloserAvailability(date)
      .then((data) => {
        if (!active) return
        const sorted = [...data].sort((a, b) => a.booked_count - b.booked_count)
        setRows(sorted)
      })
      .catch((e) => {
        if (active) setError((e as Error).message ?? '読み込みに失敗しました')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [date])

  const badgeClass = (n: number): string => {
    if (n === 0) return 'ink-badge ink-badge-ok'
    if (n <= 2) return 'ink-badge ink-badge-warn'
    return 'ink-badge ink-badge-ng'
  }

  return (
    <div className="stack">
      <div className="between">
        <strong style={{ fontSize: 14 }}>クローザー選択</strong>
        <span className="caption muted">{date}</span>
      </div>

      {loading && <div className="caption muted">読み込み中...</div>}
      {error && (
        <div className="caption" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div
        style={{
          maxHeight: 360,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingRight: 4,
        }}
      >
        {rows.length === 0 && !loading && (
          <div className="caption muted">候補のクローザーがいません</div>
        )}
        {rows.map((r) => {
          const isSelected = selectedId === r.closer.id
          return (
            <div
              key={r.closer.id}
              role="button"
              tabIndex={0}
              onClick={() => onPick(r.closer.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPick(r.closer.id)
              }}
              className="ink-card"
              style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: isSelected ? 'var(--bg-tint)' : '#fff',
                padding: 12,
                transition: 'all 0.15s',
              }}
            >
              <div className="between" style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{r.closer.name}</strong>
                <span className={badgeClass(r.booked_count)}>{r.booked_count} 件</span>
              </div>
              {r.booked_slots.length > 0 && (
                <div
                  className="caption muted mono"
                  style={{ fontFamily: 'var(--font-mono)', display: 'flex', flexWrap: 'wrap', gap: 6 }}
                >
                  {r.booked_slots.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'var(--bg-tint)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {r.booked_slots.length === 0 && (
                <div className="caption muted">予約なし</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CloserPicker
