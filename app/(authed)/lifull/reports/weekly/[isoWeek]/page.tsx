/**
 * 週次定例レポート閲覧ページ
 * isoWeek パラメータ: YYYY-Www (例: 2026-W24)
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WeeklyReport } from "@/lib/reports/weekly-report";
import { ReportActionBar } from "@/components/reports/ReportActionBar";

interface Props {
  params: { isoWeek: string };
}

/** YYYY-Www 形式チェック */
function isValidIsoWeek(s: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(s);
}

export function generateMetadata({ params }: Props) {
  return {
    title: `週次定例 ${params.isoWeek} | 大手不動産情報ポータル運営企業`,
  };
}

export default function WeeklyReportPage({ params }: Props) {
  if (!isValidIsoWeek(params.isoWeek)) notFound();

  const tenantId = "lifull_homes";

  return (
    <div className="min-h-screen bg-white">
      <ReportActionBar
        type="weekly"
        period={params.isoWeek}
        className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-2"
      />
      <Suspense
        fallback={
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            週次定例レポートを生成中...
          </div>
        }
      >
        <WeeklyReport tenantId={tenantId} isoWeek={params.isoWeek} />
      </Suspense>
    </div>
  );
}

// END_OF_FILE
