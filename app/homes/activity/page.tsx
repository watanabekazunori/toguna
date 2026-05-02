'use client'

import { useEffect, useMemo, useState } from 'react'
import { listUsers } from '@/lib/homes/api'
import { createClient } from '@/lib/supabase/client'
import type { HomesUser } from '@/lib/homes/types'
import { HourlyActivityPivot } from '../_components/HourlyActivityPivot'

/**
 * G-12: 行動管理表 (時間軸 × メンバー)
 * 議事録 00:24:11 — 誰がいつ何の結果だったかを時間ごとに俯瞰
 * activity-timeline-feed パターン: homes_events / homes_v_activity_timeline ビュー
 */

interface ActivityRow {
  id: string
  actor_id: string
  actor_name: string | null
  parent_type: string
  parent_id: string
  type: string
  outcome: string | null
  title: string
  created_at: string
  hour_jst: number
}

interface PivotRow {
  user_id: string
  user_name: string
  call_started_at: string
  result_primary: string
  result_secondary: string | null
}

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

const TYPE_ICON: Record<string, string> = {
  call: '☎',
  appointment: '◎',
  meeting: '▣',
  order: '✦',
  audit: '✓',
  note: '✎',
}

const OUTCOME_COLOR: Record<string, string> = {
  appointed: 'rgba(52,199,89,0.18)',
  connected: 'rgba(48,176,199,0.16)',
  unanswered: 'rgba(142,142,147,0.14)',
  rejected: 'rgba(255,59,48,0.16)',
  won: 'rgba(255,159,10,0.20)',
}

export default function ActivityPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [users, setUsers] = useState<HomesUser[]>([])
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [pivotRows, setPivotRows] = useState<PivotRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ActivityRow | null>(null)
  const [view, setView] = useState<'timeline' | 'pivot'>('timeline')

  useEffect(() => {
    void listUsers().then((u) => setUsers(u as unknown as HomesUser[]))
  }, [])

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const start = `${date}T00:00:00+09:00`
      const end = `${date}T23:59:59+09:00`

      // 1) timeline view (events: call/appt/meeting/order/audit/note)
      const tlPromise = supabase
        .from('homes_v_activity_timeline')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })

      // 2) raw activities for pivot (calls / アポ / NG aggregates)
      const acPromise = supabase
        .from('homes_activities')
        .select('user_id, call_started_at, result_primary, result_secondary, homes_users!inner(name)')
        .gte('call_started_at', start)
        .lte('call_started_at', end)
        .order('call_started_at', { ascending: true })

      const [tl, ac] = await Promise.all([tlPromise, acPromise])

      if (tl.error) {
        console.warn('activity view not available yet:', tl.error.message)
        setRows([])
      } else {
        setRows((tl.data ?? []) as unknown as ActivityRow[])
      }

      if (ac.error) {
        console.warn('homes_activities not available yet:', ac.error.message)
        setPivotRows([])
      } else {
        const mapped: PivotRow[] = (ac.data ?? []).map((a: Record<string, unknown>) => {
          const u = a.homes_users as { name?: string } | { name?: string }[] | null
          const name = Array.isArray(u) ? (u[0]?.name ?? '-') : (u?.name ?? '-')
          return {
            user_id: String(a.user_id ?? ''),
            user_name: name,
            call_started_at: String(a.call_started_at ?? ''),
            result_primary: String(a.result_primary ?? ''),
            result_secondary: (a.result_secondary as string | null) ?? null,
          }
        })
        setPivotRows(mapped)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [date])

  /** Map<userId, Map<hour, ActivityRow[]>> */
  const grid = useMemo(() => {
    const m = new Map<string, Map<number, ActivityRow[]>>()
    for (const r of rows) {
      const inner = m.get(r.actor_id) ?? new Map()
      const arr = inner.get(r.hour_jst) ?? []
      arr.push(r)
      inner.set(r.hour_jst, arr)
      m.set(r.actor_id, inner)
    }
    return m
  }, [rows])

  const userTotals = useMemo(() => {
    const t = new Map<string, { call: number; appt: number; total: number }>()
    for (const r of rows) {
      const cur = t.get(r.actor_id) ?? { call: 0, appt: 0, total: 0 }
      cur.total++
      if (r.type === 'call') cur.call++
      if (r.type === 'appointment' || r.outcome === 'appointed') cur.appt++
      t.set(r.actor_id, cur)
    }
    return t
  }, [rows])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>行動管理表</h1>
          <p className="caption muted">S-08 / 時間軸 × メンバー / 議事録 G-12 準拠</p>
        </div>
        <div className="row-tight">
          <button
            className={`ink-btn xs ${view === 'timeline' ? 'primary' : ''}`}
            onClick={() => setView('timeline')}
          >イベント時間軸</button>
          <button
            className={`ink-btn xs ${view === 'pivot' ? 'primary' : ''}`}
            onClick={() => setView('pivot')}
          >コール集計 (時間×人)</button>
          <input
            type="date"
            className="ink-input mono"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </header>

      {view === 'pivot' && (
        <section className="ink-card" style={{ padding: 16 }}>
          {loading ? (
            <p className="caption muted">読込中...</p>
          ) : (
            <HourlyActivityPivot rows={pivotRows} date={date} />
          )}
        </section>
      )}

      {view === 'timeline' && (
      <section className="excel-wrap">
        <div className="excel-toolbar">
          <span className="excel-count">{rows.length.toLocaleString()} 件</span>
          <span className="caption muted">{date}</span>
          <span style={{ flex: 1 }} />
          <span className="caption muted">
            ☎=コール ◎=アポ ▣=商談 ✦=受注 ✓=審査 ✎=メモ
          </span>
        </div>
        <div className="excel-scroll">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-rownum">#</th>
                <th className="col-sticky-1" style={{ minWidth: 160 }}>担当</th>
                {HOURS.map((h) => (
                  <th key={h} style={{ minWidth: 110, textAlign: 'center' }}>
                    {String(h).padStart(2, '0')}:00
                  </th>
                ))}
                <th className="num" style={{ minWidth: 70 }}>コール</th>
                <th className="num" style={{ minWidth: 70 }}>アポ</th>
                <th className="num" style={{ minWidth: 70 }}>合計</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={HOURS.length + 5} className="excel-empty">読込中...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={HOURS.length + 5} className="excel-empty">ユーザーなし</td></tr>
              ) : users.map((u, idx) => {
                const inner = grid.get(u.id) ?? new Map()
                const tot = userTotals.get(u.id) ?? { call: 0, appt: 0, total: 0 }
                return (
                  <tr key={u.id}>
                    <td className="col-rownum">{idx + 1}</td>
                    <td className="col-sticky-1">{u.name}</td>
                    {HOURS.map((h) => {
                      const events = (inner.get(h) ?? []) as ActivityRow[]
                      return (
                        <td key={h} style={{ padding: 4, verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {events.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => setSelected(e)}
                                title={`${e.title}${e.outcome ? ` / ${e.outcome}` : ''}`}
                                style={{
                                  background: e.outcome ? (OUTCOME_COLOR[e.outcome] ?? 'rgba(88,86,214,0.10)') : 'rgba(88,86,214,0.10)',
                                  border: 'none',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontSize: 11,
                                  fontFamily: 'var(--font-mono)',
                                  cursor: 'pointer',
                                  color: 'var(--text-primary)',
                                  fontWeight: 600,
                                }}
                              >
                                {TYPE_ICON[e.type] ?? '•'}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                    <td className="num">{tot.call.toLocaleString()}</td>
                    <td className="num">{tot.appt.toLocaleString()}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{tot.total.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-rownum">∑</td>
                <td className="col-sticky-1">合計</td>
                {HOURS.map((h) => {
                  const c = rows.filter((r) => r.hour_jst === h).length
                  return <td key={h} className="num">{c.toLocaleString()}</td>
                })}
                <td className="num">{rows.filter((r) => r.type === 'call').length.toLocaleString()}</td>
                <td className="num">{rows.filter((r) => r.type === 'appointment' || r.outcome === 'appointed').length.toLocaleString()}</td>
                <td className="num">{rows.length.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      )}

      {selected && (
        <div className="ink-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="ink-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <header className="between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{TYPE_ICON[selected.type] ?? '•'} {selected.title}</h3>
              <button className="ink-btn" aria-label="閉じる" onClick={() => setSelected(null)}>×</button>
            </header>
            <p className="caption muted">{new Date(selected.created_at).toLocaleString('ja-JP')}</p>
            <p className="caption">担当: {selected.actor_name ?? '-'}</p>
            <p className="caption">種別: {selected.type} / 結果: {selected.outcome ?? '-'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
