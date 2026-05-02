'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listCollections } from '@/lib/homes/api'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'
import AuditSheetSyncButton from '@/app/homes/_components/AuditSheetSyncButton'

// CR-06 / F-04 fix: 60d 固定 → 暦上 +2ヶ月 (Date#setMonth) で判定
// "5/15 承認" → "7/15 で再審査" になる (旧コード: 60日経過 = 7/14)
function isPastTwoCalendarMonths(approvedAtIso: string, now: Date = new Date()): boolean {
  const approved = new Date(approvedAtIso)
  if (isNaN(approved.getTime())) return false
  const due = new Date(approved)
  due.setMonth(due.getMonth() + 2)
  return now.getTime() >= due.getTime()
}

function daysBetween(from: string, now = new Date()): number | null {
  const d = new Date(from)
  if (isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

/**
 * M-03: 審査管理表
 * 議事録 G-13: 申込承認日から2ヶ月経過で再審査チェック自動オフ
 */

interface AuditRow {
  id: string
  company_name: string
  company_id: string
  audit_request_date: string | null
  audit_result: 'pending' | 'ok' | 'exempt' | 'ng' | null
  audit_document_no: string | null
  audit_progress: string | null
  audit_issue: string | null
  approved_at: string | null
  days_since: number | null
  needs_recheck: boolean
  status: string
  is_anti_social_checked: boolean
  notes: string | null
}

const RESULT_BG: Record<string, string> = {
  pending: 'rgba(255,159,10,0.18)',
  ok: 'rgba(52,199,89,0.20)',
  exempt: 'rgba(48,176,199,0.18)',
  ng: 'rgba(255,59,48,0.20)',
}
const RESULT_LABEL: Record<string, string> = {
  pending: '審査中', ok: '審査OK', exempt: '審査免除', ng: '審査NG',
}

function badge(text: string, bg = 'rgba(88,86,214,0.10)') {
  return <span className="ink-badge" style={{ background: bg, color: 'var(--text-primary)' }}>{text}</span>
}

const cols: ExcelCol<AuditRow>[] = [
  { key: 'company_name', label: '法人名', width: 220, sticky: true,
    value: (r) => r.company_name,
    render: (r) => <Link href={`/homes/call-list?company=${r.company_id}`} style={{ color: 'var(--ink-primary)', textDecoration: 'underline' }}>{r.company_name}</Link> },
  { key: 'audit_result', label: '審査結果', width: 110,
    value: (r) => r.audit_result ?? '',
    render: (r) => r.audit_result ? badge(RESULT_LABEL[r.audit_result] ?? r.audit_result, RESULT_BG[r.audit_result]) : <span className="muted">-</span> },
  { key: 'audit_request_date', label: '申請日', width: 110,
    value: (r) => r.audit_request_date ?? '',
    render: (r) => <span className="mono">{r.audit_request_date ?? '-'}</span> },
  { key: 'approved_at', label: '承認日', width: 110,
    value: (r) => r.approved_at ?? '',
    render: (r) => <span className="mono">{r.approved_at ?? '-'}</span> },
  { key: 'days_since', label: '経過日数', width: 90, num: true, agg: 'avg',
    value: (r) => r.days_since ?? 0,
    render: (r) => <span className="mono" style={{ color: r.needs_recheck ? 'var(--danger)' : undefined, fontWeight: r.needs_recheck ? 700 : 400 }}>{r.days_since ?? '-'}</span> },
  { key: 'needs_recheck', label: '再審査要否', width: 110,
    value: (r) => r.needs_recheck ? 1 : 0,
    render: (r) => r.needs_recheck ? badge('要再審査', 'rgba(255,59,48,0.20)') : badge('OK', 'rgba(52,199,89,0.18)') },
  { key: 'audit_document_no', label: '稟議書番号', width: 130, value: (r) => r.audit_document_no ?? '-' },
  { key: 'is_anti_social_checked', label: '反社チェック', width: 110,
    value: (r) => r.is_anti_social_checked ? 1 : 0,
    render: (r) => r.is_anti_social_checked ? badge('済', 'rgba(52,199,89,0.18)') : badge('未', 'rgba(255,159,10,0.18)') },
  { key: 'audit_progress', label: '進捗', width: 140, value: (r) => r.audit_progress ?? '-' },
  { key: 'audit_issue', label: '懸案', width: 200, value: (r) => r.audit_issue ?? '-' },
]

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'recheck' | 'ok'>('all')

  async function load() {
    setLoading(true)
    try {
      const data = await listCollections({ status: undefined })
      const now = new Date()
      const mapped: AuditRow[] = (data as any[])
        .filter((c: any) => c.audit_request_date || c.audit_result || c.audit_approved_at)
        .map((c: any) => {
          const approvedAt: string | null = c.audit_approved_at ?? null
          const daysSince = approvedAt ? daysBetween(approvedAt, now) : null
          const needsRecheck =
            approvedAt
              ? isPastTwoCalendarMonths(approvedAt, now) && c.audit_revalidate_required !== false
              : false
          return {
            id: c.id,
            company_name: c.homes_deals?.homes_companies?.company_name ?? '-',
            company_id: c.homes_deals?.company_id ?? '',
            audit_request_date: c.audit_request_date,
            audit_result: c.audit_result,
            audit_document_no: c.audit_document_no,
            audit_progress: c.audit_progress,
            audit_issue: c.audit_issue,
            approved_at: approvedAt,
            days_since: daysSince,
            needs_recheck: needsRecheck,
            status: c.status,
            is_anti_social_checked: !!c.is_anti_social_checked,
            notes: c.notes,
          }
        })
      setRows(mapped)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'pending') return rows.filter((r) => r.audit_result === 'pending')
    if (filter === 'ok') return rows.filter((r) => r.audit_result === 'ok')
    if (filter === 'recheck') return rows.filter((r) => r.needs_recheck)
    return rows
  }, [rows, filter])

  const stats = useMemo(() => ({
    pending: rows.filter((r) => r.audit_result === 'pending').length,
    ok: rows.filter((r) => r.audit_result === 'ok').length,
    ng: rows.filter((r) => r.audit_result === 'ng').length,
    recheck: rows.filter((r) => r.needs_recheck).length,
  }), [rows])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>審査管理表</h1>
          <p className="caption muted">M-03 / 反社・契約審査トラッカー / G-13 暦上 +2ヶ月で再審査</p>
        </div>
        <AuditSheetSyncButton autoRefresh />
      </header>

      <section className="grid-cards-4">
        {[
          { label: '審査中', val: stats.pending, color: 'rgba(255,159,10,0.18)' },
          { label: '審査OK', val: stats.ok, color: 'rgba(52,199,89,0.20)' },
          { label: '審査NG', val: stats.ng, color: 'rgba(255,59,48,0.20)' },
          { label: '要再審査(2ヶ月超)', val: stats.recheck, color: 'rgba(191,90,242,0.18)' },
        ].map((k) => (
          <article key={k.label} className="ink-card" style={{ background: k.color }}>
            <p className="caption muted">{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{k.val}</p>
          </article>
        ))}
      </section>

      <div className="excel-tabs-bar">
        {([['all', '全て'], ['pending', '審査中'], ['ok', '審査OK'], ['recheck', '要再審査']] as const).map(([k, l]) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l} ({k === 'all' ? rows.length : k === 'pending' ? stats.pending : k === 'ok' ? stats.ok : stats.recheck})</button>
        ))}
      </div>

      <ExcelTable
        rows={filtered}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
        empty="該当審査なし"
        filename={`審査管理表`}
      />
    </div>
  )
}
