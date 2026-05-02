'use client'

import { useEffect, useMemo, useState } from 'react'
import { listTeams, listUsers, getTeamStats } from '@/lib/homes/api'
import { createClient } from '@/lib/supabase/client'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'
import type { HomesTeam, HomesUser, TeamStat } from '@/lib/homes/types'

/**
 * M-06: チーム実績比較
 * チーム間ランキング・進捗対比
 */

interface TeamRow {
  team_id: string
  team_name: string
  members: number
  calls_today: number
  contacts_today: number
  appointments_today: number
  calls_month: number
  contacts_month: number
  appointments_month: number
  orders_month: number
  contact_rate: number
  appointment_rate: number
  rank: number
}

const cols: ExcelCol<TeamRow>[] = [
  { key: 'rank', label: '順位', width: 70, num: true, sticky: true,
    value: (r) => r.rank,
    render: (r) => <span className="mono" style={{ fontWeight: 700, color: r.rank === 1 ? 'var(--warning)' : r.rank === 2 ? 'var(--ink-primary)' : 'var(--text-primary)' }}>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : ''} {r.rank}</span> },
  { key: 'team_name', label: 'チーム', width: 160, value: (r) => r.team_name },
  { key: 'members', label: '人数', width: 70, num: true, agg: 'sum',
    value: (r) => r.members, render: (r) => <span className="mono">{r.members}</span> },
  { key: 'calls_today', label: '本日コール', width: 100, num: true, agg: 'sum',
    value: (r) => r.calls_today, render: (r) => <span className="mono">{r.calls_today.toLocaleString()}</span> },
  { key: 'contacts_today', label: '本日コンタ', width: 100, num: true, agg: 'sum',
    value: (r) => r.contacts_today, render: (r) => <span className="mono">{r.contacts_today.toLocaleString()}</span> },
  { key: 'appointments_today', label: '本日アポ', width: 90, num: true, agg: 'sum',
    value: (r) => r.appointments_today, render: (r) => <span className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>{r.appointments_today.toLocaleString()}</span> },
  { key: 'calls_month', label: '当月コール', width: 100, num: true, agg: 'sum',
    value: (r) => r.calls_month, render: (r) => <span className="mono">{r.calls_month.toLocaleString()}</span> },
  { key: 'contacts_month', label: '当月コンタ', width: 100, num: true, agg: 'sum',
    value: (r) => r.contacts_month, render: (r) => <span className="mono">{r.contacts_month.toLocaleString()}</span> },
  { key: 'appointments_month', label: '当月アポ', width: 90, num: true, agg: 'sum',
    value: (r) => r.appointments_month, render: (r) => <span className="mono">{r.appointments_month.toLocaleString()}</span> },
  { key: 'orders_month', label: '当月受注', width: 90, num: true, agg: 'sum',
    value: (r) => r.orders_month, render: (r) => <span className="mono" style={{ fontWeight: 700, color: 'var(--warning)' }}>{r.orders_month.toLocaleString()}</span> },
  { key: 'contact_rate', label: 'コンタ率', width: 80, num: true,
    value: (r) => r.contact_rate, render: (r) => <span className="mono">{(r.contact_rate * 100).toFixed(1)}%</span> },
  { key: 'appointment_rate', label: 'アポ率', width: 80, num: true,
    value: (r) => r.appointment_rate, render: (r) => <span className="mono">{(r.appointment_rate * 100).toFixed(1)}%</span> },
]

export default function TeamStatsPage() {
  const [rows, setRows] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [teams, users] = await Promise.all([listTeams(), listUsers()])
      const teamMembers = new Map<string, HomesUser[]>()
      for (const u of users as unknown as HomesUser[]) {
        if (!u.team_id) continue
        const arr = teamMembers.get(u.team_id) ?? []
        arr.push(u)
        teamMembers.set(u.team_id, arr)
      }
      const supabase = createClient()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const result: TeamRow[] = []
      for (const t of teams) {
        const members = teamMembers.get(t.id) ?? []
        const userIds = members.map((m) => m.id)
        if (userIds.length === 0) {
          result.push({ team_id: t.id, team_name: t.name, members: 0, calls_today: 0, contacts_today: 0, appointments_today: 0, calls_month: 0, contacts_month: 0, appointments_month: 0, orders_month: 0, contact_rate: 0, appointment_rate: 0, rank: 0 })
          continue
        }
        const [actMonthRes, ordMonthRes] = await Promise.all([
          supabase.from('homes_activities').select('call_started_at, result_primary, result_secondary').in('user_id', userIds).gte('call_started_at', monthStart.toISOString()),
          supabase.from('homes_orders').select('ordered_at').in('closer_user_id', userIds).gte('ordered_at', monthStart.toISOString()),
        ])
        const actsM = actMonthRes.data ?? []
        const ordsM = ordMonthRes.data ?? []
        const actsToday = actsM.filter((a: any) => new Date(a.call_started_at) >= today)
        const calls_today = actsToday.length
        const contacts_today = actsToday.filter((a: any) => a.result_primary === 'contact').length
        const appointments_today = actsToday.filter((a: any) => a.result_secondary === 'appointment').length
        const calls_month = actsM.length
        const contacts_month = actsM.filter((a: any) => a.result_primary === 'contact').length
        const appointments_month = actsM.filter((a: any) => a.result_secondary === 'appointment').length
        result.push({
          team_id: t.id, team_name: t.name, members: members.length,
          calls_today, contacts_today, appointments_today,
          calls_month, contacts_month, appointments_month,
          orders_month: ordsM.length,
          contact_rate: calls_month ? contacts_month / calls_month : 0,
          appointment_rate: contacts_month ? appointments_month / contacts_month : 0,
          rank: 0,
        })
      }
      result.sort((a, b) => b.appointments_month - a.appointments_month)
      result.forEach((r, i) => { r.rank = i + 1 })
      setRows(result)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>チーム実績比較</h1>
          <p className="caption muted">M-06 / チーム順位・本日/当月対比 / 議事録「チーム別実績」準拠</p>
        </div>
      </header>

      <ExcelTable
        rows={rows}
        cols={cols}
        rowKey={(r) => r.team_id}
        loading={loading}
        empty="チームなし"
        filename="チーム実績比較"
      />
    </div>
  )
}
