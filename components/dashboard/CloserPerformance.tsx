/**
 * クローザー別パフォーマンス比較ヒートマップ
 * 受注率 / 値引き率 / 口頭受注数を色階調で表示
 * Recharts 依存なし (CSS グリッド実装)
 */
"use client";

interface CloserStat {
  closerId: string;
  closerName: string;
  /** 受注率 (%) */
  orderRate: number | null;
  /** 値引き率 (%) */
  discountRate: number | null;
  /** 口頭受注数 */
  bYomiCount: number;
  /** 商談数 */
  meetingCount: number;
}

interface CloserPerformanceProps {
  stats: CloserStat[];
  className?: string;
}

const METRICS: { key: keyof CloserStat; label: string; desired: "high" | "low"; unit: string }[] = [
  { key: "orderRate", label: "受注率", desired: "high", unit: "%" },
  { key: "discountRate", label: "値引き率", desired: "low", unit: "%" },
  { key: "bYomiCount", label: "口頭受注数", desired: "high", unit: "件" },
  { key: "meetingCount", label: "商談数", desired: "high", unit: "件" },
];

/** クローザー別パフォーマンスヒートマップ */
export function CloserPerformance({ stats, className = "" }: CloserPerformanceProps) {
  if (stats.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground text-center py-4 ${className}`}>
        クローザーデータがありません
      </div>
    );
  }

  return (
    <div className={`closer-performance ${className} overflow-x-auto`}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border p-1.5 text-left bg-muted font-medium">クローザー</th>
            {METRICS.map((m) => (
              <th key={m.key as string} className="border p-1.5 bg-muted font-medium text-center">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.closerId}>
              <td className="border p-1.5 font-medium whitespace-nowrap">{s.closerName}</td>
              {METRICS.map((m) => {
                const raw = s[m.key] as number | null;
                const allValues = stats
                  .map((st) => st[m.key] as number | null)
                  .filter((v): v is number => v !== null);
                return (
                  <td
                    key={m.key as string}
                    className="border p-1.5 text-center tabular-nums"
                    style={{ backgroundColor: heatColor(raw, allValues, m.desired) }}
                  >
                    {raw == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        {raw}
                        <span className="text-muted-foreground ml-0.5">{m.unit}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-1">
        色: 緑 = 良好 / 赤 = 要改善
      </p>
    </div>
  );
}

/** 値を 0-1 に正規化してヒートカラーを返す */
function heatColor(
  value: number | null,
  allValues: number[],
  desired: "high" | "low"
): string {
  if (value === null || allValues.length === 0) return "transparent";
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return "rgba(99,102,241,0.1)";

  let normalized = (value - min) / (max - min); // 0 = min, 1 = max
  if (desired === "low") normalized = 1 - normalized; // low が良いなら反転

  // 緑 (good) → 赤 (bad)
  const r = Math.round(255 * (1 - normalized));
  const g = Math.round(200 * normalized);
  return `rgba(${r},${g},80,0.25)`;
}

/** スケルトン */
export function CloserPerformanceSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-muted rounded mb-2" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 bg-muted rounded mb-1 opacity-70" />
      ))}
    </div>
  );
}

// END_OF_FILE
