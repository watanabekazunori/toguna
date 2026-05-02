'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'
import { NG_REASONS, MEETING_NG_REASONS } from '@/lib/homes/types'

/**
 * M-07: NG分析表
 * NG理由別の集計・期間トレンド
 */

interface NgRow {
  reason: string
  scope: 'call' | 'meeting'
  count: number
  pct: number
}

const cols: ExcelCol<NgRow>[] = [
  { key: 'scope', label: '区分', width: 90, sticky: true,
    value: (r) => r.scope,
    render: (r) => <span className="ink-badge" style={{ background: r.scope === 'call' ? 'rgba(88,86,214,0.12)' : 'rgba(255,159,10,0.18)' }}>{r.scope === 'call' ? 'コールNG' : '商談NG'}</span> },
  { key: 'reason', label: 'NG理由', width: 240, value: (r) => r.reason },
  { key: 'count', label: '件数', width: 100, num: true, agg: 'sum',
    value: (r) => r.count,
    render: (r) => <span className="mono" style={{ fontWeight: 700 }}>{r.count.toLocaleString()}</span> },
  { key: 'pct', label: '構成比', width: 200, num: true,
    value: (r) => r.pct,
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, background: 'rgba(142,142,147,0.14)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${(r.pct * 100).toFixed(1)}%`, height: '100%', background: 'var(--danger)' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, minWidth: 50, textAlign: 'right' }}>{(r.pct * 100).toFixed(1)}%</span>
      </div>
    ) },
]

export default function NgAnalysisPage() {
  const [rows, setRows] = useState<NgRow[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const since = period === 'all' ? null : new Date(Date.now() - { '7d': 7, '30d': 30, '90d': 90 }[period] * 86400000).toISOString()
      const [actRes, mtRes] = await Promise.all([
        supabase.from('homes_activities').select('ng_reason, created_at').not('ng_reason', 'is', null).then((r) => since ? supabase.from('homes_activities').select('ng_reason').not('ng_reason', 'is', null).gte('created_at', since) : r),
        supabase.from('homes_meetings').select('ng_reason, created_at').not('ng_reason', 'is', null).then((r) => since ? supabase.from('homes_meetings').select('ng_reason').not('ng_reason', 'is', null).gte('created_at', since) : r),
      ])
      const callBuckets = new Map<string, number>(NG_REASONS.map((r) => [r, 0]))
      for (const a of (actRes.data ?? []) as any[]) {
        if (a.ng_reason) callBuckets.set(a.ng_reason, (callBuckets.get(a.ng_reason) ?? 0) + 1)
      }
      const mtBuckets = new Map<string, number>(MEETING_NG_REASONS.map((r) => [r, 0]))
      for (const m of (mtRes.data ?? []) as any[]) {
        if (m.ng_reason) mtBuckets.set(m.ng_reason, (mtBuckets.get(m.ng_reason) ?? 0) + 1)
      }
      const callTotal = Array.from(callBuckets.values()).reduce((s, n) => s + n, 0)
      const mtTotal = Array.from(mtBuckets.values()).reduce((s, n) => s + n, 0)
      const out: NgRow[] = [
        ...Array.from(callBuckets.entries()).map(([reason, count]) => ({ reason, scope: 'call' as const, count, pct: callTotal ? count / callTotal : 0 })),
        ...Array.from(mtBuckets.entries()).map(([reason, count]) => ({ reason, scope: 'meeting' as const, count, pct: mtTotal ? count / mtTotal : 0 })),
      ].sort((a, b) => b.count - a.count)
      setRows(out)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [period])

  const totals = useMemo(() => ({
    call: rows.filter((r) => r.scope === 'call').reduce((s, r) => s + r.count, 0),
    meeting: rows.filter((r) => r.scope === 'meeting').reduce((s, r) => s + r.count, 0),
    top: rows[0],
  }), [rows])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>NG分析表</h1>
          <p className="caption muted">M-07 / コール・商談NG理由別 / 期間: {period}</p>
        </div>
        <div className="row-tight">
          {(['7d', '30d', '90d', 'all'] as const).map((p) => (
            <button key={p} className={`ink-btn xs ${period === p ? 'primary' : ''}`} onClick={() => setPeriod(p)}>{p === 'all' ? '全期間' : p}</button>
          ))}
        </div>
      </header>

      <section className="grid-cards-3">
        <article className="ink-card">
          <p className="caption muted">コールNG累計</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{totals.call.toLocaleString()}</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">商談NG累計</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{totals.meeting.toLocaleString()}</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">最頻NG理由</p>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{totals.top?.reason ?? '-'}</p>
          <p className="caption muted">{totals.top?.count.toLocaleString() ?? 0} 件 ({totals.top ? (totals.top.pct * 100).toFixed(1) : 0}%)</p>
        </article>
      </section>

      <ExcelTable
        rows={rows}
        cols={cols}
        rowKey={(r) => `${r.scope}:${r.reason}`}
        loading={loading}
        empty="NGデータなし"
        filename={`NG分析_${period}`}
      />
    </div>
  )
}
