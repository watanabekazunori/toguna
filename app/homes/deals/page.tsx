'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listDeals, getCurrentHomesUser } from '@/lib/homes/api'
import { DEAL_STATUS_LABEL, YOMI_LABEL, type DealStatus, type Yomi, type HomesUser } from '@/lib/homes/types'
import { ExcelTable, type ExcelCol } from '../_components/ExcelTable'

// CL-04: c_yomi_following を追客タブとして明示
const TABS: DealStatus[] = ['meeting_scheduled', 'rescheduled', 'c_yomi_following', 'disappeared', 'lost', 'won']

interface DealRow {
  id: string
  appointed_at: string
  appointment_kind: string | null
  appointment_type: string | null
  appointment_status: string | null
  status: DealStatus
  latest_yomi: Yomi | null
  latest_meeting_at: string | null
  contact_count: number
  reschedule_count: number
  reschedule_reason: string | null
  notes: string | null
  handover_memo: string | null
  is_priority_area: boolean
  homes_companies: { company_name: string; phone: string; prefecture: string | null; city: string | null }
  homes_lists: { name: string } | null
  appointer: { name: string } | null
  closer: { name: string } | null
}

export default function DealsPage() {
  const [me, setMe] = useState<HomesUser | null>(null)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [tab, setTab] = useState<DealStatus>('meeting_scheduled')
  const [deals, setDeals] = useState<DealRow[]>([])
  const [q, setQ] = useState('')
  const [yomiFilter, setYomiFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const u = await getCurrentHomesUser()
      setMe(u)
      if (u && u.role !== 'CLOSER') setScope('all')
    })()
  }, [])

  async function load() {
    if (!me) return
    setLoading(true)
    try {
      const isCloserScope = me.role === 'CLOSER' || scope === 'mine'
      const closerId = isCloserScope ? me.id : undefined
      const r = await listDeals({ status: tab, closer_user_id: closerId })
      setDeals(r as unknown as DealRow[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [tab, me, scope])

  // CL-05: 検索を notes / handover_memo にも拡張 (引き継ぎメモを跨いだ案件検索)
  const filtered = useMemo(() => {
    let out = deals
    if (q) {
      const k = q.toLowerCase()
      out = out.filter((d) =>
        d.homes_companies?.company_name?.toLowerCase().includes(k) ||
        d.homes_companies?.phone?.includes(q) ||
        d.notes?.toLowerCase().includes(k) ||
        d.handover_memo?.toLowerCase().includes(k),
      )
    }
    if (yomiFilter) out = out.filter((d) => d.latest_yomi === yomiFilter)
    return out
  }, [deals, q, yomiFilter])

  const cols = useMemo<ExcelCol<DealRow>[]>(() => [
    {
      key: 'company_name', label: '法人名', width: 220, sticky: true,
      value: (d) => d.homes_companies?.company_name ?? '',
      render: (d) => (
        <Link href={`/homes/deals/${d.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
          {d.homes_companies?.company_name}
        </Link>
      ),
    },
    { key: 'phone', label: 'TEL', width: 120, value: (d) => d.homes_companies?.phone ?? '' },
    { key: 'prefecture', label: '都道府県', width: 90, value: (d) => d.homes_companies?.prefecture ?? '' },
    { key: 'city', label: '市区町村', width: 120, value: (d) => d.homes_companies?.city ?? '' },
    { key: 'list', label: 'リスト', width: 110, value: (d) => d.homes_lists?.name ?? '' },
    { key: 'appointed_at', label: 'アポ取得日', width: 110, value: (d) => d.appointed_at?.slice(0, 10) ?? '' },
    { key: 'appointer', label: 'アポ取得者', width: 110, value: (d) => d.appointer?.name ?? '' },
    { key: 'closer', label: 'クローザー', width: 110, value: (d) => d.closer?.name ?? '' },
    { key: 'appointment_kind', label: 'アポ種類', width: 110, value: (d) => d.appointment_kind ?? '' },
    {
      key: 'appointment_type', label: '種別', width: 80,
      value: (d) => d.appointment_type === 'web' ? 'WEB' : d.appointment_type === 'phone' ? '電話' : '',
    },
    { key: 'status', label: '状態', width: 110, value: (d) => DEAL_STATUS_LABEL[d.status],
      render: (d) => <span className="ink-badge">{DEAL_STATUS_LABEL[d.status]}</span> },
    { key: 'latest_yomi', label: '最新ヨミ', width: 90,
      value: (d) => d.latest_yomi ?? '',
      render: (d) => d.latest_yomi
        ? <span className="ink-badge ink-badge-accent">{YOMI_LABEL[d.latest_yomi]}</span>
        : '-' },
    { key: 'contact_count', label: '商談回数', width: 80, num: true, agg: 'sum',
      value: (d) => d.contact_count,
      render: (d) => `${d.contact_count}/10` },
    { key: 'latest_meeting_at', label: '最終商談', width: 110,
      value: (d) => d.latest_meeting_at?.slice(0, 10) ?? '' },
    { key: 'reschedule_count', label: 'リスケ', width: 70, num: true, agg: 'sum',
      value: (d) => d.reschedule_count },
    { key: 'reschedule_reason', label: 'リスケ理由', width: 140,
      value: (d) => d.reschedule_reason ?? '' },
    { key: 'is_priority_area', label: '稟議', width: 80,
      value: (d) => d.is_priority_area ? '特定優先' : '',
      render: (d) => d.is_priority_area
        ? <span className="ink-badge ink-badge-hot">特定優先</span>
        : '-' },
    { key: 'notes', label: '備考', width: 240, value: (d) => d.notes ?? '' },
  ], [])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>案件管理表</h1>
          <p className="caption muted">
            S-04 / アポ獲得後の商談トラッキング / Excel互換ビュー
            {me && ` · ${me.name} (${me.role})`}
          </p>
        </div>
        <div className="row-tight">
          {me && me.role !== 'CLOSER' && (
            <>
              <button
                className={`ink-btn xs ${scope === 'mine' ? 'primary' : ''}`}
                onClick={() => setScope('mine')}
              >自分の担当</button>
              <button
                className={`ink-btn xs ${scope === 'all' ? 'primary' : ''}`}
                onClick={() => setScope('all')}
              >全件</button>
            </>
          )}
          <input
            className="ink-input"
            style={{ width: 220 }}
            placeholder="法人名 / TEL / 備考 / 引継ぎ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="ink-select"
            style={{ width: 120 }}
            value={yomiFilter}
            onChange={(e) => setYomiFilter(e.target.value)}
          >
            <option value="">全ヨミ</option>
            {Object.entries(YOMI_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="excel-tabs-bar">
        {TABS.map((s) => (
          <button
            key={s}
            className={`excel-tab ${tab === s ? 'active' : ''}`}
            onClick={() => setTab(s)}
          >
            {DEAL_STATUS_LABEL[s]}
            {tab === s && <span style={{ marginLeft: 4 }}>({deals.length})</span>}
          </button>
        ))}
      </div>

      <ExcelTable
        rows={filtered}
        cols={cols}
        rowKey={(d) => d.id}
        loading={loading}
        empty="該当案件なし"
        filename={`deals_${tab}`}
      />
    </div>
  )
}
