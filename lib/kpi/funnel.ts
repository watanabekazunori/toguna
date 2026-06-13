/**
 * 8段階ファネル集計
 * コール → コンタクト → アポ → 事前審査 → 商談 → 口頭B → 申込書回収 → 引き継ぎ
 * 各段階の通過数 + 離脱率を返す
 */
import { createClient } from "@/lib/supabase/server";

export interface FunnelStage {
  /** ステージ番号 (1-8) */
  stage: number;
  /** ステージ名 */
  label: string;
  /** 通過数 */
  count: number;
  /** 前ステージからの離脱率 (%) null = 最初のステージ */
  dropRate: number | null;
  /** 前ステージ比の通過率 (%) */
  passRate: number | null;
}

export interface FunnelResult {
  stages: FunnelStage[];
  /** 全体 コール→引き継ぎ 転換率 (%) */
  totalConversionRate: number | null;
}

const STAGE_LABELS: string[] = [
  "コール",
  "コンタクト",
  "アポ",
  "事前審査",
  "商談",
  "口頭B",
  "申込書回収",
  "引き継ぎ",
];

/** ファネル各段階の件数を集計 */
export async function fetchFunnelData(params: {
  tenantId: string;
  from: string;
  to: string;
  userId?: string;
}): Promise<FunnelResult> {
  const supabase = createClient();

  // lifull_daily_kpi から集計
  let kpiQuery = supabase
    .from("lifull_daily_kpi")
    .select("calls, contacts, appointments, meetings_done, b_yomi_count, collections_opened, collections_won")
    .eq("tenant_id", params.tenantId)
    .gte("kpi_date", params.from)
    .lte("kpi_date", params.to);

  if (params.userId) kpiQuery = kpiQuery.eq("user_id", params.userId);

  const { data: kpiRows } = await kpiQuery;

  // 引き継ぎ数は lifull_orders から別取得
  const { count: handoffCount } = await supabase
    .from("lifull_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId)
    .gte("ordered_at", `${params.from}T00:00:00Z`)
    .lte("ordered_at", `${params.to}T23:59:59Z`);

  const totals = aggregateKpiRows(kpiRows ?? []);

  // 事前審査 = 申込書回収と同じソースから推定 (DB に別 count がない場合)
  const rawCounts: number[] = [
    totals.calls,
    totals.contacts,
    totals.appointments,
    totals.collections_opened, // 事前審査 ≒ collections_opened
    totals.meetings_done,
    totals.b_yomi_count,
    totals.collections_won,
    handoffCount ?? 0,
  ];

  const stages: FunnelStage[] = rawCounts.map((count, i) => {
    const prev = i === 0 ? null : rawCounts[i - 1];
    const dropRate = prev == null || prev === 0 ? null : pct(prev - count, prev);
    const passRate = prev == null || prev === 0 ? null : pct(count, prev);
    return {
      stage: i + 1,
      label: STAGE_LABELS[i],
      count,
      dropRate,
      passRate,
    };
  });

  const totalConversionRate =
    rawCounts[0] > 0 ? pct(rawCounts[7], rawCounts[0]) : null;

  return { stages, totalConversionRate };
}

/** ファネル離脱率の平均 (KPI #13 用) */
export function calcFunnelDropAvg(funnel: FunnelResult): number | null {
  const dropRates = funnel.stages.map((s) => s.dropRate).filter((r): r is number => r !== null);
  if (dropRates.length === 0) return null;
  return Math.round((dropRates.reduce((a, b) => a + b, 0) / dropRates.length) * 10) / 10;
}

// ---- helpers ----
interface KpiAgg {
  calls: number;
  contacts: number;
  appointments: number;
  meetings_done: number;
  b_yomi_count: number;
  collections_opened: number;
  collections_won: number;
}

function aggregateKpiRows(rows: Partial<KpiAgg>[]): KpiAgg {
  return rows.reduce(
    (acc, r) => ({
      calls: acc.calls + (r.calls ?? 0),
      contacts: acc.contacts + (r.contacts ?? 0),
      appointments: acc.appointments + (r.appointments ?? 0),
      meetings_done: acc.meetings_done + (r.meetings_done ?? 0),
      b_yomi_count: acc.b_yomi_count + (r.b_yomi_count ?? 0),
      collections_opened: acc.collections_opened + (r.collections_opened ?? 0),
      collections_won: acc.collections_won + (r.collections_won ?? 0),
    }),
    { calls: 0, contacts: 0, appointments: 0, meetings_done: 0, b_yomi_count: 0, collections_opened: 0, collections_won: 0 }
  );
}

function pct(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 1000) / 10;
}

// END_OF_FILE
