'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getDeal } from '@/lib/homes/api'
import { DEAL_STATUS_LABEL, YOMI_LABEL, type DealStatus, type Yomi } from '@/lib/homes/types'

interface DealFull {
  id: string
  status: DealStatus
  latest_yomi: Yomi | null
  appointed_at: string
  appointment_kind: string | null
  appointment_type: string | null
  contact_count: number
  reschedule_count: number
  reschedule_reason: string | null
  disappear_reason: string | null
  notes: string | null
  homes_companies: { id: string; company_name: string; phone: string; prefecture: string | null; city: string | null }
  homes_lists: { name: string } | null
  appointer: { name: string } | null
  closer: { name: string } | null
  homes_meetings: Array<{
    id: string
    meeting_seq: number
    scheduled_at: string | null
    status: string
    yomi: Yomi | null
    proposal_plan: string | null
    meeting_content: string | null
    next_content: string | null
    next_date: string | null
    initial_fee: number | null
    running_fee: number | null
    issue_agreement: string | null
    b_yomi_date: string | null
    a_yomi_date: string | null
    won_date: string | null
    lost_date: string | null
    lost_reason: string | null
    sale_slot_count: number | null
    rent_slot_count: number | null
  }>
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [deal, setDeal] = useState<DealFull | null>(null)

  useEffect(() => {
    void (async () => {
      const d = await getDeal(id)
      setDeal(d as unknown as DealFull)
    })()
  }, [id])

  if (!deal) return <p className="muted">読込中...</p>

  const meetings = (deal.homes_meetings ?? []).sort((a, b) => a.meeting_seq - b.meeting_seq)

  return (
    <div className="stack">
      <header className="between">
        <div>
          <Link href="/homes/deals" className="caption" style={{ color: 'var(--accent-sub)' }}>← 案件管理表</Link>
          <h1>{deal.homes_companies.company_name}</h1>
          <p className="caption mono">{deal.homes_companies.phone} / {deal.homes_companies.prefecture}{deal.homes_companies.city}</p>
        </div>
        <div className="row-tight">
          <span className={`ink-badge ${deal.status === 'won' ? 'ink-badge-ok' : deal.status === 'lost' ? 'ink-badge-ng' : 'ink-badge-accent'}`}>
            {DEAL_STATUS_LABEL[deal.status]}
          </span>
          {deal.latest_yomi && <span className="ink-badge ink-badge-accent">最新ヨミ {YOMI_LABEL[deal.latest_yomi]}</span>}
        </div>
      </header>

      <section className="grid-12">
        <div className="ink-card col-span-6">
          <h3 style={{ marginBottom: 8 }}>アポ情報</h3>
          <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', fontSize: 13 }}>
            <dt className="muted">アポ取得日</dt><dd className="mono">{deal.appointed_at?.slice(0, 10)}</dd>
            <dt className="muted">アポ取得者</dt><dd>{deal.appointer?.name ?? '-'}</dd>
            <dt className="muted">クローザー</dt><dd>{deal.closer?.name ?? '-'}</dd>
            <dt className="muted">アポ種類</dt><dd>{deal.appointment_kind ?? '-'}</dd>
            <dt className="muted">商談種別</dt><dd>{deal.appointment_type === 'web' ? 'WEB' : '電話'}</dd>
            <dt className="muted">由来リスト</dt><dd>{deal.homes_lists?.name ?? '-'}</dd>
            <dt className="muted">商談回数</dt><dd className="mono">{deal.contact_count} / 10</dd>
            <dt className="muted">リスケ回数</dt><dd className="mono">{deal.reschedule_count}</dd>
            {deal.reschedule_reason && <><dt className="muted">リスケ理由</dt><dd>{deal.reschedule_reason}</dd></>}
            {deal.disappear_reason && <><dt className="muted">消滅理由</dt><dd>{deal.disappear_reason}</dd></>}
            {deal.notes && <><dt className="muted">備考</dt><dd>{deal.notes}</dd></>}
          </dl>
        </div>

        <div className="ink-card col-span-6">
          <div className="between" style={{ marginBottom: 12 }}>
            <h3>商談履歴 ({meetings.length}/10)</h3>
            <Link href={`/homes/meetings/new?deal_id=${deal.id}`} className="ink-btn primary">＋ 商談記録</Link>
          </div>
          {meetings.length === 0 ? (
            <p className="muted caption">商談未実施</p>
          ) : (
            <div className="col-tight" style={{ position: 'relative' }}>
              {meetings.map((m) => (
                <div key={m.id} style={{ borderLeft: '2px solid var(--accent-sub)', paddingLeft: 12, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -6, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                  <div className="row-tight">
                    <span className="ink-badge ink-badge-accent">第{m.meeting_seq}回</span>
                    {m.yomi && <span className="ink-badge">{YOMI_LABEL[m.yomi]}</span>}
                    <span className="caption mono">{m.scheduled_at?.slice(0, 10) ?? '-'}</span>
                  </div>
                  {m.proposal_plan && <p style={{ marginTop: 4, fontSize: 13 }}>{m.proposal_plan}</p>}
                  {m.meeting_content && <p className="caption" style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{m.meeting_content}</p>}
                  {(m.initial_fee || m.running_fee) && (
                    <p className="caption mono" style={{ marginTop: 4 }}>
                      Init: ¥{m.initial_fee?.toLocaleString() ?? '-'} / Run: ¥{m.running_fee?.toLocaleString() ?? '-'}
                    </p>
                  )}
                  {m.next_content && <p className="caption">NEXT: {m.next_content} ({m.next_date ?? '日付未'})</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
