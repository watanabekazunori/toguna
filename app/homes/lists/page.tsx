'use client'

import { useEffect, useRef, useState } from 'react'
import { listLists } from '@/lib/homes/api'
import type { HomesList } from '@/lib/homes/types'

export default function ListsPage() {
  const [lists, setLists] = useState<HomesList[]>([])
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; updated: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const r = await listLists()
    setLists(r)
  }

  useEffect(() => { void load() }, [])

  async function importCsv() {
    const file = fileRef.current?.files?.[0]
    if (!file) return alert('CSVファイルを選択してください')
    if (!name) return alert('リスト名を入力してください')

    setImporting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('name', name)
      if (source) fd.set('source', source)
      if (description) fd.set('description', description)

      const res = await fetch('/api/homes/companies/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'import failed')
      setResult(json)
      await load()
      setName(''); setSource(''); setDescription('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      alert(`インポートエラー: ${(e as Error).message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="stack">
      <header>
        <h1>リスト管理</h1>
        <p className="caption muted">M1.4 / CSV インポート + リスト命名管理</p>
      </header>

      <section className="ink-card">
        <h3>新規リスト + CSV インポート</h3>
        <p className="caption muted" style={{ marginTop: 4 }}>
          列: company_name, phone, prefecture, city, address, capital, employees, established_at, takken_license_no, homepage 等。電話番号で重複統合。
        </p>
        <div className="grid-12" style={{ marginTop: 12 }}>
          <label className="col-span-4">
            <span className="caption muted">リスト名 *</span>
            <input className="ink-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 2026-05 関西エリア仕入れリスト" />
          </label>
          <label className="col-span-4">
            <span className="caption muted">取得元</span>
            <input className="ink-input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="例: HOME'S FRANCHISE / 自社調査" />
          </label>
          <label className="col-span-4">
            <span className="caption muted">CSVファイル</span>
            <input ref={fileRef} type="file" accept=".csv" className="ink-input" />
          </label>
          <label className="col-span-12">
            <span className="caption muted">説明</span>
            <input className="ink-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="row-tight" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="ink-btn primary" disabled={importing} onClick={importCsv}>
            {importing ? 'インポート中...' : 'CSV インポート'}
          </button>
        </div>
        {result && (
          <div className="ink-card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-panel)' }}>
            <p className="caption">完了: 新規 {result.inserted} / 更新 {result.updated} / 総 {result.total}</p>
          </div>
        )}
      </section>

      <section className="ink-card" style={{ padding: 0 }}>
        <table className="ink-table">
          <thead>
            <tr>
              <th>リスト名</th>
              <th>取得元</th>
              <th>件数</th>
              <th>取得日</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {lists.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>リストなし</td></tr>
            ) : lists.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.source ?? '-'}</td>
                <td className="mono">{l.total_count.toLocaleString()}</td>
                <td className="caption mono">{l.imported_at?.slice(0, 10) ?? '-'}</td>
                <td className="caption">{l.description ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
