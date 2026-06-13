/**
 * Zod スキーマ — 商談入力 17項目
 * ヨミ A/B/C/D + 商談NG 20種 enum と整合
 */
import { z } from 'zod'

// ---- ENUM ----

export const YomiEnum = z.enum(['A', 'B', 'C', 'D', 'won', 'a_circle', 'b_circle', 'lost'], {
  required_error: 'ヨミ区分は必須です',
})
export type Yomi = z.infer<typeof YomiEnum>

export const MeetingNgCodeEnum = z.enum([
  'price_ng',
  'roi_ng',
  'timing_ng',
  'competitor_contract',
  'internal_approval_ng',
  'no_budget',
  'no_authority',
  'rescheduled',
  'disappeared',
  'area_ng',
  'business_type_ng',
  'existing_id',
  'no_need',
  'staff_change',
  'audit_ng',
  'anti_social',
  'closed',
  'contact_ng',
  'other_ng',
  'pending',
])
export type MeetingNgCode = z.infer<typeof MeetingNgCodeEnum>

export const MeetingTypeEnum = z.enum(['phone', 'web'])
export const MeetingStatusEnum = z.enum(['done', 'rescheduled', 'disappeared'])
export const MeetingResultEnum = z.enum(['ok', 'ng'])

// ---- 商談入力 17項目 ----

export const MeetingEntrySchema = z.object({
  // 1. 商談日時
  scheduled_at: z.string().datetime({ message: '商談日時は必須です' }),
  // 2. 商談形式
  meeting_type: MeetingTypeEnum,
  // 3. 商談ステータス
  status: MeetingStatusEnum,
  // 4. 担当者名
  contact_person_name: z.string().max(100).optional(),
  // 5. 担当者役職
  contact_person_role: z.string().max(100).optional(),
  // 6. 商談内容
  meeting_content: z.string().max(4000).optional(),
  // 7. 次回内容
  next_content: z.string().max(2000).optional(),
  // 8. 次回日程
  next_date: z.string().date().optional(),
  // 9. 商談結果
  meeting_result: MeetingResultEnum.optional(),
  // 10. 商談NG理由コード (meeting_result='ng' 時必須)
  ng_reason_code: MeetingNgCodeEnum.optional(),
  // 11. NG理由備考
  ng_reason_note: z.string().max(500).optional(),
  // 12. 提案プラン
  proposal_plan: z.string().max(500).optional(),
  // 13. ヨミ
  yomi: YomiEnum,
  // 14. 課題合意
  issue_agreement: z.string().max(2000).optional(),
  // 15. 商談期間
  meeting_period: z.string().max(100).optional(),
  // 16. ヨミB確定日
  b_yomi_date: z.string().date().optional(),
  // 17. 稟議番号
  approval_no: z
    .string()
    .regex(/^KNP\d{4}\d{6,}$/, '稟議番号形式: KNP202600000000')
    .optional()
    .or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.meeting_result === 'ng' && !data.ng_reason_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ng_reason_code'],
      message: '商談NGの場合、NG理由コードは必須です',
    })
  }
  if ((data.yomi === 'B' || data.yomi === 'b_circle' || data.yomi === 'won') && !data.b_yomi_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['b_yomi_date'],
      message: 'ヨミB以上の場合、口頭合意日は必須です',
    })
  }
})

export type MeetingEntryValues = z.infer<typeof MeetingEntrySchema>

// ---- ヨミ表示用メタデータ ----

export const YOMI_META: Record<
  Yomi,
  { label: string; color: string; bg: string; rate: number; description: string }
> = {
  A: {
    label: 'A',
    color: 'text-green-700',
    bg: 'bg-green-100',
    rate: 0.7,
    description: 'ほぼ確実。審査申請待ちまたは書類回収中。',
  },
  a_circle: {
    label: 'A○',
    color: 'text-emerald-800',
    bg: 'bg-emerald-100',
    rate: 0.85,
    description: '稟議承認済み。入金確認待ち。',
  },
  B: {
    label: 'B',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    rate: 0.5,
    description: '口頭合意B。申込書回収フェーズ。',
  },
  b_circle: {
    label: 'B○',
    color: 'text-indigo-700',
    bg: 'bg-indigo-100',
    rate: 0.65,
    description: '書類提出済み。審査待ち。',
  },
  C: {
    label: 'C',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    rate: 0.3,
    description: '継続商談中。次回アポあり。',
  },
  D: {
    label: 'D',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    rate: 0.15,
    description: '初回商談完了。追客フェーズ。',
  },
  won: {
    label: '受注',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    rate: 1.0,
    description: '受注確定。',
  },
  lost: {
    label: '失注',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    rate: 0,
    description: '商談終了。',
  },
}

export const MEETING_NG_LABELS: Record<MeetingNgCode, string> = {
  price_ng: '掲載金額NG',
  roi_ng: '費用対効果NG',
  timing_ng: '時期NG',
  competitor_contract: '他社契約中',
  internal_approval_ng: '社内稟議NG',
  no_budget: '予算なし',
  no_authority: '決裁権なし',
  rescheduled: 'リスケ',
  disappeared: '消滅',
  area_ng: 'エリアNG',
  business_type_ng: '業態NG',
  existing_id: '既存ID保有',
  no_need: 'ニーズなし',
  staff_change: '担当変更',
  audit_ng: '審査NG',
  anti_social: '反社',
  closed: '廃業',
  contact_ng: '連絡不通',
  other_ng: 'その他NG',
  pending: '保留',
}
