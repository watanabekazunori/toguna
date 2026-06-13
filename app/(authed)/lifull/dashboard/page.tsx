/**
 * ダッシュボード (Server Component)
 * ロール別 15 KPI grid + ヨミ着地 + ファネル + クローザー別 + プラン別。
 * KPI 中身は M4 で差込。本ファイルは枠とレイアウトのみ提供。
 */
import { createServerClient } from "@/lib/supabase/server";
import { KpiCardSlot } from "@/components/dashboard/KpiCardSlot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface MeRow {
  role: "ADMIN" | "MANAGER" | "APPOINTER" | "CLOSER" | "CS";
  display_name: string | null;
}

type KpiKey =
  | "callsToday"
  | "connectRate"
  | "appointmentRate"
  | "appointmentsHeld"
  | "appointmentsKept"
  | "ordersThisMonth"
  | "orderRate"
  | "averageDealSize"
  | "yomiAExpected"
  | "yomiBExpected"
  | "collectionPending"
  | "collectionDefectRate"
  | "ngRateP1"
  | "transferRate"
  | "salesActual";

const KPI_BY_ROLE: Record<MeRow["role"], KpiKey[]> = {
  ADMIN: [
    "callsToday", "connectRate", "appointmentRate", "appointmentsHeld",
    "ordersThisMonth", "orderRate", "averageDealSize", "salesActual",
    "yomiAExpected", "yomiBExpected", "collectionPending", "collectionDefectRate",
    "ngRateP1", "transferRate", "appointmentsKept",
  ],
  MANAGER: [
    "callsToday", "connectRate", "appointmentRate", "appointmentsHeld",
    "ordersThisMonth", "orderRate", "averageDealSize", "salesActual",
    "yomiAExpected", "yomiBExpected", "collectionPending", "ngRateP1",
    "transferRate", "appointmentsKept", "collectionDefectRate",
  ],
  APPOINTER: [
    "callsToday", "connectRate", "appointmentRate", "appointmentsHeld",
    "ngRateP1", "transferRate",
  ],
  CLOSER: [
    "appointmentsHeld", "appointmentsKept", "ordersThisMonth", "orderRate",
    "averageDealSize", "yomiAExpected", "yomiBExpected", "salesActual",
  ],
  CS: ["collectionPending", "collectionDefectRate"],
};

const KPI_LABELS: Record<KpiKey, string> = {
  callsToday: "本日の架電数",
  connectRate: "コネクト率",
  appointmentRate: "アポ獲得率",
  appointmentsHeld: "実施商談数",
  appointmentsKept: "出席率",
  ordersThisMonth: "今月受注数",
  orderRate: "受注率",
  averageDealSize: "平均単価",
  yomiAExpected: "ヨミA着地予測",
  yomiBExpected: "ヨミB着地予測",
  collectionPending: "回収待ち",
  collectionDefectRate: "不備率",
  ngRateP1: "NG率(優先)",
  transferRate: "転送率",
  salesActual: "売上実績",
};

/** ロール別 KPI ダッシュボード */
export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: me } = await supabase
    .from("lifull_users")
    .select("role, display_name")
    .single<MeRow>();

  const role = me?.role ?? "APPOINTER";
  const visibleKpis = KPI_BY_ROLE[role];

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          ダッシュボード ({role})
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {me?.display_name ?? "(名前未設定)"} さんの実績サマリ
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {visibleKpis.map((k) => (
          <KpiCardSlot key={k} kpiKey={k} title={KPI_LABELS[k]} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ヨミ着地予測</CardTitle>
          </CardHeader>
          <CardContent className="h-48 text-sm text-muted-foreground">
            M4 にて RechartsArea + lifull_yomi_forecasts 接続
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ファネル</CardTitle>
          </CardHeader>
          <CardContent className="h-48 text-sm text-muted-foreground">
            M4 にて 架電→コネクト→アポ→商談→受注 5 段ファネル
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>クローザー別 受注</CardTitle>
          </CardHeader>
          <CardContent className="h-48 text-sm text-muted-foreground">
            M4 にて lifull_closer_performance_view 接続
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>プラン別 売上</CardTitle>
          </CardHeader>
          <CardContent className="h-48 text-sm text-muted-foreground">
            M4 にて plan ごとの月次集計
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

// END_OF_FILE
