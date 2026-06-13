/**
 * 15 KPI 集計クエリ — lifull_daily_kpi 参照 (p95 < 1.5s 目標)
 * リアルタイム集計禁止: 必ず集計テーブルを経由すること
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type KpiRow = Database["public"]["Tables"]["lifull_daily_kpi"]["Row"];

export interface DailyKpiResult {
  /** 1. アポ獲得率 (%) */
  appointmentRate: number | null;
  /** 2. 商談化率 (%) */
  meetingRate: number | null;
  /** 3. 受注率・口頭B (%) */
  orderRate: number | null;
  /** 4. 申込書回収日数中央値 (日) */
  collectionDaysMedian: number | null;
  /** 5. 申込書不備率 (%) */
  defectRate: number | null;
  /** 6. 引き継ぎ作成時間 (分) */
  handoffMinutesAvg: number | null;
  /** 7. ステータス入力件数/日 */
  statusInputCount: number | null;
  /** 8. 平均通話時間 (秒) */
  avgCallDurationSec: number | null;
  /** 9. 平均総コール数/日 */
  avgCallsPerDay: number | null;
  /** 10. クローザー商談実施率 (%) */
  closerMeetingRate: number | null;
  /** 11. クローザー受注率 (%) */
  closerOrderRate: number | null;
  /** 12. プラン別 ID 発番数 */
  planIdCount: number | null;
  /** 13. ファネル離脱率 (8段階平均) — 詳細は funnel.ts */
  funnelDropAvg: number | null;
  /** 14. ヨミ別想定受注数 — 詳細は yomi-landing.ts */
  yomiExpectedOrders: number | null;
  /** 15. 月次着地予測 */
  monthlyLandingForecast: number | null;
  /** 集計基準日 */
  kpiDate: string;
}

/** 日次 KPI サマリ取得 (集計テーブル参照) */
export async function fetchDailyKpi(params: {
  tenantId: string;
  from: string;
  to: string;
  userId?: string;
}): Promise<KpiRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("lifull_daily_kpi")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .gte("kpi_date", params.from)
    .lte("kpi_date", params.to)
    .order("kpi_date", { ascending: false });

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`KPI fetch error: ${error.message}`);
  return data ?? [];
}

/** 集計: 指定期間の 15 KPI をロールアップして返す */
export function rollupKpi(rows: KpiRow[]): DailyKpiResult {
  if (rows.length === 0) {
    return buildEmpty();
  }

  const totalCalls = sum(rows, "calls");
  const totalContacts = sum(rows, "contacts");
  const totalAppointments = sum(rows, "appointments");
  const totalMeetings = sum(rows, "meetings_done");
  const totalBYomi = sum(rows, "b_yomi_count");
  const totalWon = sum(rows, "won_count");
  const totalColOpened = sum(rows, "collections_opened");
  const totalColWon = sum(rows, "collections_won");
  const days = rows.length;

  return {
    appointmentRate: totalContacts > 0 ? pct(totalAppointments, totalContacts) : null,
    meetingRate: totalAppointments > 0 ? pct(totalMeetings, totalAppointments) : null,
    orderRate: totalMeetings > 0 ? pct(totalBYomi, totalMeetings) : null,
    collectionDaysMedian: null, // 別クエリ: fetchCollectionDaysMedian
    defectRate: totalColOpened > 0 ? pct(totalColOpened - totalColWon, totalColOpened) : null,
    handoffMinutesAvg: null,   // 別クエリ: fetchHandoffMinutes
    statusInputCount: totalCalls > 0 ? Math.round(totalCalls / days) : null,
    avgCallDurationSec: null,  // 別クエリ: fetchAvgCallDuration
    avgCallsPerDay: days > 0 ? Math.round(totalCalls / days) : null,
    closerMeetingRate: null,   // 別クエリ: fetchCloserStats
    closerOrderRate: null,
    planIdCount: totalWon,
    funnelDropAvg: null,       // funnel.ts
    yomiExpectedOrders: null,  // yomi-landing.ts
    monthlyLandingForecast: null,
    kpiDate: rows[0]?.kpi_date ?? "",
  };
}

/** 申込書回収日数中央値 (SQL 中央値クエリ) */
export async function fetchCollectionDaysMedian(
  tenantId: string,
  from: string,
  to: string
): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("lifull_collection_days_median", {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });
  if (error) return null;
  return (data as number) ?? null;
}

/** 平均通話時間 (秒) */
export async function fetchAvgCallDuration(
  tenantId: string,
  from: string,
  to: string
): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("lifull_avg_call_duration", {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });
  if (error) return null;
  return (data as number) ?? null;
}

// ---- helpers ----
function sum(rows: KpiRow[], key: keyof KpiRow): number {
  return rows.reduce((acc, r) => acc + ((r[key] as number) ?? 0), 0);
}
function pct(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 1000) / 10;
}
function buildEmpty(): DailyKpiResult {
  return {
    appointmentRate: null, meetingRate: null, orderRate: null,
    collectionDaysMedian: null, defectRate: null, handoffMinutesAvg: null,
    statusInputCount: null, avgCallDurationSec: null, avgCallsPerDay: null,
    closerMeetingRate: null, closerOrderRate: null, planIdCount: null,
    funnelDropAvg: null, yomiExpectedOrders: null, monthlyLandingForecast: null,
    kpiDate: "",
  };
}

// END_OF_FILE
