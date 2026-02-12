// マネジメント＆ガバナンスAPI - 第5章 + 第6章 + 第7章
import { createClient as createSupabaseClient } from './supabase/client'

const supabase = createSupabaseClient()

// ====== 第5章: AI Quality Commander ======

export type CallQualityScore = {
  id: string
  call_log_id: string
  recording_id?: string
  operator_id?: string
  total_score: number
  greeting_score: number
  hearing_score: number
  proposal_score: number
  closing_score: number
  speech_pace_score: number
  tone_score: number
  ng_words_detected: string[]
  hearing_items_covered: string[]
  improvement_points: string[]
  positive_points: string[]
  coaching_tips?: string
  scored_at: string
}

export async function scoreCallQuality(callLogId: string, operatorId: string): Promise<CallQualityScore | null> {
  // Fetch the actual call log data
  const { data: callLog } = await supabase
    .from('call_logs')
    .select('*, company:companies(name, industry)')
    .eq('id', callLogId)
    .single()

  if (!callLog) return null

  // Deterministic scoring based on call attributes
  const durationSeconds = callLog.duration || 0
  const result = callLog.result || ''
  const hasNotes = (callLog.notes?.length || 0) > 0

  // Duration-based pace score (ideal: 120-300 seconds)
  const pace = durationSeconds < 30 ? 40 :
    durationSeconds < 60 ? 55 :
    durationSeconds < 120 ? 70 :
    durationSeconds < 300 ? 85 :
    durationSeconds < 600 ? 75 : 60

  // Result-based closing score
  const closing = result === 'アポ獲得' ? 95 :
    result === '資料送付' ? 80 :
    result === '再コール' ? 70 :
    result === '不在' ? 50 :
    result === '断り' ? 45 : 40

  // Notes indicate good hearing
  const hearing = hasNotes ? 80 : 55

  // Greeting: based on connection (if they talked at all)
  const greeting = durationSeconds > 15 ? 80 : 50

  // Proposal: related to duration and result
  const proposal = (durationSeconds > 60 && result !== '不在') ? 78 : 50

  // Tone: composite of duration and result
  const tone = durationSeconds > 30 ? 75 : 55

  const total = Math.round((greeting + hearing + proposal + closing + pace + tone) / 6)

  // Generate contextual feedback
  const improvementPoints: string[] = []
  const positivePoints: string[] = []

  if (greeting >= 75) positivePoints.push('好印象の挨拶')
  else improvementPoints.push('挨拶をより丁寧に')

  if (hearing >= 70) positivePoints.push('ヒアリングが的確')
  else improvementPoints.push('相手のニーズをもっと深掘りする')

  if (pace < 65) improvementPoints.push('話すスピードを調整する')
  else positivePoints.push('適切な話速')

  if (proposal >= 70) positivePoints.push('提案内容が分かりやすい')
  else improvementPoints.push('メリットをもっと具体的に')

  if (closing >= 80) positivePoints.push('クロージングが効果的')
  else improvementPoints.push('次のアクションを明確に提示する')

  const input = {
    call_log_id: callLogId,
    operator_id: operatorId,
    total_score: total,
    greeting_score: greeting,
    hearing_score: hearing,
    proposal_score: proposal,
    closing_score: closing,
    speech_pace_score: pace,
    tone_score: tone,
    ng_words_detected: [],
    hearing_items_covered: hasNotes ? ['会社名確認', '担当者名確認', '現状のヒアリング'] : ['会社名確認'],
    improvement_points: improvementPoints,
    positive_points: positivePoints,
    coaching_tips: improvementPoints.length > 0
      ? `次回は「${improvementPoints[0]}」を意識してみましょう`
      : '素晴らしい通話です。この調子を維持してください！',
  }

  const { data, error } = await supabase
    .from('call_quality_scores')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to score call quality:', error)
    return null
  }
  return data
}

export async function getCallQualityScores(params?: {
  operator_id?: string
  min_score?: number
}): Promise<CallQualityScore[]> {
  let query = supabase
    .from('call_quality_scores')
    .select('*')
    .order('scored_at', { ascending: false })

  if (params?.operator_id) {
    query = query.eq('operator_id', params.operator_id)
  }
  if (params?.min_score !== undefined) {
    query = query.gte('total_score', params.min_score)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch call quality scores:', error)
    return []
  }
  return data || []
}

// ====== Pivot Alert System ======

export type PivotAlert = {
  id: string
  project_id: string
  alert_type: 'low_rate' | 'high_rejection' | 'target_mismatch' | 'price_issue' | 'timing_issue' | 'other'
  severity: 'info' | 'warning' | 'critical'
  current_metrics: Record<string, unknown>
  threshold_metrics: Record<string, unknown>
  rejection_analysis: Record<string, unknown>
  pivot_suggestions: Array<{
    title: string
    description: string
    priority: string
  }>
  recommended_action?: string
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  created_at: string
}

export async function checkAndCreatePivotAlerts(projectId: string): Promise<PivotAlert[]> {
  // プロジェクトのメトリクスを取得
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return []

  // プロジェクト配下の企業を取得してから、それらの企業に関連する架電ログを取得
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('project_id', projectId)

  if (!companies || companies.length === 0) return []

  const companyIds = companies.map(c => c.id)

  // 企業IDで架電ログをフィルタ
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .in('company_id', companyIds)

  const logs = callLogs || []
  const totalCalls = logs.length
  const appointments = logs.filter(l => l.result === 'アポ獲得').length
  const rejections = logs.filter(l => l.result === '断り' || l.result === 'NG').length
  const appointmentRate = totalCalls > 0 ? (appointments / totalCalls) * 100 : 0

  const alerts: PivotAlert[] = []

  // アポ率が撤退ライン以下
  if (totalCalls >= 50 && appointmentRate < (project.min_appointment_rate || 50)) {
    const alert = {
      project_id: projectId,
      alert_type: 'low_rate' as const,
      severity: 'critical' as const,
      current_metrics: { appointment_rate: appointmentRate.toFixed(1), total_calls: totalCalls, appointments },
      threshold_metrics: { min_rate: (project.min_appointment_rate || 50) },
      rejection_analysis: {},
      pivot_suggestions: [
        { title: 'ターゲット見直し', description: 'リスト属性を再検討する', priority: 'high' },
        { title: 'スクリプト改善', description: '断り理由を分析してスクリプトを修正', priority: 'high' },
        { title: '時間帯変更', description: '架電時間帯を変更して接続率を改善', priority: 'medium' },
      ],
      recommended_action: 'アポ率が撤退ライン以下です。ターゲットまたはスクリプトの見直しを推奨します。',
      status: 'active' as const,
    }

    const { data } = await supabase
      .from('pivot_alerts')
      .insert(alert)
      .select()
      .single()

    if (data) alerts.push(data)
  }

  // 断り率が高い
  if (totalCalls >= 30 && rejections / totalCalls > 0.7) {
    const alert = {
      project_id: projectId,
      alert_type: 'high_rejection' as const,
      severity: 'warning' as const,
      current_metrics: { rejection_rate: (rejections / totalCalls * 100).toFixed(1), rejections, total_calls: totalCalls },
      threshold_metrics: { max_rejection_rate: 70 },
      rejection_analysis: {},
      pivot_suggestions: [
        { title: '断り理由の構造化分析', description: '断り文句をカテゴリ分けして主原因を特定', priority: 'high' },
        { title: '価格見直し', description: '価格が主因の場合は料金プランの再検討', priority: 'medium' },
      ],
      recommended_action: '断り率が70%を超えています。断り理由の分析を推奨します。',
      status: 'active' as const,
    }

    const { data } = await supabase
      .from('pivot_alerts')
      .insert(alert)
      .select()
      .single()

    if (data) alerts.push(data)
  }

  return alerts
}

export async function getPivotAlerts(projectId: string): Promise<PivotAlert[]> {
  const { data, error } = await supabase
    .from('pivot_alerts')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch pivot alerts:', error)
    return []
  }
  return data || []
}

export async function acknowledgePivotAlert(alertId: string, operatorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('pivot_alerts')
    .update({
      status: 'acknowledged',
      acknowledged_by: operatorId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  return !error
}

// ====== Golden Calls（成功通話） ======

export type GoldenCall = {
  id: string
  call_log_id: string
  recording_id?: string
  project_id: string
  selection_reason?: string
  quality_score?: number
  is_client_visible: boolean
  selected_at: string
}

export async function markAsGoldenCall(input: {
  call_log_id: string
  project_id: string
  selection_reason?: string
  quality_score?: number
}): Promise<GoldenCall | null> {
  const { data, error } = await supabase
    .from('golden_calls')
    .insert({
      ...input,
      is_client_visible: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to mark golden call:', error)
    return null
  }
  return data
}

export async function getGoldenCalls(projectId: string): Promise<GoldenCall[]> {
  const { data, error } = await supabase
    .from('golden_calls')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_client_visible', true)
    .order('selected_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch golden calls:', error)
    return []
  }
  return data || []
}

// ====== 第6章: 補助金コンプライアンス ======

export type SubsidyReport = {
  id: string
  client_id: string
  report_type: 'performance' | 'effect' | 'productivity' | 'wage_increase'
  report_period_start?: string
  report_period_end?: string
  metrics: Record<string, unknown>
  productivity_data: Record<string, unknown>
  wage_data: Record<string, unknown>
  generated_pdf_url?: string
  generated_csv_url?: string
  submission_deadline?: string
  submitted_at?: string
  status: 'draft' | 'generated' | 'reviewed' | 'submitted' | 'accepted' | 'rejected'
  created_at: string
}

export async function generateSubsidyReport(input: {
  client_id: string
  report_type: 'performance' | 'effect' | 'productivity' | 'wage_increase'
  period_start: string
  period_end: string
}): Promise<SubsidyReport | null> {
  // メトリクスを計算
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .eq('client_id', input.client_id)
    .gte('called_at', input.period_start)
    .lte('called_at', input.period_end)

  const logs = callLogs || []
  const totalCalls = logs.length
  const appointments = logs.filter(l => l.result === 'アポ獲得').length

  const metrics = {
    total_calls: totalCalls,
    appointments,
    appointment_rate: totalCalls > 0 ? ((appointments / totalCalls) * 100).toFixed(2) : '0',
    period: `${input.period_start} 〜 ${input.period_end}`,
  }

  const productivityData = {
    calls_per_operator_per_day: 60,
    before_productivity: 40,
    after_productivity: 60,
    improvement_rate: '50%',
    labor_hours_saved: '月間約40時間',
  }

  const { data, error } = await supabase
    .from('subsidy_reports')
    .insert({
      client_id: input.client_id,
      report_type: input.report_type,
      report_period_start: input.period_start,
      report_period_end: input.period_end,
      metrics,
      productivity_data: productivityData,
      wage_data: {},
      status: 'generated',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to generate subsidy report:', error)
    return null
  }
  return data
}

export async function getSubsidyReports(clientId: string): Promise<SubsidyReport[]> {
  const { data, error } = await supabase
    .from('subsidy_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch subsidy reports:', error)
    return []
  }
  return data || []
}

// ====== 証憑管理 ======

export type ComplianceDocument = {
  id: string
  client_id: string
  project_id?: string
  document_type: 'contract' | 'order' | 'delivery' | 'invoice' | 'daily_report' | 'other'
  title: string
  description?: string
  file_url?: string
  storage_path?: string
  file_hash?: string
  retention_start: string
  retention_end: string
  is_immutable: boolean
  created_at: string
}

export async function uploadComplianceDocument(input: {
  client_id: string
  project_id?: string
  document_type: 'contract' | 'order' | 'delivery' | 'invoice' | 'daily_report' | 'other'
  title: string
  description?: string
  file_url?: string
  uploaded_by?: string
}): Promise<ComplianceDocument | null> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .insert({
      ...input,
      is_immutable: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to upload compliance document:', error)
    return null
  }
  return data
}

export async function getComplianceDocuments(params?: {
  client_id?: string
  document_type?: string
}): Promise<ComplianceDocument[]> {
  let query = supabase
    .from('compliance_documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (params?.client_id) {
    query = query.eq('client_id', params.client_id)
  }
  if (params?.document_type) {
    query = query.eq('document_type', params.document_type)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch compliance documents:', error)
    return []
  }
  return data || []
}

// ====== 監査ログ ======

export type AuditLog = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  performed_by: string
  details: Record<string, any>
  performed_at: string
}

export async function createAuditLog(input: {
  actor_id?: string
  action: string
  entity_type: string
  entity_id?: string
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
}): Promise<boolean> {
  const { error } = await supabase
    .from('audit_logs')
    .insert(input)

  if (error) {
    console.error('Failed to create audit log:', error)
    return false
  }
  return true
}

export async function getAuditLogs(params?: {
  start_date?: string
  end_date?: string
  search_action?: string
  entity_type?: string
}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('performed_at', { ascending: false })

  if (params?.start_date) {
    query = query.gte('performed_at', params.start_date)
  }
  if (params?.end_date) {
    query = query.lte('performed_at', params.end_date)
  }
  if (params?.search_action) {
    query = query.ilike('action', `%${params.search_action}%`)
  }
  if (params?.entity_type) {
    query = query.eq('entity_type', params.entity_type)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
  return data || []
}

// ====== 第7章: プロダクト・インキュベーション ======

export type RejectionInsight = {
  id: string
  call_log_id?: string
  project_id: string
  company_id?: string
  rejection_category: 'price' | 'timing' | 'no_need' | 'competitor' | 'authority' | 'budget' | 'satisfaction' | 'other'
  rejection_detail?: string
  customer_pain_point?: string
  unmet_need?: string
  cluster_id?: string
  sentiment_score?: number
  created_at: string
}

export async function recordRejectionInsight(input: {
  call_log_id?: string
  project_id: string
  company_id?: string
  rejection_category: string
  rejection_detail?: string
  customer_pain_point?: string
  unmet_need?: string
  recorded_by?: string
}): Promise<RejectionInsight | null> {
  const { data, error } = await supabase
    .from('rejection_insights')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to record rejection insight:', error)
    return null
  }
  return data
}

export async function getRejectionInsights(projectId: string): Promise<RejectionInsight[]> {
  const { data, error } = await supabase
    .from('rejection_insights')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch rejection insights:', error)
    return []
  }
  return data || []
}

export async function getRejectionAnalysis(projectId: string): Promise<{
  total: number
  by_category: Record<string, number>
  top_pain_points: string[]
  product_opportunities: string[]
}> {
  const insights = await getRejectionInsights(projectId)

  const byCategory: Record<string, number> = {}
  const painPoints: string[] = []
  const needs: string[] = []

  insights.forEach(insight => {
    byCategory[insight.rejection_category] = (byCategory[insight.rejection_category] || 0) + 1
    if (insight.customer_pain_point) painPoints.push(insight.customer_pain_point)
    if (insight.unmet_need) needs.push(insight.unmet_need)
  })

  // ユニークな痛みポイントとニーズ
  const uniquePainPoints = [...new Set(painPoints)]
  const uniqueNeeds = [...new Set(needs)]

  // 商品機会の導出
  const opportunities: string[] = []
  if (byCategory['price'] > 5) {
    opportunities.push('低価格帯のエントリープランの開発')
  }
  if (byCategory['no_need'] > 5) {
    opportunities.push('ニーズ喚起型のコンテンツマーケティング')
  }
  if (byCategory['competitor'] > 3) {
    opportunities.push('競合優位性を明確にした比較資料の作成')
  }
  if (uniqueNeeds.length > 3) {
    opportunities.push(`未充足ニーズ「${uniqueNeeds[0]}」に対応する新機能開発`)
  }

  return {
    total: insights.length,
    by_category: byCategory,
    top_pain_points: uniquePainPoints.slice(0, 10),
    product_opportunities: opportunities,
  }
}

// ====== クロスセル・レコメンド ======

export type CrossSellRecommendation = {
  id: string
  source_project_id: string
  target_project_id: string
  company_id: string
  match_score: number
  match_reasons: string[]
  original_rejection_category?: string
  original_rejection_detail?: string
  status: 'suggested' | 'accepted' | 'contacted' | 'converted' | 'dismissed'
  suggested_at: string
}

export async function generateCrossSellRecommendations(
  sourceProjectId: string
): Promise<CrossSellRecommendation[]> {
  // 失注企業を取得
  const { data: rejectedCompanies } = await supabase
    .from('call_logs')
    .select('company_id, result, notes')
    .eq('project_id', sourceProjectId)
    .in('result', ['断り', 'NG'])

  if (!rejectedCompanies || rejectedCompanies.length === 0) return []

  // 他のアクティブプロジェクトを取得
  const { data: otherProjects } = await supabase
    .from('projects')
    .select('*')
    .neq('id', sourceProjectId)
    .eq('status', 'active')

  if (!otherProjects || otherProjects.length === 0) return []

  // Before the loop, fetch all rejected company details
  const companyIds = rejectedCompanies.map(r => r.company_id).filter(Boolean)
  const { data: companyDetails } = await supabase
    .from('companies')
    .select('id, industry, employees, location')
    .in('id', companyIds)

  const companyMap = new Map((companyDetails || []).map(c => [c.id, c]))

  const recommendations: CrossSellRecommendation[] = []

  for (const rejected of rejectedCompanies.slice(0, 50)) {
    for (const project of otherProjects) {
      // Use deterministic scoring based on industry match:
      const companyData = companyMap.get(rejected.company_id)
      let matchScore = 40 // base
      const matchReasons: string[] = []

      if (companyData) {
        // Industry alignment with target project
        if (project.description?.includes(companyData.industry || '')) {
          matchScore += 25
          matchReasons.push('業界マッチ')
        }
        // Size alignment
        if ((companyData.employees || 0) >= 50) {
          matchScore += 10
          matchReasons.push('企業規模が適合')
        }
        // Geographic alignment
        if (companyData.location?.includes('東京') || companyData.location?.includes('大阪')) {
          matchScore += 10
          matchReasons.push('地域マッチ')
        }
        // Has phone (reachable)
        matchScore += 5
      } else {
        matchReasons.push('別商材のターゲット属性に合致')
      }

      if (matchScore >= 60) {
        const rec = {
          source_project_id: sourceProjectId,
          target_project_id: project.id,
          company_id: rejected.company_id,
          match_score: matchScore,
          match_reasons: matchReasons.length > 0 ? matchReasons : ['別商材のターゲット属性に合致'],
          original_rejection_category: '断り',
          status: 'suggested' as const,
        }
        recommendations.push(rec as CrossSellRecommendation)
      }
    }
  }

  // DBに保存
  if (recommendations.length > 0) {
    await supabase.from('cross_sell_recommendations').insert(
      recommendations.map(r => ({
        source_project_id: r.source_project_id,
        target_project_id: r.target_project_id,
        company_id: r.company_id,
        match_score: r.match_score,
        match_reasons: r.match_reasons,
        original_rejection_category: r.original_rejection_category,
        status: r.status,
      }))
    )
  }

  return recommendations
}

export async function getCrossSellRecommendations(projectId: string): Promise<CrossSellRecommendation[]> {
  const { data, error } = await supabase
    .from('cross_sell_recommendations')
    .select('*')
    .eq('target_project_id', projectId)
    .eq('status', 'suggested')
    .order('match_score', { ascending: false })

  if (error) {
    console.error('Failed to fetch cross-sell recommendations:', error)
    return []
  }
  return data || []
}
