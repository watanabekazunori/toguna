/**
 * ヨミ別確度計算 + 月次着地予測ロジック
 * yomi_rates テーブル(確度係数) × 案件数 = 想定受注数
 * 月次着地 = 確定済み + 想定受注数の合計
 */
import { createClient } from "@/lib/supabase/server";

/** ヨミ区分 (lifull_yomi ENUM 対応) */
export type YomiLabel = "A" | "B" | "C" | "D" | "a_circle" | "b_circle" | "won" | "lost";

/** ヨミ確度係数テーブル (DB fallback 用デフォルト値) */
const DEFAULT_YOMI_RATES: Record<YomiLabel, number> = {
  won: 1.0,
  a_circle: 0.9,
  A: 0.7,
  b_circle: 0.6,
  B: 0.4,
  C: 0.2,
  D: 0.05,
  lost: 0.0,
};

export interface YomiCount {
  yomi: YomiLabel;
  count: number;
  expectedOrders: number;
  rate: number;
}

export interface LandingForecast {
  /** ヨミ別集計 */
  byYomi: YomiCount[];
  /** 想定受注数合計 (確度係数加重) */
  totalExpected: number;
  /** 確定受注数 (won) */
  confirmed: number;
  /** 月次着地予測 (confirmed + totalExpected) */
  monthlyLanding: number;
  /** 集計月 YYYY-MM */
  month: string;
}

/** ヨミ別確度係数を DB から取得 (テーブル未整備時はデフォルト使用) */
async function fetchYomiRates(tenantId: string): Promise<Record<YomiLabel, number>> {
  const supabase = createClient();
  // yomi_rates テーブルが存在する場合は読み込む
  const { data } = await supabase
    .from("lifull_yomi_rates" as never)
    .select("yomi, rate")
    .eq("tenant_id", tenantId);

  if (!data || data.length === 0) return { ...DEFAULT_YOMI_RATES };

  const rates: Record<string, number> = { ...DEFAULT_YOMI_RATES };
  for (const row of data as { yomi: string; rate: number }[]) {
    rates[row.yomi] = row.rate;
  }
  return rates as Record<YomiLabel, number>;
}

/** 指定月のヨミ別案件数を lifull_deals から集計 */
async function fetchYomiCounts(
  tenantId: string,
  month: string // YYYY-MM
): Promise<Partial<Record<YomiLabel, number>>> {
  const supabase = createClient();
  const from = `${month}-01`;
  const to = `${month}-31`;

  const { data, error } = await supabase
    .from("lifull_deals")
    .select("latest_yomi")
    .eq("tenant_id", tenantId)
    .neq("status", "lost")
    .gte("appointed_at", from)
    .lte("appointed_at", to);

  if (error || !data) return {};

  const counts: Partial<Record<YomiLabel, number>> = {};
  for (const row of data) {
    const y = row.latest_yomi as YomiLabel | null;
    if (!y) continue;
    counts[y] = (counts[y] ?? 0) + 1;
  }
  return counts;
}

/** 月次着地予測を計算して返す */
export async function computeLandingForecast(
  tenantId: string,
  month: string // YYYY-MM
): Promise<LandingForecast> {
  const [rates, counts] = await Promise.all([
    fetchYomiRates(tenantId),
    fetchYomiCounts(tenantId, month),
  ]);

  const yomiOrder: YomiLabel[] = ["won", "a_circle", "A", "b_circle", "B", "C", "D", "lost"];
  const byYomi: YomiCount[] = yomiOrder.map((yomi) => {
    const count = counts[yomi] ?? 0;
    const rate = rates[yomi] ?? 0;
    return { yomi, count, expectedOrders: Math.round(count * rate * 10) / 10, rate };
  });

  const confirmed = byYomi.find((y) => y.yomi === "won")?.count ?? 0;
  const totalExpected = byYomi
    .filter((y) => y.yomi !== "won" && y.yomi !== "lost")
    .reduce((acc, y) => acc + y.expectedOrders, 0);
  const monthlyLanding = Math.round((confirmed + totalExpected) * 10) / 10;

  return { byYomi, totalExpected, confirmed, monthlyLanding, month };
}

/** クローザー別ヨミ集計 (CloserPerformance コンポーネント向け) */
export async function fetchCloserYomiStats(
  tenantId: string,
  from: string,
  to: string
): Promise<{ closerId: string; closerName: string; byYomi: Partial<Record<YomiLabel, number>> }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lifull_deals")
    .select("closer_user_id, latest_yomi, lifull_users!closer_user_id(name)")
    .eq("tenant_id", tenantId)
    .gte("appointed_at", from)
    .lte("appointed_at", to)
    .not("closer_user_id", "is", null);

  if (error || !data) return [];

  const map = new Map<string, { closerName: string; byYomi: Partial<Record<YomiLabel, number>> }>();
  for (const row of data as { closer_user_id: string; latest_yomi: string | null; lifull_users: { name: string } | null }[]) {
    if (!row.closer_user_id) continue;
    if (!map.has(row.closer_user_id)) {
      map.set(row.closer_user_id, {
        closerName: row.lifull_users?.name ?? row.closer_user_id,
        byYomi: {},
      });
    }
    const entry = map.get(row.closer_user_id)!;
    const y = row.latest_yomi as YomiLabel | null;
    if (y) entry.byYomi[y] = (entry.byYomi[y] ?? 0) + 1;
  }

  return Array.from(map.entries()).map(([closerId, v]) => ({ closerId, ...v }));
}

// END_OF_FILE
