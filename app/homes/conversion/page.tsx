'use client'

import { useEffect, useMemo, useState } from 'react'
import { listUsers } from '@/lib/homes/api'
import { createClient } from '@/lib/supabase/client'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'
import type { HomesUser } from '@/lib/homes/types'

/**
 * M-08: アポ→受注コンバージョン表
 * アポインター×クローザーのファネル可視化
 * call → contact → appointment → deal → meeting_won → order
 */

interface FunnelRow {
  user_id: string
  user_name: string
  role: string
  calls: number
  contacts: number
  appointments: number
  meetings: number
  won: number
  orders: number
  call_to_contact: number
  contact_to_appt: number
  appt_to_meeting: number
  meeting_to_won: number
  call_to_order: number
}

const cols: ExcelCol<FunnelRow>[] = [
  { key: 'user_name', label: 'ユーザー', width: 140, sticky: true, value: (r) => r.user_name },
  { key: 'role', label: 'ロール', width: 110, value: (r) => r.role },
  { key: 'calls', label: 'コール', width: 90, num: true, agg: 'sum',
    value: (r) => r.calls, render: (r) => <span className="mono">{r.calls.toLocaleString()}</span> },
  { key: 'contacts', label: 'コンタクト', width: 100, num: true, agg: 'sum',
    value: (r) => r.contacts, render: (r) => <span className="mono">{r.contacts.toLocaleString()}</span> },
  { key: 'appointments', label: 'アポ', width: 90, num: true, agg: 'sum',
    value: (r) => r.appointments, render: (r) => <span className="mono">{r.appointments.toLocaleString()}</span> },
  { key: 'meetings', label: '商談', width: 90, num: true, agg: 'sum',
    value: (r) => r.meetings, render: (r) => <span className="mono">{r.meetings.toLocaleString()}</span> },
  { key: 'won', label: '受注', width: 90, num: true, agg: 'sum',
    value: (r) => r.won,
    render: (r) => <span className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>{r.won.toLocaleString()}</span> },
  { key: 'call_to_contact', label: 'C率', width: 80, num: true,
    value: (r) => r.call_to_contact, render: (r) => <span className="mono">{(r.call_to_contact * 100).toFixed(1)}%</span> },
  { key: 'contact_to_appt', label: 'A率', width: 80, num: true,
    value: (r) => r.contact_to_appt, render: (r) => <span className="mono">{(r.contact_to_appt * 100).toFixed(1)}%</span> },
  { key: 'appt_to_meeting', label: '商談化率', width: 90, num: true,
    value: (r) => r.appt_to_meeting, render: (r) => <span className="mono">{(r.appt_to_meeting * 100).toFixed(1)}%</span> },
  { key: 'meeting_to_won', label: '受注率', width: 90, num: true,
    value: (r) => r.meeting_to_won, render: (r) => <span className="mono">{(r.meeting_to_won * 100).toFixed(1)}%</span> },
  { key: 'call_to_order', label: '全体CV', width: 90, num: true,
    value: (r) => r.call_to_order, render: (r) => <span className="mono" style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>{(r.call_to_order * 100).toFixed(2)}%</span> },
]

export default function ConversionPage() {
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  // B-03 / OW-07 fix: 30 users × 5 queries を直列ループ → 全並列 Promise.all で展開
  // 30 × 5 = 150 RTT が単発の wave に収束する
  async function load() {
    setLoading(true)
    try {
      const since = `${month}-01T00:00:00+09:00`
      const supabase = createClient()
      const users = await listUsers() as unknown as HomesUser[]

      const results = await Promise.all(
        users.map(async (u) => {
          const [actRes, mtRes, ordRes] = await Promise.all([
            supabase.from('homes_activities').select('result_primary, result_secondary').eq('user_id', u.id).gte('call_started_at', since),
            supabase.from('homes_meetings').select('id, yomi').eq('closer_user_id', u.id).gte('created_at', since),
            supabase.from('homes_orders').select('id').eq('closer_user_id', u.id).gte('ordered_at', since),
          ])
          const acts = actRes.data ?? []
          const calls = acts.length
          const contacts = acts.filter((a: any) => a.result_primary === 'contact').length
          const appointments = acts.filter((a: any) => a.result_secondary === 'appointment').length
          const isCloser = u.role === 'CLOSER'
          const meetings = (mtRes.data ?? []).length
          const won = isCloser ? (mtRes.data ?? []).filter((m: any) => m.yomi === 'won').length : 0
          const orders = (ordRes.data ?? []).length
          return {
            user_id: u.id,
            user_name: u.name,
            role: u.role,
            calls,
            contacts,
            appointments,
            meetings,
            won,
            orders,
            call_to_contact: calls ? contacts / calls : 0,
            contact_to_appt: contacts ? appointments / contacts : 0,
            appt_to_meeting: appointments ? meetings / appointments : 0,
            meeting_to_won: meetings ? won / meetings : 0,
            call_to_order: calls ? orders / calls : 0,
          } satisfies FunnelRow
        })
      )

      results.sort((a, b) => b.orders - a.orders)
      setRows(results)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [month])

  const totals = useMemo(() => rows.reduce((a, r) => ({
    calls: a.calls + r.calls,
    contacts: a.contacts + r.contacts,
    appts: a.appts + r.appointments,
    meetings: a.meetings + r.meetings,
    won: a.won + r.won,
    orders: a.orders + r.orders,
  }), { calls: 0, contacts: 0, appts: 0, meetings: 0, won: 0, orders: 0 }), [rows])

  const stages = [
    { label: 'コール', count: totals.calls, color: 'rgba(88,86,214,0.85)' },
    { label: 'コンタクト', count: totals.contacts, color: 'rgba(48,176,199,0.85)' },
    { label: 'アポ獲得', count: totals.appts, color: 'rgba(52,199,89,0.85)' },
    { label: '商談実施', count: totals.meetings, color: 'rgba(255,159,10,0.85)' },
    { label: '受注確定', count: totals.orders, color: 'rgba(191,90,242,0.85)' },
  ]
  const max = Math.max(1, ...stages.map((s) => s.count))

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>アポ→受注コンバージョン</h1>
          <p className="caption muted">M-08 / ファネル分析 / アポインター×クローザー個人別歩留</p>
        </div>
        <input type="month" className="ink-input mono" value={month} onChange={(e) => setMonth(e.target.value)} />
      </header>

      {/* Funnel visualization */}
      <section className="ink-card">
        <h3 style={{ marginTop: 0 }}>全体ファネル</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
          {stages.map((s, i) => {
            const prev = i === 0 ? max : stages[i - 1].count
            const dropPct = prev ? (s.count / prev) * 100 : 0
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 100, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                <div style={{ flex: 1, background: 'rgba(142,142,147,0.10)', borderRadius: 8, height: 32, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: s.color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12, color: 'white', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {s.count.toLocaleString()}
                  </div>
                </div>
                <span className="mono" style={{ width: 60, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                  {i === 0 ? '基準' : `${dropPct.toFixed(1)}%`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <ExcelTable
        rows={rows}
        cols={cols}
        rowKey={(r) => r.user_id}
        loading={loading}
        empty="ユーザーなし"
        filename={`コンバージョン_${month}`}
      />
    </div>
  )
}
