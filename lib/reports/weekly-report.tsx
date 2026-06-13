/**
 * 週次定例(60分)テンプレート — React Server Component
 * 週次推移 / クローザー別 / プラン別 / ファネル分析 / 着地予測
 * UI文言: 大手不動産情報ポータル運営企業 (LIFULL 表記禁止)
 */
import { fetchDailyKpi, rollupKpi } from "@/lib/kpi/queries";
import { computeLandingForecast, fetchCloserYomiStats } from "@/lib/kpi/yomi-landing";
import { fetchFunnelData, calcFunnelDropAvg } from "@/lib/kpi/funnel";
import { startOfISOWeek, endOfISOWeek, format, getISOWeek } from "date-fns";

interface WeeklyReportProps {
  tenantId: string;
  /** ISO 週: YYYY-Www (例: 2026-W24) */
  isoWeek: string;
}

function parseIsoWeek(isoWeek: string): { from: string; to: string; month: string } {
  const [yearStr, wStr] = isoWeek.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  // 簡易計算: その年の第1週月曜日から (week-1)*7 日後
  const jan4 = new Date(year, 0, 4); // ISO week 1 には必ず1月4日が含まれる
  const monday = startOfISOWeek(jan4);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  const sunday = endOfISOWeek(monday);
  return {
    from: format(monday, "yyyy-MM-dd"),
    to: format(sunday, "yyyy-MM-dd"),
    month: format(monday, "yyyy-MM"),
  };
}

export async function WeeklyReport({ tenantId, isoWeek }: WeeklyReportProps) {
  const { from, to, month } = parseIsoWeek(isoWeek);

  const [kpiRows, funnel, forecast, closerStats] = await Promise.all([
    fetchDailyKpi({ tenantId, from, to }),
    fetchFunnelData({ tenantId, from, to }),
    computeLandingForecast(tenantId, month),
    fetchCloserYomiStats(tenantId, from, to),
  ]);

  const kpi = rollupKpi(kpiRows);
  const funnelDropAvg = calcFunnelDropAvg(funnel);

  return (
    <article className="weekly-report print:p-0 p-6 max-w-3xl mx-auto font-sans text-sm">
      <header className="border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-lg font-bold">
          大手不動産情報ポータル運営企業 — 週次定例シート
        </h1>
        <p className="text-gray-600 text-xs mt-1">
          {isoWeek} ({from} 〜 {to})
        </p>
      </header>

      {/* 週次 KPI サマリ */}
      <section className="mb-5">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          週次 KPI サマリ
        </h2>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <WeeklyKpiCard label="アポ獲得率" value={kpi.appointmentRate} unit="%" />
          <WeeklyKpiCard label="商談化率" value={kpi.meetingRate} unit="%" />
          <WeeklyKpiCard label="口頭B率" value={kpi.orderRate} unit="%" />
          <WeeklyKpiCard label="ファネル離脱平均" value={funnelDropAvg} unit="%" />
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs mt-2">
          <WeeklyKpiCard label="平均コール/日" value={kpi.avgCallsPerDay} unit="件" />
          <WeeklyKpiCard label="申込書不備率" value={kpi.defectRate} unit="%" />
          <WeeklyKpiCard label="プラン別ID発番" value={kpi.planIdCount} unit="件" />
          <WeeklyKpiCard label="月次着地予測" value={forecast.monthlyLanding} unit="件" />
        </div>
      </section>

      {/* クローザー別実績 */}
      <section className="mb-5">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          クローザー別ヨミ状況
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1 text-left">クローザー</th>
              <th className="border p-1">受注</th>
              <th className="border p-1">A◯/A</th>
              <th className="border p-1">B◯/B</th>
              <th className="border p-1">C/D</th>
            </tr>
          </thead>
          <tbody>
            {closerStats.length === 0 && (
              <tr>
                <td className="border p-1 text-gray-400" colSpan={5}>
                  データなし
                </td>
              </tr>
            )}
            {closerStats.map((cs) => (
              <tr key={cs.closerId}>
                <td className="border p-1 font-medium">{cs.closerName}</td>
                <td className="border p-1 text-center text-emerald-600">
                  {(cs.byYomi["won"] ?? 0)}
                </td>
                <td className="border p-1 text-center">
                  {(cs.byYomi["a_circle"] ?? 0) + (cs.byYomi["A"] ?? 0)}
                </td>
                <td className="border p-1 text-center">
                  {(cs.byYomi["b_circle"] ?? 0) + (cs.byYomi["B"] ?? 0)}
                </td>
                <td className="border p-1 text-center text-gray-400">
                  {(cs.byYomi["C"] ?? 0) + (cs.byYomi["D"] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ファネル分析 */}
      <section className="mb-5">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          ファネル分析 (8段階)
        </h2>
        <div className="grid grid-cols-4 gap-1 text-xs">
          {funnel.stages.map((s) => (
            <div key={s.stage} className="border rounded p-2 text-center">
              <div className="font-medium">{s.label}</div>
              <div className="text-base font-bold">{s.count}</div>
              {s.dropRate !== null && (
                <div className="text-red-400">離脱 {s.dropRate}%</div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          全体転換率: {funnel.totalConversionRate?.toFixed(2) ?? "--"}%
        </p>
      </section>

      {/* 月次着地予測 */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          月次着地予測 ({month})
        </h2>
        <div className="border rounded p-3 flex justify-between items-center">
          <div className="text-xs space-y-1">
            <div>確定受注: <span className="font-bold text-emerald-600">{forecast.confirmed} 件</span></div>
            <div>想定受注: <span className="font-bold">{forecast.totalExpected.toFixed(1)} 件</span></div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">月次着地</div>
            <div className="text-3xl font-bold text-indigo-700">{forecast.monthlyLanding.toFixed(1)}</div>
            <div className="text-xs text-gray-500">件</div>
          </div>
        </div>
      </section>

      <footer className="text-xs text-gray-400 border-t pt-2 mt-4">
        <p>本資料は社内限定。外部配布禁止。生成: {new Date().toLocaleString("ja-JP")}</p>
      </footer>

      <style>{`@media print { .weekly-report { font-size: 10px; } }`}</style>
    </article>
  );
}

function WeeklyKpiCard({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="border rounded p-2 text-center">
      <div className="text-gray-500">{label}</div>
      <div className="text-base font-bold tabular-nums">
        {value == null ? "--" : value}
        <span className="text-xs font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

// END_OF_FILE
