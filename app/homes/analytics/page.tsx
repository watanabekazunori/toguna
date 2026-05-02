'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getKuruStats,
  getTodayPersonal,
  getYomiForecast,
  getTeamStats,
  listUsers,
  listOrders,
  listDeals,
} from '@/lib/homes/api'
import {
  YOMI_LABEL,
  YOMI_RATE,
  type Yomi,
  type KuruStat,
  type TodayPersonal,
  type YomiForecast,
  type TeamStat,
  type HomesUser,
  type DealStatus,
} from '@/lib/homes/types'

type Tab = 'today' | 'kuru' | 'yomi' | 'team' | 'personal' | 'pipeline' | 'orders'
const TABS: Array<{ key: Tab; label: string; section: string }> = [
  { key: 'today', label: 'サマリー', section: '本日' },
  { key: 'kuru', label: '9コマ × メンバー', section: 'クル数' },
  { key: 'yomi', label: 'ヨミ予測', section: '受注確度' },
  { key: 'team', label: 'チーム実績', section: '部門別' },
  { key: 'personal', label: '個人別', section: '本日' },
  { key: 'pipeline', label: 'パイプライン', section: '案件状態' },
  { key: 'orders', label: '受注実績', section: '月次' },
]

const KURU_LABELS = ['9-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17', '17-18']
const YOMI_ORDER: Yomi[] = ['won', 'A_circle', 'A', 'B_circle', 'B', 'C', 'D', 'lost']
const STATUS_ORDER: DealStatus[] = ['meeting_scheduled', 'rescheduled', 'c_yomi_following', 'won', 'lost', 'disappeared']
const STATUS_LABEL: Record<DealStatus, string> = {
  meeting_scheduled: '商談化',
  rescheduled: 'リスケ',
  disappeared: '消滅',
  lost: '失注',
  won: '受注',
  c_yomi_following: 'Cヨミ追客',
}

interface PipelineDeal {
  id: string
  status: DealStatus
  latest_yomi: Yomi | null
  appointer_user_id: string | null
  closer_user_id: string | null
  appointer: { name: string } | null
  closer: { name: string } | null
}
interface OrderRow {
  id: string
  ordered_at: string
  initial_fee: number | null
  monthly_fee: number | null
  closer_user_id: string | null
  homes_companies: { company_name: string } | null
}

function csvDownload(name: string, headers: string[], rows: (string | number | null)[][]) {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [kuru, setKuru] = useState<KuruStat[]>([])
  const [today, setToday] = useState<TodayPersonal[]>([])
  const [yomi, setYomi] = useState<YomiForecast[]>([])
  const [team, setTeam] = useState<TeamStat[]>([])
  const [users, setUsers] = useState<HomesUser[]>([])
  const [pipeline, setPipeline] = useState<PipelineDeal[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [k, t, y, tm, u] = await Promise.all([
        getKuruStats(date),
        getTodayPersonal(),
        getYomiForecast(),
        getTeamStats(),
        listUsers(),
      ])
      setKuru(k)
      setToday(t)
      setYomi(y)
      setTeam(tm)
      setUsers(u as unknown as HomesUser[])
      const dealsAll = (await listDeals({})) as unknown as PipelineDeal[]
      setPipeline(dealsAll)
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const ord = (await listOrders({ since: since.toISOString() })) as unknown as OrderRow[]
      setOrders(ord)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [date])

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users])

  // === サマリー ===
  const kpis = useMemo(() => {
    const callsTotal = today.reduce((s, x) => s + (x.calls_today ?? 0), 0)
    const contactsTotal = today.reduce((s, x) => s + (x.contacts_today ?? 0), 0)
    const apptTotal = today.reduce((s, x) => s + (x.appointments_today ?? 0), 0)
    const expectedWon = yomi.reduce((s, x) => s + (x.expected_won_count ?? 0), 0)
    const dealsActive = pipeline.filter((d) => ['meeting_scheduled', 'rescheduled', 'c_yomi_following'].includes(d.status)).length
    const won = pipeline.filter((d) => d.status === 'won').length
    const lost = pipeline.filter((d) => d.status === 'lost').length
    const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0
    const ordersThisMonth = orders.filter((o) => o.ordered_at?.slice(0, 7) === date.slice(0, 7))
    const monthlyRevenue = ordersThisMonth.reduce((s, o) => s + (Number(o.initial_fee) || 0) + (Number(o.monthly_fee) || 0), 0)
    return {
      callsTotal, contactsTotal, apptTotal,
      contactRate: callsTotal > 0 ? (contactsTotal / callsTotal) * 100 : 0,
      apptRate: contactsTotal > 0 ? (apptTotal / contactsTotal) * 100 : 0,
      expectedWon, dealsActive, won, lost, winRate, monthlyRevenue,
      ordersThisMonth: ordersThisMonth.length,
    }
  }, [today, yomi, pipeline, orders, date])

  // === 9コマ × メンバー ピボット ===
  const kuruPivot = useMemo(() => {
    const mat = new Map<string, number[]>() // userId -> kuru[9]
    kuru.forEach((k) => {
      const arr = mat.get(k.user_id) ?? Array(9).fill(0)
      const idx = Math.min(8, Math.max(0, k.kuru - 1))
      arr[idx] = (arr[idx] ?? 0) + (k.calls ?? 0)
      mat.set(k.user_id, arr)
    })
    const rows = Array.from(mat.entries()).map(([uid, arr]) => ({
      userId: uid,
      name: userById[uid]?.name ?? uid.slice(0, 8),
      values: arr,
      total: arr.reduce((s, v) => s + v, 0),
    }))
    rows.sort((a, b) => b.total - a.total)
    const colTotals = Array(9).fill(0)
    rows.forEach((r) => r.values.forEach((v, i) => { colTotals[i] += v }))
    const grand = colTotals.reduce((s, v) => s + v, 0)
    return { rows, colTotals, grand }
  }, [kuru, userById])

  // === ヨミ予測 ===
  const yomiSorted = useMemo(() => {
    return YOMI_ORDER.map((y) => yomi.find((x) => x.yomi === y) ?? { yomi: y, deal_count: 0, yomi_rate: YOMI_RATE[y], expected_won_count: 0 })
  }, [yomi])
  const yomiTotal = yomiSorted.reduce((s, x) => s + x.deal_count, 0)

  // === チーム実績 ===
  const teamSorted = useMemo(() => [...team].sort((a, b) => b.appointments_total - a.appointments_total), [team])
  const teamMaxAppt = teamSorted[0]?.appointments_total ?? 1

  // === 個人別本日 ===
  const todaySorted = useMemo(() => {
    return today.map((t) => ({ ...t, name: userById[t.user_id]?.name ?? t.user_id.slice(0, 8) }))
      .sort((a, b) => b.appointments_today - a.appointments_today)
  }, [today, userById])

  // === パイプライン ===
  const pipelineByStatus = useMemo(() => {
    return STATUS_ORDER.map((s) => ({
      status: s,
      count: pipeline.filter((d) => d.status === s).length,
    }))
  }, [pipeline])
  const pipelineByYomi = useMemo(() => {
    return YOMI_ORDER.map((y) => ({
      yomi: y,
      count: pipeline.filter((d) => d.latest_yomi === y).length,
    }))
  }, [pipeline])

  // === 受注実績 月次 ===
  const ordersByMonth = useMemo(() => {
    const map = new Map<string, { count: number; initial: number; monthly: number }>()
    orders.forEach((o) => {
      const m = o.ordered_at?.slice(0, 7) ?? '?'
      const cur = map.get(m) ?? { count: 0, initial: 0, monthly: 0 }
      cur.count += 1
      cur.initial += Number(o.initial_fee) || 0
      cur.monthly += Number(o.monthly_fee) || 0
      map.set(m, cur)
    })
    return Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [orders])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>集計表</h1>
          <p className="caption muted">S-07 / 全部署横断 / リアルタイム集計</p>
        </div>
        <div className="row-tight">
          <input className="ink-input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 180 }} />
          <button className="ink-btn" onClick={() => void load()} disabled={loading}>{loading ? '読込中...' : '↻ 再集計'}</button>
        </div>
      </header>

      <div className="agg-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`agg-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          <div className="agg-grid">
            <div className="agg-kpi tinted-primary">
              <div className="agg-label">本日 総コール</div>
              <div className="agg-value">{kpis.callsTotal.toLocaleString()}</div>
              <div className="agg-sub">コンタクト率 {kpis.contactRate.toFixed(1)}%</div>
            </div>
            <div className="agg-kpi tinted-info">
              <div className="agg-label">本日 コンタクト</div>
              <div className="agg-value">{kpis.contactsTotal.toLocaleString()}</div>
              <div className="agg-sub">アポ率 {kpis.apptRate.toFixed(1)}%</div>
            </div>
            <div className="agg-kpi tinted-warning">
              <div className="agg-label">本日 アポ獲得</div>
              <div className="agg-value">{kpis.apptTotal.toLocaleString()}</div>
              <div className="agg-sub">{kpis.dealsActive} 件 アクティブ</div>
            </div>
            <div className="agg-kpi tinted-success">
              <div className="agg-label">受注予測 (ヨミ)</div>
              <div className="agg-value">{kpis.expectedWon.toFixed(1)}</div>
              <div className="agg-sub">受注率 {kpis.winRate.toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid-12">
            <section className="ink-card col-span-6">
              <div className="agg-section-title">案件パイプライン</div>
              <div className="stack" style={{ gap: 0 }}>
                {pipelineByStatus.map((s) => {
                  const max = Math.max(...pipelineByStatus.map((x) => x.count), 1)
                  const pct = (s.count / max) * 100
                  return (
                    <div key={s.status} className="agg-bar-row">
                      <span className="caption" style={{ fontWeight: 600 }}>{STATUS_LABEL[s.status]}</span>
                      <div className="agg-bar-track">
                        <div className={`agg-bar-fill ${s.status === 'won' ? 'success' : s.status === 'lost' ? 'danger' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="mono" style={{ textAlign: 'right' }}>{s.count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="ink-card col-span-6">
              <div className="agg-section-title">ヨミ別 受注予測</div>
              <table className="pivot-table">
                <thead>
                  <tr>
                    <th>ヨミ</th>
                    <th>件数</th>
                    <th>確度</th>
                    <th>予測受注</th>
                  </tr>
                </thead>
                <tbody>
                  {yomiSorted.map((y) => (
                    <tr key={y.yomi}>
                      <td>
                        <span className={`ink-badge ${y.yomi === 'won' ? 'ink-badge-ok' : y.yomi === 'lost' ? 'ink-badge-ng' : 'ink-badge-accent'}`}>{YOMI_LABEL[y.yomi]}</span>
                      </td>
                      <td className="mono">{y.deal_count.toLocaleString()}</td>
                      <td className="mono">{(y.yomi_rate * 100).toFixed(0)}%</td>
                      <td className="mono">{y.expected_won_count.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>合計</td>
                    <td className="mono">{yomiTotal.toLocaleString()}</td>
                    <td className="mono">-</td>
                    <td className="mono">{kpis.expectedWon.toFixed(1)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          </div>
        </>
      )}

      {tab === 'kuru' && (
        <section className="ink-card" style={{ padding: 16 }}>
          <div className="agg-section-title">
            9コマ × メンバー — 時間帯別コール数
            <button className="ink-btn xs" onClick={() => csvDownload('kuru_pivot', ['担当', ...KURU_LABELS, '合計'],
              kuruPivot.rows.map((r) => [r.name, ...r.values, r.total]))}>CSV</button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table className="pivot-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 120 }}>担当</th>
                  {KURU_LABELS.map((l) => <th key={l}>{l}</th>)}
                  <th>合計</th>
                </tr>
              </thead>
              <tbody>
                {kuruPivot.rows.length === 0 ? (
                  <tr><td colSpan={11} className="muted" style={{ textAlign: 'center', padding: 24 }}>データなし</td></tr>
                ) : kuruPivot.rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.name}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className="mono" style={{ background: v > 0 ? `rgba(88,86,214,${Math.min(0.18, v / 50)})` : undefined }}>
                        {v > 0 ? v : '-'}
                      </td>
                    ))}
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>列合計</td>
                  {kuruPivot.colTotals.map((c, i) => <td key={i} className="mono">{c}</td>)}
                  <td className="mono">{kuruPivot.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {tab === 'yomi' && (
        <div className="grid-12">
          <section className="ink-card col-span-7">
            <div className="agg-section-title">ヨミ別 受注予測 (件数 × 確度)</div>
            <div className="stack" style={{ gap: 0 }}>
              {yomiSorted.map((y) => {
                const max = Math.max(...yomiSorted.map((x) => x.deal_count), 1)
                const pct = (y.deal_count / max) * 100
                return (
                  <div key={y.yomi} className="agg-bar-row">
                    <span style={{ fontWeight: 600 }}>{YOMI_LABEL[y.yomi]}</span>
                    <div className="agg-bar-track">
                      <div className={`agg-bar-fill ${y.yomi === 'won' ? 'success' : y.yomi === 'lost' ? 'danger' : y.yomi.startsWith('A') ? '' : y.yomi.startsWith('B') ? 'warning' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mono" style={{ textAlign: 'right' }}>
                      {y.deal_count} × {(y.yomi_rate * 100).toFixed(0)}% = <strong>{y.expected_won_count.toFixed(1)}</strong>
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="ink-card col-span-5">
            <div className="agg-section-title">サマリー</div>
            <table className="pivot-table">
              <thead><tr><th>指標</th><th>値</th></tr></thead>
              <tbody>
                <tr><td>総アクティブ案件</td><td className="mono">{yomiTotal}</td></tr>
                <tr><td>予測受注 (期待値)</td><td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{kpis.expectedWon.toFixed(1)}</td></tr>
                <tr><td>A以上 (高確度)</td><td className="mono">{yomiSorted.filter((y) => y.yomi.startsWith('A') || y.yomi === 'won').reduce((s, x) => s + x.deal_count, 0)}</td></tr>
                <tr><td>B以上 (中確度)</td><td className="mono">{yomiSorted.filter((y) => y.yomi.startsWith('B')).reduce((s, x) => s + x.deal_count, 0)}</td></tr>
                <tr><td>C/D (低確度)</td><td className="mono">{yomiSorted.filter((y) => y.yomi === 'C' || y.yomi === 'D').reduce((s, x) => s + x.deal_count, 0)}</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === 'team' && (
        <section className="ink-card" style={{ padding: 16 }}>
          <div className="agg-section-title">
            チーム別 累計実績
            <button className="ink-btn xs" onClick={() => csvDownload('team_stats', ['チーム', 'コール', 'コンタクト', 'アポ'],
              teamSorted.map((t) => [t.team_name, t.calls_total, t.contacts_total, t.appointments_total]))}>CSV</button>
          </div>
          <table className="pivot-table">
            <thead>
              <tr>
                <th>チーム</th>
                <th>コール</th>
                <th>コンタクト</th>
                <th>コンタクト率</th>
                <th>アポ</th>
                <th>アポ率</th>
                <th>進捗</th>
              </tr>
            </thead>
            <tbody>
              {teamSorted.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>データなし</td></tr>
              ) : teamSorted.map((t) => {
                const cr = t.calls_total > 0 ? (t.contacts_total / t.calls_total) * 100 : 0
                const ar = t.contacts_total > 0 ? (t.appointments_total / t.contacts_total) * 100 : 0
                const pct = (t.appointments_total / teamMaxAppt) * 100
                return (
                  <tr key={t.team_id}>
                    <td>{t.team_name}</td>
                    <td className="mono">{t.calls_total.toLocaleString()}</td>
                    <td className="mono">{t.contacts_total.toLocaleString()}</td>
                    <td className="mono">{cr.toFixed(1)}%</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{t.appointments_total.toLocaleString()}</td>
                    <td className="mono">{ar.toFixed(1)}%</td>
                    <td style={{ minWidth: 160 }}>
                      <div className="agg-bar-track">
                        <div className="agg-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>合計</td>
                <td className="mono">{teamSorted.reduce((s, t) => s + t.calls_total, 0).toLocaleString()}</td>
                <td className="mono">{teamSorted.reduce((s, t) => s + t.contacts_total, 0).toLocaleString()}</td>
                <td>-</td>
                <td className="mono">{teamSorted.reduce((s, t) => s + t.appointments_total, 0).toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {tab === 'personal' && (
        <section className="ink-card" style={{ padding: 16 }}>
          <div className="agg-section-title">
            個人別 本日実績
            <button className="ink-btn xs" onClick={() => csvDownload('today_personal', ['氏名', 'コール', 'コンタクト', 'アポ', 'コンタクト率', 'アポ率'],
              todaySorted.map((t) => [t.name, t.calls_today, t.contacts_today, t.appointments_today, t.contact_rate_pct, t.appointment_rate_pct]))}>CSV</button>
          </div>
          <table className="pivot-table">
            <thead>
              <tr>
                <th>氏名</th>
                <th>コール</th>
                <th>コンタクト</th>
                <th>コンタクト率</th>
                <th>アポ</th>
                <th>アポ率</th>
              </tr>
            </thead>
            <tbody>
              {todaySorted.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>データなし</td></tr>
              ) : todaySorted.map((t) => (
                <tr key={t.user_id}>
                  <td>{t.name}</td>
                  <td className="mono">{t.calls_today.toLocaleString()}</td>
                  <td className="mono">{t.contacts_today.toLocaleString()}</td>
                  <td className="mono">{t.contact_rate_pct?.toFixed(1) ?? '-'}%</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{t.appointments_today.toLocaleString()}</td>
                  <td className="mono">{t.appointment_rate_pct?.toFixed(1) ?? '-'}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>合計</td>
                <td className="mono">{kpis.callsTotal.toLocaleString()}</td>
                <td className="mono">{kpis.contactsTotal.toLocaleString()}</td>
                <td className="mono">{kpis.contactRate.toFixed(1)}%</td>
                <td className="mono">{kpis.apptTotal.toLocaleString()}</td>
                <td className="mono">{kpis.apptRate.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {tab === 'pipeline' && (
        <div className="grid-12">
          <section className="ink-card col-span-6">
            <div className="agg-section-title">ステータス別 件数</div>
            <table className="pivot-table">
              <thead><tr><th>ステータス</th><th>件数</th></tr></thead>
              <tbody>
                {pipelineByStatus.map((p) => (
                  <tr key={p.status}>
                    <td>{STATUS_LABEL[p.status]}</td>
                    <td className="mono">{p.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>合計</td><td className="mono">{pipeline.length.toLocaleString()}</td></tr></tfoot>
            </table>
          </section>
          <section className="ink-card col-span-6">
            <div className="agg-section-title">最新ヨミ別 件数</div>
            <table className="pivot-table">
              <thead><tr><th>ヨミ</th><th>件数</th></tr></thead>
              <tbody>
                {pipelineByYomi.map((p) => (
                  <tr key={p.yomi}>
                    <td>{YOMI_LABEL[p.yomi]}</td>
                    <td className="mono">{p.count.toLocaleString()}</td>
                  </tr>
                ))}
                <tr><td>未設定</td><td className="mono">{pipeline.filter((d) => !d.latest_yomi).length}</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === 'orders' && (
        <>
          <div className="agg-grid">
            <div className="agg-kpi tinted-primary">
              <div className="agg-label">{date.slice(0, 7)} 受注件数</div>
              <div className="agg-value">{kpis.ordersThisMonth}</div>
              <div className="agg-sub">過去90日 {orders.length} 件</div>
            </div>
            <div className="agg-kpi tinted-success">
              <div className="agg-label">{date.slice(0, 7)} 売上 (円)</div>
              <div className="agg-value">¥{kpis.monthlyRevenue.toLocaleString()}</div>
              <div className="agg-sub">イニシャル + 月額</div>
            </div>
            <div className="agg-kpi tinted-info">
              <div className="agg-label">受注勝率</div>
              <div className="agg-value">{kpis.winRate.toFixed(1)}%</div>
              <div className="agg-sub">受注 {kpis.won} / 失注 {kpis.lost}</div>
            </div>
            <div className="agg-kpi tinted-warning">
              <div className="agg-label">アクティブ案件</div>
              <div className="agg-value">{kpis.dealsActive}</div>
              <div className="agg-sub">商談 + リスケ + Cヨミ</div>
            </div>
          </div>

          <section className="ink-card" style={{ padding: 16 }}>
            <div className="agg-section-title">
              月次 受注実績
              <button className="ink-btn xs" onClick={() => csvDownload('orders_by_month', ['月', '件数', 'イニシャル', '月額', '合計'],
                ordersByMonth.map((m) => [m.month, m.count, m.initial, m.monthly, m.initial + m.monthly]))}>CSV</button>
            </div>
            <table className="pivot-table">
              <thead>
                <tr>
                  <th>月</th>
                  <th>件数</th>
                  <th>イニシャル合計</th>
                  <th>月額合計</th>
                  <th>合計</th>
                </tr>
              </thead>
              <tbody>
                {ordersByMonth.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>受注データなし</td></tr>
                ) : ordersByMonth.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="mono">{m.count}</td>
                    <td className="mono">¥{m.initial.toLocaleString()}</td>
                    <td className="mono">¥{m.monthly.toLocaleString()}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>¥{(m.initial + m.monthly).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>累計</td>
                  <td className="mono">{ordersByMonth.reduce((s, m) => s + m.count, 0)}</td>
                  <td className="mono">¥{ordersByMonth.reduce((s, m) => s + m.initial, 0).toLocaleString()}</td>
                  <td className="mono">¥{ordersByMonth.reduce((s, m) => s + m.monthly, 0).toLocaleString()}</td>
                  <td className="mono">¥{ordersByMonth.reduce((s, m) => s + m.initial + m.monthly, 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
