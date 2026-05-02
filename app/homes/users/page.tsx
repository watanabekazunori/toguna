'use client'

import { useEffect, useState } from 'react'
import { listTeams, listUsers } from '@/lib/homes/api'
import { ROLE_LABEL, type HomesTeam, type HomesUser, type UserRole } from '@/lib/homes/types'
import UserCsvImport from '@/app/homes/_components/UserCsvImport'

interface UserRow extends HomesUser {
  homes_teams: HomesTeam | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [teams, setTeams] = useState<HomesTeam[]>([])
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [showImport, setShowImport] = useState(false)

  async function load() {
    const [u, t] = await Promise.all([listUsers({ role: roleFilter || undefined }), listTeams()])
    setUsers(u as UserRow[])
    setTeams(t)
  }

  useEffect(() => { void load() }, [roleFilter])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>ユーザー管理</h1>
          <p className="caption muted">M7 / アポインター15 / クローザー4 / 回収2 / SV1-2 / PM1 / Admin1</p>
        </div>
        <button
          className={`ink-btn ${showImport ? '' : 'primary'}`}
          onClick={() => setShowImport((v) => !v)}
        >
          {showImport ? '閉じる' : 'CSV/TSVから一括登録'}
        </button>
      </header>

      {showImport && (
        <section className="ink-card">
          <h3 style={{ marginTop: 0 }}>CSV / TSV 一括登録</h3>
          <p className="caption muted" style={{ marginBottom: 12 }}>
            ヘッダー必須: <code>name, email, role, team_id</code> (TSV/CSV 自動判定)
          </p>
          <UserCsvImport onImported={() => { setShowImport(false); void load() }} />
        </section>
      )}

      <section className="ink-card">
        <div className="row-tight">
          <button className={`ink-btn ${!roleFilter ? 'primary' : ''}`} onClick={() => setRoleFilter('')}>全員 ({users.length})</button>
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
            <button key={r} className={`ink-btn ${roleFilter === r ? 'primary' : ''}`} onClick={() => setRoleFilter(r)}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </section>

      <section className="ink-card col-span-8">
        <h3>チーム編成 (3チーム)</h3>
        <div className="grid-12" style={{ marginTop: 12 }}>
          {teams.map((t) => (
            <div key={t.id} className="ink-card col-span-4" style={{ padding: 12 }}>
              <h4>{t.name}</h4>
              <p className="caption muted mono">leader: {t.leader_user_id ? users.find((u) => u.id === t.leader_user_id)?.name ?? '-' : '未割当'}</p>
              <ul className="caption" style={{ marginTop: 8 }}>
                {users.filter((u) => u.team_id === t.id).map((u) => (
                  <li key={u.id}>{u.name} ({ROLE_LABEL[u.role]})</li>
                ))}
                {users.filter((u) => u.team_id === t.id).length === 0 && <li className="muted">未配属</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="ink-card" style={{ padding: 0 }}>
        <table className="ink-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>ロール</th>
              <th>チーム</th>
              <th>メール</th>
              <th>Zoom Phone</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>該当なし</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td><span className="ink-badge ink-badge-accent">{ROLE_LABEL[u.role]}</span></td>
                <td>{u.homes_teams?.name ?? '-'}</td>
                <td className="caption mono">{u.email ?? '-'}</td>
                <td className="caption mono">{u.zoom_phone_user_id ?? '-'}</td>
                <td>{u.is_active ? <span className="ink-badge ink-badge-ok">ACTIVE</span> : <span className="ink-badge">無効</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
