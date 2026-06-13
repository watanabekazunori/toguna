'use client'

/**
 * 汎用データテーブル — TanStack Table v8 + shadcn テーブル
 * フィルタ保存(URL params + localStorage)、ソート / ページング / カラム可視性 / CSV エクスポート、テナント context 越境警告
 */

import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Settings2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataTableProps<TData> {
  /** TanStack Table カラム定義 */
  columns: ColumnDef<TData>[]
  /** テーブルデータ */
  data: TData[]
  /** 現在のテナントID (テナント越境チェックに使用) */
  currentTenantId?: string
  /** データが所属するテナントID (越境チェック用) */
  dataTenantId?: string
  /** グローバル検索のプレースホルダー */
  searchPlaceholder?: string
  /** 検索対象カラムキー */
  searchColumnKey?: string
  /** CSV エクスポート有効か */
  enableExport?: boolean
  /** CSV ファイル名 (拡張子なし) */
  exportFileName?: string
  /** URL params にフィルタ保存するか */
  persistFiltersInUrl?: boolean
  /** localStorage のキー (フィルタ保存用) */
  localStorageKey?: string
  /** ページサイズ選択肢 */
  pageSizeOptions?: number[]
  /** 追加クラス */
  className?: string
  /** ツールバーの追加コンテンツ */
  toolbarExtra?: ReactNode
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportToCsv<TData>(data: TData[], columns: ColumnDef<TData>[], fileName: string) {
  const headers = columns
    .map((col) => (typeof col.header === 'string' ? col.header : (col as { id?: string }).id ?? ''))
    .filter(Boolean)

  const rows = data.map((row) =>
    columns.map((col) => {
      const key = (col as { accessorKey?: string }).accessorKey
      if (!key) return ''
      const val = (row as Record<string, unknown>)[key]
      // CSV エスケープ: ダブルクォートを二重に、カンマを含む場合はクォート
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    })
  )

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Tenant mismatch warning
// ---------------------------------------------------------------------------

function TenantMismatchWarning({
  currentTenantId,
  dataTenantId,
}: {
  currentTenantId: string
  dataTenantId: string
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        表示中のデータ ({dataTenantId}) は現在のコンテキスト ({currentTenantId}) と一致しません。
        意図した操作か確認してください。
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * 汎用データテーブル。
 * - フィルタ: URL params + localStorage に保存・復元
 * - ソート: カラムヘッダークリック
 * - ページング: ページサイズ変更対応
 * - カラム可視性: ドロップダウンで切替
 * - CSV エクスポート: enableExport=true で有効化
 * - テナント越境警告: currentTenantId != dataTenantId 時にバナー表示
 */
export function DataTable<TData>({
  columns,
  data,
  currentTenantId,
  dataTenantId,
  searchPlaceholder = '検索...',
  searchColumnKey,
  enableExport = false,
  exportFileName = 'export',
  persistFiltersInUrl = false,
  localStorageKey,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  toolbarExtra,
}: DataTableProps<TData>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ---------------------------------------------------------------------------
  // State: フィルタ復元
  // ---------------------------------------------------------------------------

  const getInitialFilter = useCallback((): string => {
    if (persistFiltersInUrl && searchColumnKey) {
      const fromUrl = searchParams.get(`filter_${searchColumnKey}`)
      if (fromUrl) return fromUrl
    }
    if (localStorageKey) {
      try {
        const stored = localStorage.getItem(`${localStorageKey}_filter`)
        if (stored) return stored
      } catch { /* localStorage 利用不可 */ }
    }
    return ''
  }, [persistFiltersInUrl, searchColumnKey, searchParams, localStorageKey])

  const [globalFilter, setGlobalFilter] = useState<string>(getInitialFilter)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions[0],
  })

  // フィルタ変更時に URL params / localStorage に保存
  const handleGlobalFilterChange = useCallback(
    (value: string) => {
      setGlobalFilter(value)
      setPagination((p) => ({ ...p, pageIndex: 0 })) // フィルタ変更でページリセット

      if (persistFiltersInUrl && searchColumnKey) {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
          params.set(`filter_${searchColumnKey}`, value)
        } else {
          params.delete(`filter_${searchColumnKey}`)
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }

      if (localStorageKey) {
        try {
          if (value) {
            localStorage.setItem(`${localStorageKey}_filter`, value)
          } else {
            localStorage.removeItem(`${localStorageKey}_filter`)
          }
        } catch { /* localStorage 利用不可 */ }
      }
    },
    [persistFiltersInUrl, searchColumnKey, searchParams, router, pathname, localStorageKey]
  )

  // ---------------------------------------------------------------------------
  // TanStack Table インスタンス
  // ---------------------------------------------------------------------------

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: handleGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const showTenantWarning =
    currentTenantId && dataTenantId && currentTenantId !== dataTenantId

  return (
    <div className={cn('space-y-3', className)}>
      {/* テナント越境警告 */}
      {showTenantWarning && (
        <TenantMismatchWarning
          currentTenantId={currentTenantId!}
          dataTenantId={dataTenantId!}
        />
      )}

      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* グローバル検索 */}
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => handleGlobalFilterChange(e.target.value)}
            aria-label={searchPlaceholder}
            aria-keyshortcuts="/"
            className="h-8 w-48 text-sm"
          />
          {toolbarExtra}
        </div>

        <div className="flex items-center gap-2">
          {/* CSV エクスポート */}
          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(data, columns, exportFileName)}
              className="flex items-center gap-1.5 h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              CSV出力
            </Button>
          )}

          {/* カラム可視性 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-8 text-xs">
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                表示列
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">表示する列</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="text-xs capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(val) => col.toggleVisibility(!!val)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* テーブル本体 */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'text-xs font-semibold',
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                  データがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページング */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          全 {table.getFilteredRowModel().rows.length} 件 / {table.getPageCount()} ページ
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="最初のページ"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="前のページ"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-1">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="次のページ"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="最後のページ"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
