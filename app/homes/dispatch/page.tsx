'use client'

// GAP-K: AI 割り振りルール管理画面

import { useEffect, useState } from 'react'
import { listDispatchRules, listDispatchRuns, upsertDispatchRule, listTeams } from '@/lib/homes/api'
import type { HomesDispatchRule, HomesDispatchRun, HomesTeam, UserRole } from '@/lib/homes/types'

const ROLES: UserRole[] = ['APPOINTER', 'CLOSER', 'COLLECTOR', 'SV', 'PM', 'ADMIN']

export default function DispatchPage() {
  const [rules, setRules] = useState<HomesDispatchRule[]>([])
  const [runs, setRuns] = useState<HomesDispatchRun[]>([])
  const [teams, setTeams] = useState<HomesTeam[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    priority: 100,
    target_team_id: '',
    target_role: 'APPOINTER' as UserRole,
    weight: 1.0,
    conditions: '{}',
  })

  async function load() {
    setLoading(true)
    try {
      const [r, runs, t] = await Promise.all([listDispatchRules(), listDispatchRuns(20), listTeams()])
      setRules(r)
      setRuns(runs)
      setTeams(t)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function createRule() {
    try {
      const conditions = JSON.parse(draft.conditions)
      await upsertDispatchRule({
        name: draft.name,
        priority: draft.priority,
        is_active: true,
        target_team_id: draft.target_team_id || null,
        target_role: draft.target_role,
        weight: draft.weight,
        conditions,
      })
      setCreating(false)
      setDraft({ name: '', priority: 100, target_team_id: '', target_role: 'APPOINTER', weight: 1.0, conditions: '{}' })
      await load()
    } catch (e) {
      alert('保存エラー: ' + (e as Error).message)
    }
  }

  async function toggleRule(rule: HomesDispatchRule) {
    await upsertDispatchRule({ id: rule.id, is_active: !rule.is_active })
    await load()
  }

  async function manualRun() {
    if (!confirm('AI 割り振りを今すぐ実行しますか？')) return
    try {
      const res = await fetch('/api/dispatch-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '失敗')
      alert(`完了: 割り振り ${json.assigned_count ?? '-'} / スキップ ${json.skipped_count ?? '-'}`)
      await load()
    } catch (e) {
      alert('実行エラー: ' + (e as Error).message)
    }
  }

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>AI 割り振り設定</h1>
          <p className="caption muted">GAP-K / 毎朝7:00 自動実行 / ルールブック=藤原・五十嵐・藤井</p>
        </div>
        <div className="row-tight">
          <button className="ink-btn outline" onClick={manualRun}>今すぐ実行</button>
          <button className="ink-btn primary" onClick={() => setCreating(true)}>+ ルール追加</button>
        </div>
      </header>

      {creating && (
        <section className="ink-card">
          <h3>新規ルール</h3>
          <div className="grid-12" style={{ marginTop: 12 }}>
            <label className="col-span-6">
              <span className="caption muted">ルール名</span>
              <input className="ink-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="例: 関東・売買・既存掲載" />
            </label>
            <label className="col-span-3">
              <span className="caption muted">優先度</span>
              <input type="number" className="ink-input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            </label>
            <label className="col-span-3">
              <span className="caption muted">重み</span>
              <input type="number" step="0.1" className="ink-input" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
            </label>
            <label className="col-span-6">
              <span className="caption muted">対象チーム</span>
              <select className="ink-select" value={draft.target_team_id} onChange={(e) => setDraft({ ...draft, target_team_id: e.target.value })}>
                <option value="">全チーム</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="col-span-6">
              <span className="caption muted">対象ロール</span>
              <select className="ink-select" value={draft.target_role} onChange={(e) => setDraft({ ...draft, target_role: e.target.value as UserRole })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="col-span-12">
              <span className="caption muted">条件 JSON (例: {'{"prefecture":"東京都","is_existing_publisher":true,"score_min":50}'})</span>
              <textarea className="ink-textarea mono" rows={4} value={draft.conditions} onChange={(e) => setDraft({ ...draft, conditions: e.target.value })} />
            </label>
          </div>
          <div className="row-tight" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="ink-btn" onClick={() => setCreating(false)}>キャンセル</button>
            <button className="ink-btn primary" onClick={createRule}>保存</button>
          </div>
        </section>
      )}

      <section className="ink-card" style={{ padding: 0 }}>
        <h3 style={{ padding: 16, marginBottom: 0 }}>ルール一覧 ({rules.length})</h3>
        <table className="ink-table">
          <thead>
            <tr>
              <th>優先度</th><th>名前</th><th>条件</th><th>対象</th><th>重み</th><th>状態</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>ルール未設定</td></tr>
            ) : rules.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.priority}</td>
                <td>{r.name}</td>
                <td className="mono caption">{JSON.stringify(r.conditions)}</td>
                <td className="caption">{teams.find((t) => t.id === r.target_team_id)?.name ?? '全チーム'} / {r.target_role ?? '-'}</td>
                <td className="mono">{r.weight.toFixed(2)}</td>
                <td>{r.is_active ? <span className="ink-badge ink-badge-ok">有効</span> : <span className="ink-badge">無効</span>}</td>
                <td><button className="ink-btn xs" onClick={() => void toggleRule(r)}>{r.is_active ? '無効化' : '有効化'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ink-card" style={{ padding: 0 }}>
        <h3 style={{ padding: 16, marginBottom: 0 }}>実行履歴 (最新20件)</h3>
        <table className="ink-table">
          <thead>
            <tr>
              <th>実行日時</th><th>ステータス</th><th>対象</th><th>割り振り</th><th>スキップ</th><th>エラー</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ padding: 24, textAlign: 'center' }}>実行履歴なし</td></tr>
            ) : runs.map((r) => (
              <tr key={r.id}>
                <td className="mono caption">{r.run_at.slice(0, 16).replace('T', ' ')}</td>
                <td>
                  {r.status === 'done' && <span className="ink-badge ink-badge-ok">完了</span>}
                  {r.status === 'failed' && <span className="ink-badge ink-badge-ng">失敗</span>}
                  {(r.status === 'pending' || r.status === 'running') && <span className="ink-badge ink-badge-warn">{r.status}</span>}
                </td>
                <td className="mono">{r.total_companies.toLocaleString()}</td>
                <td className="mono" style={{ color: 'var(--success)' }}>{r.assigned_count.toLocaleString()}</td>
                <td className="mono caption">{r.skipped_count.toLocaleString()}</td>
                <td className="caption">{r.error ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
