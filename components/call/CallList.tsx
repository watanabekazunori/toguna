/**
 * 当日コールリスト — 担当/全体切替、フィルタ保存(URL params)、ステータス絞込み、無限スクロール
 */
'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Phone, Building2, Search, RefreshCcw } from 'lucide-react'

export type CallState =
  | 'untouched'
  | 'dialed'
  | 'connected'
  | 'contacted'
  | 'appointed'
  | 'ng'
  | 'recall_scheduled'
  | 'all'

const CALL_STATE_LABELS: Record<string, string> = {
  all: 'すべて',
  untouched: '未架電',
  dialed: '架電済',
  connected: 'コンタクト',
  contacted: '接触済',
  appointed: 'アポ獲得',
  ng: 'NG',
  recall_scheduled: '再架電予定',
}

const CALL_STATE_COLORS: Record<string, string> = {
  untouched: 'bg-slate-100 text-slate-700',
  dialed: 'bg-blue-100 text-blue-700',
  connected: 'bg-teal-100 text-teal-700',
  contacted: 'bg-cyan-100 text-cyan-700',
  appointed: 'bg-green-100 text-green-700',
  ng: 'bg-red-100 text-red-700',
  recall_scheduled: 'bg-yellow-100 text-yellow-700',
}

export interface Company {
  id: string
  company_name: string
  phone: string
  call_state: string
  score_priority?: number
  area?: string
  assigned_user_id?: string
  last_call_at?: string
  call_count?: number
}

interface CallListProps {
  /** 現在選択中の company_id */
  selectedCompanyId: string | null
  onSelect: (company: Company) => void
}

const PAGE_SIZE = 30

/** コールリスト — URL params でフィルタ永続化、無限スクロール対応 */
export function CallList({ selectedCompanyId, onSelect }: CallListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isPending, startTransition] = useTransition()

  // URL params からフィルタ初期値を読み込む
  const [scope, setScope] = useState<'mine' | 'all'>(
    (searchParams.get('scope') as 'mine' | 'all') ?? 'mine',
  )
  const [stateFilter, setStateFilter] = useState<CallState>(
    (searchParams.get('state') as CallState) ?? 'all',
  )
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  const [companies, setCompanies] = useState<Company[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState<number | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // フィルタ変更 → URL 更新
  const updateUrl = useCallback(
    (newScope: 'mine' | 'all', newState: CallState, newQuery: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('scope', newScope)
      params.set('state', newState)
      if (newQuery) params.set('q', newQuery)
      else params.delete('q')
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams],
  )

  // データ取得
  const fetchCompanies = useCallback(
    async (nextPage: number, reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          scope,
          state: stateFilter === 'all' ? '' : stateFilter,
          q: query,
          page: String(nextPage),
          limit: String(PAGE_SIZE),
        })
        const res = await fetch(`/api/lifull/companies/call-list?${params}`)
        if (!res.ok) throw new Error()
        const data: { companies: Company[]; total: number } = await res.json()
        setCompanies((prev) => (reset ? data.companies : [...prev, ...data.companies]))
        setTotal(data.total)
        setHasMore(data.companies.length === PAGE_SIZE)
      } catch {
        // フォールバック: エラー時は空を維持
      } finally {
        setIsLoading(false)
      }
    },
    [scope, stateFilter, query],
  )

  // フィルタ変更時にリセット
  useEffect(() => {
    setPage(0)
    setCompanies([])
    setHasMore(true)
    fetchCompanies(0, true)
    updateUrl(scope, stateFilter, query)
  }, [scope, stateFilter, query])

  // 無限スクロール
  useEffect(() => {
    if (!sentinelRef.current) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          const next = page + 1
          setPage(next)
          fetchCompanies(next)
        }
      },
      { rootMargin: '100px' },
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, isLoading, page, fetchCompanies])

  return (
    <div className="flex flex-col h-full">
      {/* フィルタバー */}
      <div className="p-3 border-b space-y-2 bg-white">
        {/* スコープ切替 */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={scope === 'mine' ? 'default' : 'outline'}
            className="flex-1 h-8 text-xs"
            onClick={() => setScope('mine')}
          >
            担当
          </Button>
          <Button
            size="sm"
            variant={scope === 'all' ? 'default' : 'outline'}
            className="flex-1 h-8 text-xs"
            onClick={() => setScope('all')}
          >
            全体
          </Button>
        </div>
        {/* ステータス絞込 */}
        <Select
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as CallState)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CALL_STATE_LABELS) as CallState[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {CALL_STATE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="h-8 text-xs pl-7"
            placeholder="社名・電話番号"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {total !== null && (
          <p className="text-xs text-slate-500 text-right">{total.toLocaleString()} 件</p>
        )}
      </div>

      {/* リスト本体 */}
      <div className="flex-1 overflow-y-auto">
        {companies.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <Building2 className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">本日のコールリストがありません</p>
            <p className="text-xs text-slate-400">リストを割り当てるか、フィルタを変更してください</p>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => fetchCompanies(0, true)}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              再読み込み
            </Button>
          </div>
        )}

        <div className="divide-y">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={[
                'w-full text-left px-3 py-3 hover:bg-slate-50 transition-colors',
                selectedCompanyId === company.id ? 'bg-blue-50 border-l-2 border-blue-500' : '',
              ].join(' ')}
              onClick={() => onSelect(company)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{company.company_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {company.phone}
                  </p>
                  {company.area && (
                    <p className="text-xs text-slate-400 mt-0.5">{company.area}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    className={[
                      'text-xs px-1.5 py-0',
                      CALL_STATE_COLORS[company.call_state] ?? 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                    variant="outline"
                  >
                    {CALL_STATE_LABELS[company.call_state] ?? company.call_state}
                  </Badge>
                  {company.call_count !== undefined && company.call_count > 0 && (
                    <span className="text-xs text-slate-400">{company.call_count}回</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="p-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  )
}
