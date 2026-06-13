/**
 * ローディング状態コンポーネント — スケルトン/スピナー切替、Suspense fallback 用、aria-busy 付き
 */

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadingVariant = 'skeleton' | 'spinner' | 'skeleton-card' | 'skeleton-table' | 'skeleton-kpi'

interface StateLoadingProps {
  /** ローディング表示の種類 */
  variant?: LoadingVariant
  /** スピナー下のラベルテキスト */
  label?: string
  /** プログレスバー (0-100、undefined で非表示) */
  progress?: number
  /** プログレスバーのラベル */
  progressLabel?: string
  /** スケルトン行数 (skeleton-table 用) */
  rows?: number
  /** 追加クラス */
  className?: string
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** KPI カードスケルトン (ダッシュボード用) */
function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4 space-y-2', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

/** テーブルスケルトン */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {/* ヘッダー */}
      <div className="flex gap-4 px-4 py-2">
        {[40, 24, 16, 20].map((w, i) => (
          <Skeleton key={i} className={`h-3 w-${w}`} />
        ))}
      </div>
      {/* 行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-md border border-border px-4 py-3">
          {[40, 24, 16, 20].map((w, j) => (
            <Skeleton key={j} className={`h-4 w-${w}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** 汎用カードスケルトン */
function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4" aria-hidden="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  )
}

/** スピナービュー */
function SpinnerView({
  label,
  progress,
  progressLabel,
}: {
  label?: string
  progress?: number
  progressLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      {label && (
        <p className="text-sm text-muted-foreground text-center max-w-xs">{label}</p>
      )}
      {progress !== undefined && (
        <div className="w-48 space-y-1">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressLabel ?? 'ローディング進捗'}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
          {progressLabel && (
            <p className="text-xs text-center text-muted-foreground">{progressLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ローディング状態コンポーネント。
 * - variant="skeleton" — 汎用スケルトン (デフォルト)
 * - variant="skeleton-card" — カードスケルトン
 * - variant="skeleton-table" — テーブルスケルトン
 * - variant="skeleton-kpi" — KPIダッシュボード用スケルトン
 * - variant="spinner" — スピナー + オプションのプログレスバー
 *
 * LCP < 2.5s 対応: スケルトンは即時表示、flicker 防止は呼び出し元で useTransition を使用。
 */
export function StateLoading({
  variant = 'skeleton',
  label,
  progress,
  progressLabel,
  rows = 5,
  className,
}: StateLoadingProps) {
  const content = (() => {
    switch (variant) {
      case 'spinner':
        return (
          <SpinnerView label={label} progress={progress} progressLabel={progressLabel} />
        )
      case 'skeleton-card':
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )
      case 'skeleton-table':
        return <TableSkeleton rows={rows} />
      case 'skeleton-kpi':
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
        )
      default:
        // 汎用スケルトン
        return (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )
    }
  })()

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? 'コンテンツを読み込み中'}
      aria-live="polite"
      className={cn('w-full', className)}
    >
      {content}
      {/* スクリーンリーダー用テキスト */}
      <span className="sr-only">{label ?? 'コンテンツを読み込み中です。しばらくお待ちください。'}</span>
    </div>
  )
}
