'use client'

import { useEffect, useMemo, useState } from 'react'
import { listUsers } from '@/lib/homes/api'
import { createClient } from '@/lib/supabase/client'
import type { HomesUser } from '@/lib/homes/types'

/**
 * M-01: 個人実績ダッシュボード
 * 議事録「個人別分析ダッシュボード — 過去半年のデータ・数字推移を一目で」
 * activity-timeline-feed + analytics-charts-builder パターン
 */

interface MonthBucket {
  ym: string                  // 2026-04
  calls: number
  contacts: number
  appointments: number
  orders: number
  contact_rate: number
  appointment_rate: number
}

const MONTHS_BACK = 6

function lastNMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d)
    dd.setMonth(d.getMonth() - i)
    out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function PersonalPage() {
  const [users, setUsers] = useState<HomesUser[]>([])
  const [userId, setUserId] = useState<string>('')
  const [buckets, setBuckets] = useState<MonthBucket[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void listUsers().then((u) => {
      setUsers(u as unknown as HomesUser[])
      if (u.length && !userId) setUserId((u[0] as unknown as HomesUser).id)
    })
  }, [])

  async function load() {
    if (!userId) return
    setLoading(true)
    try {
      const months = lastNMonths(MONTHS_BACK)
      const start = new Date(`${months[0]}-01T00:00:00+09:00`).toISOString()
      const supabase = createClient()
      const [actsRes, ordersRes] = await Promise.all([
        supabase.from('homes_activities').select('call_started_at, result_primary, result_secondary')
          .eq('user_id', userId).gte('call_started_at', start),
        supabase.from('homes_orders').select('ordered_at, monthly_fee, initial_fee')
          .eq('closer_user_id', userId).gte('ordered_at', start),
      ])
      const acts = actsRes.data ?? []
      const ords = ordersRes.data ?? []
      const map = new Map<string, MonthBucket>(months.map((ym) => [ym, {
        ym, calls: 0, contacts: 0, appointments: 0, orders: 0, contact_rate: 0, appointment_rate: 0,
      }]))
      for (const a of acts) {
        const ym = (a as any).call_started_at?.slice(0, 7)
        const b = map.get(ym); if (!b) continue
        b.calls++
        if ((a as any).result_primary === 'contact') b.contacts++
        if ((a as any).result_secondary === 'appointment') b.appointments++
      }
      for (const o of ords) {
        const ym = (o as any).ordered_at?.slice(0, 7)
        const b = map.get(ym); if (!b) continue
        b.orders++
      }
      for (const b of map.values()) {
        b.contact_rate = b.calls ? (b.contacts / b.calls) * 100 : 0
        b.appointment_rate = b.contacts ? (b.appointments / b.contacts) * 100 : 0
      }
      setBuckets(Array.from(map.values()))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [userId])

  const total = useMemo(() => buckets.reduce((acc, b) => ({
    calls: acc.calls + b.calls,
    contacts: acc.contacts + b.contacts,
    appointments: acc.appointments + b.appointments,
    orders: acc.orders + b.orders,
  }), { calls: 0, contacts: 0, appointments: 0, orders: 0 }), [buckets])

  const maxCalls = Math.max(1, ...buckets.map((b) => b.calls))
  const selectedUser = users.find((u) => u.id === userId)

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>個人実績ダッシュボード</h1>
          <p className="caption muted">M-01 / 過去{MONTHS_BACK}ヶ月の数字推移 / 議事録「個人別分析」準拠</p>
        </div>
        <select className="ink-input mono" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ minWidth: 200 }}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
      </header>

      {/* KPI tiles */}
      <section className="grid-cards-4">
        {[
          { label: '累計コール', value: total.calls, sub: `${MONTHS_BACK}ヶ月計` },
          { label: '累計コンタクト', value: total.contacts, sub: `率 ${total.calls ? ((total.contacts / total.calls) * 100).toFixed(1) : 0}%` },
          { label: '累計アポ獲得', value: total.appointments, sub: `率 ${total.contacts ? ((total.appointments / total.contacts) * 100).toFixed(1) : 0}%` },
          { label: '累計受注', value: total.orders, sub: `率 ${total.appointments ? ((total.orders / total.appointments) * 100).toFixed(1) : 0}%` },
        ].map((k) => (
          <article key={k.label} className="ink-card">
            <p className="caption muted" style={{ marginBottom: 4 }}>{k.label}</p>
            <p style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{k.value.toLocaleString()}</p>
            <p className="caption muted" style={{ marginTop: 4 }}>{k.sub}</p>
          </article>
        ))}
      </section>

      {/* Bar chart (CSS-only) */}
      <section className="ink-card">
        <h3 style={{ marginTop: 0 }}>月次推移 — {selectedUser?.name ?? '-'}</h3>
        {loading ? <p className="caption muted">読込中...</p> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180, padding: '12px 4px', borderBottom: '1px solid var(--border-light)' }}>
            {buckets.map((b) => (
              <div key={b.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: 130, gap: 2 }}>
                  <div title={`コール ${b.calls}`} style={{ width: 14, height: `${(b.calls / maxCalls) * 100}%`, background: 'rgba(88,86,214,0.65)', borderRadius: '4px 4px 0 0' }} />
                  <div title={`コンタクト ${b.contacts}`} style={{ width: 14, height: `${(b.contacts / maxCalls) * 100}%`, background: 'rgba(48,176,199,0.85)', borderRadius: '4px 4px 0 0' }} />
                  <div title={`アポ ${b.appointments}`} style={{ width: 14, height: `${(b.appointments / maxCalls) * 100}%`, background: 'rgba(52,199,89,0.85)', borderRadius: '4px 4px 0 0' }} />
                </div>
                <span className="caption muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{b.ym}</span>
                <span className="caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{b.calls}/{b.contacts}/{b.appointments}</span>
              </div>
            ))}
          </div>
        )}
        <p className="caption muted" style={{ marginTop: 8 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(88,86,214,0.65)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />コール
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(48,176,199,0.85)', borderRadius: 2, marginLeft: 12, marginRight: 4, verticalAlign: 'middle' }} />コンタクト
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(52,199,89,0.85)', borderRadius: 2, marginLeft: 12, marginRight: 4, verticalAlign: 'middle' }} />アポ獲得
        </p>
      </section>

      {/* Detail Excel */}
      <section className="excel-wrap">
        <div className="excel-toolbar">
          <span className="excel-count">月次内訳</span>
          <span style={{ flex: 1 }} />
          <span className="caption muted">N=コール / C=コンタクト / A=アポ / O=受注</span>
        </div>
        <div className="excel-scroll">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-rownum">#</th>
                <th className="col-sticky-1">月</th>
                <th className="num">N コール</th>
                <th className="num">C コンタクト</th>
                <th className="num">A アポ</th>
                <th className="num">O 受注</th>
                <th className="num">C率</th>
                <th className="num">A率</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={b.ym}>
                  <td className="col-rownum">{i + 1}</td>
                  <td className="col-sticky-1 mono">{b.ym}</td>
                  <td className="num mono">{b.calls.toLocaleString()}</td>
                  <td className="num mono">{b.contacts.toLocaleString()}</td>
                  <td className="num mono">{b.appointments.toLocaleString()}</td>
                  <td className="num mono">{b.orders.toLocaleString()}</td>
                  <td className="num mono">{b.contact_rate.toFixed(1)}%</td>
                  <td className="num mono">{b.appointment_rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-rownum">∑</td>
                <td className="col-sticky-1">合計</td>
                <td className="num mono">{total.calls.toLocaleString()}</td>
                <td className="num mono">{total.contacts.toLocaleString()}</td>
                <td className="num mono">{total.appointments.toLocaleString()}</td>
                <td className="num mono">{total.orders.toLocaleString()}</td>
                <td className="num mono">{total.calls ? ((total.contacts / total.calls) * 100).toFixed(1) : 0}%</td>
                <td className="num mono">{total.contacts ? ((total.appointments / total.contacts) * 100).toFixed(1) : 0}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
