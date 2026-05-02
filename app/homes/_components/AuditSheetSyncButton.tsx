'use client'

import { useCallback, useEffect, useState } from 'react'
import { listAuditSyncLogs } from '@/lib/homes/api'
import type { HomesAuditSyncLog } from '@/lib/homes/types'

interface Props {
  autoRefresh?: boolean
}

function fmtJst(iso: string): string {
  try {
    const d = new Date(iso)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${m}-${day} ${h}:${min}`
  } catch {
    return iso
  }
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'success' || s === 'ok') return 'ink-badge ink-badge-ok'
  if (s === 'error' || s === 'failed') return 'ink-badge ink-badge-ng'
  if (s === 'partial') return 'ink-badge ink-badge-warn'
  return 'ink-badge'
}

export function AuditSheetSyncButton({ autoRefresh = false }: Props) {
  const [logs, setLogs] = useState<HomesAuditSyncLog[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recheckRunning, setRecheckRunning] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAuditSyncLogs(5)
      setLogs(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [autoRefresh, refresh])

  // GAP-P / G-13: 申込承認日から2ヶ月経過の再審査チェックを手動でオフにする
  const handleRecheckAutoOff = async () => {
    if (!confirm('承認2ヶ月超の案件の「要再審査」フラグを一括オフにしますか?')) return
    setRecheckRunning(true)
    try {
      const res = await fetch('/api/recheck-auto-off', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`実行失敗: ${json?.error ?? res.statusText}`)
      } else {
        alert(`再審査自動オフ完了: ${json?.updated ?? 0} 件を更新`)
      }
      await refresh()
    } catch (e) {
      alert(`エラー: ${(e as Error).message}`)
    } finally {
      setRecheckRunning(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-audit-sheet', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`同期失敗: ${json?.error ?? res.statusText}`)
      } else {
        alert(
          `同期完了: 更新 ${json?.rows_updated ?? '?'} 件 / 処理 ${json?.rows_processed ?? '?'} 件`
        )
      }
      await refresh()
    } catch (e) {
      alert(`同期エラー: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="stack">
      <div className="between">
        <strong>審査スプシ同期</strong>
        <div className="row-tight">
          <button className="ink-btn xs" onClick={refresh} disabled={loading}>
            再読込
          </button>
          <button
            className="ink-btn xs"
            onClick={handleRecheckAutoOff}
            disabled={recheckRunning}
            title="承認2ヶ月超の案件の要再審査フラグを一括オフ (G-13)"
          >
            {recheckRunning ? '実行中...' : '再審査自動オフ'}
          </button>
          <button className="ink-btn primary" onClick={handleSync} disabled={syncing}>
            {syncing ? '同期中...' : '今すぐ同期'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="ink-table">
          <thead>
            <tr>
              <th>同期時刻</th>
              <th>ソース</th>
              <th>更新</th>
              <th>状態</th>
              <th>エラー</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="caption muted" style={{ textAlign: 'center' }}>
                  履歴がありません
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="mono">{fmtJst(log.synced_at)}</td>
                <td>{log.source}</td>
                <td className="mono">{log.rows_updated}</td>
                <td>
                  <span className={statusBadgeClass(log.status)}>{log.status}</span>
                </td>
                <td className="caption" style={{ color: log.error ? 'var(--danger)' : 'inherit' }}>
                  {log.error ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AuditSheetSyncButton
