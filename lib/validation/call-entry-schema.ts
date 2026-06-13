/**
 * Zod スキーマ — コール入力 46項目 全定義
 * result_primary 値で discriminated union を使い条件必須を型安全に表現
 */
import { z } from 'zod'

// ---- ENUM 定義 (db_schema.sql の lifull_* enum と整合) ----

export const ResultPrimaryEnum = z.enum([
  'no_answer',    // 無応答
  'absent',       // 不在
  'reception_ng', // 受付NG
  'contact',      // コンタクト
])
export type ResultPrimary = z.infer<typeof ResultPrimaryEnum>

export const ResultSecondaryEnum = z.enum([
  'appointment',    // アポ獲得
  'lead',           // アポネタ
  'recall',         // 再架電
  'document_send',  // 資料送付
  'ng',             // NG
])
export type ResultSecondary = z.infer<typeof ResultSecondaryEnum>

export const NgReasonCodeEnum = z.enum([
  'listing_ng',
  'sourcing_ng',
  'current_ng',
  'other_media_ng',
  'sales_ng',
  'timing_ng',
  'workload_ng',
  'price_ng',
  'homes_ng',
  'closed_business',
  'duplicate',
  'other',
])
export type NgReasonCode = z.infer<typeof NgReasonCodeEnum>

export const AppointmentReasonCodeEnum = z.enum([
  'follow_up',
  'document_pending',
])

export const ApptFormatEnum = z.enum(['オンライン', '来訪', '電話商談'])

export const CallRestrictionEnum = z.enum([
  'existing',
  'lh_following',
  'anti_social',
  'legal_ng',
  'other',
])

// ---- カテゴリ A: 企業基本情報 10項目 ----

const CategoryASchema = z.object({
  company_name: z.string().min(1, '会社名は必須です').max(200),
  corporate_number: z.string().max(13).optional(),
  representative_name: z.string().max(100).optional(),
  phone: z.string().min(1, '電話番号は必須です').max(20),
  fax: z.string().max(20).optional(),
  postal_code: z.string().max(8).optional(),
  address: z.string().max(300).optional(),
  industry: z.string().max(100).optional(),
  property_type: z.string().max(100).optional(),
  existing_contract_status: z.string().max(200).optional(),
})

// ---- カテゴリ E: Zoom連携 7項目 (read-only, auto-filled) ----

const CategoryESchema = z.object({
  zoom_call_id: z.string().optional(),
  caller_number: z.string().optional(),
  call_started_at: z.string().datetime().optional(),
  call_ended_at: z.string().datetime().optional(),
  call_duration_sec: z.number().int().nonnegative().optional(),
  recording_url: z.string().url().optional(),
  recording_storage_status: z.enum(['pending', 'stored', 'failed']).optional(),
})

// ---- カテゴリ F: 管理 5項目 ----

const CategoryFSchema = z.object({
  appointer_user_id: z.string().uuid('担当アポインターは必須です'),
  list_name: z.string().max(100).optional(),
  action_date: z.string().date().optional(),
  cooltime_division: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9'], {
    required_error: 'クール区分は必須です',
  }),
  updated_at: z.string().datetime().optional(),
})

// ---- 共通ベース (B カテゴリの共通フィールド) ----

const CallBaseSchema = z.object({
  company_id: z.string().uuid(),
  list_id: z.string().uuid().optional(),
  contact_person: z.string().max(100).optional(),
  call_restriction: z.array(CallRestrictionEnum).default([]),
  call_memo: z.string().max(4000).optional(),
  ...CategoryASchema.shape,
  ...CategoryESchema.shape,
  ...CategoryFSchema.shape,
})

// ---- Discriminated Union: result_primary 別に必須項目を分岐 ----

// 1. 無応答 / 受付NG
const NoContactSchema = CallBaseSchema.extend({
  result_primary: z.enum(['no_answer', 'reception_ng']),
  result_secondary: ResultSecondaryEnum.optional(),
  ng_reason_code: NgReasonCodeEnum.optional(),
  ng_reason_detail: z.string().max(500).optional(),
  next_call_at: z.string().datetime().optional(),
  // アポ関連フィールドは不要
  appt_datetime: z.undefined().optional(),
  appt_format: z.undefined().optional(),
  appt_contact_name: z.undefined().optional(),
  appt_contact_role: z.undefined().optional(),
  closer_id: z.undefined().optional(),
  meeting_place: z.undefined().optional(),
  proposal_plan_draft: z.undefined().optional(),
  appt_memo: z.undefined().optional(),
  handover_draft: z.undefined().optional(),
})

// 2. 不在 → next_call_at 必須
const AbsentSchema = CallBaseSchema.extend({
  result_primary: z.literal('absent'),
  result_secondary: ResultSecondaryEnum.optional(),
  ng_reason_code: NgReasonCodeEnum.optional(),
  ng_reason_detail: z.string().max(500).optional(),
  next_call_at: z.string().datetime({ message: '次回架電日時は必須です' }),
  appt_datetime: z.undefined().optional(),
  appt_format: z.undefined().optional(),
  appt_contact_name: z.undefined().optional(),
  appt_contact_role: z.undefined().optional(),
  closer_id: z.undefined().optional(),
  meeting_place: z.undefined().optional(),
  proposal_plan_draft: z.undefined().optional(),
  appt_memo: z.undefined().optional(),
  handover_draft: z.undefined().optional(),
})

// 3. コンタクト → result_secondary 必須
const ContactBaseSchema = CallBaseSchema.extend({
  result_primary: z.literal('contact'),
  result_secondary: ResultSecondaryEnum,
  ng_reason_code: NgReasonCodeEnum.optional(),
  ng_reason_detail: z.string().max(500).optional(),
  next_call_at: z.string().datetime().optional(),
})

// 3a. コンタクト × アポ獲得 → C カテゴリ 条件必須
const ContactAppointmentSchema = ContactBaseSchema.extend({
  result_secondary: z.literal('appointment'),
  appt_datetime: z.string().datetime({ message: 'アポ日時は必須です' }),
  appt_format: ApptFormatEnum,
  appt_contact_name: z.string().max(100).optional(),
  appt_contact_role: z.string().max(100).optional(),
  closer_id: z.string().uuid({ message: '担当クローザーは必須です' }),
  meeting_place: z.string().max(200).optional(),
  proposal_plan_draft: z.string().max(1000).optional(),
  appt_memo: z.string().max(2000).optional(),
  handover_draft: z.string().max(4000).optional(),
})

// 3b. コンタクト × NG → ng_reason_code 必須
const ContactNgSchema = ContactBaseSchema.extend({
  result_secondary: z.literal('ng'),
  ng_reason_code: NgReasonCodeEnum,
  ng_reason_detail: z.string().max(500).optional(),
  appt_datetime: z.undefined().optional(),
  appt_format: z.undefined().optional(),
  appt_contact_name: z.undefined().optional(),
  appt_contact_role: z.undefined().optional(),
  closer_id: z.undefined().optional(),
  meeting_place: z.undefined().optional(),
  proposal_plan_draft: z.undefined().optional(),
  appt_memo: z.undefined().optional(),
  handover_draft: z.undefined().optional(),
})

// 3c. コンタクト × 再架電 → next_call_at 必須
const ContactRecallSchema = ContactBaseSchema.extend({
  result_secondary: z.literal('recall'),
  next_call_at: z.string().datetime({ message: '次回架電日時は必須です' }),
  appt_datetime: z.undefined().optional(),
  appt_format: z.undefined().optional(),
  appt_contact_name: z.undefined().optional(),
  appt_contact_role: z.undefined().optional(),
  closer_id: z.undefined().optional(),
  meeting_place: z.undefined().optional(),
  proposal_plan_draft: z.undefined().optional(),
  appt_memo: z.undefined().optional(),
  handover_draft: z.undefined().optional(),
})

// 3d. コンタクト × その他 (lead / document_send)
const ContactOtherSchema = ContactBaseSchema.extend({
  result_secondary: z.enum(['lead', 'document_send']),
  appt_datetime: z.undefined().optional(),
  appt_format: z.undefined().optional(),
  appt_contact_name: z.undefined().optional(),
  appt_contact_role: z.undefined().optional(),
  closer_id: z.undefined().optional(),
  meeting_place: z.undefined().optional(),
  proposal_plan_draft: z.undefined().optional(),
  appt_memo: z.undefined().optional(),
  handover_draft: z.undefined().optional(),
})

// ---- AI 出力 (D カテゴリ) — read-only overlay ----

export const AISuggestionSchema = z.object({
  result_primary: ResultPrimaryEnum,
  result_secondary: ResultSecondaryEnum.optional(),
  ng_reason_code: NgReasonCodeEnum.optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
})
export type AISuggestion = z.infer<typeof AISuggestionSchema>

// ---- 最終 Union Export ----

export const CallEntrySchema = z.discriminatedUnion('result_primary', [
  NoContactSchema.extend({ result_primary: z.literal('no_answer') }),
  NoContactSchema.extend({ result_primary: z.literal('reception_ng') }),
  AbsentSchema,
  // contact の result_secondary をさらに分岐させる場合は superRefine で補完
  ContactAppointmentSchema,
  ContactNgSchema,
  ContactRecallSchema,
  ContactOtherSchema,
])

// フォーム内部で使うフラット型 (superRefine でチェック)
export const CallEntryFormSchema = CallBaseSchema.extend({
  result_primary: ResultPrimaryEnum,
  result_secondary: ResultSecondaryEnum.optional(),
  ng_reason_code: NgReasonCodeEnum.optional(),
  ng_reason_detail: z.string().max(500).optional(),
  next_call_at: z.string().datetime().optional(),
  appt_datetime: z.string().optional(),
  appt_format: ApptFormatEnum.optional(),
  appt_contact_name: z.string().max(100).optional(),
  appt_contact_role: z.string().max(100).optional(),
  closer_id: z.string().uuid().optional(),
  meeting_place: z.string().max(200).optional(),
  proposal_plan_draft: z.string().max(1000).optional(),
  appt_memo: z.string().max(2000).optional(),
  handover_draft: z.string().max(4000).optional(),
}).superRefine((data, ctx) => {
  if (data.result_primary === 'absent') {
    if (!data.next_call_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_call_at'],
        message: '不在の場合、次回架電日時は必須です',
      })
    }
  }
  if (data.result_primary === 'contact') {
    if (!data.result_secondary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['result_secondary'],
        message: 'コンタクト時はコール結果(第2階層)が必須です',
      })
    }
    if (data.result_secondary === 'appointment') {
      if (!data.appt_datetime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['appt_datetime'], message: 'アポ日時は必須です' })
      }
      if (!data.appt_format) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['appt_format'], message: 'アポ形式は必須です' })
      }
      if (!data.closer_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['closer_id'], message: '担当クローザーは必須です' })
      }
    }
    if (data.result_secondary === 'ng' && !data.ng_reason_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ng_reason_code'],
        message: 'NGの場合、NG理由コードは必須です',
      })
    }
    if (data.result_secondary === 'recall' && !data.next_call_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_call_at'],
        message: '再架電の場合、次回架電日時は必須です',
      })
    }
  }
})

export type CallEntryFormValues = z.infer<typeof CallEntryFormSchema>
