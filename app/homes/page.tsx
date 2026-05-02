import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  YOMI_LABEL,
  type Yomi,
  type KuruStat,
  type TodayPersonal,
  type YomiForecast,
  type TeamStat,
} from '@/lib/homes/types'

export const dynamic = 'force-dynamic'

const KURU_LABELS = ['', '9-10', '10-11', '11-12', '13-14', '14-15', '15-16', '16-17', '17-18', '18-18:30']

async function fetchDashboard() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const next = new Date(today)
  next.setDate(next.getDate() + 1)

  const [{ data: kuru }, { data: today_p }, { data: yomi }, { data: teams }, { data: monthly }, { data: users }] =
    await Promise.all([
      supabase
        .from('homes_v_kuru_stats')
        .select('*')
        .gte('work_date', today)
        .lt('work_date', next.toISOString().slice(0, 10)),
      supabase.from('homes_v_today_personal').select('*'),
      supabase.from('homes_v_yomi_forecast').select('*'),
      supabase.from('homes_v_team_stats').select('*'),
      supabase.from('homes_v_monthly_summary').select('*').order('month', { ascending: false }).limit(1),
      supabase.from('homes_users').select('id, name, role, team_id, homes_teams(name)').eq('is_active', true),
    ])

  return {
    today,
    kuru: (kuru ?? []) as KuruStat[],
    today_p: (today_p ?? []) as TodayPersonal[],
    yomi: (yomi ?? []) as YomiForecast[],
    teams: (teams ?? []) as TeamStat[],
    monthly: monthly?.[0] ?? null,
    users: users ?? [],
  }
}

function heatClass(rate: number) {
  if (rate >= 0.95) return 'ink-heat-6'
  if (rate >= 0.85) return 'ink-heat-5'
  if (rate >= 0.6) return 'ink-heat-4'
  if (rate >= 0.3) return 'ink-heat-3'
  if (rate > 0) return 'ink-heat-2'
  return 'ink-heat-1'
}

export default async function DashboardPage() {
  const d = await fetchDashboard()

  // ヘリンボーン: ユーザー × クール9コマ
  const kuruByUser = new Map<string, Map<number, KuruStat>>()
  for (const row of d.kuru) {
    if (!kuruByUser.has(row.user_id)) kuruByUser.set(row.user_id, new Map())
    kuruByUser.get(row.user_id)!.set(row.kuru, row)
  }

  // 集計トータル
  const totalCalls = d.kuru.reduce((s, r) => s + (r.calls ?? 0), 0)
  const totalContacts = d.kuru.reduce((s, r) => s + (r.contacts ?? 0), 0)
  const totalAppointments = d.kuru.reduce((s, r) => s + (r.appointments ?? 0), 0)
  const expectedWon = d.yomi.reduce((s, r) => s + (Number(r.expected_won_count) || 0), 0)

  // ランキング
  const ranking = [...d.today_p]
    .sort((a, b) => (b.appointments_today ?? 0) - (a.appointments_today ?? 0))
    .slice(0, 3)
  const userMap = new Map(d.users.map((u) => [u.id, u]))

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>ダッシュボード</h1>
          <p className="muted caption">{d.today} / S-01</p>
        </div>
        <div className="row-tight">
          <Link href="/homes/call" className="ink-btn primary">コール開始</Link>
        </div>
      </header>

      {/* Hero KPI */}
      <section className="grid-12">
        <div className="ink-card ink-elevated col-span-3">
          <p className="kpi-label">本日コール</p>
          <p className="kpi-num">{totalCalls.toLocaleString()}</p>
          <p className="caption">アポ獲得 {totalAppointments} 件</p>
        </div>
        <div className="ink-card ink-elevated col-span-3">
          <p className="kpi-label">本日コンタクト</p>
          <p className="kpi-num">{totalContacts.toLocaleString()}</p>
          <p className="caption">
            率 {totalCalls ? ((totalContacts / totalCalls) * 100).toFixed(1) : '0'}%
          </p>
        </div>
        <div className="ink-card ink-elevated col-span-3">
          <p className="kpi-label">受注予測 (ヨミ × 受注率)</p>
          <p className="kpi-num">{expectedWon.toFixed(1)}</p>
          <p className="caption">本月着地予測</p>
        </div>
        <div className="ink-card ink-elevated col-span-3">
          <p className="kpi-label">月次コール累計</p>
          <p className="kpi-num">{d.monthly?.calls?.toLocaleString() ?? 0}</p>
          <p className="caption">アポ {d.monthly?.appointments ?? 0} 件</p>
        </div>
      </section>

      {/* ヘリンボーン: クール毎 */}
      <section className="ink-card">
        <div className="between" style={{ marginBottom: 12 }}>
          <h3>クール毎ヘリンボーン (9コマ × メンバー)</h3>
          <span className="caption">9:00 — 18:30</span>
        </div>
        {d.users.length === 0 ? (
          <p className="muted">メンバー未登録 — <Link href="/homes/users" style={{ color: 'var(--accent-sub)' }}>登録</Link></p>
        ) : (
          <div className="ink-scroll" style={{ maxHeight: 500 }}>
            <div className="ink-herringbone">
              <div className="row">
                <div className="cell head">担当</div>
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="cell head">{KURU_LABELS[i + 1]}</div>
                ))}
              </div>
              {d.users.map((u) => {
                const m = kuruByUser.get(u.id) ?? new Map()
                return (
                  <div className="row" key={u.id}>
                    <div className="cell label">
                      <strong>{u.name}</strong>
                      <span className="caption" style={{ fontSize: 10 }}>{u.role}</span>
                    </div>
                    {Array.from({ length: 9 }, (_, i) => {
                      const k = m.get(i + 1)
                      const calls = k?.calls ?? 0
                      const apts = k?.appointments ?? 0
                      const intensity = Math.min(1, calls / 50)
                      const heat = intensity >= 0.7 ? 'ink-heat-5' : intensity >= 0.4 ? 'ink-heat-3' : intensity > 0 ? 'ink-heat-2' : 'ink-heat-1'
                      return (
                        <div className={`cell ${heat}`} key={i}>
                          <span style={{ fontWeight: 600 }}>{calls}</span>
                          <span style={{ fontSize: 10, opacity: 0.85 }}>apo {apts}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="grid-12">
        {/* ヨミ予測 */}
        <div className="ink-card col-span-6">
          <div className="between" style={{ marginBottom: 12 }}>
            <h3>ヨミ受注予測</h3>
            <span className="caption">合計予測 {expectedWon.toFixed(1)} 件</span>
          </div>
          <table className="ink-table">
            <thead>
              <tr>
                <th>ヨミ</th>
                <th style={{ textAlign: 'right' }}>件数</th>
                <th style={{ textAlign: 'right' }}>受注率</th>
                <th style={{ textAlign: 'right' }}>受注見込</th>
              </tr>
            </thead>
            <tbody>
              {d.yomi.length === 0 ? (
                <tr><td colSpan={4} className="muted">データなし</td></tr>
              ) : d.yomi.map((y) => (
                <tr key={y.yomi}>
                  <td>
                    <span className={`ink-badge ${heatClass(y.yomi_rate)}`} style={{ fontFamily: 'var(--font-mono)' }}>
                      {YOMI_LABEL[y.yomi as Yomi] ?? y.yomi}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{y.deal_count}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{(y.yomi_rate * 100).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right' }}><strong>{Number(y.expected_won_count).toFixed(1)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ランキング */}
        <div className="ink-card col-span-6">
          <h3 style={{ marginBottom: 12 }}>本日ランキング (アポ進捗)</h3>
          <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }} className="col-tight">
            {ranking.length === 0 ? (
              <li className="muted">本日データなし</li>
            ) : ranking.map((r, idx) => {
              const u = userMap.get(r.user_id)
              return (
                <li key={r.user_id} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="row-tight">
                    <span className="ink-badge ink-badge-accent" style={{ width: 22, justifyContent: 'center' }}>{idx + 1}</span>
                    <strong>{u?.name ?? r.user_id.slice(0, 8)}</strong>
                    <span className="caption">{u?.role}</span>
                  </span>
                  <span className="row-tight">
                    <span className="caption">アポ</span>
                    <span className="kpi-num" style={{ fontSize: 24 }}>{r.appointments_today ?? 0}</span>
                    <span className="caption mono" style={{ marginLeft: 12 }}>
                      {r.appointment_rate_pct ?? 0}%
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="grid-12">
        <div className="ink-card col-span-6">
          <h3 style={{ marginBottom: 12 }}>チーム別実績 (累計)</h3>
          <table className="ink-table">
            <thead>
              <tr>
                <th>チーム</th>
                <th style={{ textAlign: 'right' }}>コール</th>
                <th style={{ textAlign: 'right' }}>コンタクト</th>
                <th style={{ textAlign: 'right' }}>アポ</th>
              </tr>
            </thead>
            <tbody>
              {d.teams.length === 0 ? (
                <tr><td colSpan={4} className="muted">チーム未登録</td></tr>
              ) : d.teams.map((t) => (
                <tr key={t.team_id}>
                  <td><strong>{t.team_name}</strong></td>
                  <td style={{ textAlign: 'right' }} className="mono">{t.calls_total}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{t.contacts_total}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{t.appointments_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ink-card col-span-6">
          <h3 style={{ marginBottom: 12 }}>個人別本日</h3>
          <table className="ink-table">
            <thead>
              <tr>
                <th>担当</th>
                <th style={{ textAlign: 'right' }}>コール</th>
                <th style={{ textAlign: 'right' }}>コンタクト</th>
                <th style={{ textAlign: 'right' }}>アポ</th>
                <th style={{ textAlign: 'right' }}>アポ率</th>
              </tr>
            </thead>
            <tbody>
              {d.today_p.length === 0 ? (
                <tr><td colSpan={5} className="muted">本日データなし</td></tr>
              ) : d.today_p.map((p) => {
                const u = userMap.get(p.user_id)
                return (
                  <tr key={p.user_id}>
                    <td>{u?.name ?? p.user_id.slice(0, 8)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{p.calls_today}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{p.contacts_today}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{p.appointments_today}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{p.appointment_rate_pct ?? 0}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
