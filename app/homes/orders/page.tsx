'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listOrders, listUsers, getCurrentHomesUser } from '@/lib/homes/api'
import { ExcelTable, type ExcelCol } from '@/app/homes/_components/ExcelTable'
import PdfUploader from '@/app/homes/_components/PdfUploader'
import type { HomesUser } from '@/lib/homes/types'

/** M-02: 受注管理表 */
interface OrderRow {
  id: string
  ordered_at: string
  company_name: string
  company_id: string
  closer_user_id: string | null
  closer_name: string | null
  proposal_plan: string | null
  initial_fee: number | null
  monthly_fee: number | null
  product_kind: string | null
  approval_id: string | null
  application_pdf_url: string | null
  application_pdf_uploaded_at: string | null
  raw: Record<string, unknown>
}

function makeCols(onUploadClick: (orderId: string) => void): ExcelCol<OrderRow>[] {
  return [
    { key: 'ordered_at', label: '受注日', width: 110, sticky: true,
      value: (r) => r.ordered_at?.slice(0, 10) ?? '',
      render: (r) => <span className="mono">{r.ordered_at?.slice(0, 10) ?? '-'}</span> },
    { key: 'company_name', label: '法人名', width: 220,
      value: (r) => r.company_name,
      render: (r) => (
        // CR-10 fix: 視覚 underline + focus-visible リング
        <Link
          href={`/homes/call-list?company=${r.company_id}`}
          style={{ color: 'var(--ink-primary)', textDecoration: 'underline' }}
        >
          {r.company_name}
        </Link>
      ) },
    { key: 'closer_name', label: 'クローザー', width: 130, value: (r) => r.closer_name ?? '-' },
    { key: 'proposal_plan', label: '提案プラン', width: 180, value: (r) => r.proposal_plan ?? '-' },
    { key: 'product_kind', label: '商材', width: 110, value: (r) => r.product_kind ?? '-' },
    { key: 'initial_fee', label: '初期費用', width: 110, num: true, agg: 'sum',
      value: (r) => r.initial_fee ?? 0,
      render: (r) => <span className="mono">{(r.initial_fee ?? 0).toLocaleString()}</span> },
    { key: 'monthly_fee', label: '月額', width: 110, num: true, agg: 'sum',
      value: (r) => r.monthly_fee ?? 0,
      render: (r) => <span className="mono">{(r.monthly_fee ?? 0).toLocaleString()}</span> },
    { key: 'approval_id', label: '稟議番号', width: 120, value: (r) => r.approval_id ?? '-' },
    {
      key: 'application_pdf', label: '申込書PDF', width: 160,
      value: (r) => r.application_pdf_url ?? '',
      render: (r) =>
        r.application_pdf_url ? (
          <a
            href={r.application_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--ink-primary)', textDecoration: 'underline', fontSize: 12 }}
          >
            PDF表示 ({r.application_pdf_uploaded_at?.slice(0, 10) ?? '-'})
          </a>
        ) : (
          <button
            className="ink-btn xs"
            onClick={() => onUploadClick(r.id)}
            aria-label="申込書PDFをアップロード"
          >
            アップロード
          </button>
        ),
    },
  ]
}

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [users, setUsers] = useState<HomesUser[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [closerId, setCloserId] = useState<string>('')
  const [me, setMe] = useState<HomesUser | null>(null)
  const [uploadOrderId, setUploadOrderId] = useState<string | null>(null)

  useEffect(() => { void listUsers({ role: 'CLOSER' }).then((u) => setUsers(u as unknown as HomesUser[])) }, [])
  useEffect(() => { void getCurrentHomesUser().then(setMe) }, [])

  async function load() {
    setLoading(true)
    try {
      const since = `${month}-01T00:00:00+09:00`
      const data = await listOrders({ since })
      const map = new Map(users.map((u) => [u.id, u.name]))
      setRows((data as any[]).map((o: any) => ({
        id: o.id,
        ordered_at: o.ordered_at,
        company_name: o.homes_companies?.company_name ?? '-',
        company_id: o.company_id,
        closer_user_id: o.closer_user_id,
        closer_name: o.closer_user_id ? (map.get(o.closer_user_id) ?? null) : null,
        proposal_plan: o.proposal_plan,
        initial_fee: o.initial_fee,
        monthly_fee: o.monthly_fee,
        product_kind: o.product_kind,
        approval_id: o.approval_id,
        application_pdf_url: o.application_pdf_url ?? null,
        application_pdf_uploaded_at: o.application_pdf_uploaded_at ?? null,
        raw: o,
      })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [month])

  const cols = useMemo(
    () => makeCols((id) => setUploadOrderId(id)),
    []
  )

  const filtered = useMemo(() => closerId ? rows.filter((r) => r.closer_user_id === closerId) : rows, [rows, closerId])
  const totalInitial = filtered.reduce((s, r) => s + (r.initial_fee ?? 0), 0)
  const totalMonthly = filtered.reduce((s, r) => s + (r.monthly_fee ?? 0), 0)
  const uploadingOrder = uploadOrderId ? rows.find((r) => r.id === uploadOrderId) : null

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>受注管理表</h1>
          <p className="caption muted">M-02 / クローザー成約一覧 / Excel互換ビュー</p>
        </div>
        <div className="row-tight">
          <input type="month" className="ink-input mono" value={month} onChange={(e) => setMonth(e.target.value)} />
          <select className="ink-input" value={closerId} onChange={(e) => setCloserId(e.target.value)}>
            <option value="">全クローザー</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </header>

      <section className="grid-cards-3">
        <article className="ink-card">
          <p className="caption muted">受注件数</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>{filtered.length.toLocaleString()}</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">初期費用合計</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>¥{totalInitial.toLocaleString()}</p>
        </article>
        <article className="ink-card">
          <p className="caption muted">月額合計 (MRR)</p>
          <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>¥{totalMonthly.toLocaleString()}</p>
        </article>
      </section>

      <ExcelTable
        rows={filtered}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
        empty="該当受注なし"
        filename={`受注管理表_${month}`}
      />

      {uploadingOrder && me && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="申込書PDFアップロード"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setUploadOrderId(null)}
        >
          <div
            className="ink-card"
            style={{ background: '#fff', minWidth: 480, maxWidth: 640, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>申込書PDF アップロード</h3>
              <button
                className="ink-btn xs"
                aria-label="閉じる"
                onClick={() => setUploadOrderId(null)}
              >
                ×
              </button>
            </div>
            <p className="caption muted" style={{ marginBottom: 12 }}>
              {uploadingOrder.company_name} / 受注日 {uploadingOrder.ordered_at?.slice(0, 10)}
            </p>
            <PdfUploader
              orderId={uploadingOrder.id}
              uploadedBy={me.id}
              currentUrl={uploadingOrder.application_pdf_url}
              onUploaded={() => {
                setUploadOrderId(null)
                void load()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
