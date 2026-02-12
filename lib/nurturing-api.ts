// ナーチャリング・オートメーションAPI - 第4章
import { createClient as createSupabaseClient } from './supabase/client'

const supabase = createSupabaseClient()

// ====== 型定義 ======

export type DocumentTemplate = {
  id: string
  project_id: string
  name: string
  subject?: string
  body_template: string
  attachment_urls: string[]
  template_type: 'email' | 'dm' | 'letter'
  is_active: boolean
  created_at: string
}

export type DocumentSend = {
  id: string
  company_id: string
  call_log_id?: string
  template_id?: string
  operator_id?: string
  channel: 'email' | 'dm' | 'letter' | 'fax'
  recipient_email?: string
  subject?: string
  body?: string
  status: 'draft' | 'sent' | 'delivered' | 'bounced' | 'failed'
  sent_at: string
  delivered_at?: string
}

export type DocumentTrackingEvent = {
  id: string
  document_send_id: string
  event_type: 'open' | 'page_view' | 'link_click' | 'download' | 'forward'
  page_number?: number
  duration_seconds?: number
  tracked_at: string
}

export type EngagementScore = {
  id: string
  company_id: string
  project_id: string
  total_score: number
  call_score: number
  document_score: number
  web_activity_score: number
  social_score: number
  score_trend: 'rising' | 'stable' | 'declining'
  alert_level: 'none' | 'low' | 'medium' | 'high' | 'critical'
  last_activity_at?: string
  calculated_at: string
}

export type Appointment = {
  id: string
  company_id: string
  project_id: string
  operator_id?: string
  call_log_id?: string
  scheduled_at: string
  duration_minutes: number
  meeting_type: 'online' | 'onsite' | 'phone'
  meeting_url?: string
  status: 'tentative' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  assigned_sales_rep?: string
  sales_rep_email?: string
  google_calendar_event_id?: string
  notes?: string
  outcome?: string
  created_at: string
  updated_at: string
  // JOIN
  company?: { id: string; name: string; industry: string; phone?: string }
  project?: { id: string; name: string }
}

// ====== テンプレート管理 ======

export async function getDocumentTemplates(projectId: string): Promise<DocumentTemplate[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch document templates:', error)
    return []
  }
  return data || []
}

export async function createDocumentTemplate(
  input: Omit<DocumentTemplate, 'id' | 'created_at'>
): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .from('document_templates')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to create document template:', error)
    return null
  }
  return data
}

// ====== 資料送付 ======

export async function sendDocument(input: {
  company_id: string
  call_log_id?: string
  template_id?: string
  operator_id?: string
  channel: 'email' | 'dm' | 'letter' | 'fax'
  recipient_email?: string
  subject?: string
  body?: string
}): Promise<DocumentSend | null> {
  const { data, error } = await supabase
    .from('document_sends')
    .insert({
      ...input,
      status: 'sent',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to send document:', error)
    return null
  }

  // エンゲージメントスコア更新
  await updateEngagementScore(input.company_id, 'document_sent')

  return data
}

export async function getDocumentSends(params?: {
  company_id?: string
  operator_id?: string
}): Promise<DocumentSend[]> {
  let query = supabase
    .from('document_sends')
    .select('*')
    .order('sent_at', { ascending: false })

  if (params?.company_id) {
    query = query.eq('company_id', params.company_id)
  }
  if (params?.operator_id) {
    query = query.eq('operator_id', params.operator_id)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch document sends:', error)
    return []
  }
  return data || []
}

// ====== トラッキング ======

export async function trackDocumentEvent(input: {
  document_send_id: string
  event_type: 'open' | 'page_view' | 'link_click' | 'download' | 'forward'
  page_number?: number
  duration_seconds?: number
}): Promise<boolean> {
  const { error } = await supabase
    .from('document_tracking')
    .insert(input)

  if (error) {
    console.error('Failed to track document event:', error)
    return false
  }

  // 送付先のcompany_idを取得してスコア更新
  const { data: send } = await supabase
    .from('document_sends')
    .select('company_id')
    .eq('id', input.document_send_id)
    .single()

  if (send?.company_id) {
    await updateEngagementScore(send.company_id, `document_${input.event_type}`)
  }

  return true
}

export async function getDocumentTracking(sendId: string): Promise<DocumentTrackingEvent[]> {
  const { data, error } = await supabase
    .from('document_tracking')
    .select('*')
    .eq('document_send_id', sendId)
    .order('tracked_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch document tracking:', error)
    return []
  }
  return data || []
}

// ====== エンゲージメントスコア ======

export async function getEngagementScore(
  companyId: string,
  projectId: string
): Promise<EngagementScore | null> {
  const { data, error } = await supabase
    .from('engagement_scores')
    .select('*')
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to fetch engagement score:', error)
  }
  return data || null
}

export async function getHighEngagementCompanies(
  projectId: string,
  minScore: number = 60
): Promise<EngagementScore[]> {
  const { data, error } = await supabase
    .from('engagement_scores')
    .select('*')
    .eq('project_id', projectId)
    .gte('total_score', minScore)
    .order('total_score', { ascending: false })

  if (error) {
    console.error('Failed to fetch high engagement companies:', error)
    return []
  }
  return data || []
}

export async function updateEngagementScore(
  companyId: string,
  eventType: string
): Promise<void> {
  // スコア加算ルール
  const scoreMap: Record<string, { field: string; points: number }> = {
    'call_connected': { field: 'call_score', points: 10 },
    'call_appointment': { field: 'call_score', points: 30 },
    'document_sent': { field: 'document_score', points: 5 },
    'document_open': { field: 'document_score', points: 15 },
    'document_page_view': { field: 'document_score', points: 5 },
    'document_link_click': { field: 'document_score', points: 20 },
    'document_download': { field: 'document_score', points: 25 },
  }

  const scoreUpdate = scoreMap[eventType]
  if (!scoreUpdate) return

  // 既存スコアを取得
  const { data: existing } = await supabase
    .from('engagement_scores')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (existing) {
    const currentFieldScore = (existing as Record<string, number>)[scoreUpdate.field] || 0
    const newFieldScore = currentFieldScore + scoreUpdate.points
    const newTotal = (existing.total_score || 0) + scoreUpdate.points

    // トレンド判定
    const trend = scoreUpdate.points >= 15 ? 'rising' : 'stable'
    // アラートレベル判定
    let alertLevel: string = 'none'
    if (newTotal >= 80) alertLevel = 'critical'
    else if (newTotal >= 60) alertLevel = 'high'
    else if (newTotal >= 40) alertLevel = 'medium'
    else if (newTotal >= 20) alertLevel = 'low'

    await supabase
      .from('engagement_scores')
      .update({
        [scoreUpdate.field]: newFieldScore,
        total_score: newTotal,
        score_trend: trend,
        alert_level: alertLevel,
        last_activity_at: new Date().toISOString(),
        calculated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    // 新規作成（project_idを取得する必要あり）
    const { data: company } = await supabase
      .from('companies')
      .select('project_id')
      .eq('id', companyId)
      .single()

    if (company?.project_id) {
      await supabase
        .from('engagement_scores')
        .insert({
          company_id: companyId,
          project_id: company.project_id,
          [scoreUpdate.field]: scoreUpdate.points,
          total_score: scoreUpdate.points,
          score_trend: 'rising',
          alert_level: scoreUpdate.points >= 20 ? 'low' : 'none',
          last_activity_at: new Date().toISOString(),
        })
    }
  }
}

// ====== アポイント管理 ======

export async function getAppointments(params?: {
  project_id?: string
  operator_id?: string
  status?: string
  date_from?: string
  date_to?: string
}): Promise<Appointment[]> {
  let query = supabase
    .from('appointments')
    .select('*, company:companies(id, name, industry, phone), project:projects(id, name)')
    .order('scheduled_at', { ascending: true })

  if (params?.project_id) {
    query = query.eq('project_id', params.project_id)
  }
  if (params?.operator_id) {
    query = query.eq('operator_id', params.operator_id)
  }
  if (params?.status) {
    query = query.eq('status', params.status)
  }
  if (params?.date_from) {
    query = query.gte('scheduled_at', params.date_from)
  }
  if (params?.date_to) {
    query = query.lte('scheduled_at', params.date_to)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch appointments:', error)
    return []
  }
  return data || []
}

export async function createAppointment(input: {
  company_id: string
  project_id: string
  operator_id?: string
  call_log_id?: string
  scheduled_at: string
  duration_minutes?: number
  meeting_type?: 'online' | 'onsite' | 'phone'
  meeting_url?: string
  assigned_sales_rep?: string
  sales_rep_email?: string
  notes?: string
}): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      ...input,
      status: 'confirmed',
      duration_minutes: input.duration_minutes || 30,
      meeting_type: input.meeting_type || 'online',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create appointment:', error)
    return null
  }
  return data
}

export async function updateAppointment(
  id: string,
  input: Partial<Appointment>
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update appointment:', error)
    return null
  }
  return data
}
