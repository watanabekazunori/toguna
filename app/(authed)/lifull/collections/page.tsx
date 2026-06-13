/**
 * 申込書回収管理ページ (Server Component)
 * 一覧 (data-table) + 詳細チェックリストの 2 ペイン構成。
 * 出力先ロール: APPOINTER / MANAGER / ADMIN。
 */
import { createServerClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/data-table";
import { CollectionChecklist } from "@/components/collection/CollectionChecklist";
import { StateEmpty } from "@/components/ui/StateEmpty";

export const dynamic = "force-dynamic";

interface CollectionRow {
  id: string;
  deal_id: string;
  company_name: string | null;
  yomi_rank: "A" | "B" | "C" | null;
  received_at: string | null;
  collected_at: string | null;
  ftp_uploaded_at: string | null;
  dw_stored_at: string | null;
  defect_warnings: string[] | null;
  checklist: Record<string, boolean> | null;
}

interface PageProps {
  searchParams: { id?: string };
}

/** 申込書回収一覧 + 詳細ペイン */
export default async function CollectionsPage({ searchParams }: PageProps) {
  const supabase = createServerClient();

  const { data: rows } = await supabase
    .from("lifull_collections")
    .select(
      "id, deal_id, company_name, yomi_rank, received_at, collected_at, ftp_uploaded_at, dw_stored_at, defect_warnings, checklist"
    )
    .order("received_at", { ascending: false })
    .limit(100);

  const collections: CollectionRow[] = rows ?? [];
  const selectedId = searchParams.id ?? collections[0]?.id ?? null;
  const selected = collections.find((c) => c.id === selectedId) ?? null;

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          申込書回収管理
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 不備事前検出付き。「ポータルサイト審査用書類」として社外送付。
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded border">
          {collections.length === 0 ? (
            <StateEmpty
              title="申込書回収案件なし"
              description="商談で受注確定すると、こちらに表示されます。"
            />
          ) : (
            <DataTable
              columns={[
                { key: "company_name", label: "会社名" },
                { key: "yomi_rank", label: "ヨミ" },
                { key: "received_at", label: "受領日" },
                { key: "ftp_uploaded_at", label: "FTP" },
                { key: "dw_stored_at", label: "DW格納" },
              ]}
              rows={collections.map((c) => ({
                id: c.id,
                company_name: c.company_name ?? "(未設定)",
                yomi_rank: c.yomi_rank ?? "-",
                received_at: c.received_at?.slice(0, 10) ?? "-",
                ftp_uploaded_at: c.ftp_uploaded_at ? "済" : "-",
                dw_stored_at: c.dw_stored_at ? "済" : "-",
                _selected: c.id === selectedId,
              }))}
              rowHref={(r) => `/lifull/collections?id=${r.id}`}
            />
          )}
        </div>

        <aside className="rounded border bg-card p-4">
          {selected ? (
            <CollectionChecklist
              collectionId={selected.id}
              dealId={selected.deal_id}
              companyName={selected.company_name ?? "(未設定)"}
              defectWarnings={selected.defect_warnings ?? []}
              initialChecklist={selected.checklist ?? {}}
              receivedAt={selected.received_at}
              collectedAt={selected.collected_at}
              ftpUploadedAt={selected.ftp_uploaded_at}
              dwStoredAt={selected.dw_stored_at}
            />
          ) : (
            <p className="text-sm text-muted-foreground">案件を選択してください。</p>
          )}
        </aside>
      </section>
    </main>
  );
}

// END_OF_FILE
