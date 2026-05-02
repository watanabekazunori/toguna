'use client'

import { useMemo } from 'react'

interface Row {
  user_id: string
  user_name: string
  call_started_at: string
  result_primary: string
  result_secondary: string | null
}

interface Props {
  rows: Row[]
  date: string
}

interface CellStat {
  calls: number
  appts: number
  ngs: number
}

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function emptyCell(): CellStat {
  return { calls: 0, appts: 0, ngs: 0 }
}

export function HourlyActivityPivot({ rows, date }: Props) {
  const { users, matrix, hourTotals, userTotals, grandTotal } = useMemo(() => {
    const userMap = new Map<string, string>()
    const matrix = new Map<string, Map<number, CellStat>>()
    const hourTotals = new Map<number, CellStat>()
    const userTotals = new Map<string, CellStat>()
    const grand = emptyCell()

    for (const h of HOURS) hourTotals.set(h, emptyCell())

    for (const r of rows) {
      const dt = new Date(r.call_started_at)
      if (isNaN(dt.getTime())) continue
      // Filter to date if provided
      if (date) {
        const y = dt.getFullYear()
        const m = String(dt.getMonth() + 1).padStart(2, '0')
        const d = String(dt.getDate()).padStart(2, '0')
        if (`${y}-${m}-${d}` !== date) continue
      }
      const hour = dt.getHours()
      if (!HOURS.includes(hour)) continue

      userMap.set(r.user_id, r.user_name)
      if (!matrix.has(r.user_id)) matrix.set(r.user_id, new Map())
      const userRow = matrix.get(r.user_id)!
      if (!userRow.has(hour)) userRow.set(hour, emptyCell())
      const cell = userRow.get(hour)!

      const isAppt = r.result_secondary === 'appointment' || r.result_secondary === 'lead'
      const isNg = r.result_secondary === 'ng'

      cell.calls++
      if (isAppt) cell.appts++
      if (isNg) cell.ngs++

      const ht = hourTotals.get(hour)!
      ht.calls++
      if (isAppt) ht.appts++
      if (isNg) ht.ngs++

      if (!userTotals.has(r.user_id)) userTotals.set(r.user_id, emptyCell())
      const ut = userTotals.get(r.user_id)!
      ut.calls++
      if (isAppt) ut.appts++
      if (isNg) ut.ngs++

      grand.calls++
      if (isAppt) grand.appts++
      if (isNg) grand.ngs++
    }

    const users = Array.from(userMap.entries()).map(([id, name]) => ({ id, name }))
    users.sort((a, b) => a.name.localeCompare(b.name))

    return { users, matrix, hourTotals, userTotals, grandTotal: grand }
  }, [rows, date])

  const renderCell = (c: CellStat | undefined) => {
    if (!c || c.calls === 0) return <span className="muted">-</span>
    return (
      <span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
        <span>{c.calls}</span>
        <span className="muted"> / </span>
        <span style={{ color: c.appts > 0 ? 'var(--success)' : 'inherit', fontWeight: c.appts > 0 ? 600 : 400 }}>
          {c.appts}
        </span>
        <span className="muted"> / </span>
        <span style={{ color: c.ngs > 0 ? 'var(--danger)' : 'inherit', fontWeight: c.ngs > 0 ? 600 : 400 }}>
          {c.ngs}
        </span>
      </span>
    )
  }

  return (
    <div className="stack">
      <div className="between">
        <strong>行動管理表</strong>
        <span className="caption muted">{date} / 表記: コール / アポ / NG</span>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 600 }}>
        <table className="ink-table" style={{ minWidth: 720 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 3 }}>時間帯</th>
              {users.map((u) => (
                <th key={u.id} style={{ minWidth: 110, textAlign: 'center' }}>
                  {u.name}
                </th>
              ))}
              <th style={{ background: 'var(--bg-tint)', textAlign: 'center' }}>合計</th>
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  {String(h).padStart(2, '0')}:00 - {String(h).padStart(2, '0')}:59
                </td>
                {users.map((u) => {
                  const cell = matrix.get(u.id)?.get(h)
                  return (
                    <td key={u.id} style={{ textAlign: 'center' }}>
                      {renderCell(cell)}
                    </td>
                  )
                })}
                <td style={{ textAlign: 'center', background: 'var(--bg-tint)' }}>
                  {renderCell(hourTotals.get(h))}
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-tint)', fontWeight: 600 }}>
              <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tint)' }}>合計</td>
              {users.map((u) => (
                <td key={u.id} style={{ textAlign: 'center' }}>
                  {renderCell(userTotals.get(u.id))}
                </td>
              ))}
              <td style={{ textAlign: 'center', background: 'var(--bg-tint)' }}>
                {renderCell(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HourlyActivityPivot
