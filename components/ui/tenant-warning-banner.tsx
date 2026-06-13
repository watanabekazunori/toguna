'use client'

/**
 * テナント越境警告バナー — 複数テナント所属時、現在 view 中の tenant_id を明示
 * quality_bar §3「テナントcontext切替UX」対応
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import type { KnownTenantId } from '@/lib/tenant-context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantWarningBannerProps {
  /** 現在の認証テナントID (セッションのテナント) */
  sessionTenantId: string
  /** 現在 view 中のテナントID (ページのデータ側) */
  viewTenantId: string
  /** 切替可能なテナント一覧 (ADMIN の場合は複数) */
  availableTenants?: Array<{ id: string; displayName: string }>
  /** テナント切替ハンドラ */
  onSwitchTenant?: (tenantId: string) => void | Promise<void>
  /** 追加クラス */
  className?: string
}

// ---------------------------------------------------------------------------
// Tenant display name map
// ---------------------------------------------------------------------------

/** テナントIDから外部向け表示名に変換 (社外文書ルール準拠) */
function getTenantDisplayName(tenantId: string): string {
  const map: Record<string, string> = {
    lifull_homes: '大手不動産情報ポータル運営企業 (lifull_homes)',
    renovi_call: 'Renovi コール管理 (renovi_call)',
    enefoward_batt: 'エネフォード 受注管理 (enefoward_batt)',
  }
  return map[tenantId] ?? `テナント: ${tenantId}`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * テナント越境警告バナー。
 *
 * sessionTenantId と viewTenantId が不一致の場合にのみ表示する。
 * ADMIN ロールが他テナントのデータを閲覧する際に、意図した操作かを確認させる。
 *
 * quality_bar §3「テナントcontext切替UX」準拠:
 * - 現在 view 中の tenant_id を明示
 * - テナント切替ボタンを提供
 * - 意図的なアクセスとして閉じることも可能 (セッション中のみ非表示)
 */
export function TenantWarningBanner({
  sessionTenantId,
  viewTenantId,
  availableTenants,
  onSwitchTenant,
  className,
}: TenantWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // テナントが同一ならバナー不要
  const isMismatch = sessionTenantId !== viewTenantId

  // viewTenantId が変わったら dismissed をリセット
  useEffect(() => {
    setDismissed(false)
  }, [viewTenantId])

  if (!isMismatch || dismissed) {
    return null
  }

  const handleSwitch = async (tenantId: string) => {
    if (!onSwitchTenant) return
    setIsSwitching(true)
    try {
      await onSwitchTenant(tenantId)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="テナントコンテキスト警告"
      className={cn(
        'relative flex flex-wrap items-start gap-3 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/50 dark:bg-amber-900/20',
        className
      )}
    >
      {/* アイコン */}
      <AlertTriangle
        className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
        aria-hidden="true"
      />

      {/* メッセージ */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-amber-800 dark:text-amber-300">
          テナントコンテキストが異なります
        </p>
        <p className="text-amber-700 dark:text-amber-400/80 text-xs leading-relaxed">
          現在のセッション:{' '}
          <span className="font-mono font-medium">{getTenantDisplayName(sessionTenantId)}</span>
          <br />
          表示中のデータ:{' '}
          <span className="font-mono font-medium">{getTenantDisplayName(viewTenantId)}</span>
        </p>

        {/* テナント切替オプション */}
        {availableTenants && availableTenants.length > 0 && onSwitchTenant && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-amber-700 dark:text-amber-400/80">切替:</span>
            {availableTenants
              .filter((t) => t.id !== sessionTenantId)
              .map((tenant) => (
                <Button
                  key={tenant.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSwitch(tenant.id)}
                  disabled={isSwitching}
                  className="h-6 gap-1 border-amber-400 bg-white text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-500/50 dark:bg-transparent dark:text-amber-300"
                  aria-label={`${tenant.displayName} に切り替える`}
                >
                  {isSwitching && (
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                  )}
                  {tenant.displayName}
                </Button>
              ))}
          </div>
        )}
      </div>

      {/* 閉じるボタン (意図的なアクセスとして非表示化) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDismissed(true)}
        aria-label="警告を閉じる (このセッションでは非表示になります)"
        className="h-6 w-6 shrink-0 text-amber-600 hover:bg-amber-100 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
