/**
 * レポート API Route Handler
 * GET /api/lifull/reports/:type/:period
 * type: morning | evening | weekly
 * period: YYYY-MM-DD (morning/evening) | YYYY-Www (weekly)
 * Accept ヘッダで JSON / PDF / XLSX を切り替え
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDailyKpi, rollupKpi } from "@/lib/kpi/queries";
import { fetchFunnelData } from "@/lib/kpi/funnel";
import { computeLandingForecast, fetchCloserYomiStats } from "@/lib/kpi/yomi-landing";
import { renderMorningXlsx, renderEveningXlsx, renderWeeklyXlsx } from "@/lib/reports/xlsx-renderer";
import { renderPdf, buildPdfHeaders } from "@/lib/reports/pdf-renderer";

type ReportType = "morning" | "evening" | "weekly";

const TENANT_ID = "lifull_homes";

interface Context {
  params: { type: string; period: string };
}

export async function GET(req: NextRequest, { params }: Context): Promise<NextResponse> {
  // 認証チェック
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = params.type as ReportType;
  const period = params.period;

  if (!["morning", "evening", "weekly"].includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "application/json";

  try {
    if (accept.includes("application/pdf")) {
      return await handlePdf(type, period, req);
    }
    if (accept.includes("application/vnd.openxmlformats")) {
      return await handleXlsx(type, period);
    }
    return await handleJson(type, period);
  } catch (err) {
    console.error("[reports/route]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** JSON レスポンス */
async function handleJson(type: ReportType, period: string): Promise<NextResponse> {
  const { from, to, month } = resolvePeriod(type, period);

  const [kpiRows, funnel, forecast] = await Promise.all([
    fetchDailyKpi({ tenantId: TENANT_ID, from, to }),
    fetchFunnelData({ tenantId: TENANT_ID, from, to }),
    computeLandingForecast(TENANT_ID, month),
  ]);

  return NextResponse.json({
    type,
    period,
    kpi: rollupKpi(kpiRows),
    funnel,
    forecast,
    generatedAt: new Date().toISOString(),
  });
}

/** PDF レスポンス */
async function handlePdf(type: ReportType, period: string, req: NextRequest): Promise<NextResponse> {
  const baseUrl = new URL(req.url).origin;
  const pageUrl = reportPageUrl(type, period);
  const filename = `${type}-report-${period}.pdf`;

  const { buffer } = await renderPdf({ url: pageUrl, baseUrl });
  return new NextResponse(buffer, {
    status: 200,
    headers: buildPdfHeaders(filename) as Record<string, string>,
  });
}

/** XLSX レスポンス */
async function handleXlsx(type: ReportType, period: string): Promise<NextResponse> {
  const { from, to, month } = resolvePeriod(type, period);

  const [kpiRows, funnel, forecast] = await Promise.all([
    fetchDailyKpi({ tenantId: TENANT_ID, from, to }),
    fetchFunnelData({ tenantId: TENANT_ID, from, to }),
    computeLandingForecast(TENANT_ID, month),
  ]);
  const kpi = rollupKpi(kpiRows);
  const filename = `${type}-report-${period}.xlsx`;

  let result;
  if (type === "morning") {
    result = await renderMorningXlsx({ date: period, kpi, funnel });
  } else if (type === "evening") {
    result = await renderEveningXlsx({ date: period, kpi, forecast });
  } else {
    const closerStats = await fetchCloserYomiStats(TENANT_ID, from, to);
    result = await renderWeeklyXlsx({ isoWeek: period, kpi, forecast, funnel, closerStats });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** period から from/to/month を解決 */
function resolvePeriod(type: ReportType, period: string) {
  if (type === "weekly") {
    const [yearStr, wStr] = period.split("-W");
    const year = parseInt(yearStr, 10);
    const week = parseInt(wStr, 10);
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { from: fmt(monday), to: fmt(sunday), month: fmt(monday).slice(0, 7) };
  }
  return { from: period, to: period, month: period.slice(0, 7) };
}

/** レポート閲覧ページ URL */
function reportPageUrl(type: ReportType, period: string): string {
  if (type === "weekly") return `/lifull/reports/weekly/${period}`;
  return `/lifull/reports/${type}/${period}`;
}

// END_OF_FILE
