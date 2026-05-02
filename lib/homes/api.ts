// TOGUNA HOME'S Supabase API クライアント (browser-side)
import { createClient } from '@/lib/supabase/client'
import type {
  HomesCompany,
  HomesActivity,
  HomesDeal,
  HomesMeeting,
  HomesCollection,
  HomesOrder,
  HomesUser,
  HomesTeam,
  HomesList,
  HomesApproval,
  KuruStat,
  TodayPersonal,
  YomiForecast,
  TeamStat,
  HomesSetting,
  HomesDispatchRule,
  HomesDispatchRun,
  HomesNotification,
  HomesAuditSyncLog,
  HomesMigrationLog,
} from './types'

const sb = () => createClient()

// =====================================================================
// Companies (M1)
// =====================================================================
export type CompanyFilters = {
  list_id?: string
  /** 複数リスト選択 (GAP-B: 14万件 × 40種類 マルチ絞り込み) */
  list_ids?: string[]
  prefecture?: string
  city?: string
  call_restriction?: string
  call_restrictions?: string[]
  call_state?: string
  call_states?: string[]
  priority_min?: number
  priority_max?: number
  capital_min?: number
  capital_max?: number
  revenue_min?: number
  revenue_max?: number
  employees_min?: number
  employees_max?: number
  established_year_min?: number
  established_year_max?: number
  call_count_min?: number
  call_count_max?: number
  last_call_from?: string         // ISO date
  last_call_to?: string           // ISO date
  last_call_is_null?: boolean     // true=未架電のみ
  main_business?: string
  listing_status?: string
  company_grade?: string
  has_takken?: boolean
  homes_usage?: string
  attack_target?: string
  assigned_user_id?: string
  unassigned?: boolean
  athome_min?: number
  suumo_min?: number
  q?: string                   // 法人名/電話/住所 部分一致
  q_email?: string
  q_representative?: string
  page?: number
  page_size?: number
  order_by?: keyof HomesCompany
  order_dir?: 'asc' | 'desc'
}

export async function listCompanies(filters: CompanyFilters = {}) {
  const {
    page = 1,
    page_size = 50,
    order_by = 'last_call_at',
    order_dir = 'asc',
  } = filters

  let q = sb().from('homes_companies').select('*', { count: 'exact' })

  if (filters.list_ids?.length) q = q.in('list_id', filters.list_ids)
  else if (filters.list_id) q = q.eq('list_id', filters.list_id)
  if (filters.prefecture) q = q.eq('prefecture', filters.prefecture)
  if (filters.city) q = q.eq('city', filters.city)
  if (filters.call_restriction) q = q.eq('call_restriction', filters.call_restriction)
  if (filters.call_restrictions?.length) q = q.in('call_restriction', filters.call_restrictions)
  if (filters.call_state) q = q.eq('call_state', filters.call_state)
  if (filters.call_states?.length) q = q.in('call_state', filters.call_states)
  if (filters.priority_min != null) q = q.gte('score_priority', filters.priority_min)
  if (filters.priority_max != null) q = q.lte('score_priority', filters.priority_max)
  if (filters.capital_min != null) q = q.gte('capital', filters.capital_min)
  if (filters.capital_max != null) q = q.lte('capital', filters.capital_max)
  if (filters.revenue_min != null) q = q.gte('revenue', filters.revenue_min)
  if (filters.revenue_max != null) q = q.lte('revenue', filters.revenue_max)
  if (filters.employees_min != null) q = q.gte('employees', filters.employees_min)
  if (filters.employees_max != null) q = q.lte('employees', filters.employees_max)
  if (filters.established_year_min != null) q = q.gte('established_at', `${filters.established_year_min}-01-01`)
  if (filters.established_year_max != null) q = q.lte('established_at', `${filters.established_year_max}-12-31`)
  if (filters.call_count_min != null) q = q.gte('call_count', filters.call_count_min)
  if (filters.call_count_max != null) q = q.lte('call_count', filters.call_count_max)
  if (filters.last_call_is_null) q = q.is('last_call_at', null)
  else {
    if (filters.last_call_from) q = q.gte('last_call_at', filters.last_call_from)
    if (filters.last_call_to) q = q.lte('last_call_at', filters.last_call_to)
  }
  if (filters.main_business) q = q.eq('main_business', filters.main_business)
  if (filters.listing_status) q = q.eq('listing_status', filters.listing_status)
  if (filters.company_grade) q = q.eq('company_grade', filters.company_grade)
  if (filters.has_takken === true) q = q.not('takken_license_no', 'is', null)
  if (filters.has_takken === false) q = q.is('takken_license_no', null)
  if (filters.homes_usage) q = q.eq('homes_usage', filters.homes_usage)
  if (filters.attack_target) q = q.eq('attack_target', filters.attack_target)
  if (filters.assigned_user_id) q = q.eq('assigned_user_id', filters.assigned_user_id)
  if (filters.unassigned) q = q.is('assigned_user_id', null)
  if (filters.athome_min != null) {
    q = q.or(`athome_rent_count.gte.${filters.athome_min},athome_sale_count.gte.${filters.athome_min}`)
  }
  if (filters.suumo_min != null) {
    q = q.or(`suumo_rent_count.gte.${filters.suumo_min},suumo_sale_count.gte.${filters.suumo_min}`)
  }
  if (filters.q) {
    const safe = filters.q.replace(/[%_,()]/g, '')
    q = q.or(
      `company_name.ilike.%${safe}%,phone.ilike.%${safe}%,address.ilike.%${safe}%`,
    )
  }
  if (filters.q_email) {
    const safe = filters.q_email.replace(/[%_,()]/g, '')
    q = q.or(`representative_email.ilike.%${safe}%,contact_person_email.ilike.%${safe}%,staff_email.ilike.%${safe}%`)
  }
  if (filters.q_representative) {
    const safe = filters.q_representative.replace(/[%_,()]/g, '')
    q = q.or(`representative_name.ilike.%${safe}%,contact_person_name.ilike.%${safe}%`)
  }
  q = q.order(order_by as string, { ascending: order_dir === 'asc', nullsFirst: order_dir === 'asc' })
    .range((page - 1) * page_size, page * page_size - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []) as HomesCompany[], total: count ?? 0 }
}

export async function getCompany(id: string) {
  const { data, error } = await sb().from('homes_companies').select('*').eq('id', id).single()
  if (error) throw error
  return data as HomesCompany
}

export async function upsertCompany(input: Partial<HomesCompany>) {
  const { data, error } = await sb().from('homes_companies').upsert(input).select().single()
  if (error) throw error
  return data as HomesCompany
}

export async function bulkUpdateCompanies(ids: string[], patch: Partial<HomesCompany>) {
  const { data, error } = await sb()
    .from('homes_companies')
    .update(patch)
    .in('id', ids)
    .select()
  if (error) throw error
  return data as HomesCompany[]
}

export async function nextDialTarget(userId: string, minIntervalHours = 24) {
  const { data, error } = await sb().rpc('homes_next_dial_target', {
    p_user_id: userId,
    p_min_interval_hours: minIntervalHours,
  })
  if (error) throw error
  return (data?.[0] ?? null) as HomesCompany | null
}

// =====================================================================
// Activities (M2)
// =====================================================================
export async function createActivity(input: Partial<HomesActivity>) {
  const { data, error } = await sb().from('homes_activities').insert(input).select().single()
  if (error) throw error
  return data as HomesActivity
}

export async function listActivitiesByCompany(companyId: string) {
  const { data, error } = await sb()
    .from('homes_activities')
    .select('*')
    .eq('company_id', companyId)
    .order('call_started_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as HomesActivity[]
}

export async function listActivitiesByUserToday(userId: string) {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { data, error } = await sb()
    .from('homes_activities')
    .select('*')
    .eq('user_id', userId)
    .gte('call_started_at', since.toISOString())
    .order('call_started_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as HomesActivity[]
}

// =====================================================================
// Deals (M3)
// =====================================================================
export async function listDeals(filters: { status?: string; closer_user_id?: string; q?: string } = {}) {
  let q = sb()
    .from('homes_deals')
    .select('*, homes_companies!inner(*), homes_lists(*), appointer:homes_users!appointer_user_id(*), closer:homes_users!closer_user_id(*)')
    .order('appointed_at', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.closer_user_id) q = q.eq('closer_user_id', filters.closer_user_id)
  if (filters.q) q = q.ilike('homes_companies.company_name', `%${filters.q}%`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getDeal(id: string) {
  const { data, error } = await sb()
    .from('homes_deals')
    .select('*, homes_companies(*), homes_lists(*), appointer:homes_users!appointer_user_id(*), closer:homes_users!closer_user_id(*), homes_meetings(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateDeal(id: string, patch: Partial<HomesDeal>) {
  const { data, error } = await sb().from('homes_deals').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as HomesDeal
}

// =====================================================================
// Meetings (M4)
// =====================================================================
export async function createMeeting(input: Partial<HomesMeeting>) {
  const { data, error } = await sb().from('homes_meetings').insert(input).select().single()
  if (error) throw error
  return data as HomesMeeting
}

export async function listMeetingsByDeal(dealId: string) {
  const { data, error } = await sb()
    .from('homes_meetings')
    .select('*')
    .eq('deal_id', dealId)
    .order('meeting_seq', { ascending: true })
  if (error) throw error
  return (data ?? []) as HomesMeeting[]
}

export async function listMeetingsToday(closerUserId?: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  let q = sb()
    .from('homes_meetings')
    .select('*, homes_deals!inner(*, homes_companies(*))')
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true })
  if (closerUserId) q = q.eq('closer_user_id', closerUserId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// =====================================================================
// Collections (M5)
// =====================================================================
export async function listCollections(filters: { collector_user_id?: string; status?: string; remind_today?: boolean } = {}) {
  let q = sb()
    .from('homes_collections')
    .select('*, homes_deals!inner(*, homes_companies(*)), homes_users!collector_user_id(*)')
    .order('ba_remind_date', { ascending: true, nullsFirst: false })

  if (filters.collector_user_id) q = q.eq('collector_user_id', filters.collector_user_id)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.remind_today) {
    const today = new Date().toISOString().slice(0, 10)
    q = q.eq('ba_remind_date', today)
  }
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function updateCollection(id: string, patch: Partial<HomesCollection>) {
  const { data, error } = await sb().from('homes_collections').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as HomesCollection
}

// =====================================================================
// Orders
// =====================================================================
export async function createOrder(input: Partial<HomesOrder>) {
  const { data, error } = await sb().from('homes_orders').insert(input).select().single()
  if (error) throw error
  return data as HomesOrder
}

export async function listOrders(filters: { since?: string } = {}) {
  let q = sb()
    .from('homes_orders')
    .select('*, homes_companies(*)')
    .order('ordered_at', { ascending: false })
  if (filters.since) q = q.gte('ordered_at', filters.since)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// =====================================================================
// Users / Teams / Lists / Approvals
// =====================================================================
export async function listUsers(filters: { role?: string } = {}) {
  let q = sb().from('homes_users').select('*, homes_teams!homes_users_team_id_fkey(*)').eq('is_active', true).order('name')
  if (filters.role) q = q.eq('role', filters.role)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getCurrentHomesUser(): Promise<HomesUser | null> {
  const supabase = sb()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from('homes_users')
    .select('*')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()
  return (data ?? null) as HomesUser | null
}

export async function listTeams() {
  const { data, error } = await sb().from('homes_teams').select('*').order('display_order')
  if (error) throw error
  return (data ?? []) as HomesTeam[]
}

export async function listLists() {
  const { data, error } = await sb().from('homes_lists').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return (data ?? []) as HomesList[]
}

export async function listApprovals() {
  const { data, error } = await sb().from('homes_approvals').select('*').eq('is_active', true).order('approval_no')
  if (error) throw error
  return (data ?? []) as HomesApproval[]
}

// =====================================================================
// ダッシュボード派生
// =====================================================================
export async function getKuruStats(date?: string) {
  const target = date ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await sb()
    .from('homes_v_kuru_stats')
    .select('*')
    .gte('work_date', target)
    .lt('work_date', new Date(new Date(target).getTime() + 86400000).toISOString().slice(0, 10))
  if (error) throw error
  return (data ?? []) as KuruStat[]
}

export async function getTodayPersonal() {
  const { data, error } = await sb().from('homes_v_today_personal').select('*')
  if (error) throw error
  return (data ?? []) as TodayPersonal[]
}

export async function getYomiForecast() {
  const { data, error } = await sb().from('homes_v_yomi_forecast').select('*')
  if (error) throw error
  return (data ?? []) as YomiForecast[]
}

export async function getTeamStats() {
  const { data, error } = await sb().from('homes_v_team_stats').select('*')
  if (error) throw error
  return (data ?? []) as TeamStat[]
}

// =====================================================================
// GAP-D: 設定 (営業時間・閾値)
// =====================================================================
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await sb().from('homes_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return (data?.value ?? null) as T | null
}

export async function listSettings() {
  const { data, error } = await sb().from('homes_settings').select('*').order('key')
  if (error) throw error
  return (data ?? []) as HomesSetting[]
}

export async function upsertSetting(key: string, value: unknown, description?: string) {
  const { data, error } = await sb()
    .from('homes_settings')
    .upsert({ key, value, description: description ?? null, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as HomesSetting
}

// =====================================================================
// GAP-K: AI 割り振りルール
// =====================================================================
export async function listDispatchRules() {
  const { data, error } = await sb()
    .from('homes_dispatch_rules')
    .select('*')
    .order('priority', { ascending: false })
  if (error) throw error
  return (data ?? []) as HomesDispatchRule[]
}

export async function upsertDispatchRule(input: Partial<HomesDispatchRule>) {
  const { data, error } = await sb().from('homes_dispatch_rules').upsert(input).select().single()
  if (error) throw error
  return data as HomesDispatchRule
}

export async function listDispatchRuns(limit = 20) {
  const { data, error } = await sb()
    .from('homes_dispatch_runs')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as HomesDispatchRun[]
}

// =====================================================================
// GAP-N: 通知
// =====================================================================
export async function listNotifications(userId: string, unreadOnly = true) {
  let q = sb().from('homes_notifications').select('*').eq('user_id', userId).order('fired_at', { ascending: false })
  if (unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q.limit(50)
  if (error) throw error
  return (data ?? []) as HomesNotification[]
}

export async function markNotificationRead(id: string) {
  const { error } = await sb().from('homes_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function createNotification(input: Partial<HomesNotification>) {
  const { data, error } = await sb().from('homes_notifications').insert(input).select().single()
  if (error) throw error
  return data as HomesNotification
}

// =====================================================================
// GAP-N: ネクストアクション 5分前監視 (本人のみ)
// recall_date/recall_time + appointment_date/appointment_time を見る
// =====================================================================
export async function listUpcomingActionsForUser(userId: string) {
  const now = new Date()
  const tenMinLater = new Date(now.getTime() + 10 * 60 * 1000)
  const today = now.toISOString().slice(0, 10)
  const { data, error } = await sb()
    .from('homes_activities')
    .select('id, company_id, recall_date, recall_time, appointment_date, appointment_time, result_secondary, homes_companies(company_name)')
    .eq('user_id', userId)
    .or(`recall_date.eq.${today},appointment_date.eq.${today}`)
  if (error) throw error
  return (data ?? []).filter((a: any) => {
    const dt = a.result_secondary === 'recall' ? `${a.recall_date}T${a.recall_time ?? '00:00'}` : `${a.appointment_date}T${a.appointment_time ?? '00:00'}`
    const t = new Date(dt)
    return t >= now && t <= tenMinLater
  })
}

// =====================================================================
// GAP-P: 審査スプシ連携ログ
// =====================================================================
export async function listAuditSyncLogs(limit = 30) {
  const { data, error } = await sb()
    .from('homes_audit_sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as HomesAuditSyncLog[]
}

// =====================================================================
// GAP-J: 移行ログ
// =====================================================================
export async function listMigrationLogs(limit = 30) {
  const { data, error } = await sb()
    .from('homes_migration_log')
    .select('*')
    .order('migrated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as HomesMigrationLog[]
}

// =====================================================================
// GAP-A: ユーザー一括登録
// =====================================================================
export async function bulkInsertUsers(rows: Array<Partial<HomesUser>>) {
  const { data, error } = await sb().from('homes_users').upsert(rows).select()
  if (error) throw error
  return (data ?? []) as HomesUser[]
}

// =====================================================================
// GAP-I: クローザー空き状況
// =====================================================================
export async function getCloserAvailability(date: string) {
  const start = `${date}T00:00:00+09:00`
  const end = `${date}T23:59:59+09:00`
  const closersRes = await sb().from('homes_users').select('*').eq('role', 'CLOSER').eq('is_active', true)
  const dealsRes = await sb()
    .from('homes_deals')
    .select('closer_user_id, appointed_at, status')
    .gte('appointed_at', start)
    .lte('appointed_at', end)
  if (closersRes.error) throw closersRes.error
  if (dealsRes.error) throw dealsRes.error
  const closers = (closersRes.data ?? []) as HomesUser[]
  const deals = (dealsRes.data ?? []) as Array<{ closer_user_id: string | null; appointed_at: string; status: string }>
  return closers.map((c) => ({
    closer: c,
    booked_count: deals.filter((d) => d.closer_user_id === c.id).length,
    booked_slots: deals.filter((d) => d.closer_user_id === c.id).map((d) => d.appointed_at),
  }))
}

// =====================================================================
// GAP-O: 申込PDFアップ
// =====================================================================
export async function uploadApplicationPdf(orderId: string, file: File, uploadedBy: string) {
  const supabase = sb()
  const path = `${orderId}/${Date.now()}_${file.name}`
  const { error: upErr } = await supabase.storage.from('application-forms').upload(path, file, { upsert: false })
  if (upErr) throw upErr
  const { data: urlData } = supabase.storage.from('application-forms').getPublicUrl(path)
  const { data, error } = await supabase
    .from('homes_orders')
    .update({
      application_pdf_url: urlData.publicUrl,
      application_pdf_uploaded_at: new Date().toISOString(),
      application_pdf_uploaded_by: uploadedBy,
    })
    .eq('id', orderId)
    .select()
    .single()
  if (error) throw error
  // 通知 (Edge Function に投げる)
  try {
    await fetch('/api/notify-order-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
  } catch {
    // 通知失敗はsilent (アップ自体は成功)
  }
  return data as HomesOrder
}

// =====================================================================
// B-02: list-progress 1クエリ集計 (homes_list_progress_view)
// =====================================================================
export interface ListProgressRow {
  list_id: string
  name: string
  source: string | null
  list_total_count: number
  total: number
  untouched: number
  dialed: number
  contacted: number
  appointed: number
  ng: number
  low_priority: number
}

export async function listListProgress(): Promise<ListProgressRow[]> {
  const { data, error } = await sb()
    .from('homes_list_progress_view')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as ListProgressRow[]
}

// =====================================================================
// B-03: conversion 1クエリ集計 (homes_user_conversion_view)
// =====================================================================
export interface UserConversionRow {
  user_id: string
  user_name: string
  role: string
  team_id: string | null
  calls_30d: number
  connected_30d: number
  contacted_30d: number
  appointed_30d: number
  won_30d: number
}

export async function listUserConversion(): Promise<UserConversionRow[]> {
  const { data, error } = await sb()
    .from('homes_user_conversion_view')
    .select('*')
    .order('user_name')
  if (error) throw error
  return (data ?? []) as UserConversionRow[]
}
