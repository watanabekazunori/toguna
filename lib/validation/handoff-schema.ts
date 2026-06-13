/**
 * 引き継ぎ 5カテゴリ Zod スキーマ + SF テキストフォーマッタ
 * M2 handoff-generate Edge Function の出力スキーマと整合。
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// 5 カテゴリスキーマ
// ---------------------------------------------------------------------------

/** C1: 企業属性 */
export const CompanyBlockSchema = z.object({
  company_name: z.string().max(200).optional().default(""),
  area: z.string().max(200).optional().default(""),
  main_business: z.string().max(500).optional().default(""),
  homes_usage_summary: z.string().max(1000).optional().default(""),
  competitor_info: z.string().max(1000).optional().default(""),
});
export type CompanyBlock = z.infer<typeof CompanyBlockSchema>;

/** C2: 担当者情報 */
export const ContactBlockSchema = z.object({
  name: z.string().max(100).optional().default(""),
  role: z.string().max(100).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  email: z.string().max(200).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});
export type ContactBlock = z.infer<typeof ContactBlockSchema>;

/** C3: 商談アジェンダ */
export const AppointmentBlockSchema = z.object({
  appointment_type: z.string().max(100).optional().default(""),
  scheduled_at: z.string().max(50).optional().default(""),
  location: z.string().max(200).optional().default(""),
  purpose: z.string().max(1000).optional().default(""),
  preparation_notes: z.string().max(2000).optional().default(""),
});
export type AppointmentBlock = z.infer<typeof AppointmentBlockSchema>;

/** C4: 課題・ニーズ */
export const NegotiationBlockSchema = z.object({
  key_concerns: z.array(z.string().max(500)).default([]),
  decision_factors: z.string().max(1000).optional().default(""),
  budget_hint: z.string().max(500).optional().default(""),
  timeline: z.string().max(500).optional().default(""),
  objections: z.string().max(2000).optional().default(""),
});
export type NegotiationBlock = z.infer<typeof NegotiationBlockSchema>;

/** C5: 注意事項・契約 */
export const ContractBlockSchema = z.object({
  contract_type: z.string().max(100).optional().default(""),
  expected_amount: z.string().max(100).optional().default(""),
  contract_probability: z.number().min(0).max(100).optional().default(0),
  special_conditions: z.string().max(2000).optional().default(""),
});
export type ContractBlock = z.infer<typeof ContractBlockSchema>;

/** 5カテゴリ統合スキーマ */
export const HandoffDraftSchema = z.object({
  company_block: CompanyBlockSchema,
  contact_block: ContactBlockSchema,
  appointment_block: AppointmentBlockSchema,
  negotiation_block: NegotiationBlockSchema,
  contract_block: ContractBlockSchema,
  optional_notes: z.string().max(2000).optional().default(""),
  defect_warnings: z.array(z.string()).default([]),
});
export type HandoffDraft = z.infer<typeof HandoffDraftSchema>;

/** カテゴリキー型 */
export type HandoffCategoryKey =
  | "company_block"
  | "contact_block"
  | "appointment_block"
  | "negotiation_block"
  | "contract_block";

export const HANDOFF_CATEGORIES: ReadonlyArray<{
  key: HandoffCategoryKey;
  label: string;
  order: number;
}> = [
  { key: "company_block", label: "企業属性", order: 1 },
  { key: "contact_block", label: "担当者情報", order: 2 },
  { key: "appointment_block", label: "商談アジェンダ", order: 3 },
  { key: "negotiation_block", label: "課題・ニーズ", order: 4 },
  { key: "contract_block", label: "注意事項・契約", order: 5 },
];

// ---------------------------------------------------------------------------
// Salesforce 引き継ぎテキストフォーマッタ
// ---------------------------------------------------------------------------

/** Salesforce 引き継ぎ用プレーンテキストへ整形する */
export function formatHandoffForSalesforce(draft: HandoffDraft): string {
  const lines: string[] = [];
  lines.push("【引き継ぎサマリー】");
  lines.push("");
  lines.push("■ 企業属性");
  lines.push(`  会社名: ${draft.company_block.company_name}`);
  lines.push(`  業態: ${draft.company_block.main_business}`);
  lines.push(`  エリア: ${draft.company_block.area}`);
  lines.push(`  ポータル利用状況: ${draft.company_block.homes_usage_summary}`);
  lines.push(`  競合掲載: ${draft.company_block.competitor_info}`);
  lines.push("");
  lines.push("■ 担当者情報");
  lines.push(
    `  ${draft.contact_block.name} / ${draft.contact_block.role}`
  );
  lines.push(`  TEL: ${draft.contact_block.phone}`);
  lines.push(`  MAIL: ${draft.contact_block.email}`);
  lines.push(`  備考: ${draft.contact_block.notes}`);
  lines.push("");
  lines.push("■ 商談アジェンダ");
  lines.push(`  形式: ${draft.appointment_block.appointment_type}`);
  lines.push(`  予定: ${draft.appointment_block.scheduled_at}`);
  lines.push(`  場所: ${draft.appointment_block.location}`);
  lines.push(`  目的: ${draft.appointment_block.purpose}`);
  lines.push(`  準備事項: ${draft.appointment_block.preparation_notes}`);
  lines.push("");
  lines.push("■ 課題・ニーズ");
  draft.negotiation_block.key_concerns.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c}`);
  });
  lines.push(`  決裁要因: ${draft.negotiation_block.decision_factors}`);
  lines.push(`  予算感: ${draft.negotiation_block.budget_hint}`);
  lines.push(`  タイムライン: ${draft.negotiation_block.timeline}`);
  lines.push(`  反論ポイント: ${draft.negotiation_block.objections}`);
  lines.push("");
  lines.push("■ 注意事項・契約");
  lines.push(`  契約種別: ${draft.contract_block.contract_type}`);
  lines.push(`  想定金額: ${draft.contract_block.expected_amount}`);
  lines.push(
    `  契約確度: ${draft.contract_block.contract_probability ?? 0}%`
  );
  lines.push(`  特記事項: ${draft.contract_block.special_conditions}`);
  if (draft.optional_notes) {
    lines.push("");
    lines.push("■ 補足");
    lines.push(`  ${draft.optional_notes}`);
  }
  if (draft.defect_warnings.length > 0) {
    lines.push("");
    lines.push("■ 申込書不備事前検出");
    draft.defect_warnings.forEach((w) => lines.push(`  ⚠ ${w}`));
  }
  return lines.join("\n");
}

// END_OF_FILE
