'use client'

// GAP-D / 設定管理画面: 営業時間 / 定例 / 閾値

import { useEffect, useState } from 'react'
import { listSettings, upsertSetting } from '@/lib/homes/api'
import type { HomesSetting } from '@/lib/homes/types'

export default function SettingsPage() {
  const [rows, setRows] = useState<HomesSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      const r = await listSettings()
      setRows(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save(key: string) {
    const raw = editing[key]
    if (!raw) return
    try {
      const value = JSON.parse(raw)
      await upsertSetting(key, value)
      setEditing({ ...editing, [key]: '' })
      await load()
    } catch (e) {
      alert('JSON parse error: ' + (e as Error).message)
    }
  }

  return (
    <div className="stack">
      <header>
        <h1>システム設定</h1>
        <p className="caption muted">営業時間 / 定例 / 閾値 — homes_settings テーブル直接編集</p>
      </header>

      <section className="ink-card" style={{ padding: 0 }}>
        {loading ? (
          <p className="muted" style={{ padding: 24, textAlign: 'center' }}>読み込み中...</p>
        ) : (
          <table className="ink-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>キー</th>
                <th>説明</th>
                <th>現在の値</th>
                <th style={{ width: 320 }}>編集 (JSON)</th>
                <th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: 'center' }}>設定なし</td></tr>
              ) : rows.map((r) => (
                <tr key={r.key}>
                  <td className="mono">{r.key}</td>
                  <td className="caption">{r.description ?? '-'}</td>
                  <td className="mono caption">{JSON.stringify(r.value)}</td>
                  <td>
                    <input
                      className="ink-input mono"
                      placeholder={JSON.stringify(r.value)}
                      value={editing[r.key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [r.key]: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="ink-btn primary" disabled={!editing[r.key]} onClick={() => void save(r.key)}>
                      保存
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
