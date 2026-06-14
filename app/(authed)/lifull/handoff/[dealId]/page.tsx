/**
 * 引き継ぎドラフト確認ページ (Server Component)
 * deal + AI ドラフトを fetch し、5カテゴリ tab UI を表示。
 */
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { HandoffDraftPanel } from "@/components/handoff/HandoffDraftPanel";
import {
  type HandoffDraft,
  HANDOFF_CATEGORIES,
} from "@/lib/validation/handoff-schema";

interface PageProps {
  params: { dealId: string };
}

interface DealRow {
  id: string;
  tenant_id: string;
  company_name: string | null;
  handoff_ai_generated_at: string | null;
  handoff_model_version: string | null;
  handoff_defect_warnings: string[] | null;
  contact_block_ai_draft: HandoffDraft["contact_block"] | null;
  company_block_ai_draft: HandoffDraft["company_block"] | null;
  appointment_block_ai_draft: HandoffDraft["appointment_block"] | null;
  negotiation_block_ai_draft: HandoffDraft["negotiation_block"] | null;
  contract_block_ai_draft: HandoffDraft["contract_block"] | null;
  contact_block_confirmed: HandoffDraft["contact_block"] | null;
  company_block_confirmed: HandoffDraft["company_block"] | null;
  appointment_block_confirmed: HandoffDraft["appointment_block"] | null;
  negotiation_block_confirmed: HandoffDraft["negotiation_block"] | null;
  contract_block_confirmed: HandoffDraft["contract_block"] | null;
  handoff_confirmed_at: string | null;
}

/** 引き継ぎドラフト確認ページ */
export const dynamic = "force-dynamic";

export default async function HandoffPage({ params }: PageProps) {
  const supabase = createServerClient();

  const { data: deal, error } = await supabase
    .from("lifull_deals")
    .select(
      [
        "id",
        "tenant_id",
        "company_name",
        "handoff_ai_generated_at",
        "handoff_model_version",
        "handoff_defect_warnings",
        "contact_block_ai_draft",
        "company_block_ai_draft",
        "appointment_block_ai_draft",
        "negotiation_block_ai_draft",
        "contract_block_ai_draft",
        "contact_block_confirmed",
        "company_block_confirmed",
        "appointment_block_confirmed",
        "negotiation_block_confirmed",
        "contract_block_confirmed",
        "handoff_confirmed_at",
      ].join(",")
    )
    .eq("id", params.dealId)
    .single<DealRow>();

  if (error || !deal) {
    notFound();
  }

  const aiGenerated = deal.handoff_ai_generated_at != null;
  const confirmedCount = HANDOFF_CATEGORIES.filter(
    (c) => deal[`${c.key}_confirmed` as keyof DealRow] != null
  ).length;

  return (
    <main className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          引き継ぎドラフト確認
        </h1>
        <p className="text-sm text-muted-foreground">
          {deal.company_name ?? "(未設定)"} / 確定 {confirmedCount} /{" "}
          {HANDOFF_CATEGORIES.length}
        </p>
        {!aiGenerated && (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            AI ドラフトは未生成です。商談入力で「口頭合意B確定」した後、AI
            ドラフトが自動生成されます。
          </div>
        )}
        {(deal.handoff_defect_warnings ?? []).length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-1">
            <div className="font-medium">
              申込書不備事前検出 (
              {(deal.handoff_defect_warnings ?? []).length}件)
            </div>
            <ul className="list-disc pl-5">
              {(deal.handoff_defect_warnings ?? []).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <HandoffDraftPanel
        dealId={deal.id}
        tenantId={deal.tenant_id}
        aiDraft={{
          contact_block: deal.contact_block_ai_draft ?? null,
          company_block: deal.company_block_ai_draft ?? null,
          appointment_block: deal.appointment_block_ai_draft ?? null,
          negotiation_block: deal.negotiation_block_ai_draft ?? null,
          contract_block: deal.contract_block_ai_draft ?? null,
        }}
        confirmed={{
          contact_block: deal.contact_block_confirmed ?? null,
          company_block: deal.company_block_confirmed ?? null,
          appointment_block: deal.appointment_block_confirmed ?? null,
          negotiation_block: deal.negotiation_block_confirmed ?? null,
          contract_block: deal.contract_block_confirmed ?? null,
        }}
        defectWarnings={deal.handoff_defect_warnings ?? []}
      />

      <footer className="text-xs text-muted-foreground border-t pt-4">
        {deal.handoff_model_version
          ? `モデル: ${deal.handoff_model_version}`
          : ""}
        {deal.handoff_ai_generated_at
          ? ` / 生成: ${new Date(deal.handoff_ai_generated_at).toLocaleString(
              "ja-JP"
            )}`
          : ""}
      </footer>
    </main>
  );
}

// END_OF_FILE
