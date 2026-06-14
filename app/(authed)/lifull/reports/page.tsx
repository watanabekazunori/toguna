/**
 * レポート一覧ページ — 朝会/夜会/週次 過去 30 日分のリンク
 * MANAGER / ADMIN のみアクセス可 (middleware で制御)
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format, subDays, getISOWeek, getISOWeekYear } from "date-fns";

export const metadata = { title: "レポート一覧 | 大手不動産情報ポータル運営企業" };
export const dynamic = "force-dynamic";

/** 過去 N 日の日付配列を返す */
function recentDates(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) =>
    format(subDays(today, i), "yyyy-MM-dd")
  );
}

/** 過去 N 週の ISO 週表現を返す */
function recentIsoWeeks(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(today, i * 7);
    return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
  });
}

export default async function ReportsIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // middleware が先にリダイレクト

  const dates = recentDates(30);
  const weeks = recentIsoWeeks(8);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        大手不動産情報ポータル運営企業 レポート一覧
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        朝会 / 夜会 / 週次定例の閲覧・ダウンロード
      </p>

      <div className="grid grid-cols-3 gap-6">
        {/* 朝会 */}
        <section>
          <h2 className="font-semibold mb-3 text-sm border-b pb-1">
            朝会シート (過去 30 日)
          </h2>
          <ul className="space-y-1">
            {dates.map((d) => (
              <li key={d}>
                <Link
                  href={`/lifull/reports/morning/${d}`}
                  className="text-sm text-blue-600 hover:underline flex justify-between"
                >
                  <span>{d}</span>
                  <span className="text-xs text-muted-foreground">閲覧</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 夜会 */}
        <section>
          <h2 className="font-semibold mb-3 text-sm border-b pb-1">
            夜会シート (過去 30 日)
          </h2>
          <ul className="space-y-1">
            {dates.map((d) => (
              <li key={d}>
                <Link
                  href={`/lifull/reports/evening/${d}`}
                  className="text-sm text-blue-600 hover:underline flex justify-between"
                >
                  <span>{d}</span>
                  <span className="text-xs text-muted-foreground">閲覧</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 週次 */}
        <section>
          <h2 className="font-semibold mb-3 text-sm border-b pb-1">
            週次定例シート (過去 8 週)
          </h2>
          <ul className="space-y-1">
            {weeks.map((w) => (
              <li key={w}>
                <Link
                  href={`/lifull/reports/weekly/${w}`}
                  className="text-sm text-blue-600 hover:underline flex justify-between"
                >
                  <span>{w}</span>
                  <span className="text-xs text-muted-foreground">閲覧</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8 p-4 bg-muted rounded text-xs text-muted-foreground">
        <p>本レポートは社内限定資料です。外部への配布・共有を禁じます。</p>
      </div>
    </main>
  );
}

// END_OF_FILE
