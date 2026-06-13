'use client'

/**
 * グローバルヘッダー — テナント表示 + 通知 + プロフィール、UI文言は社外向け言い換え遵守
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bell,
  HelpCircle,
  LogOut,
  Search,
  Settings,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LifullRole } from '@/lib/lifull-roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  role: LifullRole
  tenantId: string
  userName: string
  userEmail: string | undefined
  userId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** テナントIDから表示名を返す (社外向け言い換え適用) */
function getTenantDisplayName(tenantId: string): string {
  const map: Record<string, string> = {
    lifull_homes: '大手不動産情報ポータル運営企業 営業支援',
    renovi_call: 'Renovi コール管理',
    enefoward_batt: 'エネフォード 受注管理',
  }
  return map[tenantId] ?? tenantId
}

/** ロール表示ラベル */
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

/** グローバルヘッダー */
export function Header({ role, tenantId, userName, userEmail, userId }: HeaderProps) {
  const router = useRouter()
  const [notificationCount] = useState(0) // 将来的に Supabase Realtime で更新

  // キーボードショートカット: `/` で検索フォーカス、`?` でヘルプ
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !isInput) {
      e.preventDefault()
      document.getElementById('global-search-input')?.focus()
    }

    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isInput) {
      e.preventDefault()
      // ヘルプダイアログを開く (実装は別コンポーネント)
      document.dispatchEvent(new CustomEvent('open-help-dialog'))
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6"
      aria-label="グローバルヘッダー"
    >
      {/* 左: テナント表示 */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="truncate text-sm font-medium text-foreground">
          {/* UI文言: 社外向け言い換え済み。"LIFULL" は露出しない */}
          {getTenantDisplayName(tenantId)}
        </span>
        <span className="hidden md:inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {getRoleLabel(role)}
        </span>
      </div>

      {/* 右: アクションエリア */}
      <div className="flex items-center gap-1">
        {/* 検索 */}
        <div className="relative hidden md:block">
          <label htmlFor="global-search-input" className="sr-only">
            グローバル検索
          </label>
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="global-search-input"
            type="search"
            placeholder="検索 (/)"
            aria-keyshortcuts="/"
            aria-label="グローバル検索 (ショートカット: /)"
            className={cn(
              'h-8 w-48 rounded-md border border-input bg-background pl-8 pr-3 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'transition-all duration-150 focus:w-64'
            )}
          />
        </div>

        {/* ヘルプ */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="ヘルプを開く (ショートカット: ?)"
          aria-keyshortcuts="?"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => document.dispatchEvent(new CustomEvent('open-help-dialog'))}
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* 通知 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`通知${notificationCount > 0 ? ` (${notificationCount}件の未読)` : ''}`}
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Button>

        {/* プロフィールメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`プロフィールメニューを開く (${userName})`}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <User className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none truncate">{userName}</p>
                {userEmail && (
                  <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
                )}
                <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/lifull/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span>設定</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>ログアウト</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
