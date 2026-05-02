'use client'

import { useEffect, useState } from 'react'
import { listApprovals } from '@/lib/homes/api'
import type { HomesApproval } from '@/lib/homes/types'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<HomesApproval[]>([])

  useEffect(() => {
    void (async () => {
      const r = await listApprovals()
      setApprovals(r)
    })()
  }, [])

  return (
    <div className="stack">
      <header>
        <h1>稟議番号管理</h1>
        <p className="caption muted">M3.4 / 稟議番号 (KNP2025000101等) と特定優先エリア紐付け</p>
      </header>

      <section className="ink-card" style={{ padding: 0 }}>
        <table className="ink-table">
          <thead>
            <tr>
              <th>稟議番号</th>
              <th>タイトル</th>
              <th>値引き率</th>
              <th>値引き金額</th>
              <th>適用エリア</th>
              <th>有効期間</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {approvals.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>稟議番号未登録</td></tr>
            ) : approvals.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.approval_no}</td>
                <td>{a.title ?? '-'}</td>
                <td className="mono">{a.discount_rate != null ? `${(a.discount_rate * 100).toFixed(1)}%` : '-'}</td>
                <td className="mono">{a.discount_amount != null ? `¥${a.discount_amount.toLocaleString()}` : '-'}</td>
                <td className="caption">{a.applicable_area_ids?.length ?? 0} エリア</td>
                <td className="caption mono">{a.valid_from ?? '-'} 〜 {a.valid_until ?? '-'}</td>
                <td>{a.is_active ? <span className="ink-badge ink-badge-ok">有効</span> : <span className="ink-badge">無効</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ink-card">
        <h3>稟議番号運用ルール</h3>
        <ul className="caption" style={{ marginTop: 8, lineHeight: 1.8 }}>
          <li>商談ヨミ判定時に該当エリアの稟議番号を自動候補表示</li>
          <li>受注確定時に検収書記載項目へ自動転記</li>
          <li>有効期間外の稟議は自動非表示</li>
          <li>新規エリア追加は ADMIN ロールのみ操作可</li>
        </ul>
      </section>
    </div>
  )
}
