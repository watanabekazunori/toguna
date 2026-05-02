'use client'

import { useEffect, useMemo, useState } from 'react'
import { listListProgress, type ListProgressRow } from '@/lib/homes/api'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'

/**
 * M-05: リスト消化進捗
 * 議事録「リスト合計14万件・40種類前後。マスターリスト＋種類マークで絞り込み」
 * B-02 fix: 1クエリ集計 (homes_list_progress_view) で N+1 排除
 */

interface ListProgress {
  id: string
  name: string
  source: string | null
  total: number
  untouched: number
  dialed: number
  contacted: number
  appointed: number
  ng: number
  consumption_rate: number
  appointment_rate: number
}

const cols: ExcelCol<ListProgress>[] = [
  { key: 'name', label: 'リスト名', width: 220, sticky: true, value: (r) => r.name },
  { key: 'source', label: 'ソース', width: 130, value: (r) => r.source ?? '-' },
  { key: 'total', label: '総件数', width: 90, num: true, agg: 'sum',
    value: (r) => r.total,
    render: (r) => <span className="mono">{r.total.toLocaleString()}</span> },
  { key: 'untouched', label: '未架電', width: 90, num: true, agg: 'sum',
    value: (r) => r.untouched,
    render: (r) => <span className="mono">{r.untouched.toLocaleString()}</span> },
  { key: 'dialed', label: '架電済', width: 90, num: true, agg: 'sum',
    value: (r) => r.dialed,
    render: (r) => <span className="mono">{r.dialed.toLocaleString()}</span> },
  { key: 'contacted', label: 'コンタクト', width: 100, num: true, agg: 'sum',
    value: (r) => r.contacted,
    render: (r) => <span className="mono">{r.contacted.toLocaleString()}</span> },
  { key: 'appointed', label: 'アポ獲得', width: 90, num: true, agg: 'sum',
    value: (r) => r.appointed,
    render: (r) => <span className="mono">{r.appointed.toLocaleString()}</span> },
  { key: 'ng', label: 'NG', width: 80, num: true, agg: 'sum',
    value: (r) => r.ng,
    render: (r) => <span className="mono">{r.ng.toLocaleString()}</span> },
  { key: 'consumption_rate', label: '消化率', width: 140, num: true,
    value: (r) => r.consumption_rate,
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, background: 'rgba(142,142,147,0.14)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${(r.consumption_rate * 100).toFixed(1)}%`,
            height: '100%',
            background: r.consumption_rate >= 0.8 ? 'var(--success)' : r.consumption_rate >= 0.5 ? 'var(--warning)' : 'var(--ink-primary)',
          }} />
        </div>
        <span className="mono" style={{ fontSize: 11, minWidth: 42, textAlign: 'right' }}>{(r.consumption_rate * 100).toFixed(1)}%</span>
      </div>
    ) },
  { key: 'appointment_rate', label: 'アポ率', width: 90, num: true,
    value: (r) => r.appointment_rate,
    render: (r) => <span className="mono">{(r.appointment_rate * 100).toFixed(1)}%</span> },
]

function toListProgress(r: ListProgressRow): ListProgress {
  const total = r.total || r.list_total_count || 0
  return {
    id: r.list_id,
    name: r.name,
    source: r.source,
    total,
    untouched: r.untouched,
    dialed: r.dialed,
    contacted: r.contacted,
    appointed: r.appointed,
    ng: r.ng,
    consumption_rate: total ? 1 - r.untouched / total : 0,
    appointment_rate: r.contacted ? r.appointed / r.contacted : 0,
  }
}

export default function ListProgressPage() {
  const [rows, setRows] = useState<ListProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const raw = await listListProgress()
      setRows(raw.map(toListProgress))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const totals = useMemo(() => rows.reduce((a, r) => ({
    total: a.total + r.total,
    untouched: a.untouched + r.untouched,
    appointed: a.appointed + r.appointed,
  }), { total: 0, untouched: 0, appointed: 0 }), [rows])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>リスト消化進捗</h1>
          <p className="caption muted">M-05 / 全{rows.length}リストの架電進捗 / 議事録 14万件×40種類</p>
        </div>
      </header>

      {err && (
        <div className="ink-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <p className="caption" style={{ color: 'var(--danger)' }}>取得失敗: {err}</p>
        </div>
      )}

      <section className="grid-cards-3">
        <article className="ink-card">
          <p className="caption muted">総件数</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{totals.total.toLocaleString()}</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">残未架電</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0, color: 'var(--ink-primary)' }}>{totals.untouched.toLocaleString()}</p>
          <p className="caption muted">消化率 {totals.total ? (((totals.total - totals.untouched) / totals.total) * 100).toFixed(1) : 0}%</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">アポ獲得累計</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0, color: 'var(--success)' }}>{totals.appointed.toLocaleString()}</p>
        </article>
      </section>

      <ExcelTable
        rows={rows}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
        empty="リストなし"
        filename="リスト消化進捗"
      />
    </div>
  )
}
