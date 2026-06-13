/**
 * 権限不足状態コンポーネント — 403表示、ロール別メッセージ、role escalation 申請リンク
 */

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Lock, Mail } from 'lucide-react'
import { hasMinimumRole, type LifullRole } from '@/lib/lifull-roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StateUnauthorizedProps {
  /** 現在のユーザーロール */
  currentRole: LifullRole
  /** アクセスに必要な最低ロール */
  requiredRole?: LifullRole
  /** 必要なアクション名 (ロールではなくアクション単位で権限不足の場合) */
  requiredAction?: string
  /** テナント context mismatch によるブロックか */
  isTenantMismatch?: boolean
  /** 管理者へのメール (role escalation 申請先) */
  adminEmail?: string
  /** 追加クラス */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ロール日本語ラベル */
function getRoleLabel(role: LifullRole): string {
  const map: Record<LifullRole, string> = {
    APPOINTER: 'アポインター',
    CLOSER: 'クローザー',
    MANAGER: 'マネージャー',
    ADMIN: '管理者',
  }
  return map[role]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * 権限不足 (403) 状態コンポーネント。
 *
 * ui_flow.md §9-4 準拠:
 * - 「あなたは○○ロールです、必要なロールは△△」を明示
 * - 必ず「管理者に連絡する」CTA を表示
 * - テナント越境アクセス時は専用メッセージ
 */
export function StateUnauthorized({
  currentRole,
  requiredRole,
  requiredAction,
  isTenantMismatch = false,
  adminEmail,
  className,
}: StateUnauthorizedProps) {
  const currentRoleLabel = getRoleLabel(currentRole)
  const requiredRoleLabel = requiredRole ? getRoleLabel(requiredRole) : null

  // メッセージ生成
  const heading = isTenantMismatch
    ? 'アクセス権限がありません'
    : 'この操作を行う権限がありません'

  const description = (() => {
    if (isTenantMismatch) {
      return 'アクセス権限がありません (tenant context mismatch)。別のテナントのデータにはアクセスできません。'
    }
    if (requiredRoleLabel) {
      return `あなたは「${currentRoleLabel}」ロールです。この操作には「${requiredRoleLabel}」以上のロールが必要です。`
    }
    if (requiredAction) {
      return `あなたは「${currentRoleLabel}」ロールです。「${requiredAction}」の権限がありません。`
    }
    return `あなたは「${currentRoleLabel}」ロールです。このページへのアクセス権限がありません。`
  })()

  // role escalation メール本文
  const escalationSubject = encodeURIComponent('[権限申請] ロール変更リクエスト')
  const escalationBody = encodeURIComponent(
    `管理者様\n\n以下の権限申請をお願いします。\n\n現在のロール: ${currentRoleLabel}\n必要なロール: ${requiredRoleLabel ?? '確認が必要です'}\n\nよろしくお願いいたします。`
  )
  const mailtoHref = adminEmail
    ? `mailto:${adminEmail}?subject=${escalationSubject}&body=${escalationBody}`
    : undefined

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {/* アイコン */}
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"
      >
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* メッセージ */}
      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-semibold text-foreground">{heading}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

        {/* ロール情報の視覚化 */}
        {requiredRole && !isTenantMismatch && (
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <RoleBadge role={currentRole} label={`あなた: ${currentRoleLabel}`} variant="current" />
            <span className="text-xs text-muted-foreground" aria-hidden="true">→ 必要:</span>
            <RoleBadge role={requiredRole} label={requiredRoleLabel!} variant="required" />
          </div>
        )}
      </div>

      {/* アクション */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* 管理者に連絡 (必須 CTA) */}
        <Button variant="default" asChild>
          {mailtoHref ? (
            <a href={mailtoHref} className="flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              管理者に連絡する
            </a>
          ) : (
            <a href="/lifull/settings" className="flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              管理者に連絡する
            </a>
          )}
        </Button>

        {/* ホームに戻る */}
        <Button variant="outline" asChild>
          <a href="/lifull">ホームに戻る</a>
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RoleBadge sub-component
// ---------------------------------------------------------------------------

function RoleBadge({
  role,
  label,
  variant,
}: {
  role: LifullRole
  label: string
  variant: 'current' | 'required'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'current'
          ? 'bg-muted text-muted-foreground'
          : 'bg-primary/10 text-primary'
      )}
    >
      {label}
    </span>
  )
}
