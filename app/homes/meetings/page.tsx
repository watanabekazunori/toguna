'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listMeetingsToday, listDeals, getCurrentHomesUser } from '@/lib/homes/api'
import { YOMI_LABEL, type Yomi, type HomesUser } from '@/lib/homes/types'
import { ExcelTable, type ExcelCol } from '../_components/ExcelTable'

interface MeetingToday {
  id: string
  scheduled_at: string | null
  meeting_seq: number
  status: string
  yomi: Yomi | null
  meeting_type: string | null
  homes_deals: {
    id: string
    appointment_kind: string | null
    homes_companies: { company_name: string; phone: string }
  }
}

interface DealSummary {
  id: string
  status: string
  latest_yomi: Yomi | null
  contact_count: number
  homes_companies: { company_name: string; phone: string }
}

export default function MeetingsPage() {
  const [me, setMe] = useState<HomesUser | null>(null)
  const [today, setToday] = useState<MeetingToday[]>([])
  const [cYomi, setCYomi] = useState<DealSummary[]>([])
  const [tab, setTab] = useState<'today' | 'c_yomi'>('today')
  // CL-02/03: クローザーは自分担当のみが既定。SV/PM/ADMIN は all 切替可。
  const [scope, setScope] = useState<'mine' | 'all'>('mine')

  useEffect(() => {
    void (async () => {
      const u = await getCurrentHomesUser()
      setMe(u)
      // CLOSER以外（SV/PM/ADMIN）はデフォルトで全件
      if (u && u.role !== 'CLOSER') setScope('all')
    })()
  }, [])

  useEffect(() => {
    if (!me) return
    void (async () => {
      const isCloserScope = me.role === 'CLOSER' || scope === 'mine'
      const closerId = isCloserScope ? me.id : undefined
      const [t, cy] = await Promise.all([
        listMeetingsToday(closerId),
        listDeals({ status: 'c_yomi_following', closer_user_id: closerId }),
      ])
      setToday(t as unknown as MeetingToday[])
      setCYomi(cy as unknown as DealSummary[])
    })()
  }, [me, scope])

  const todayCols = useMemo<ExcelCol<MeetingToday>[]>(() => [
    {
      key: 'time', label: '時刻', width: 70, sticky: true,
      value: (m) => m.scheduled_at?.slice(11, 16) ?? '',
    },
    {
      key: 'company', label: '企業名', width: 220,
      value: (m) => m.homes_deals?.homes_companies?.company_name ?? '',
      render: (m) => (
        <Link href={`/homes/deals/${m.homes_deals?.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
          {m.homes_deals?.homes_companies?.company_name}
        </Link>
      ),
    },
    { key: 'tel', label: 'TEL', width: 130, value: (m) => m.homes_deals?.homes_companies?.phone ?? '' },
    { key: 'kind', label: 'アポ種類', width: 120, value: (m) => m.homes_deals?.appointment_kind ?? '' },
    {
      key: 'mtype', label: '種別', width: 80,
      value: (m) => m.meeting_type === 'web' ? 'WEB' : m.meeting_type === 'phone' ? '電話' : '',
    },
    { key: 'seq', label: '第N回', width: 70, num: true, agg: 'avg', value: (m) => m.meeting_seq },
    { key: 'status', label: '状態', width: 110,
      value: (m) => m.status,
      render: (m) => <span className="ink-badge">{m.status}</span> },
    { key: 'yomi', label: 'ヨミ', width: 90,
      value: (m) => m.yomi ?? '',
      render: (m) => m.yomi
        ? <span className="ink-badge ink-badge-accent">{YOMI_LABEL[m.yomi]}</span>
        : '-' },
    {
      key: 'action', label: '操作', width: 90,
      value: () => '',
      render: (m) => (
        <Link
          className="ink-btn xs"
          href={`/homes/meetings/new?deal_id=${m.homes_deals?.id}&meeting_id=${m.id}`}
        >更新</Link>
      ),
    },
  ], [])

  const cYomiCols = useMemo<ExcelCol<DealSummary>[]>(() => [
    {
      key: 'company', label: '企業名', width: 240, sticky: true,
      value: (d) => d.homes_companies?.company_name ?? '',
      render: (d) => (
        <Link href={`/homes/deals/${d.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
          {d.homes_companies?.company_name}
        </Link>
      ),
    },
    { key: 'tel', label: 'TEL', width: 130, value: (d) => d.homes_companies?.phone ?? '' },
    { key: 'count', label: '商談回数', width: 90, num: true, agg: 'avg',
      value: (d) => d.contact_count,
      render: (d) => `${d.contact_count}/10` },
    { key: 'yomi', label: '最新ヨミ', width: 100,
      value: (d) => d.latest_yomi ?? '',
      render: (d) => d.latest_yomi
        ? <span className="ink-badge ink-badge-accent">{YOMI_LABEL[d.latest_yomi]}</span>
        : '-' },
    { key: 'status', label: 'ステータス', width: 130, value: (d) => d.status },
    {
      key: 'action', label: '操作', width: 100,
      value: () => '',
      render: (d) => <Link className="ink-btn xs" href={`/homes/deals/${d.id}`}>詳細</Link>,
    },
  ], [])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>商談管理表</h1>
          <p className="caption muted">
            S-05 / クローザー主戦場 / Excel互換ビュー
            {me && ` · ${me.name} (${me.role})`}
          </p>
        </div>
        {me && me.role !== 'CLOSER' && (
          <div className="row" style={{ gap: 8 }}>
            <button
              className={`ink-btn xs ${scope === 'mine' ? 'primary' : ''}`}
              onClick={() => setScope('mine')}
            >自分の担当</button>
            <button
              className={`ink-btn xs ${scope === 'all' ? 'primary' : ''}`}
              onClick={() => setScope('all')}
            >全件</button>
          </div>
        )}
      </header>

      <div className="excel-tabs-bar">
        <button className={`excel-tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
          本日の商談 ({today.length})
        </button>
        <button className={`excel-tab ${tab === 'c_yomi' ? 'active' : ''}`} onClick={() => setTab('c_yomi')}>
          Cヨミ追客 ({cYomi.length})
        </button>
      </div>

      {tab === 'today' && (
        <ExcelTable
          rows={today}
          cols={todayCols}
          rowKey={(m) => m.id}
          empty="本日の商談予定なし"
          filename="meetings_today"
        />
      )}

      {tab === 'c_yomi' && (
        <ExcelTable
          rows={cYomi}
          cols={cYomiCols}
          rowKey={(d) => d.id}
          empty="Cヨミ追客中なし"
          filename="meetings_cyomi"
        />
      )}
    </div>
  )
}
