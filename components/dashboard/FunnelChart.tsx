/**
 * 8段階ファネル可視化コンポーネント
 * 各段階の件数 + 離脱率を trapezoid 風 div で表現
 * Recharts 依存なし (純粋 Tailwind CSS 実装)
 */
"use client";

import type { FunnelResult, FunnelStage } from "@/lib/kpi/funnel";

interface FunnelChartProps {
  funnel: FunnelResult;
  className?: string;
}

/** 8段階ファネル可視化 */
export function FunnelChart({ funnel, className = "" }: FunnelChartProps) {
  const maxCount = Math.max(...funnel.stages.map((s) => s.count), 1);

  return (
    <div className={`funnel-chart ${className}`} aria-label="ファネルチャート 8段階">
      <div className="flex flex-col gap-1">
        {funnel.stages.map((stage) => (
          <FunnelStageRow key={stage.stage} stage={stage} maxCount={maxCount} />
        ))}
      </div>
      {funnel.totalConversionRate !== null && (
        <p className="mt-3 text-xs text-muted-foreground text-center">
          全体転換率: <span className="font-semibold">{funnel.totalConversionRate}%</span>
          （コール → 引き継ぎ）
        </p>
      )}
    </div>
  );
}

function FunnelStageRow({
  stage,
  maxCount,
}: {
  stage: FunnelStage;
  maxCount: number;
}) {
  const widthPct = maxCount === 0 ? 0 : Math.round((stage.count / maxCount) * 100);
  const dropColor =
    stage.dropRate == null
      ? ""
      : stage.dropRate > 50
      ? "text-red-600"
      : stage.dropRate > 20
      ? "text-amber-600"
      : "text-emerald-600";

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* ラベル */}
      <div className="w-20 shrink-0 text-right text-muted-foreground truncate">
        {stage.label}
      </div>

      {/* バー */}
      <div className="flex-1 bg-muted rounded-sm h-6 relative overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-sm transition-all duration-300"
          style={{ width: `${widthPct}%` }}
          aria-label={`${stage.label}: ${stage.count}件`}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white mix-blend-difference">
          {stage.count.toLocaleString()}
        </span>
      </div>

      {/* 離脱率 */}
      <div className={`w-16 shrink-0 tabular-nums ${dropColor}`}>
        {stage.dropRate == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>離脱 {stage.dropRate}%</>
        )}
      </div>
    </div>
  );
}

/** スケルトンローダー */
export function FunnelChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`funnel-chart-skeleton flex flex-col gap-1 ${className}`} aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-20 h-5 bg-muted animate-pulse rounded" />
          <div
            className="h-6 bg-muted animate-pulse rounded-sm"
            style={{ flex: 1, opacity: 1 - i * 0.1 }}
          />
          <div className="w-16 h-5 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// END_OF_FILE
