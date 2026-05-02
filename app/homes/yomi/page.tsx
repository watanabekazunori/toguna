'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listDeals } from '@/lib/homes/api'
import { YOMI_LABEL, YOMI_RATE, type Yomi } from '@/lib/homes/types'

/**
 * M-04: ヨミ別管理表
 * カンバン風: ヨミステージ別の商談一覧
 * 議事録「ヨミ管理 (won/A〇/A/B〇/B/C/D/lost) 」に準拠
 */

interface YomiRow {
  id: string
  company_name: string
  company_id: string
  closer_name: string | null
  appointer_name: string | null
  yomi: Yomi
  appointed_at: string
  latest_meeting_at: string | null
  contact_count: number
  status: string
}

const STAGES: Yomi[] = ['won', 'A_circle', 'A', 'B_circle', 'B', 'C', 'D', 'lost']

const STAGE_BG: Record<Yomi, string> = {
  won: 'linear-gradient(180deg, rgba(52,199,89,0.20) 0%, rgba(52,199,89,0.05) 100%)',
  A_circle: 'linear-gradient(180deg, rgba(48,176,199,0.20) 0%, rgba(48,176,199,0.05) 100%)',
  A: 'linear-gradient(180deg, rgba(48,176,199,0.14) 0%, rgba(48,176,199,0.04) 100%)',
  B_circle: 'linear-gradient(180deg, rgba(255,159,10,0.20) 0%, rgba(255,159,10,0.05) 100%)',
  B: 'linear-gradient(180deg, rgba(255,159,10,0.14) 0%, rgba(255,159,10,0.04) 100%)',
  C: 'linear-gradient(180deg, rgba(142,142,147,0.18) 0%, rgba(142,142,147,0.04) 100%)',
  D: 'linear-gradient(180deg, rgba(142,142,147,0.10) 0%, rgba(142,142,147,0.02) 100%)',
  lost: 'linear-gradient(180deg, rgba(255,59,48,0.16) 0%, rgba(255,59,48,0.03) 100%)',
}

export default function YomiPage() {
  const [rows, setRows] = useState<YomiRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await listDeals({})
      setRows((data as any[]).map((d: any) => ({
        id: d.id,
        company_name: d.homes_companies?.company_name ?? '-',
        company_id: d.company_id,
        closer_name: d.closer?.name ?? null,
        appointer_name: d.appointer?.name ?? null,
        yomi: d.latest_yomi ?? 'C',
        appointed_at: d.appointed_at,
        latest_meeting_at: d.latest_meeting_at,
        contact_count: d.contact_count ?? 0,
        status: d.status,
      })))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const grouped = useMemo(() => {
    const m = new Map<Yomi, YomiRow[]>()
    for (const s of STAGES) m.set(s, [])
    for (const r of rows) {
      const arr = m.get(r.yomi) ?? []
      arr.push(r)
      m.set(r.yomi, arr)
    }
    return m
  }, [rows])

  const totalForecast = useMemo(() => rows.reduce((s, r) => s + (YOMI_RATE[r.yomi] ?? 0), 0), [rows])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>ヨミ別管理表</h1>
          <p className="caption muted">M-04 / ヨミステージ別カンバン / 受注予測 = Σ(ヨミ確度)</p>
        </div>
        <div className="row-tight">
          <article className="ink-card" style={{ padding: '8px 14px' }}>
            <span className="caption muted">予測受注</span>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              {totalForecast.toFixed(1)}
            </span>
            <span className="caption muted" style={{ marginLeft: 4 }}>件</span>
          </article>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(180px, 1fr))', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {STAGES.map((stage) => {
          const items = grouped.get(stage) ?? []
          return (
            <div key={stage} style={{
              background: STAGE_BG[stage],
              borderRadius: 14,
              border: '1px solid var(--border-light)',
              padding: 10,
              minHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div className="between" style={{ marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{YOMI_LABEL[stage]}</strong>
                <span className="caption muted mono" style={{ fontSize: 11 }}>
                  {items.length} 件 · {((YOMI_RATE[stage] ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {loading ? <p className="caption muted">読込中...</p> : items.length === 0 ? (
                  <p className="caption muted" style={{ fontSize: 11, textAlign: 'center', padding: 16 }}>該当なし</p>
                ) : items.map((r) => (
                  <Link key={r.id} href={`/homes/deals?id=${r.id}`} style={{ textDecoration: 'none' }}>
                    <article style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 10,
                      padding: 8,
                      cursor: 'pointer',
                      transition: 'transform 0.12s',
                    }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{r.company_name}</p>
                      <p className="caption muted" style={{ margin: '4px 0 0', fontSize: 10 }}>
                        {r.closer_name ?? '未割当'} · {r.contact_count}回
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
