/**
 * 夜会(15分)テンプレート — React Server Component
 * 当日実績 + ヨミ更新 + 翌日重点
 * UI文言: 大手不動産情報ポータル運営企業 (LIFULL 表記禁止)
 */
import { fetchDailyKpi, rollupKpi } from "@/lib/kpi/queries";
import { computeLandingForecast } from "@/lib/kpi/yomi-landing";
import { format } from "date-fns";

interface EveningReportProps {
  tenantId: string;
  date: string; // YYYY-MM-DD
}

export async function EveningReport({ tenantId, date }: EveningReportProps) {
  const month = format(new Date(date), "yyyy-MM");

  const [kpiRows, forecast] = await Promise.all([
    fetchDailyKpi({ tenantId, from: date, to: date }),
    computeLandingForecast(tenantId, month),
  ]);

  const kpi = rollupKpi(kpiRows);

  return (
    <article className="evening-report print:p-0 p-6 max-w-2xl mx-auto font-sans text-sm">
      <header className="border-b-2 border-indigo-700 pb-3 mb-4">
        <h1 className="text-lg font-bold">
          大手不動産情報ポータル運営企業 — 夜会シート
        </h1>
        <p className="text-gray-600 text-xs mt-1">{date} 夜会</p>
      </header>

      {/* 当日実績 */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          当日実績
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="コール数" value={kpi.avgCallsPerDay} unit="件" />
          <StatCard label="アポ獲得率" value={kpi.appointmentRate} unit="%" />
          <StatCard label="商談化率" value={kpi.meetingRate} unit="%" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatCard label="口頭B率" value={kpi.orderRate} unit="%" />
          <StatCard label="申込書不備率" value={kpi.defectRate} unit="%" />
          <StatCard label="ステータス入力" value={kpi.statusInputCount} unit="件" />
        </div>
      </section>

      {/* ヨミ更新サマリ */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          ヨミ更新 ({month} 月次着地予測)
        </h2>
        <div className="border rounded p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">確定受注</span>
            <span className="font-bold text-emerald-600">{forecast.confirmed} 件</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">想定受注 (確度加重)</span>
            <span className="font-bold">{forecast.totalExpected.toFixed(1)} 件</span>
          </div>
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-semibold">月次着地予測</span>
            <span className="text-xl font-bold text-indigo-700">
              {forecast.monthlyLanding.toFixed(1)} 件
            </span>
          </div>
        </div>
        <YomiBreakdown byYomi={forecast.byYomi} />
      </section>

      {/* 翌日重点 */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          翌日重点アクション
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1 text-left">担当者</th>
              <th className="border p-1">重点タスク</th>
              <th className="border p-1">期限</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-1 text-gray-400" colSpan={3}>
                翌日計画を入力 / work_slots から自動展開予定
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="text-xs text-gray-400 border-t pt-2 mt-4">
        <p>本資料は社内限定。外部配布禁止。</p>
        <p>生成: {new Date().toLocaleString("ja-JP")}</p>
      </footer>

      <style>{`
        @media print {
          .evening-report { font-size: 11px; }
        }
      `}</style>
    </article>
  );
}

function StatCard({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="border rounded p-2 text-center text-xs">
      <div className="text-gray-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">
        {value == null ? "--" : value}
        <span className="text-xs font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function YomiBreakdown({
  byYomi,
}: {
  byYomi: { yomi: string; count: number; expectedOrders: number; rate: number }[];
}) {
  const visible = byYomi.filter((y) => y.count > 0 && y.yomi !== "lost");
  if (visible.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
      {visible.map((y) => (
        <div key={y.yomi} className="border rounded p-1 text-center">
          <div className="font-semibold">{y.yomi}</div>
          <div>{y.count} 件</div>
          <div className="text-gray-400">x{y.rate}</div>
          <div className="text-indigo-600">{y.expectedOrders.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

// END_OF_FILE
