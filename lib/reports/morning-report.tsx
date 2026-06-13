/**
 * 朝会(10分)テンプレート — React Server Component
 * 前日実績 + 当日計画 + 重要アラートを1ページ印刷用に整形
 * UI文言: 大手不動産情報ポータル運営企業 (LIFULL 表記禁止)
 */
import { fetchDailyKpi, rollupKpi } from "@/lib/kpi/queries";
import { fetchFunnelData } from "@/lib/kpi/funnel";
import { format, subDays } from "date-fns";

interface MorningReportProps {
  tenantId: string;
  date: string; // YYYY-MM-DD (朝会当日)
}

/** 朝会レポートデータ取得 + 描画 */
export async function MorningReport({ tenantId, date }: MorningReportProps) {
  const yesterday = format(subDays(new Date(date), 1), "yyyy-MM-dd");

  const [kpiRows, funnel] = await Promise.all([
    fetchDailyKpi({ tenantId, from: yesterday, to: yesterday }),
    fetchFunnelData({ tenantId, from: yesterday, to: yesterday }),
  ]);

  const kpi = rollupKpi(kpiRows);

  return (
    <article className="morning-report print:p-0 p-6 max-w-2xl mx-auto font-sans text-sm">
      <header className="border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-lg font-bold">
          大手不動産情報ポータル運営企業 — 朝会シート
        </h1>
        <p className="text-gray-600 text-xs mt-1">
          {date} 朝会 / 前日実績: {yesterday}
        </p>
      </header>

      {/* 前日実績サマリ */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          前日実績サマリ
        </h2>
        <div className="grid grid-cols-4 gap-2">
          <KpiCell label="コール数" value={kpi.statusInputCount} unit="件" />
          <KpiCell label="アポ獲得率" value={kpi.appointmentRate} unit="%" />
          <KpiCell label="商談化率" value={kpi.meetingRate} unit="%" />
          <KpiCell label="口頭B率" value={kpi.orderRate} unit="%" />
        </div>
      </section>

      {/* ファネル通過数 */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          ファネル通過 (前日)
        </h2>
        <div className="grid grid-cols-4 gap-1 text-xs">
          {funnel.stages.slice(0, 4).map((s) => (
            <div key={s.stage} className="border rounded p-2 text-center">
              <div className="font-medium">{s.label}</div>
              <div className="text-lg font-bold tabular-nums">{s.count}</div>
              {s.dropRate !== null && (
                <div className="text-red-500">離脱{s.dropRate}%</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 当日計画 */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          当日重点計画
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1 text-left">担当者</th>
              <th className="border p-1">目標コール</th>
              <th className="border p-1">重点リスト</th>
              <th className="border p-1">注意事項</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-1 text-gray-400" colSpan={4}>
                行動管理データから自動展開 (work_slots 参照)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 重要アラート */}
      <section className="mb-4">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">
          重要アラート
        </h2>
        <AlertPlaceholder kpi={kpi} />
      </section>

      <footer className="text-xs text-gray-400 border-t pt-2 mt-4 print:mt-8">
        <p>本資料は社内限定。外部配布禁止。</p>
        <p>生成: {new Date().toLocaleString("ja-JP")}</p>
      </footer>

      <style>{`
        @media print {
          .morning-report { font-size: 11px; }
          header h1 { font-size: 16px; }
        }
      `}</style>
    </article>
  );
}

function KpiCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="border rounded p-2 text-center text-xs">
      <div className="text-gray-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">
        {value == null ? "--" : value}
        <span className="text-xs font-normal">{unit}</span>
      </div>
    </div>
  );
}

function AlertPlaceholder({ kpi }: { kpi: ReturnType<typeof rollupKpi> }) {
  const alerts: string[] = [];
  if (kpi.appointmentRate !== null && kpi.appointmentRate < 10) {
    alerts.push(`アポ獲得率が低水準 (${kpi.appointmentRate}%)`);
  }
  if (alerts.length === 0) {
    return <p className="text-xs text-gray-400">アラートなし</p>;
  }
  return (
    <ul className="text-xs space-y-1">
      {alerts.map((a, i) => (
        <li key={i} className="flex gap-1 text-red-600">
          <span>!</span>
          <span>{a}</span>
        </li>
      ))}
    </ul>
  );
}

// END_OF_FILE
