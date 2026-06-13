// TOGUNA HOME'S 仕様 型定義
// REQUIREMENTS / v1.0 (2026-05-02)

export type Yomi = 'won' | 'A_circle' | 'A' | 'B_circle' | 'B' | 'C' | 'D' | 'lost'

export const YOMI_LABEL: Record<Yomi, string> = {
  won: '受注',
  A_circle: 'A〇',
  A: 'A',
  B_circle: 'B〇',
  B: 'B',
  C: 'C',
  D: 'D',
  lost: '失注',
}

export const YOMI_RATE: Record<Yomi, number> = {
  won: 1.0,
  A_circle: 0.95,
  A: 0.9,
  B_circle: 0.85,
  B: 0.8,
  C: 0.2,
  D: 0.1,
  lost: 0,
}

export type UserRole = 'APPOINTER' | 'CLOSER' | 'COLLECTOR' | 'SV' | 'PM' | 'ADMIN'

export const ROLE_LABEL: Record<UserRole, string> = {
  APPOINTER: 'アポインター',
  CLOSER: 'クローザー',
  COLLECTOR: '回収',
  SV: 'SV',
  PM: 'PM',
  ADMIN: 'Admin',
}

export type CallState =
  | 'untouched'
  | 'dialed'
  | 'connected'
  | 'contacted'
  | 'appointed'
  | 'ng'
  | 'recall_scheduled'

export type CallRestriction =
  | 'none'
  | 'closed_business'
  | 'current_announcer'
  | 'duplicate_list'
  | 'existing'
  | 'lh_following'

export const CALL_RESTRICTION_LABEL: Record<CallRestriction, string> = {
  none: '規制なし',
  closed_business: '不動産業廃業',
  current_announcer: '現アナ',
  duplicate_list: 'リスト被り',
  existing: '既存',
  lh_following: 'LH追客中',
}

export type ResultPrimary = 'no_answer' | 'absent' | 'reception_ng' | 'contact'
export type ResultSecondary = 'appointment' | 'lead' | 'recall' | 'document_send' | 'ng'

export const PRIMARY_LABEL: Record<ResultPrimary, string> = {
  no_answer: '無応答/未通電',
  absent: '不在',
  reception_ng: '受付NG',
  contact: 'コンタクト',
}

export const SECONDARY_LABEL: Record<ResultSecondary, string> = {
  appointment: 'アポ',
  lead: 'アポネタ',
  recall: '再架電',
  document_send: '資料送付',
  ng: 'NG',
}

export const NG_REASONS = [
  '掲載・仕入れニーズなし',
  '仕入れニーズのみなし',
  '掲載ニーズのみなし',
  '他媒体NG',
  '時期NG',
  '工数NG',
  '金額NG',
  'HOMES NG',
  '営業NG',
] as const

export const APPOINTMENT_KINDS = [
  '売買掲載アポ',
  '賃貸掲載アポ',
  '売却査定アポ',
  'その他',
] as const

export const PROPOSAL_PLANS = [
  '問い合わせ課金プラン',
  '掲載課金プラン',
  '業務支援プラン',
  '新築戸建てプラン',
] as const

export const APPRAISAL_TYPES = [
  'マンション',
  '戸建て',
  '土地',
  '区分マンション',
  '一棟マンション・アパート',
  '倉庫・工場',
] as const

export const MEETING_NG_REASONS = [
  '掲載金額NG',
  '売却金額NG',
  '掲載反響課金NG',
  '売却反響課金NG',
  '掲載他媒体NG',
  '売却他媒体NG',
  '掲載工数NG',
  '売却工数NG',
  '賃貸反響上限NG',
  '売却競合発生NG',
  '掲載過去利用効果なしNG',
  '売却過去利用効果なしNG',
  '売却時期NG',
] as const

export const MAIN_BUSINESSES = [
  '賃貸管理',
  '賃貸仲介',
  '売買仲介',
  '売買買取',
  '実需',
  '収益',
  '事業',
] as const

// GAP-M: 議事録「業態ランク (賃貸/売買/管理)」必須化マッピング
export type BusinessTier = 'rental' | 'sale' | 'management' | 'unknown'

export const BUSINESS_TIER_LABEL: Record<BusinessTier, string> = {
  rental: '賃貸',
  sale: '売買',
  management: '管理',
  unknown: '未設定',
}

export function classifyBusinessTier(mainBusiness: string | null | undefined): BusinessTier {
  if (!mainBusiness || mainBusiness === 'unknown') return 'unknown'
  if (mainBusiness.startsWith('賃貸')) return mainBusiness.includes('管理') ? 'management' : 'rental'
  if (mainBusiness.startsWith('売買')) return 'sale'
  return 'unknown'
}

export type DealStatus =
  | 'meeting_scheduled'
  | 'rescheduled'
  | 'disappeared'
  | 'lost'
  | 'won'
  | 'c_yomi_following'

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  meeting_scheduled: '商談化',
  rescheduled: 'リスケ',
  disappeared: '消滅',
  lost: '失注',
  won: '受注',
  c_yomi_following: 'Cヨミ追客中',
}

export type CollectionStatus =
  | 'opened'
  | 'remind_set'
  | 'confirm_sent'
  | 'application_sent'
  | 'return_pending'
  | 'audit_requested'
  | 'audit_done'
  | 'won'
  | 'lost'

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  opened: '発生',
  remind_set: 'リマ予定設定',
  confirm_sent: '確認メール送付',
  application_sent: '申込書送付',
  return_pending: '返送予定',
  audit_requested: '審査申請中',
  audit_done: '審査結果',
  won: '受注確定',
  lost: '失注',
}

// =====================================================================
// テーブル型
// =====================================================================

export interface HomesTeam {
  id: string
  name: string
  leader_user_id: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface HomesUser {
  id: string
  auth_user_id: string | null
  email: string | null
  name: string
  role: UserRole
  team_id: string | null
  is_active: boolean
  zoom_phone_user_id: string | null
  created_at: string
  updated_at: string
}

export interface HomesArea {
  id: string
  prefecture: string
  city: string | null
  is_priority_area: boolean
  is_new_approval_area: boolean
  display_order: number
  created_at: string
}

export interface HomesList {
  id: string
  name: string
  source: string | null
  description: string | null
  total_count: number
  is_active: boolean
  imported_at: string | null
  // GAP-L: 2軸スコアリングのチューニング profile (existing/new × quality/size/potential/priority)
  score_profile: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface HomesApproval {
  id: string
  approval_no: string
  title: string | null
  discount_rate: number | null
  discount_amount: number | null
  applicable_area_ids: string[]
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface HomesCompany {
  id: string
  phone: string
  company_name: string
  fc_name: string | null
  list_id: string | null
  area: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  listing_status: string | null
  company_grade: string | null
  established_at: string | null
  capital: number | null
  revenue: number | null
  employees: number | null
  first_license_date: string | null
  takken_license_no: string | null
  homepage: string | null
  closed_days: string | null
  last_call_at: string | null
  call_restriction: CallRestriction
  call_count: number
  representative_name: string | null
  representative_phone: string | null
  representative_email: string | null
  contact_person_name: string | null
  contact_person_phone: string | null
  contact_person_email: string | null
  attack_target: 'representative' | 'decision_maker' | 'contact_person' | null
  prev_list_contact: string | null
  homes_usage: string | null
  athome_rent_count: number
  athome_sale_count: number
  suumo_rent_count: number
  suumo_sale_count: number
  other_media: string | null
  bulk_quote_media: string | null
  other_services: string | null
  staff_name: string | null
  staff_email: string | null
  main_business: string
  score_quality: number | null
  score_size: number | null
  score_potential: number | null
  score_priority: number | null
  assigned_user_id: string | null
  call_state: CallState
  status_note: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // GAP-F
  no_answer_count: number
  // GAP-L
  is_existing_publisher: boolean
  total_score: number
  score_calculated_at: string | null
}

export interface HomesActivity {
  id: string
  company_id: string
  user_id: string
  call_started_at: string
  call_ended_at: string | null
  call_duration_sec: number | null
  recording_url: string | null
  zoom_call_id: string | null
  result_primary: ResultPrimary
  responder_role: 'representative' | 'decision_maker' | 'contact_person' | null
  responder_name: string | null
  result_secondary: ResultSecondary | null
  appointment_date: string | null
  appointment_time: string | null
  appointment_type: 'phone' | 'web' | null
  closer_user_id: string | null
  appointment_kind: string | null
  handover_memo: string | null
  appointment_status: 'pending' | 'confirmed' | null
  recall_date: string | null
  recall_time: string | null
  keep_assignee: boolean
  ng_reason: string | null
  document_send_target: string | null
  operator_log: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface HomesDeal {
  id: string
  company_id: string
  list_id: string | null
  appointer_user_id: string | null
  closer_user_id: string | null
  appointed_at: string
  appointment_kind: string | null
  appointment_type: 'phone' | 'web' | null
  appointment_status: 'pending' | 'confirmed' | null
  attack_target: string | null
  contact_person_name: string | null
  // GAP-H: アポ4点
  contact_email: string | null
  is_decision_maker: boolean | null
  status: DealStatus
  reschedule_count: number
  reschedule_reason: string | null
  disappear_reason: string | null
  latest_meeting_id: string | null
  latest_meeting_at: string | null
  latest_yomi: Yomi | null
  contact_count: number
  priority: number | null
  category: string | null
  count: number | null
  notes: string | null
  approval_id: string | null
  is_priority_area: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface HomesMeeting {
  id: string
  deal_id: string
  closer_user_id: string | null
  meeting_seq: number
  scheduled_at: string | null
  meeting_type: 'phone' | 'web' | null
  status: 'done' | 'rescheduled' | 'disappeared' | 'pending_email' | 'pending_handoff'
  contact_person_name: string | null
  contact_person_role: string | null
  meeting_content: string | null
  next_content: string | null
  next_date: string | null
  meeting_result: string | null
  ng_reason: string | null
  proposal_plan: string | null
  sale_slot_count: number | null
  rent_slot_count: number | null
  options: string[] | null
  appraisal_max_count: number | null
  appraisal_types: string[] | null
  initial_fee: number | null
  running_fee: number | null
  running_discount_period_months: number | null
  yomi: Yomi | null
  yomi_rate: number | null
  issue_agreement: string | null
  meeting_period: string | null
  audit_date: string | null
  b_yomi_date: string | null
  a_yomi_date: string | null
  won_date: string | null
  lost_date: string | null
  lost_reason: string | null
  approval_id: string | null
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface HomesCollection {
  id: string
  deal_id: string
  meeting_id: string | null
  collector_user_id: string | null
  ba_remind_user_id: string | null
  ba_remind_date: string | null
  ba_remind_time: string | null
  confirm_mail_sent_at: string | null
  application_mail_sent_at: string | null
  expected_return_date: string | null
  irregular_handling: boolean
  collection_can_advance: boolean
  audit_request_date: string | null
  audit_document_no: string | null
  audit_result: 'pending' | 'ok' | 'exempt' | 'ng' | null
  billing_month: string | null
  ftp_status: string | null
  audit_issue: string | null
  dw_stored_at: string | null
  lifull_payload: Record<string, unknown>
  status: CollectionStatus
  is_anti_social_checked: boolean
  audit_progress: string | null
  docu_status: string | null
  cl_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface HomesOrder {
  id: string
  collection_id: string | null
  deal_id: string
  company_id: string
  ordered_at: string
  closer_user_id: string | null
  collector_user_id: string | null
  contact_block: Record<string, unknown>
  company_block: Record<string, unknown>
  billing_block: Record<string, unknown>
  appraisal_block: Record<string, unknown>
  other_block: Record<string, unknown>
  acceptance_block: Record<string, unknown>
  monthly_discount_count: number | null
  initial_fee: number | null
  monthly_fee: number | null
  location: string | null
  list_price_billing_start_month: string | null
  phone: string | null
  mlit_no: string | null
  product_kind: string | null
  proposal_plan: string | null
  approval_id: string | null
  lifull_opportunity_url: string | null
  lifull_docu_url: string | null
  metadata: Record<string, unknown>
  // GAP-O: 申込PDF
  application_pdf_url: string | null
  application_pdf_uploaded_at: string | null
  application_pdf_uploaded_by: string | null
  created_at: string
  updated_at: string
}

// =====================================================================
// GAP-D / GAP-K / GAP-L / GAP-N / GAP-P 用テーブル型
// =====================================================================

export interface HomesSetting {
  key: string
  value: unknown
  description: string | null
  updated_at: string
  updated_by: string | null
}

export interface HomesDispatchRule {
  id: string
  name: string
  priority: number
  is_active: boolean
  conditions: Record<string, unknown>
  target_team_id: string | null
  target_role: UserRole | null
  weight: number
  authored_by: string | null
  created_at: string
  updated_at: string
}

export interface HomesDispatchRun {
  id: string
  run_at: string
  total_companies: number
  assigned_count: number
  skipped_count: number
  status: 'pending' | 'running' | 'done' | 'failed'
  error: string | null
  details: Record<string, unknown> | null
}

export interface HomesNotification {
  id: string
  user_id: string
  kind: 'next_action_5min' | 'order_pdf_uploaded' | string
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  fired_at: string
  read_at: string | null
}

// GAP-I: アポ→クローザー手動振り分け (議事録 5.3)
// migration 20260503030000_p0_implementation.sql のスキーマに対応
export interface HomesHandoffAssignment {
  id: string
  meeting_id: string
  closer_user_id: string
  scheduled_at: string
  duration_minutes: number
  assigned_by: string | null
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  memo: string | null
  created_at: string
  updated_at: string
}

export interface HomesAuditSyncLog {
  id: string
  synced_at: string
  source: 'sheet' | 'recheck_cron' | string
  sheet_url: string | null
  rows_processed: number
  rows_updated: number
  rows_skipped: number
  status: string
  error: string | null
  details: Record<string, unknown> | null
}

export interface HomesMigrationLog {
  id: string
  migrated_at: string
  source: string
  mode: 'sample' | 'full'
  total: number
  succeeded: number
  failed: number
  errors: unknown
  notes: string | null
}

// GAP-H: アポ4点バリデーション結果
export interface AppointmentValidation {
  ok: boolean
  errors: Partial<Record<'datetime' | 'contact_name' | 'contact_email' | 'is_decision_maker', string>>
}

export function validateAppointment(input: {
  date: string | null | undefined
  time: string | null | undefined
  contact_name: string | null | undefined
  contact_email: string | null | undefined
  is_decision_maker: boolean | null | undefined
}): AppointmentValidation {
  const errors: AppointmentValidation['errors'] = {}
  if (!input.date || !input.time) errors.datetime = '商談日時を確定してください'
  if (!input.contact_name || input.contact_name.trim().length === 0) errors.contact_name = '担当者名は必須'
  if (!input.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)) errors.contact_email = '有効なメールアドレスが必要'
  if (input.is_decision_maker === null || input.is_decision_maker === undefined) errors.is_decision_maker = '決済者かどうか必須'
  return { ok: Object.keys(errors).length === 0, errors }
}

// GAP-E: 不在時必須入力バリデーション
export interface AbsenceValidation {
  ok: boolean
  errors: Partial<Record<'responder_name' | 'callback_at', string>>
}

export function validateAbsence(input: {
  responder_name: string | null | undefined
  recall_date: string | null | undefined
}): AbsenceValidation {
  const errors: AbsenceValidation['errors'] = {}
  if (!input.responder_name || input.responder_name.trim().length === 0) errors.responder_name = '先方氏名は必須 (議事録G-05)'
  if (!input.recall_date) errors.callback_at = '折返し日は必須 (議事録G-05)'
  return { ok: Object.keys(errors).length === 0, errors }
}

// =====================================================================
// ダッシュボード派生
// =====================================================================

export interface KuruStat {
  work_date: string
  user_id: string
  kuru: number
  calls: number
  contacts: number
  appointments: number
}

export interface TodayPersonal {
  user_id: string
  calls_today: number
  contacts_today: number
  appointments_today: number
  contact_rate_pct: number | null
  appointment_rate_pct: number | null
}

export interface YomiForecast {
  yomi: Yomi
  deal_count: number
  yomi_rate: number
  expected_won_count: number
}

export interface TeamStat {
  team_id: string
  team_name: string
  calls_total: number
  contacts_total: number
  appointments_total: number
}
