/**
 * KPI カード共通フォーマット (枠のみ提供)。
 * title / 数値 / 前日比% / 上昇下降アイコン / trend mini chart slot。
 * M4 で props.value/delta/trend を実データで差込予定。
 */
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  /** KPI 識別キー (M4 で data 取得時に使う) */
  kpiKey: string;
  /** カード見出し (日本語ラベル) */
  title: string;
  /** 現在値。`undefined` のときは `--` を表示 */
  value?: number | string;
  /** 単位 (例: '%', '件', '万円') */
  unit?: string;
  /** 前日比 % */
  deltaPercent?: number;
  /** mini trend chart (Recharts や sparkline) を差込むスロット */
  trendSlot?: React.ReactNode;
  /** 値の意味づけ (high が上昇望ましい / low が望ましい) */
  desired?: "high" | "low";
}

function pickArrow(deltaPercent: number | undefined, desired: "high" | "low") {
  if (deltaPercent == null) return ArrowRightIcon;
  if (deltaPercent === 0) return ArrowRightIcon;
  const positive = deltaPercent > 0;
  if (desired === "high") return positive ? ArrowUpIcon : ArrowDownIcon;
  return positive ? ArrowDownIcon : ArrowUpIcon;
}

function pickColor(deltaPercent: number | undefined, desired: "high" | "low") {
  if (deltaPercent == null || deltaPercent === 0) return "text-muted-foreground";
  const positive = deltaPercent > 0;
  const good = desired === "high" ? positive : !positive;
  return good ? "text-emerald-600" : "text-red-600";
}

/** ダッシュボード KPI カード (枠フォーマット共通化) */
export function KpiCardSlot({
  kpiKey,
  title,
  value,
  unit,
  deltaPercent,
  trendSlot,
  desired = "high",
}: Props) {
  const Arrow = pickArrow(deltaPercent, desired);
  const colorClass = pickColor(deltaPercent, desired);
  const displayValue = value == null ? "--" : value;
  const displayDelta =
    deltaPercent == null
      ? "—"
      : `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`;

  return (
    <Card data-kpi-key={kpiKey} className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">
            {displayValue}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-1 text-xs ${colorClass}`}>
          <Arrow size={12} aria-hidden />
          <span>前日比 {displayDelta}</span>
        </div>
        {trendSlot && <div className="mt-2 h-8">{trendSlot}</div>}
      </CardContent>
    </Card>
  );
}

// END_OF_FILE
