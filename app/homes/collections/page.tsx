'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listCollections, updateCollection, createOrder } from '@/lib/homes/api'
import { COLLECTION_STATUS_LABEL, type CollectionStatus, type Yomi, YOMI_LABEL } from '@/lib/homes/types'
import { ExcelTable, type ExcelCol } from '../_components/ExcelTable'

interface CollectionRow {
  id: string
  deal_id: string
  status: CollectionStatus
  ba_remind_date: string | null
  ba_remind_time: string | null
  confirm_mail_sent_at: string | null
  application_mail_sent_at: string | null
  expected_return_date: string | null
  irregular_handling: boolean
  audit_request_date: string | null
  audit_document_no: string | null
  audit_result: 'pending' | 'ok' | 'exempt' | 'ng' | null
  billing_month: string | null
  ftp_status: string | null
  audit_issue: string | null
  dw_stored_at: string | null
  is_anti_social_checked: boolean
  notes: string | null
  homes_deals: {
    id: string
    company_id: string
    latest_yomi: Yomi | null
    contact_count: number
    homes_companies: { company_name: string; phone: string }
  }
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'today', label: '本日リマ' },
  { key: 'irregular', label: 'イレギュラー' },
  { key: 'audit', label: '審査中' },
  { key: 'all', label: '全て' },
]

export default function CollectionsPage() {
  const [filter, setFilter] = useState('today')
  const [rows, setRows] = useState<CollectionRow[]>([])
  const [active, setActive] = useState<CollectionRow | null>(null)
  const [orderModal, setOrderModal] = useState<CollectionRow | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const opts: { remind_today?: boolean; status?: string } = {}
      if (filter === 'today') opts.remind_today = true
      if (filter === 'audit') opts.status = 'audit_requested'
      const data = await listCollections(opts)
      let filtered = data as unknown as CollectionRow[]
      if (filter === 'irregular') filtered = filtered.filter((r) => r.irregular_handling)
      setRows(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filter])

  async function patch(id: string, p: Partial<CollectionRow>) {
    await updateCollection(id, p as never)
    await load()
    if (active?.id === id) {
      const updated = rows.find((r) => r.id === id)
      if (updated) setActive({ ...updated, ...p })
    }
  }

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>回収管理表</h1>
          <p className="caption muted">S-06 / 回収主戦場 / Bヨミ以上で自動発生</p>
        </div>
      </header>

      <div className="agg-tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={`agg-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label} {filter === f.key && `(${rows.length})`}
          </button>
        ))}
      </div>

      <div className="grid-12">
        <div className="col-span-7">
          <CollectionsExcel
            rows={rows}
            loading={loading}
            activeId={active?.id ?? null}
            onSelect={setActive}
            onOrder={setOrderModal}
          />
        </div>

        <aside className="ink-card col-span-5">
          {!active ? (
            <p className="muted caption">案件を選択してください</p>
          ) : (
            <div className="stack">
              <header>
                <h3>{active.homes_deals?.homes_companies?.company_name}</h3>
                <p className="caption mono muted">{active.homes_deals?.homes_companies?.phone}</p>
              </header>

              <div className="ink-card" style={{ padding: 12 }}>
                <h4 style={{ marginBottom: 8 }}>B→A リマインド</h4>
                <div className="grid-12">
                  <label className="col-span-6">
                    <span className="caption muted">リマ予定日</span>
                    <input className="ink-input mono" type="date" value={active.ba_remind_date ?? ''} onChange={(e) => void patch(active.id, { ba_remind_date: e.target.value })} />
                  </label>
                  <label className="col-span-6">
                    <span className="caption muted">リマ時刻</span>
                    <input className="ink-input mono" type="time" value={active.ba_remind_time ?? ''} onChange={(e) => void patch(active.id, { ba_remind_time: e.target.value })} />
                  </label>
                </div>
              </div>

              <div className="ink-card" style={{ padding: 12 }}>
                <h4 style={{ marginBottom: 8 }}>送付フロー</h4>
                <div className="grid-12">
                  <label className="col-span-6">
                    <span className="caption muted">確認メール送付日</span>
                    <input className="ink-input mono" type="date" value={active.confirm_mail_sent_at?.slice(0, 10) ?? ''} onChange={(e) => void patch(active.id, { confirm_mail_sent_at: e.target.value || null, status: 'confirm_sent' })} />
                  </label>
                  <label className="col-span-6">
                    <span className="caption muted">申込書送付日</span>
                    <input className="ink-input mono" type="date" value={active.application_mail_sent_at?.slice(0, 10) ?? ''} onChange={(e) => void patch(active.id, { application_mail_sent_at: e.target.value || null, status: 'application_sent' })} />
                  </label>
                  <label className="col-span-6">
                    <span className="caption muted">返送予定日</span>
                    <input className="ink-input mono" type="date" value={active.expected_return_date ?? ''} onChange={(e) => void patch(active.id, { expected_return_date: e.target.value || null, status: 'return_pending' })} />
                  </label>
                  <label className="col-span-6" style={{ alignSelf: 'end' }}>
                    <span className="caption muted">イレギュラー対応中</span>
                    <input type="checkbox" checked={active.irregular_handling} onChange={(e) => void patch(active.id, { irregular_handling: e.target.checked })} />
                  </label>
                </div>
              </div>

              <div className="ink-card" style={{ padding: 12 }}>
                <h4 style={{ marginBottom: 8 }}>審査ブロック</h4>
                <div className="grid-12">
                  <label className="col-span-6">
                    <span className="caption muted">申請日</span>
                    <input className="ink-input mono" type="date" value={active.audit_request_date ?? ''} onChange={(e) => void patch(active.id, { audit_request_date: e.target.value || null, status: 'audit_requested' })} />
                  </label>
                  <label className="col-span-6">
                    <span className="caption muted">文書番号</span>
                    <input className="ink-input mono" value={active.audit_document_no ?? ''} onChange={(e) => void patch(active.id, { audit_document_no: e.target.value || null })} />
                  </label>
                  <label className="col-span-4">
                    <span className="caption muted">審査結果</span>
                    <select className="ink-select" value={active.audit_result ?? ''} onChange={(e) => void patch(active.id, { audit_result: (e.target.value || null) as never })}>
                      <option value="">未</option>
                      <option value="pending">審査中</option>
                      <option value="ok">OK</option>
                      <option value="exempt">免除</option>
                      <option value="ng">NG</option>
                    </select>
                  </label>
                  <label className="col-span-4">
                    <span className="caption muted">課金月</span>
                    <input className="ink-input mono" type="month" value={active.billing_month?.slice(0, 7) ?? ''} onChange={(e) => void patch(active.id, { billing_month: e.target.value ? `${e.target.value}-01` : null })} />
                  </label>
                  <label className="col-span-4">
                    <span className="caption muted">FTP状況</span>
                    <input className="ink-input" value={active.ftp_status ?? ''} onChange={(e) => void patch(active.id, { ftp_status: e.target.value || null })} />
                  </label>
                  <label className="col-span-12">
                    <span className="caption muted">不備内容</span>
                    <input className="ink-input" value={active.audit_issue ?? ''} onChange={(e) => void patch(active.id, { audit_issue: e.target.value || null })} />
                  </label>
                  <label className="col-span-6">
                    <span className="caption muted">DW格納日</span>
                    <input className="ink-input mono" type="date" value={active.dw_stored_at?.slice(0, 10) ?? ''} onChange={(e) => void patch(active.id, { dw_stored_at: e.target.value || null })} />
                  </label>
                  <label className="col-span-6" style={{ alignSelf: 'end' }}>
                    <span className="caption muted">反社チェック済</span>
                    <input type="checkbox" checked={active.is_anti_social_checked} onChange={(e) => void patch(active.id, { is_anti_social_checked: e.target.checked })} />
                  </label>
                </div>
              </div>

              <Link href={`/homes/deals/${active.deal_id}`} className="ink-btn">案件詳細を見る</Link>
            </div>
          )}
        </aside>
      </div>

      {orderModal && (
        <OrderConfirmModal
          collection={orderModal}
          onClose={() => setOrderModal(null)}
          onSaved={() => { setOrderModal(null); void load() }}
        />
      )}
    </div>
  )
}

function CollectionsExcel({
  rows,
  loading,
  activeId,
  onSelect,
  onOrder,
}: {
  rows: CollectionRow[]
  loading: boolean
  activeId: string | null
  onSelect: (r: CollectionRow) => void
  onOrder: (r: CollectionRow) => void
}) {
  const cols = useMemo<ExcelCol<CollectionRow>[]>(() => [
    {
      key: 'company', label: '企業名', width: 200, sticky: true,
      value: (r) => r.homes_deals?.homes_companies?.company_name ?? '',
    },
    { key: 'tel', label: 'TEL', width: 130, value: (r) => r.homes_deals?.homes_companies?.phone ?? '' },
    { key: 'yomi', label: 'ヨミ', width: 80,
      value: (r) => r.homes_deals?.latest_yomi ?? '',
      render: (r) => r.homes_deals?.latest_yomi
        ? <span className="ink-badge ink-badge-accent">{YOMI_LABEL[r.homes_deals.latest_yomi]}</span>
        : '-' },
    { key: 'count', label: '商談', width: 70, num: true, agg: 'avg',
      value: (r) => r.homes_deals?.contact_count ?? 0,
      render: (r) => `${r.homes_deals?.contact_count}/10` },
    { key: 'status', label: '状態', width: 110,
      value: (r) => COLLECTION_STATUS_LABEL[r.status],
      render: (r) => <span className="ink-badge">{COLLECTION_STATUS_LABEL[r.status]}</span> },
    { key: 'remind', label: 'リマ予定', width: 120,
      value: (r) => `${r.ba_remind_date ?? ''} ${r.ba_remind_time?.slice(0, 5) ?? ''}`.trim() },
    { key: 'irregular', label: 'イレギュラー', width: 100,
      value: (r) => r.irregular_handling ? '対応中' : '',
      render: (r) => r.irregular_handling
        ? <span className="ink-badge ink-badge-hot">対応中</span>
        : '-' },
    { key: 'audit', label: '審査', width: 80, value: (r) => r.audit_result ?? '' },
    {
      key: 'action', label: '操作', width: 100,
      value: () => '',
      render: (r) => r.status !== 'won' ? (
        <button className="ink-btn xs success" onClick={(e) => { e.stopPropagation(); onOrder(r) }}>受注確定</button>
      ) : null,
    },
  ], [onOrder])

  return (
    <ExcelTable
      rows={rows}
      cols={cols}
      rowKey={(r) => r.id}
      loading={loading}
      empty="回収中の案件はありません"
      filename="collections"
      selected={activeId ? new Set([activeId]) : undefined}
      onRowClick={onSelect}
    />
  )
}

function OrderConfirmModal({
  collection,
  onClose,
  onSaved,
}: {
  collection: CollectionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [contact, setContact] = useState({ name: '', email: '', phone: '', role: '' })
  const [company, setCompany] = useState({ name: '', address: '', representative: '', takken: '' })
  const [billing, setBilling] = useState({ method: '', cycle: '', billing_email: '', notes: '' })
  const [appraisal, setAppraisal] = useState({ category: '', max_count: '', types: '' })
  const [other, setOther] = useState({ memo: '' })
  const [acceptance, setAcceptance] = useState({ contract_no: '', initial_fee: '', monthly_fee: '', start_month: '' })
  const [applicationFile, setApplicationFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      let applicationFormUrl: string | null = null
      if (applicationFile) {
        const { uploadApplicationForm } = await import('@/lib/homes/storage')
        applicationFormUrl = await uploadApplicationForm(collection.id, applicationFile)
      }
      await createOrder({
        collection_id: collection.id,
        deal_id: collection.deal_id,
        company_id: collection.homes_deals.company_id,
        ordered_at: new Date().toISOString(),
        contact_block: contact,
        company_block: company,
        billing_block: billing,
        appraisal_block: appraisal,
        other_block: other,
        acceptance_block: acceptance,
        initial_fee: Number(acceptance.initial_fee) || null,
        monthly_fee: Number(acceptance.monthly_fee) || null,
        list_price_billing_start_month: acceptance.start_month ? `${acceptance.start_month}-01` : null,
        application_form_url: applicationFormUrl,
      } as never)
      onSaved()
    } catch (e) {
      alert(`受注確定エラー: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ink-modal-backdrop" onClick={onClose}>
      <div className="ink-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <header className="between" style={{ marginBottom: 12 }}>
          <h2>受注確定 / LIFULL納品ブロック</h2>
          <button className="ink-btn" aria-label="閉じる" onClick={onClose}>×</button>
        </header>
        <p className="caption muted" style={{ marginBottom: 16 }}>
          {collection.homes_deals?.homes_companies?.company_name} の受注情報を入力してください。F-5.6 反社チェック・F-5.5 受注確定モーダル準拠
        </p>

        <div className="stack">
          <div className="ink-card" style={{ padding: 12 }}>
            <h4>担当者情報</h4>
            <div className="grid-12" style={{ marginTop: 8 }}>
              <label className="col-span-6"><span className="caption muted">氏名</span><input className="ink-input" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
              <label className="col-span-6"><span className="caption muted">役職</span><input className="ink-input" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} /></label>
              <label className="col-span-6"><span className="caption muted">メール</span><input className="ink-input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
              <label className="col-span-6"><span className="caption muted">電話</span><input className="ink-input mono" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
            </div>
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>会社情報</h4>
            <div className="grid-12" style={{ marginTop: 8 }}>
              <label className="col-span-6"><span className="caption muted">商号</span><input className="ink-input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></label>
              <label className="col-span-6"><span className="caption muted">代表者</span><input className="ink-input" value={company.representative} onChange={(e) => setCompany({ ...company, representative: e.target.value })} /></label>
              <label className="col-span-8"><span className="caption muted">所在地</span><input className="ink-input" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></label>
              <label className="col-span-4"><span className="caption muted">宅建免許番号</span><input className="ink-input mono" value={company.takken} onChange={(e) => setCompany({ ...company, takken: e.target.value })} /></label>
            </div>
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>請求案内</h4>
            <div className="grid-12" style={{ marginTop: 8 }}>
              <label className="col-span-4"><span className="caption muted">支払方法</span><input className="ink-input" value={billing.method} onChange={(e) => setBilling({ ...billing, method: e.target.value })} /></label>
              <label className="col-span-4"><span className="caption muted">請求サイクル</span><input className="ink-input" value={billing.cycle} onChange={(e) => setBilling({ ...billing, cycle: e.target.value })} /></label>
              <label className="col-span-4"><span className="caption muted">請求書送付先</span><input className="ink-input" type="email" value={billing.billing_email} onChange={(e) => setBilling({ ...billing, billing_email: e.target.value })} /></label>
              <label className="col-span-12"><span className="caption muted">備考</span><input className="ink-input" value={billing.notes} onChange={(e) => setBilling({ ...billing, notes: e.target.value })} /></label>
            </div>
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>売却査定 (受注時)</h4>
            <div className="grid-12" style={{ marginTop: 8 }}>
              <label className="col-span-4"><span className="caption muted">カテゴリ</span><input className="ink-input" value={appraisal.category} onChange={(e) => setAppraisal({ ...appraisal, category: e.target.value })} /></label>
              <label className="col-span-4"><span className="caption muted">設定上限</span><input className="ink-input mono" type="number" min={0} value={appraisal.max_count} onChange={(e) => setAppraisal({ ...appraisal, max_count: e.target.value })} /></label>
              <label className="col-span-4"><span className="caption muted">対象種別 (カンマ)</span><input className="ink-input" value={appraisal.types} onChange={(e) => setAppraisal({ ...appraisal, types: e.target.value })} /></label>
            </div>
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>その他</h4>
            <textarea className="ink-textarea" rows={2} value={other.memo} onChange={(e) => setOther({ memo: e.target.value })} />
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>検収書記載 (Acceptance)</h4>
            <div className="grid-12" style={{ marginTop: 8 }}>
              <label className="col-span-3"><span className="caption muted">契約番号</span><input className="ink-input mono" value={acceptance.contract_no} onChange={(e) => setAcceptance({ ...acceptance, contract_no: e.target.value })} /></label>
              <label className="col-span-3"><span className="caption muted">イニシャル (円)</span><input className="ink-input mono" type="number" min={0} value={acceptance.initial_fee} onChange={(e) => setAcceptance({ ...acceptance, initial_fee: e.target.value })} /></label>
              <label className="col-span-3"><span className="caption muted">月額 (円)</span><input className="ink-input mono" type="number" min={0} value={acceptance.monthly_fee} onChange={(e) => setAcceptance({ ...acceptance, monthly_fee: e.target.value })} /></label>
              <label className="col-span-3"><span className="caption muted">課金開始月</span><input className="ink-input mono" type="month" value={acceptance.start_month} onChange={(e) => setAcceptance({ ...acceptance, start_month: e.target.value })} /></label>
            </div>
          </div>

          <div className="ink-card" style={{ padding: 12 }}>
            <h4>申込書 PDF (G-10)</h4>
            <p className="caption muted" style={{ marginBottom: 8 }}>
              アップロードすると担当クローザーへ自動通知されます
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setApplicationFile(e.target.files?.[0] ?? null)}
            />
            {applicationFile && (
              <p className="caption" style={{ marginTop: 6 }}>
                選択中: {applicationFile.name} ({(applicationFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <div className="row-tight" style={{ justifyContent: 'flex-end' }}>
            <button className="ink-btn" onClick={onClose}>キャンセル</button>
            <button className="ink-btn success" disabled={saving} onClick={submit}>
              {saving ? '保存中...' : '受注確定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
