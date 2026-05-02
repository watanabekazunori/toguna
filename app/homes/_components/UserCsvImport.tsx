'use client'

import { useRef, useState } from 'react'
import { bulkInsertUsers } from '@/lib/homes/api'
import type { HomesUser, UserRole } from '@/lib/homes/types'

interface Props {
  onImported?: (count: number) => void
}

const VALID_ROLES: UserRole[] = ['APPOINTER', 'CLOSER', 'COLLECTOR', 'SV', 'PM', 'ADMIN']

interface ParsedRow {
  lineNo: number
  data: Partial<HomesUser>
  warning?: string
}

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

function parseCsv(text: string): { headers: string[]; rows: string[][]; delimiter: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [], delimiter: ',' }
  const delimiter = detectDelimiter(lines[0])
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1).map((l) => l.split(delimiter).map((c) => c.trim()))
  return { headers, rows, delimiter }
}

export function UserCsvImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    setHeaders(headers)

    const idx = (k: string) => headers.indexOf(k)
    const iName = idx('name')
    const iEmail = idx('email')
    const iRole = idx('role')
    const iTeam = idx('team_id')
    const iActive = idx('is_active')

    const warns: string[] = []
    const out: ParsedRow[] = rows.map((cols, i) => {
      const lineNo = i + 2
      const role = iRole >= 0 ? cols[iRole]?.toUpperCase() : ''
      let warn: string | undefined
      if (role && !VALID_ROLES.includes(role as UserRole)) {
        const w = `${lineNo}行目: roleが不正(${role})`
        warns.push(w)
        warn = w
      }
      const isActiveRaw = iActive >= 0 ? cols[iActive]?.toLowerCase() : ''
      const isActive = isActiveRaw === 'false' ? false : true
      return {
        lineNo,
        warning: warn,
        data: {
          name: iName >= 0 ? cols[iName] : '',
          email: iEmail >= 0 ? cols[iEmail] || null : null,
          role: (VALID_ROLES.includes(role as UserRole) ? (role as UserRole) : 'APPOINTER') as UserRole,
          team_id: iTeam >= 0 ? cols[iTeam] || null : null,
          is_active: isActive,
        },
      }
    })

    setParsed(out)
    setWarnings(warns)
    setResultMsg(null)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)
    setResultMsg(null)
    try {
      const validRows = parsed.filter((p) => !p.warning).map((p) => p.data)
      const inserted = await bulkInsertUsers(validRows)
      setResultMsg(`${inserted.length} 件をインポートしました`)
      onImported?.(inserted.length)
      setParsed([])
      setHeaders([])
    } catch (e) {
      setResultMsg(`エラー: ${(e as Error).message ?? 'インポートに失敗しました'}`)
    } finally {
      setImporting(false)
    }
  }

  const previewRows = parsed.slice(0, 20)

  return (
    <div className="stack">
      <div className="between">
        <strong>ユーザー CSV インポート</strong>
        <button className="ink-btn outline" onClick={() => inputRef.current?.click()}>
          CSV を選択
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,text/csv"
          onChange={onFile}
          style={{ display: 'none' }}
        />
      </div>

      <div className="caption muted">
        想定列: name, email, role (APPOINTER/CLOSER/COLLECTOR/SV/PM/ADMIN), team_id (任意), is_active (任意)
      </div>

      {warnings.length > 0 && (
        <div className="ink-card" style={{ padding: 12, borderLeft: '4px solid var(--warning)' }}>
          <strong style={{ fontSize: 13 }}>警告</strong>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            {warnings.map((w, i) => (
              <li key={i} className="caption" style={{ color: 'var(--warning)' }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed.length > 0 && (
        <>
          <div className="caption muted">
            プレビュー (上位 {previewRows.length} / 全 {parsed.length} 件)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ink-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>name</th>
                  <th>email</th>
                  <th>role</th>
                  <th>team_id</th>
                  <th>is_active</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.lineNo} style={{ background: r.warning ? 'rgba(255,193,7,0.08)' : undefined }}>
                    <td className="mono">{r.lineNo}</td>
                    <td>{r.data.name}</td>
                    <td>{r.data.email}</td>
                    <td>{r.data.role}</td>
                    <td>{r.data.team_id ?? ''}</td>
                    <td>{String(r.data.is_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="between">
            <button
              className="ink-btn outline"
              onClick={() => {
                setParsed([])
                setHeaders([])
                setWarnings([])
              }}
              disabled={importing}
            >
              キャンセル
            </button>
            <button className="ink-btn primary" onClick={handleImport} disabled={importing}>
              {importing ? 'インポート中...' : `実行 (${parsed.filter((p) => !p.warning).length} 件)`}
            </button>
          </div>
        </>
      )}

      {resultMsg && (
        <div className="caption" style={{ color: resultMsg.startsWith('エラー') ? 'var(--danger)' : 'var(--success)' }}>
          {resultMsg}
        </div>
      )}
    </div>
  )
}

export default UserCsvImport
