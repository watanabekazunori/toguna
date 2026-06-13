'use client'

/**
 * エラー状態コンポーネント — ErrorBoundary 連携、retry ボタン、Sentry breadcrumb 連携、correlation_id 表示
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StateErrorProps {
  /** エラーオブジェクト (Next.js error.tsx から渡される) */
  error?: Error & { digest?: string }
  /** 手動で設定するエラーメッセージ */
  message?: string
  /** 相関ID (audit_log / Sentry trace に紐付くID、S-01/I-07 対策) */
  correlationId?: string
  /** エラーコード (ユーザー向け表示用) */
  errorCode?: string
  /** retry コールバック (Next.js error.tsx の reset 関数) */
  onRetry?: () => void
  /** 追加アクション */
  additionalAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
  /** 追加クラス */
  className?: string
}

// ---------------------------------------------------------------------------
// Sentry breadcrumb hook (Sentry が未導入の場合は no-op)
// ---------------------------------------------------------------------------

/**
 * Sentry breadcrumb を記録する。
 * @sentry/nextjs がインストールされていない場合は console.error のみ。
 */
function useSentryBreadcrumb() {
  return useCallback(
    (message: string, data?: Record<string, unknown>) => {
      try {
        // Sentry が導入されている場合のみ実行
        const Sentry = (globalThis as Record<string, unknown>).__SENTRY__
        if (Sentry && typeof (Sentry as Record<string, unknown>).addBreadcrumb === 'function') {
          ;(Sentry as { addBreadcrumb: (opts: unknown) => void }).addBreadcrumb({
            category: 'ui.error',
            message,
            level: 'error',
            data,
          })
        }
      } catch {
        // Sentry 未導入または初期化前は無視
      }
      console.error('[StateError]', message, data)
    },
    []
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * エラー状態コンポーネント。
 *
 * Next.js App Router の error.tsx から直接利用:
 * ```tsx
 * 'use client'
 * export default function Error({ error, reset }: { error: Error; reset: () => void }) {
 *   return <StateError error={error} onRetry={reset} />
 * }
 * ```
 *
 * correlation_id はバックエンドの audit_log と Sentry trace に紐付けることで、
 * threat_model.md S-01(不正アクセス監査)/I-07(操作ログ改ざん) に対応する。
 */
export function StateError({
  error,
  message,
  correlationId,
  errorCode,
  onRetry,
  additionalAction,
  className,
}: StateErrorProps) {
  const addBreadcrumb = useSentryBreadcrumb()

  // コンポーネント描画時に Sentry に記録
  // useEffect 不要 — 描画ごとに一度だけ記録すれば十分
  addBreadcrumb('StateError rendered', {
    message: error?.message ?? message,
    correlationId,
    errorCode,
    digest: error?.digest,
  })

  // ユーザー向けメッセージ (内部エラー詳細は隠す)
  const displayMessage =
    message ??
    (errorCode
      ? `データの取得に失敗しました (${errorCode})。`
      : 'データの取得に失敗しました。')

  // digest は Next.js が付与するサーバーエラーID
  const displayCorrelationId = correlationId ?? error?.digest

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {/* アイコン */}
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
      >
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      {/* メッセージ */}
      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-semibold text-foreground">エラーが発生しました</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{displayMessage}</p>

        {/* correlation_id — 監査・サポート連携用 */}
        {displayCorrelationId && (
          <p className="mt-2 font-mono text-xs text-muted-foreground/60">
            参照ID: {displayCorrelationId}
          </p>
        )}
      </div>

      {/* アクション */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button
            variant="default"
            onClick={onRetry}
            className="flex items-center gap-2"
            aria-label="再試行する"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            再試行
          </Button>
        )}

        {additionalAction && (
          <>
            {additionalAction.href ? (
              <Button variant="outline" asChild>
                <a
                  href={additionalAction.href}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {additionalAction.label}
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={additionalAction.onClick}
                className="flex items-center gap-2"
              >
                {additionalAction.label}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
