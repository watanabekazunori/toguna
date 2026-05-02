'use client'

import { ReactNode, useMemo, useState } from 'react'

export interface ExcelCol<T> {
  key: string
  label: string
  width?: number
  num?: boolean
  sticky?: boolean
  agg?: 'sum' | 'avg' | 'count'
  /** Raw value for sort/agg/csv */
  value: (row: T) => string | number | null | undefined
  /** Optional render override for the cell */
  render?: (row: T) => ReactNode
}

interface Props<T> {
  rows: T[]
  cols: ExcelCol<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  empty?: string
  filename?: string
  selected?: Set<string>
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  showRowNum?: boolean
  showFooter?: boolean
}

export function ExcelTable<T>({
  rows,
  cols,
  rowKey,
  loading,
  empty = '該当データなし',
  filename = 'data',
  selected,
  onRowClick,
  toolbar,
  showRowNum = true,
  showFooter = true,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    const col = cols.find((c) => c.key === sortKey)
    if (!col) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.value(a)
      const bv = col.value(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'ja') * dir
    })
  }, [rows, sortKey, sortDir, cols])

  const totals = useMemo(() => {
    const out: Record<string, string> = {}
    for (const c of cols) {
      if (!c.agg) continue
      const nums = rows
        .map((r) => c.value(r))
        .filter((v): v is number => typeof v === 'number')
      if (nums.length === 0) {
        out[c.key] = '-'
      } else if (c.agg === 'sum') {
        out[c.key] = nums.reduce((a, b) => a + b, 0).toLocaleString()
      } else if (c.agg === 'avg') {
        out[c.key] = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
      } else if (c.agg === 'count') {
        out[c.key] = nums.length.toLocaleString()
      }
    }
    return out
  }, [rows, cols])

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function downloadCsv() {
    const escape = (s: unknown) => {
      const v = s == null ? '' : String(s)
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    }
    const head = cols.map((c) => escape(c.label)).join(',')
    const body = sortedRows
      .map((r) => cols.map((c) => escape(c.value(r) ?? '')).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF', head, '\n', body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `${filename}_${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFooter = showFooter && cols.some((c) => c.agg)

  return (
    <div className="excel-wrap">
      <div className="excel-toolbar">
        <span className="excel-count">{rows.length.toLocaleString()} 件</span>
        {sortKey && (
          <span className="caption muted">
            並び順: {cols.find((c) => c.key === sortKey)?.label} ({sortDir === 'asc' ? '↑' : '↓'})
          </span>
        )}
        <span style={{ flex: 1 }} />
        {toolbar}
        <button className="ink-btn xs" onClick={downloadCsv}>CSV出力</button>
      </div>
      <div className="excel-scroll">
        <table className="excel-table">
          <thead>
            <tr>
              {showRowNum && <th className="col-rownum">#</th>}
              {cols.map((c, i) => {
                const isSorted = sortKey === c.key
                const stickyClass = c.sticky && i === 0 ? ' col-sticky-1' : ''
                const numClass = c.num ? ' num' : ''
                const sortedClass = isSorted ? ' sorted' : ''
                return (
                  <th
                    key={c.key}
                    className={`sortable${stickyClass}${numClass}${sortedClass}`}
                    style={{ minWidth: c.width ?? 120 }}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    <span className="sort-arrow">
                      {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={cols.length + (showRowNum ? 1 : 0)} className="excel-empty">
                  読込中...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + (showRowNum ? 1 : 0)} className="excel-empty">
                  {empty}
                </td>
              </tr>
            ) : (
              sortedRows.map((r, idx) => {
                const id = rowKey(r)
                const isSelected = selected?.has(id) ?? false
                return (
                  <tr
                    key={id}
                    className={isSelected ? 'row-selected' : ''}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {showRowNum && <td className="col-rownum">{idx + 1}</td>}
                    {cols.map((c, i) => {
                      const stickyClass = c.sticky && i === 0 ? ' col-sticky-1' : ''
                      const numClass = c.num ? ' num' : ''
                      return (
                        <td key={c.key} className={`${stickyClass}${numClass}`.trim()}>
                          {c.render ? c.render(r) : (c.value(r) ?? '-')}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
          {hasFooter && rows.length > 0 && (
            <tfoot>
              <tr>
                {showRowNum && <td className="col-rownum">∑</td>}
                {cols.map((c, i) => {
                  const stickyClass = c.sticky && i === 0 ? ' col-sticky-1' : ''
                  const numClass = c.num ? ' num' : ''
                  return (
                    <td key={c.key} className={`${stickyClass}${numClass}`.trim()}>
                      {i === 0 && !c.agg ? `合計 (${rows.length})` : (totals[c.key] ?? '')}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
