'use client'

/**
 * 動的パンくずナビゲーション — ホットキー `[` でホーム戻り
 */

import { useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Path label map
// ---------------------------------------------------------------------------

/** パスセグメント → 日本語ラベルのマッピング */
const SEGMENT_LABELS: Record<string, string> = {
  lifull: 'ホーム',
  admin: '管理',
  'call-list': 'コールリスト',
  call: 'コール',
  deals: '案件管理',
  handoff: 'アポ振り分け',
  activity: '行動管理',
  personal: '個人実績',
  'ng-analysis': 'NG分析',
  settings: '設定',
  meetings: '商談',
  new: '新規作成',
  daily: '朝会/夜会',
  weekly: '週次定例',
  collections: '申込書回収',
  orders: '受注管理',
  yomi: 'ヨミ',
  slots: '商談枠管理',
  conversion: 'ファネル',
  'team-stats': 'チーム比較',
  'list-progress': 'リスト消化',
  'sheets-sync': 'Sheets同期',
  alerts: 'アラート',
  kpi: 'KPIサマリー',
  funnels: 'ファネル比較',
  tenants: 'テナント一覧',
  users: 'ユーザー管理',
  lists: 'リスト管理',
  dispatch: 'AI割り振り',
  audit: '審査',
  approvals: '稟議番号',
  'audit-logs': '監査ログ',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  label: string
  href: string
  isCurrentPage: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = []

  // UUID チェック (動的セグメント)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  // 数値 ID チェック
  const NUM_ID_REGEX = /^\d+$/

  let currentPath = ''
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    // UUID や数値IDはラベルを「詳細」とする
    const isDynamicId = UUID_REGEX.test(segment) || NUM_ID_REGEX.test(segment)
    const label = isDynamicId
      ? '詳細'
      : (SEGMENT_LABELS[segment] ?? segment)

    items.push({
      label,
      href: currentPath,
      isCurrentPage: i === segments.length - 1,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface BreadcrumbProps {
  /** ホームパス (ロールによって異なる) */
  homeHref?: string
  /** 追加クラス */
  className?: string
}

/** 動的パンくずナビゲーション。ホットキー `[` でホームに戻る。 */
export function Breadcrumb({ homeHref = '/lifull', className }: BreadcrumbProps) {
  const pathname = usePathname()
  const breadcrumbs = buildBreadcrumbs(pathname)

  // キーボードショートカット: `[` でホームに戻る
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        const isInput =
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
        if (!isInput) {
          window.location.href = homeHref
        }
      }
    },
    [homeHref]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <nav
      aria-label="パンくずナビゲーション"
      aria-keyshortcuts="["
      className={cn('flex items-center', className)}
    >
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {/* ホームアイコン */}
        <li>
          <Link
            href={homeHref}
            aria-label="ホームへ戻る (ショートカット: [)"
            className={cn(
              'flex items-center rounded-sm p-0.5 transition-colors',
              'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>

        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            {item.isCurrentPage ? (
              <span
                aria-current="page"
                className="font-medium text-foreground truncate max-w-[200px]"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  'truncate max-w-[160px] rounded-sm transition-colors',
                  'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
