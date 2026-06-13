/**
 * 行動管理ヒートマップ
 * ユーザー別 × クール区分 (1-9) × 日付 の 3 次元ヒートマップ
 * lifull_work_slots + lifull_daily_kpi を結合して表示
 */
"use client";

import { useMemo } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";

export interface ActivityCell {
  userId: string;
  userName: string;
  workDate: string; // YYYY-MM-DD
  kuru: number; // 1-9
  callTarget: number | null;
  actualCalls: number;
}

interface ActivityHeatmapProps {
  cells: ActivityCell[];
  /** 表示期間 */
  from: string;
  to: string;
  /** クール区分フィルタ (null = 全て) */
  kuruFilter?: number | null;
  className?: string;
}

/** 行動管理ヒートマップ */
export function ActivityHeatmap({
  cells,
  from,
  to,
  kuruFilter = null,
  className = "",
}: ActivityHeatmapProps) {
  const dates = useMemo(
    () =>
      eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((d) =>
        format(d, "yyyy-MM-dd")
      ),
    [from, to]
  );

  const users = useMemo(() => {
    const map = new Map<string, string>();
    cells.forEach((c) => map.set(c.userId, c.userName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [cells]);

  const filteredCells = useMemo(
    () => (kuruFilter == null ? cells : cells.filter((c) => c.kuru === kuruFilter)),
    [cells, kuruFilter]
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, ActivityCell[]>();
    filteredCells.forEach((c) => {
      const key = `${c.userId}|${c.workDate}`;
      const arr = m.get(key) ?? [];
      arr.push(c);
      m.set(key, arr);
    });
    return m;
  }, [filteredCells]);

  if (users.length === 0 || dates.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground text-center py-4 ${className}`}>
        行動管理データがありません
      </div>
    );
  }

  return (
    <div className={`activity-heatmap ${className} overflow-x-auto`}>
      <table className="text-xs border-collapse min-w-max">
        <thead>
          <tr>
            <th className="border p-1 bg-muted text-left sticky left-0 z-10">担当者</th>
            {dates.map((d) => (
              <th key={d} className="border p-1 bg-muted text-center whitespace-nowrap">
                {format(parseISO(d), "M/d")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border p-1 font-medium whitespace-nowrap sticky left-0 bg-white z-10">
                {u.name}
              </td>
              {dates.map((d) => {
                const dayCells = cellMap.get(`${u.id}|${d}`) ?? [];
                const actualTotal = dayCells.reduce((a, c) => a + c.actualCalls, 0);
                const targetTotal = dayCells.reduce(
                  (a, c) => a + (c.callTarget ?? 0),
                  0
                );
                return (
                  <td
                    key={d}
                    className="border p-1 text-center tabular-nums cursor-default"
                    style={{ backgroundColor: achievementColor(actualTotal, targetTotal) }}
                    title={`${u.name} ${d}: ${actualTotal}/${targetTotal} コール`}
                  >
                    {dayCells.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-medium">{actualTotal}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 凡例 */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>達成率:</span>
        {[
          { label: "100%+", color: "rgba(5,150,105,0.4)" },
          { label: "80%+", color: "rgba(52,211,153,0.3)" },
          { label: "50%+", color: "rgba(251,191,36,0.3)" },
          { label: "〜50%", color: "rgba(248,113,113,0.3)" },
          { label: "未計画", color: "transparent" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 border rounded-sm"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 達成率に応じたヒートカラー */
function achievementColor(actual: number, target: number): string {
  if (target === 0) return "transparent";
  const rate = actual / target;
  if (rate >= 1.0) return "rgba(5,150,105,0.4)";    // 100%+ 緑
  if (rate >= 0.8) return "rgba(52,211,153,0.3)";   // 80%+ 薄緑
  if (rate >= 0.5) return "rgba(251,191,36,0.3)";   // 50%+ 黄
  return "rgba(248,113,113,0.3)";                    // ~50% 赤
}

// END_OF_FILE
