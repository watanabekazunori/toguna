/**
 * エンプティ状態コンポーネント — illustration プレースホルダ + CTA、ロール別メッセージカスタム
 */

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Inbox,
  PhoneCall,
  Briefcase,
  BarChart2,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { LifullRole } from '@/lib/lifull-roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'secondary' | 'outline'
}

interface StateEmptyProps {
  /** エンプティメッセージのコンテキスト (どの画面か) */
  context?: EmptyContext
  /** カスタム見出し (context より優先) */
  heading?: string
  /** カスタム説明文 (context より優先) */
  description?: string
  /** カスタムアイコン */
  icon?: LucideIcon
  /** アクション群 (最大2件推奨) */
  actions?: EmptyAction[]
  /** 表示するロール (ロール別メッセージに使用) */
  role?: LifullRole
  /** 追加クラス */
  className?: string
}

type EmptyContext =
  | 'call-list'       // コールリスト (APPOINTER)
  | 'meetings'        // 担当商談 (CLOSER)
  | 'ng-analysis'     // NG分析
  | 'search-results'  // 検索結果なし
  | 'alerts'          // アラート
  | 'generic'         // 汎用

// ---------------------------------------------------------------------------
// Context configs (ui_flow.md §9-2 準拠)
// ---------------------------------------------------------------------------

interface ContextConfig {
  heading: string
  description: (role?: LifullRole) => string
  icon: LucideIcon
  defaultAction?: EmptyAction
}

const CONTEXT_CONFIGS: Record<EmptyContext, ContextConfig> = {
  'call-list': {
    heading: '本日のコールリストがありません',
    description: () => 'マネージャーからのリスト割り当て後に表示されます。',
    icon: PhoneCall,
    defaultAction: {
      label: 'リストを割り当てる',
      href: '/lifull/call-list',
    },
  },
  meetings: {
    heading: '担当商談がありません',
    description: (role) =>
      role === 'CLOSER'
        ? 'アポインターからの振り分けをお待ちください。'
        : '商談はアポインターが振り分けると表示されます。',
    icon: Briefcase,
  },
  'ng-analysis': {
    heading: '集計期間内のデータがありません',
    description: () => '期間を変更するか、データが蓄積されるまでお待ちください。',
    icon: BarChart2,
    defaultAction: {
      label: '期間を変更する',
      href: '/lifull/ng-analysis',
      variant: 'outline',
    },
  },
  'search-results': {
    heading: '検索結果がありません',
    description: () => 'キーワードを変えて再度お試しください。',
    icon: Search,
  },
  alerts: {
    heading: '現在アラートはありません',
    description: () => 'すべての指標が正常範囲内です。',
    icon: Inbox,
  },
  generic: {
    heading: 'データがありません',
    description: () => '表示できるデータがありません。',
    icon: Inbox,
  },
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * エンプティ状態コンポーネント。
 * アイコン + 見出し + 説明 + CTAボタン の4要素を必ず含む (empty-state-designer スキル準拠)。
 */
export function StateEmpty({
  context = 'generic',
  heading,
  description,
  icon: CustomIcon,
  actions,
  role,
  className,
}: StateEmptyProps) {
  const config = CONTEXT_CONFIGS[context]
  const Icon = CustomIcon ?? config.icon
  const displayHeading = heading ?? config.heading
  const displayDescription = description ?? config.description(role)

  // アクション: props から渡された場合は優先、なければデフォルト
  const displayActions: EmptyAction[] = actions ?? (config.defaultAction ? [config.defaultAction] : [])

  return (
    <div
      role="status"
      aria-label={displayHeading}
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {/* イラストプレースホルダー (実装時に SVG illustration に差し替え) */}
      <div
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-muted"
      >
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>

      {/* 見出し */}
      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-semibold text-foreground">{displayHeading}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{displayDescription}</p>
      </div>

      {/* CTA アクション */}
      {displayActions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {displayActions.map((action, i) => {
            if (action.href) {
              return (
                <Button key={i} asChild variant={action.variant ?? (i === 0 ? 'default' : 'outline')}>
                  <a href={action.href}>{action.label}</a>
                </Button>
              )
            }
            return (
              <Button
                key={i}
                variant={action.variant ?? (i === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
