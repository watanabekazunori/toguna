/**
 * ヨミ A/B/C/D の色分けバッジ + 確度% 表示 — yomi_rates テーブルから動的取得
 */
'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type Yomi, YOMI_META } from '@/lib/validation/meeting-schema'

interface YomiBadgeProps {
  yomi: Yomi
  /** DB から取得したカスタム確度率 (0.0〜1.0)。省略時は YOMI_META のデフォルト値を使用 */
  customRate?: number
  /** コンパクト表示 (確度% 省略) */
  compact?: boolean
  className?: string
}

/** ヨミ区分を色分けバッジ + 確度% で表示するコンポーネント */
export function YomiBadge({ yomi, customRate, compact = false, className = '' }: YomiBadgeProps) {
  const meta = YOMI_META[yomi]
  const rate = customRate ?? meta.rate
  const pct = Math.round(rate * 100)

  const badge = (
    <Badge
      variant="outline"
      className={[
        'font-bold text-xs px-2 py-0.5 gap-1',
        meta.color,
        meta.bg,
        'border-current/30',
        className,
      ].join(' ')}
    >
      {meta.label}
      {!compact && (
        <span className="font-normal opacity-80">
          {pct}%
        </span>
      )}
    </Badge>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-semibold">{meta.label} — 確度 {pct}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** ヨミ一覧をまとめて表示するサマリーコンポーネント */
export function YomiLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(YOMI_META) as Yomi[]).map((y) => (
        <YomiBadge key={y} yomi={y} />
      ))}
    </div>
  )
}
