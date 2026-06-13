/**
 * ヨミ別 stacked bar + 月次着地予測ライン
 * Recharts の BarChart + ReferenceLine を使用
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { LandingForecast } from "@/lib/kpi/yomi-landing";

interface YomiLandingChartProps {
  forecast: LandingForecast;
  /** 目標受注数 (着地目標ライン) */
  targetOrders?: number;
  className?: string;
}

const YOMI_COLORS: Record<string, string> = {
  won: "#059669",
  a_circle: "#10b981",
  A: "#34d399",
  b_circle: "#6366f1",
  B: "#818cf8",
  C: "#fbbf24",
  D: "#f87171",
};

/** ヨミ別着地チャート */
export function YomiLandingChart({
  forecast,
  targetOrders,
  className = "",
}: YomiLandingChartProps) {
  // Recharts 用データ変換: ヨミラベルを列にした1行データ
  const chartData = [
    {
      name: forecast.month,
      ...Object.fromEntries(
        forecast.byYomi
          .filter((y) => y.count > 0)
          .map((y) => [y.yomi, y.expectedOrders])
      ),
    },
  ];

  const visibleYomi = forecast.byYomi.filter(
    (y) => y.count > 0 && y.yomi !== "lost"
  );

  return (
    <div className={`yomi-landing-chart ${className}`}>
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">月次着地予測:</span>
        <span className="text-xl font-bold text-indigo-700">
          {forecast.monthlyLanding.toFixed(1)} 件
        </span>
        {targetOrders != null && (
          <span className="text-muted-foreground">
            目標: {targetOrders} 件
            {forecast.monthlyLanding >= targetOrders ? (
              <span className="ml-1 text-emerald-600">達成見込み</span>
            ) : (
              <span className="ml-1 text-red-500">
                残 {(targetOrders - forecast.monthlyLanding).toFixed(1)} 件
              </span>
            )}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)} 件`,
              name,
            ]}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {visibleYomi.map((y) => (
            <Bar
              key={y.yomi}
              dataKey={y.yomi}
              stackId="yomi"
              fill={YOMI_COLORS[y.yomi] ?? "#94a3b8"}
              maxBarSize={80}
            />
          ))}
          {targetOrders != null && (
            <ReferenceLine
              y={targetOrders}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: "目標", fontSize: 10, fill: "#ef4444" }}
            />
          )}
          {forecast.monthlyLanding > 0 && (
            <ReferenceLine
              y={forecast.monthlyLanding}
              stroke="#6366f1"
              strokeDasharray="6 3"
              label={{ value: "着地予測", fontSize: 10, fill: "#6366f1" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* ヨミ別内訳テーブル */}
      <div className="mt-3 grid grid-cols-4 gap-1 text-xs">
        {visibleYomi.map((y) => (
          <div key={y.yomi} className="border rounded p-1 text-center">
            <div
              className="w-3 h-3 rounded-full mx-auto mb-1"
              style={{ backgroundColor: YOMI_COLORS[y.yomi] ?? "#94a3b8" }}
            />
            <div className="font-semibold">{y.yomi}</div>
            <div>{y.count} 件</div>
            <div className="text-muted-foreground">×{y.rate}</div>
            <div className="font-medium">{y.expectedOrders.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// END_OF_FILE
