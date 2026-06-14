/**
 * 夜会レポート閲覧ページ
 * 当日実績 + ヨミ更新 + 翌日重点
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EveningReport } from "@/lib/reports/evening-report";
import { ReportActionBar } from "@/components/reports/ReportActionBar";

interface Props {
  params: { date: string };
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function generateMetadata({ params }: Props) {
  return { title: `夜会レポート ${params.date} | 大手不動産情報ポータル運営企業` };
}

export const dynamic = "force-dynamic";

export default function EveningReportPage({ params }: Props) {
  if (!isValidDate(params.date)) notFound();

  const tenantId = "lifull_homes";

  return (
    <div className="min-h-screen bg-white">
      <ReportActionBar
        type="evening"
        period={params.date}
        className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-2"
      />
      <Suspense
        fallback={
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            夜会レポートを生成中...
          </div>
        }
      >
        <EveningReport tenantId={tenantId} date={params.date} />
      </Suspense>
    </div>
  );
}

// END_OF_FILE
