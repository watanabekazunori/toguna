/**
 * プラン別 ID 数 + イニ/ラン集計 stacked bar
 * lifull_orders.proposal_plan × initial_fee / monthly_fee
 * Recharts BarChart 使用
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface PlanStat {
  plan: string;
  /** ID 発番数 */
  idCount: number;
  /** イニシャル合計 (万円) */
  initialFeeTotal: number;
  /** ランニング合計 (万円/月) */
  monthlyFeeTotal: number;
}

interface PlanBreakdownProps {
  stats: PlanStat[];
  className?: string;
}

const PLAN_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#10b981", "#34d399", "#6ee7b7",
];

/** プラン別集計チャート */
export function PlanBreakdown({ stats, className = "" }: PlanBreakdownProps) {
  if (stats.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground text-center py-4 ${className}`}>
        プランデータがありません
      </div>
    );
  }

  // Recharts 用データ変換
  const chartData = stats.map((s) => ({
    name: s.plan,
    ID数: s.idCount,
    イニシャル: Math.round(s.initialFeeTotal / 10000), // 円 → 万円
    ランニング: Math.round(s.monthlyFeeTotal / 10000),
  }));

  return (
    <div className={`plan-breakdown ${className}`}>
      {/* ID 発番数 stacked bar */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">プラン別 ID 発番数</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
          >
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`${v} 件`, "ID数"]} />
            <Bar dataKey="ID数" maxBarSize={48}>
              {chartData.map((_, i) => (
                <BarCell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* イニ/ラン stacked */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">イニシャル / ランニング (万円)</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
          >
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number, name: string) => [`${v} 万円`, name]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="イニシャル" stackId="fee" fill="#6366f1" maxBarSize={48} />
            <Bar dataKey="ランニング" stackId="fee" fill="#a78bfa" maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* サマリテーブル */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-1 text-left">プラン</th>
              <th className="border p-1 text-center">ID数</th>
              <th className="border p-1 text-center">イニ計(万)</th>
              <th className="border p-1 text-center">ラン計(万/月)</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.plan}>
                <td className="border p-1 font-medium">{s.plan}</td>
                <td className="border p-1 text-center tabular-nums">{s.idCount}</td>
                <td className="border p-1 text-center tabular-nums">
                  {Math.round(s.initialFeeTotal / 10000).toLocaleString()}
                </td>
                <td className="border p-1 text-center tabular-nums">
                  {Math.round(s.monthlyFeeTotal / 10000).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Recharts の Cell コンポーネント (型エラー回避)
function BarCell(props: { fill: string; [k: string]: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fill, ...rest } = props;
  return <rect {...rest} fill={fill} />;
}

// END_OF_FILE
