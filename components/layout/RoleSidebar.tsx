'use client'

/**
 * ロール別サイドバー — APPOINTER / CLOSER / MANAGER / ADMIN の4ロールに対応、collapsed トグル付き
 */

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Home,
  PhoneCall,
  List,
  Briefcase,
  Share2,
  BarChart2,
  User,
  Settings,
  Calendar,
  Clock,
  FileText,
  CheckSquare,
  Package,
  TrendingUp,
  Users,
  AlertCircle,
  Database,
  Shield,
  FileCheck,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from 'lucide-react'
import type { LifullRole } from '@/lib/lifull-roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface SidebarConfig {
  heroCta: {
    label: string
    href: string
    variant: 'default' | 'secondary' | 'outline'
  }
  topItems: NavItem[]
  groups: NavGroup[]
  bottomItems: NavItem[]
}

// ---------------------------------------------------------------------------
// Role-specific sidebar configurations (ui_flow.md §2 準拠)
// ---------------------------------------------------------------------------

const SIDEBAR_CONFIG: Record<LifullRole, SidebarConfig> = {
  APPOINTER: {
    heroCta: { label: 'コールを開始', href: '/lifull/call', variant: 'default' },
    topItems: [
      { label: 'ホーム', href: '/lifull', icon: Home },
      { label: 'リスト', href: '/lifull/call-list', icon: List },
    ],
    groups: [
      {
        label: '案件',
        items: [
          { label: '案件管理表', href: '/lifull/deals', icon: Briefcase },
          { label: 'アポ振り分け', href: '/lifull/handoff', icon: Share2 },
        ],
      },
      {
        label: '分析',
        items: [
          { label: '行動管理', href: '/lifull/activity', icon: BarChart2 },
          { label: '個人実績', href: '/lifull/personal', icon: User },
          { label: 'NG分析', href: '/lifull/ng-analysis', icon: AlertCircle },
        ],
      },
    ],
    bottomItems: [{ label: '設定', href: '/lifull/settings', icon: Settings }],
  },

  CLOSER: {
    heroCta: { label: '担当案件一覧', href: '/lifull/meetings', variant: 'default' },
    topItems: [{ label: 'ホーム', href: '/lifull', icon: Home }],
    groups: [
      {
        label: '案件',
        items: [
          { label: '担当商談', href: '/lifull/meetings', icon: Briefcase },
          { label: '商談入力', href: '/lifull/meetings/new', icon: FileText },
          { label: '申込書回収', href: '/lifull/collections', icon: CheckSquare },
          { label: '受注管理', href: '/lifull/orders', icon: Package },
          { label: '引き継ぎ', href: '/lifull/handoff', icon: Share2 },
          { label: 'ヨミ', href: '/lifull/yomi', icon: TrendingUp },
        ],
      },
      {
        label: '商談枠管理',
        items: [{ label: '週カレンダー', href: '/lifull/slots', icon: Calendar }],
      },
    ],
    bottomItems: [
      { label: '個人実績', href: '/lifull/personal', icon: User },
      { label: '設定', href: '/lifull/settings', icon: Settings },
    ],
  },

  MANAGER: {
    heroCta: { label: 'ダッシュボード', href: '/lifull', variant: 'secondary' },
    topItems: [{ label: 'ホーム', href: '/lifull', icon: Home }],
    groups: [
      {
        label: 'KPI',
        items: [
          { label: 'ヨミ着地', href: '/lifull/yomi', icon: TrendingUp },
          { label: 'ファネル', href: '/lifull/conversion', icon: BarChart2 },
          { label: 'チーム比較', href: '/lifull/team-stats', icon: Users },
          { label: '行動管理', href: '/lifull/activity', icon: BarChart2 },
          { label: 'リスト消化', href: '/lifull/list-progress', icon: List },
        ],
      },
      {
        label: '商談枠管理',
        items: [{ label: '週カレンダー', href: '/lifull/slots', icon: Calendar }],
      },
      {
        label: '会議',
        items: [
          { label: '朝会/夜会', href: '/lifull/meetings/daily', icon: Clock },
          { label: '週次定例', href: '/lifull/meetings/weekly', icon: Calendar },
          { label: 'Sheets同期', href: '/lifull/sheets-sync', icon: FileText },
        ],
      },
    ],
    bottomItems: [
      { label: 'アラート', href: '/lifull/alerts', icon: AlertCircle },
      { label: '設定', href: '/lifull/settings', icon: Settings },
    ],
  },

  ADMIN: {
    heroCta: {
      label: '全テナントダッシュボード',
      href: '/admin',
      variant: 'default',
    },
    topItems: [{ label: 'ホーム', href: '/admin', icon: Home }],
    groups: [
      {
        label: 'テナント横断',
        items: [
          { label: 'KPIサマリー', href: '/admin/kpi', icon: BarChart2 },
          { label: 'ファネル比較', href: '/admin/funnels', icon: TrendingUp },
          { label: 'アラート', href: '/admin/alerts', icon: AlertCircle },
        ],
      },
      {
        label: '管理',
        items: [
          { label: 'テナント一覧', href: '/admin/tenants', icon: Database },
          { label: 'ユーザー管理', href: '/admin/users', icon: Users },
          { label: 'リスト管理', href: '/admin/lists', icon: List },
          { label: 'AI割り振り', href: '/admin/dispatch', icon: LayoutDashboard },
          { label: '審査', href: '/admin/audit', icon: FileCheck },
          { label: '稟議番号', href: '/admin/approvals', icon: FileText },
        ],
      },
    ],
    bottomItems: [
      { label: '設定', href: '/admin/settings', icon: Settings },
      { label: '監査ログ', href: '/admin/audit-logs', icon: Shield },
    ],
  },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** 単一ナビゲーションリンク */
function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

/** 折りたたみ可能グループ */
function NavGroupSection({
  group,
  pathname,
  collapsed,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
}) {
  const hasActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
  const [open, setOpen] = useState(hasActive || true)

  if (collapsed) {
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
            collapsed={collapsed}
          />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider',
            'text-muted-foreground/70 hover:text-muted-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
          )}
          aria-expanded={open}
        >
          <span>{group.label}</span>
          {open ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-1">
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
            collapsed={collapsed}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RoleSidebarProps {
  role: LifullRole
  tenantId: string
}

/** ロール別サイドバー — ui_flow.md §2 の構成に準拠 */
export function RoleSidebar({ role, tenantId }: RoleSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const config = SIDEBAR_CONFIG[role]

  // キーボードショートカット: `[` でホームに戻る
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
        if (!isInput) {
          window.location.href = config.topItems[0]?.href ?? '/lifull'
        }
      }
    },
    [config]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <aside
      aria-label="ナビゲーションサイドバー"
      aria-keyshortcuts="["
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-14' : 'w-60',
        'shrink-0 overflow-hidden'
      )}
    >
      {/* ブランドロゴ + collapse トグル */}
      <div className={cn('flex items-center border-b border-border px-3 py-3', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-foreground">
            {/* UI文言: 社外向け「LIFULL」言い換え済み */}
            TOGUNA Operation Hub
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'サイドバーを展開する' : 'サイドバーを折りたたむ'}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Hero CTA */}
      <div className={cn('px-3 py-3', collapsed && 'px-2')}>
        <Button
          asChild
          variant={config.heroCta.variant}
          className={cn('w-full', collapsed && 'px-2')}
          aria-label={collapsed ? config.heroCta.label : undefined}
        >
          <Link href={config.heroCta.href}>
            <LayoutDashboard className={cn('h-4 w-4 shrink-0', !collapsed && 'mr-2')} aria-hidden="true" />
            {!collapsed && <span className="truncate">{config.heroCta.label}</span>}
          </Link>
        </Button>
      </div>

      {/* ナビゲーション */}
      <nav
        aria-label="メインナビゲーション"
        className="flex-1 overflow-y-auto px-2 pb-2"
      >
        {/* トップレベルアイテム */}
        <div className="space-y-1 pb-2">
          {config.topItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* グループ */}
        {config.groups.length > 0 && (
          <div className="space-y-3 border-t border-border pt-2">
            {config.groups.map((group) => (
              <NavGroupSection
                key={group.label}
                group={group}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </nav>

      {/* ボトムアイテム */}
      {config.bottomItems.length > 0 && (
        <div className="border-t border-border px-2 py-2 space-y-1">
          {config.bottomItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}

      {/* ロールバッジ (collapsed 時は非表示) */}
      {!collapsed && (
        <div className="border-t border-border px-3 py-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {role}
          </span>
        </div>
      )}
    </aside>
  )
}
