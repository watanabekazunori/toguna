'use client'

import { useEffect, useMemo, useState } from 'react'
import { listLists } from '@/lib/homes/api'
import type { HomesList } from '@/lib/homes/types'

interface Props {
  selectedListIds: string[]
  onChange: (ids: string[]) => void
}

export function ListTagFilter({ selectedListIds, onChange }: Props) {
  const [lists, setLists] = useState<HomesList[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listLists()
      .then((data) => {
        if (active) setLists(data.filter((l) => l.is_active))
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lists
    return lists.filter((l) => l.name.toLowerCase().includes(q))
  }, [lists, search])

  const toggle = (id: string) => {
    if (selectedListIds.includes(id)) {
      onChange(selectedListIds.filter((x) => x !== id))
    } else {
      onChange([...selectedListIds, id])
    }
  }

  const selectAll = () => {
    onChange(filtered.map((l) => l.id))
  }

  const clear = () => {
    onChange([])
  }

  return (
    <div className="stack">
      <div className="between">
        <strong style={{ fontSize: 14 }}>リスト絞り込み</strong>
        <div className="row-tight">
          <button className="ink-btn xs" onClick={selectAll} type="button">
            全選択
          </button>
          <button className="ink-btn xs" onClick={clear} type="button">
            クリア
          </button>
        </div>
      </div>

      <input
        className="ink-input"
        placeholder="リスト名で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <div className="caption muted">読み込み中...</div>}

      <div
        style={{
          maxHeight: 200,
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: 4,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg-tint)',
        }}
      >
        {filtered.length === 0 && !loading && (
          <span className="caption muted">該当するリストがありません</span>
        )}
        {filtered.map((l) => {
          const selected = selectedListIds.includes(l.id)
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l.id)}
              className="ink-badge"
              style={{
                cursor: 'pointer',
                background: selected ? 'var(--primary)' : 'var(--bg-tint)',
                color: selected ? '#fff' : 'inherit',
                border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                padding: '4px 10px',
                fontSize: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {l.name} ({l.total_count.toLocaleString()})
            </button>
          )
        })}
      </div>

      {selectedListIds.length > 0 && (
        <div className="caption muted">{selectedListIds.length} 件選択中</div>
      )}
    </div>
  )
}

export default ListTagFilter
