/**
 * 集計表 → XLSX レンダラー (exceljs)
 * 朝会/夜会/週次それぞれのシートを別タブで出力
 * 書式維持: 値セルのみ更新、既存スタイルは変更しない設計
 */
import ExcelJS from "exceljs";
import type { LandingForecast } from "@/lib/kpi/yomi-landing";
import type { FunnelResult } from "@/lib/kpi/funnel";
import type { DailyKpiResult } from "@/lib/kpi/queries";

export interface XlsxResult {
  buffer: Buffer;
  sizeBytes: number;
}

/** 朝会レポート XLSX */
export async function renderMorningXlsx(params: {
  date: string;
  kpi: DailyKpiResult;
  funnel: FunnelResult;
}): Promise<XlsxResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TOGUNA コールシステム";
  wb.created = new Date();

  const ws = wb.addWorksheet("朝会シート");

  // タイトル行
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `大手不動産情報ポータル運営企業 朝会シート ${params.date}`;
  applyTitleStyle(ws.getCell("A1"));

  // KPI サマリ
  ws.addRow(["KPI", "値", "単位", "", "", ""]);
  applyHeaderStyle(ws.lastRow!);
  addKpiRow(ws, "アポ獲得率", params.kpi.appointmentRate, "%");
  addKpiRow(ws, "商談化率", params.kpi.meetingRate, "%");
  addKpiRow(ws, "口頭B率", params.kpi.orderRate, "%");
  addKpiRow(ws, "平均コール数/日", params.kpi.avgCallsPerDay, "件");

  ws.addRow([]);

  // ファネル
  ws.addRow(["ステージ", "件数", "離脱率(%)", "", "", ""]);
  applyHeaderStyle(ws.lastRow!);
  params.funnel.stages.forEach((s) => {
    ws.addRow([s.label, s.count, s.dropRate ?? "—"]);
  });

  autoFitColumns(ws);
  return buildBuffer(wb);
}

/** 夜会レポート XLSX */
export async function renderEveningXlsx(params: {
  date: string;
  kpi: DailyKpiResult;
  forecast: LandingForecast;
}): Promise<XlsxResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TOGUNA コールシステム";

  const ws = wb.addWorksheet("夜会シート");
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `大手不動産情報ポータル運営企業 夜会シート ${params.date}`;
  applyTitleStyle(ws.getCell("A1"));

  ws.addRow(["KPI", "値", "単位"]);
  applyHeaderStyle(ws.lastRow!);
  addKpiRow(ws, "当日コール数", params.kpi.avgCallsPerDay, "件");
  addKpiRow(ws, "アポ獲得率", params.kpi.appointmentRate, "%");
  addKpiRow(ws, "申込書不備率", params.kpi.defectRate, "%");

  ws.addRow([]);

  ws.addRow(["ヨミ", "件数", "確度", "想定受注"]);
  applyHeaderStyle(ws.lastRow!);
  params.forecast.byYomi.filter((y) => y.count > 0).forEach((y) => {
    ws.addRow([y.yomi, y.count, y.rate, y.expectedOrders]);
  });
  ws.addRow(["月次着地予測", "", "", params.forecast.monthlyLanding]);
  ws.lastRow!.getCell(4).font = { bold: true };

  autoFitColumns(ws);
  return buildBuffer(wb);
}

/** 週次定例レポート XLSX (複数シート) */
export async function renderWeeklyXlsx(params: {
  isoWeek: string;
  kpi: DailyKpiResult;
  forecast: LandingForecast;
  funnel: FunnelResult;
  closerStats: { closerName: string; byYomi: Record<string, number> }[];
}): Promise<XlsxResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TOGUNA コールシステム";

  // Sheet 1: KPI サマリ
  const wsSummary = wb.addWorksheet("KPIサマリ");
  wsSummary.mergeCells("A1:E1");
  wsSummary.getCell("A1").value = `大手不動産情報ポータル運営企業 週次定例 ${params.isoWeek}`;
  applyTitleStyle(wsSummary.getCell("A1"));
  wsSummary.addRow(["KPI", "値", "単位"]);
  applyHeaderStyle(wsSummary.lastRow!);
  addKpiRow(wsSummary, "アポ獲得率", params.kpi.appointmentRate, "%");
  addKpiRow(wsSummary, "商談化率", params.kpi.meetingRate, "%");
  addKpiRow(wsSummary, "口頭B率", params.kpi.orderRate, "%");
  addKpiRow(wsSummary, "月次着地予測", params.forecast.monthlyLanding, "件");
  autoFitColumns(wsSummary);

  // Sheet 2: ファネル
  const wsFunnel = wb.addWorksheet("ファネル分析");
  wsFunnel.addRow(["ステージ", "件数", "通過率(%)", "離脱率(%)"]);
  applyHeaderStyle(wsFunnel.lastRow!);
  params.funnel.stages.forEach((s) => {
    wsFunnel.addRow([s.label, s.count, s.passRate ?? "—", s.dropRate ?? "—"]);
  });
  autoFitColumns(wsFunnel);

  // Sheet 3: クローザー別
  const wsCloser = wb.addWorksheet("クローザー別");
  wsCloser.addRow(["クローザー", "受注", "A◯/A", "B◯/B", "C/D"]);
  applyHeaderStyle(wsCloser.lastRow!);
  params.closerStats.forEach((cs) => {
    wsCloser.addRow([
      cs.closerName,
      cs.byYomi["won"] ?? 0,
      (cs.byYomi["a_circle"] ?? 0) + (cs.byYomi["A"] ?? 0),
      (cs.byYomi["b_circle"] ?? 0) + (cs.byYomi["B"] ?? 0),
      (cs.byYomi["C"] ?? 0) + (cs.byYomi["D"] ?? 0),
    ]);
  });
  autoFitColumns(wsCloser);

  return buildBuffer(wb);
}

// ---- helpers ----
function addKpiRow(ws: ExcelJS.Worksheet, label: string, value: number | null, unit: string) {
  ws.addRow([label, value ?? "—", unit]);
}
function applyTitleStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 13 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } };
  cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
}
function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
}
function autoFitColumns(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 40);
  });
}
async function buildBuffer(wb: ExcelJS.Workbook): Promise<XlsxResult> {
  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, sizeBytes: buffer.byteLength };
}

// END_OF_FILE
