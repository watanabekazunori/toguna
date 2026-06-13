/**
 * 朝会レポート閲覧ページ
 * 印刷ボタン + PDF/XLSX ダウンロードを提供
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MorningReport } from "@/lib/reports/morning-report";
import { ReportActionBar } from "@/components/reports/ReportActionBar";

interface Props {
  params: { date: string };
}

/** date パラメータの簡易バリデーション */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function generateMetadata({ params }: Props) {
  return { title: `朝会レポート ${params.date} | 大手不動産情報ポータル運営企業` };
}

export default function MorningReportPage({ params }: Props) {
  if (!isValidDate(params.date)) notFound();

  const tenantId = "lifull_homes";

  return (
    <div className="min-h-screen bg-white">
      {/* アクションバー: 印刷/PDF/XLSX */}
      <ReportActionBar
        type="morning"
        period={params.date}
        className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-2"
      />

      {/* レポート本体 */}
      <Suspense
        fallback={
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            レポートを生成中...
          </div>
        }
      >
        <MorningReport tenantId={tenantId} date={params.date} />
      </Suspense>
    </div>
  );
}

// END_OF_FILE
