'use client'

import { useMemo, useState, ReactNode, CSSProperties } from 'react'

export type SheetCol<T> = {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  sortable?: boolean
  render?: (row: T, idx: number) => ReactNode
  value?: (row: T) => string | number | null | undefined  // CSV value & sort key
  agg?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  format?: (v: number | null) => string
  filterable?: boolean
  sticky?: boolean  // pin to left
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export type SheetGridProps<T> = {
  rows: T[]
  cols: SheetCol<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  height?: number | string
  filename?: string
  caption?: ReactNode
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  selectable?: boolean
  selected?: Set<string>
  onSelectChange?: (next: Set<string>) => void
  showFooter?: boolean
  initialSort?: SortState
}

function fmtNum(v: number | null): string {
  if (v == null || isNaN(v)) return '-'
  if (Math.abs(v) < 0.001) return '0'
  if (Number.isInteger(v)) return v.toLocaleString()
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function SheetGrid<T>({
  rows,
  cols,
  rowKey,
  loading,
  empty = '該当なし',
  height = 'calc(100vh - 320px)',
  filename = 'sheet',
  caption,
  onRowClick,
  rowClassName,
  selectable,
  selected,
  onSelectChange,
  showFooter = true,
  initialSort = null,
}: SheetGridProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let out = rows
    for (const [key, val] of Object.entries(colFilters)) {
      if (!val) continue
      const col = cols.find((c) => c.key === key)
      if (!col) continue
      const needle = val.toLowerCase()
      out = out.filter((r) => {
        const v = col.value ? col.value(r) : (r as unknown as Record<string, unknown>)[col.key]
        return String(v ?? '').toLowerCase().includes(needle)
      })
    }
    if (sort) {
      const col = cols.find((c) => c.key === sort.key)
      if (col) {
        const sign = sort.dir === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = col.value ? col.value(a) : (a as unknown as Record<string, unknown>)[col.key]
          const bv = col.value ? col.value(b) : (b as unknown as Record<string, unknown>)[col.key]
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
          return String(av).localeCompare(String(bv), 'ja') * sign
        })
      }
    }
    return out
  }, [rows, cols, sort, colFilters])

  const aggregates = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const col of cols) {
      if (!col.agg) continue
      const nums: number[] = []
      for (const r of filtered) {
        const v = col.value ? col.value(r) : (r as unknown as Record<string, unknown>)[col.key]
        if (typeof v === 'number' && !isNaN(v)) nums.push(v)
        else if (col.agg === 'count' && v != null && v !== '') nums.push(1)
      }
      if (nums.length === 0) {
        out[col.key] = null
        continue
      }
      switch (col.agg) {
        case 'sum': out[col.key] = nums.reduce((a, b) => a + b, 0); break
        case 'avg': out[col.key] = nums.reduce((a, b) => a + b, 0) / nums.length; break
        case 'count': out[col.key] = nums.length; break
        case 'min': out[col.key] = Math.min(...nums); break
        case 'max': out[col.key] = Math.max(...nums); break
      }
    }
    return out
  }, [filtered, cols])

  const exportCsv = () => {
    const headers = cols.map((c) => c.label)
    const lines = [headers.map(csvEscape).join(',')]
    for (const r of filtered) {
      const cells = cols.map((c) => {
        const v = c.value ? c.value(r) : (r as unknown as Record<string, unknown>)[c.key]
        return csvEscape(v)
      })
      lines.push(cells.join(','))
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const allChecked = selectable && selected && selected.size > 0 && selected.size === filtered.length
  const someChecked = selectable && selected && selected.size > 0 && selected.size < filtered.length

  function toggleAll(checked: boolean) {
    if (!onSelectChange) return
    onSelectChange(checked ? new Set(filtered.map(rowKey)) : new Set())
  }

  function toggleRow(id: string) {
    if (!onSelectChange || !selected) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectChange(next)
  }

  const hasAgg = cols.some((c) => !!c.agg)

  return (
    <div className="ink-card sheet-grid" style={{ padding: 0 }}>
      <div className="sheet-toolbar">
        <div className="row-tight" style={{ flex: 1 }}>
          {caption}
          <span className="caption muted">{filtered.length.toLocaleString()} 行</span>
          {Object.values(colFilters).some(Boolean) && (
            <button className="ink-btn xs" onClick={() => setColFilters({})}>列フィルタ解除</button>
          )}
          {sort && (
            <button className="ink-btn xs" onClick={() => setSort(null)}>並び順リセット</button>
          )}
        </div>
        <div className="row-tight">
          <button className="ink-btn xs" onClick={exportCsv}>CSV</button>
        </div>
      </div>
      <div className="sheet-scroll" style={{ maxHeight: height as string }}>
        <table className="sheet-table">
          <thead>
            <tr>
              {selectable && (
                <th className="sheet-th sticky-left" style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!allChecked}
                    ref={(el) => { if (el) el.indeterminate = !!someChecked }}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
              )}
              {cols.map((c) => {
                const active = sort?.key === c.key
                const style: CSSProperties = { width: c.width, textAlign: c.align ?? 'left' }
                return (
                  <th
                    key={c.key}
                    className={`sheet-th ${c.sticky ? 'sticky-left' : ''} ${active ? 'sorted' : ''}`}
                    style={style}
                  >
                    <div className="sheet-th-inner">
                      <button
                        className="sheet-th-btn"
                        onClick={() => c.sortable !== false && toggleSort(c.key)}
                        disabled={c.sortable === false}
                      >
                        <span>{c.label}</span>
                        {active && <span className="sort-mark">{sort?.dir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                      {c.filterable !== false && (
                        <button
                          className={`sheet-th-filter ${colFilters[c.key] ? 'active' : ''}`}
                          onClick={() => setOpenFilter(openFilter === c.key ? null : c.key)}
                          title="列フィルタ"
                        >▼</button>
                      )}
                    </div>
                    {openFilter === c.key && (
                      <div className="sheet-filter-pop">
                        <input
                          autoFocus
                          className="ink-input xs"
                          placeholder={`${c.label} 検索`}
                          value={colFilters[c.key] ?? ''}
                          onChange={(e) => setColFilters({ ...colFilters, [c.key]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Escape') setOpenFilter(null); if (e.key === 'Enter') setOpenFilter(null) }}
                        />
                        <div className="row-tight" style={{ marginTop: 4 }}>
                          <button className="ink-btn xs" onClick={() => { const next = { ...colFilters }; delete next[c.key]; setColFilters(next); setOpenFilter(null) }}>クリア</button>
                          <button className="ink-btn xs primary" onClick={() => setOpenFilter(null)}>OK</button>
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="muted" colSpan={cols.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: 32 }}>読込中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="muted" colSpan={cols.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: 32 }}>{empty}</td></tr>
            ) : filtered.map((r, idx) => {
              const id = rowKey(r)
              const isSel = selected?.has(id)
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(r)}
                  className={`${rowClassName?.(r) ?? ''} ${isSel ? 'row-selected' : ''}`}
                  style={{ cursor: onRowClick ? 'pointer' : undefined }}
                >
                  {selectable && (
                    <td className="sticky-left" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={!!isSel} onChange={() => toggleRow(id)} />
                    </td>
                  )}
                  {cols.map((c) => {
                    const v = c.render ? c.render(r, idx) : (c.value ? c.value(r) : (r as unknown as Record<string, unknown>)[c.key])
                    return (
                      <td
                        key={c.key}
                        className={`${c.mono ? 'mono' : ''} ${c.sticky ? 'sticky-left' : ''}`}
                        style={{ textAlign: c.align ?? 'left' }}
                      >
                        {(v as ReactNode) ?? <span className="muted">-</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {showFooter && hasAgg && filtered.length > 0 && (
            <tfoot>
              <tr>
                {selectable && <td className="sticky-left" />}
                {cols.map((c, i) => {
                  const v = aggregates[c.key]
                  let label = ''
                  if (c.agg) {
                    const fmt = c.format ?? fmtNum
                    const prefix = c.agg === 'sum' ? 'Σ ' : c.agg === 'avg' ? '⌀ ' : c.agg === 'count' ? '# ' : c.agg === 'min' ? '↓ ' : '↑ '
                    label = `${prefix}${fmt(v)}`
                  }
                  return (
                    <td
                      key={c.key}
                      className={`sheet-foot ${c.mono || c.agg ? 'mono' : ''} ${c.sticky ? 'sticky-left' : ''}`}
                      style={{ textAlign: c.align ?? 'left' }}
                    >
                      {i === 0 && !c.agg ? <span className="caption muted">合計</span> : label}
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
