// Supabase直接接続API
import { createClient as createSupabaseClient } from './supabase/client'

const supabase = createSupabaseClient()

// ====== クライアント ======

export type Client = {
  id: string
  name: string
  contact_person?: string
  contact_email?: string
  email?: string
  phone?: string
  address?: string
  industry?: string
  created_at: string
  updated_at?: string
}

export type CreateClientInput = Omit<Client, 'id' | 'created_at'>

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch clients:', error)
    return []
  }
  return data || []
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch client:', error)
    return null
  }
  return data
}

export async function addClient(input: CreateClientInput): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to create client:', error)
    return null
  }
  return data
}

// 互換性のためのエイリアス
export { addClient as createClientRecord }

export async function updateClient(id: string, input: Partial<CreateClientInput>): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update client:', error)
    return null
  }
  return data
}

export async function deleteClient(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete client:', error)
    return false
  }
  return true
}

// ====== オペレーター ======

export type Operator = {
  id: string
  name: string
  email: string
  phone: string
  status: 'active' | 'inactive'
  role?: 'director' | 'operator'
  created_at: string
}

export async function getOperators(): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch operators:', error)
    return []
  }
  return data || []
}

export async function getOperator(id: string): Promise<Operator | null> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch operator:', error)
    return null
  }
  return data
}

// ====== 企業（架電先） ======

export type Company = {
  id: string
  name: string
  industry: string
  employees: number
  location?: string
  phone?: string
  website?: string
  status?: string
  rank: 'S' | 'A' | 'B' | 'C'
  client_id: string
  created_at: string
  updated_at?: string
  // インテント分析
  intent_score?: number
  intent_level?: 'hot' | 'warm' | 'cold'
  intent_signals?: Array<{
    type: string
    title: string
    description: string
    date: string
    strength: string
    source?: string
  }>
  buying_stage?: 'awareness' | 'consideration' | 'decision' | 'unknown'
  best_contact_timing?: string
  intent_summary?: string
  // スクレイピングデータ
  scraped_data?: Record<string, unknown>
  scraped_at?: string
  // 企業分析
  analysis_data?: Record<string, unknown>
  analyzed_at?: string
  // スコアリング詳細
  score_value?: number
  score_reasons?: string[]
  // SalesRadar元データ（全カラム保存）
  salesradar_data?: Record<string, string>
}

export async function getCompanies(params?: {
  client_id?: string
  rank?: string
  search?: string
}): Promise<Company[]> {
  let query = supabase
    .from('companies')
    .select('*')
    .order('rank', { ascending: true })
    .order('created_at', { ascending: false })

  if (params?.client_id) {
    query = query.eq('client_id', params.client_id)
  }
  if (params?.rank) {
    query = query.eq('rank', params.rank)
  }
  if (params?.search) {
    query = query.or(`name.ilike.%${params.search}%,industry.ilike.%${params.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch companies:', error)
    return []
  }
  return data || []
}

export async function getCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch company:', error)
    return null
  }
  return data
}

export async function createCompany(input: Omit<Company, 'id' | 'created_at'>): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to create company:', error)
    return null
  }
  return data
}

export async function updateCompany(id: string, input: Partial<Company>): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update company:', error)
    return null
  }
  return data
}

// ====== 架電ログ ======

export type CallLog = {
  id: string
  company_id: string
  operator_id: string
  client_id: string
  result: string
  duration: number
  notes: string
  called_at: string
  created_at: string
}

export async function getCallLogs(params?: {
  client_id?: string
  operator_id?: string
  date?: string
}): Promise<CallLog[]> {
  let query = supabase
    .from('call_logs')
    .select('*')
    .order('called_at', { ascending: false })

  if (params?.client_id) {
    query = query.eq('client_id', params.client_id)
  }
  if (params?.operator_id) {
    query = query.eq('operator_id', params.operator_id)
  }
  if (params?.date) {
    query = query.gte('called_at', `${params.date}T00:00:00`)
    query = query.lt('called_at', `${params.date}T23:59:59`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch call logs:', error)
    return []
  }
  return data || []
}

export async function createCallLog(input: Omit<CallLog, 'id' | 'called_at' | 'created_at'>): Promise<CallLog | null> {
  const { data, error } = await supabase
    .from('call_logs')
    .insert({
      ...input,
      called_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create call log:', error)
    return null
  }
  return data
}

// ====== AI機能（モック） ======

export type AIScoreResult = {
  rank: 'S' | 'A' | 'B' | 'C'
  score: number
  reasons: string[]
}

export async function scoreCompany(company: Partial<Company> & { salesradar_data?: Record<string, string> }): Promise<AIScoreResult> {
  // 従業員数と業界に基づく簡易スコアリング
  let score = 50
  const reasons: string[] = []

  // 従業員数スコア
  if (company.employees) {
    if (company.employees >= 500) {
      score += 25
      reasons.push('大企業（従業員500名以上）で決裁規模が大きい')
    } else if (company.employees >= 100) {
      score += 15
      reasons.push('中堅企業で成長余地あり')
    } else if (company.employees >= 50) {
      score += 10
      reasons.push('中小企業だが一定の規模あり')
    }
  }

  // 業界スコア
  if (company.industry) {
    const highPotentialIndustries = ['IT', '金融', '不動産', 'コンサルティング', '製造', 'サービス']
    if (highPotentialIndustries.includes(company.industry)) {
      score += 15
      reasons.push(`${company.industry}業界は導入実績多数`)
    }
  }

  // 地域スコア
  if (company.location?.includes('東京')) {
    score += 5
    reasons.push('東京都内で訪問対応しやすい')
  } else if (company.location?.match(/大阪|名古屋|福岡|横浜/)) {
    score += 3
    reasons.push('主要都市で訪問対応可能')
  }

  // === SalesRadarデータによる追加スコアリング ===
  const salesradar = company.salesradar_data
  if (salesradar) {
    // 売上高スコア
    const revenue = salesradar['売上高(円)']
    if (revenue) {
      const revenueNum = parseInt(revenue.replace(/[^0-9]/g, ''), 10)
      if (revenueNum >= 10000000000) { // 100億円以上
        score += 15
        reasons.push('売上100億円以上の優良企業')
      } else if (revenueNum >= 1000000000) { // 10億円以上
        score += 10
        reasons.push('売上10億円以上')
      } else if (revenueNum >= 100000000) { // 1億円以上
        score += 5
        reasons.push('売上1億円以上')
      }
    }

    // 資本金スコア
    const capital = salesradar['資本金(円)']
    if (capital) {
      const capitalNum = parseInt(capital.replace(/[^0-9]/g, ''), 10)
      if (capitalNum >= 100000000) { // 1億円以上
        score += 10
        reasons.push('資本金1億円以上で財務基盤安定')
      } else if (capitalNum >= 10000000) { // 1000万円以上
        score += 5
        reasons.push('資本金1000万円以上')
      }
    }

    // 上場区分スコア
    const listingStatus = salesradar['上場区分']
    if (listingStatus && listingStatus !== '未上場' && listingStatus !== '') {
      score += 15
      reasons.push(`${listingStatus}で信用度高い`)
    }

    // 法人グレードスコア
    const grade = salesradar['法人グレード']
    if (grade === 'A') {
      score += 10
      reasons.push('法人グレードA（最優良）')
    } else if (grade === 'B') {
      score += 7
      reasons.push('法人グレードB（優良）')
    } else if (grade === 'C') {
      score += 3
      reasons.push('法人グレードC')
    }

    // Webサイトがある場合
    if (salesradar['サイトURL'] && salesradar['サイトURL'] !== '') {
      score += 3
      reasons.push('Webサイトあり（情報収集可能）')
    }

    // メールアドレスがある場合
    if (salesradar['メールアドレス'] && salesradar['メールアドレス'] !== '') {
      score += 2
      reasons.push('メールアドレス判明')
    }
  }

  // スコア上限
  score = Math.min(score, 100)

  let rank: 'S' | 'A' | 'B' | 'C' = 'C'
  if (score >= 80) rank = 'S'
  else if (score >= 65) rank = 'A'
  else if (score >= 50) rank = 'B'

  return { rank, score, reasons }
}

export type AIScriptResult = {
  script: string
  tips: string[]
}

export async function generateScript(data: {
  company: Partial<Company>
  client: Partial<Client>
}): Promise<AIScriptResult> {
  const companyName = data.company.name || '御社'
  const clientName = data.client.name || '弊社'
  const industry = data.company.industry || '業界'

  return {
    script: `お忙しいところ恐れ入ります。
私、${clientName}の○○と申します。

本日は、${companyName}様の業務効率化についてご提案がございまして、ご連絡させていただきました。

現在、御社と同じ${industry}の企業様で、多くの導入実績がございます。

お忙しいところ大変恐縮ですが、15分ほどお時間をいただけないでしょうか？`,
    tips: [
      '最初の10秒で用件を明確に伝える',
      '相手の時間を尊重する姿勢を見せる',
      '具体的な数字やメリットを伝える',
      '質問形式で会話を続ける',
    ],
  }
}

// ====== インテント分析（モック） ======

export type IntentSignal = {
  type: 'hiring' | 'expansion' | 'funding' | 'news' | 'technology'
  title: string
  description: string
  date: string
  strength: 'high' | 'medium' | 'low'
  source?: string
}

export type IntentAnalysis = {
  score: number
  level: 'hot' | 'warm' | 'cold'
  signals: IntentSignal[]
  buyingStage: 'awareness' | 'consideration' | 'decision' | 'unknown'
  bestContactTiming: string
  summary: string
}

export async function analyzeIntent(company: Partial<Company>): Promise<IntentAnalysis> {
  const signals: IntentSignal[] = []
  let score = 50

  if (company.employees && company.employees >= 100) {
    signals.push({
      type: 'expansion',
      title: '事業拡大の可能性',
      description: '従業員規模から成長企業と推測',
      date: new Date().toISOString(),
      strength: 'medium',
    })
    score += 10
  }

  if (company.industry === 'IT') {
    signals.push({
      type: 'technology',
      title: 'IT投資への関心',
      description: 'IT業界は新技術への投資意欲が高い傾向',
      date: new Date().toISOString(),
      strength: 'medium',
    })
    score += 10
  }

  let level: 'hot' | 'warm' | 'cold' = 'cold'
  if (score >= 70) level = 'hot'
  else if (score >= 50) level = 'warm'

  return {
    score,
    level,
    signals,
    buyingStage: score >= 60 ? 'consideration' : 'awareness',
    bestContactTiming: '火曜日〜木曜日の午前10時〜11時',
    summary: `${company.name || '企業'}は${level === 'hot' ? '高い' : level === 'warm' ? '中程度の' : '低い'}購買意欲を示しています。`,
  }
}

// ====== 企業分析（モック） ======

export type CompetitorInfo = {
  name: string
  strength: string
  weakness: string
}

export type CompanyAnalysis = {
  overview: {
    description: string
    foundedYear?: number
    ceo?: string
    headquarters: string
    businessModel: string
  }
  marketPosition: {
    rank: string
    marketShare?: string
    trend: 'growing' | 'stable' | 'declining'
    strengths: string[]
    weaknesses: string[]
  }
  financials?: {
    revenue?: string
    growth?: string
    profitability?: string
  }
  competitors: CompetitorInfo[]
  opportunities: string[]
  risks: string[]
  recommendedApproach: {
    strategy: string
    talkingPoints: string[]
    objectionHandling: string[]
    idealTiming: string
  }
}

export async function analyzeCompany(company: Partial<Company>): Promise<CompanyAnalysis> {
  return {
    overview: {
      description: `${company.name || '企業'}は${company.industry || '一般'}業界で事業を展開しています。`,
      headquarters: company.location || '東京',
      businessModel: '一般事業',
    },
    marketPosition: {
      rank: company.employees && company.employees >= 500 ? '大手' : company.employees && company.employees >= 100 ? '中堅' : '中小',
      trend: 'stable',
      strengths: ['安定した事業基盤', '業界での知名度'],
      weaknesses: ['デジタル化の遅れの可能性'],
    },
    competitors: [],
    opportunities: ['業務効率化による競争力強化', 'デジタルトランスフォーメーション'],
    risks: ['市場競争の激化'],
    recommendedApproach: {
      strategy: '課題ヒアリング重視のコンサルティング型アプローチ',
      talkingPoints: [
        '同業他社の成功事例を紹介',
        '具体的なROIを提示',
        '段階的な導入プランを提案',
      ],
      objectionHandling: [
        '「予算がない」→ 費用対効果と分割払いオプションを説明',
        '「今は忙しい」→ 短時間での概要説明を提案',
        '「検討中」→ 具体的な検討スケジュールを確認',
      ],
      idealTiming: '四半期末の1ヶ月前',
    },
  }
}

// ====== フル分析 ======

export type FullAnalysisResult = {
  company: Partial<Company>
  score: AIScoreResult
  intent: IntentAnalysis
  analysis: CompanyAnalysis
  generatedAt: string
}

export async function runFullAnalysis(company: Partial<Company>): Promise<FullAnalysisResult> {
  const [score, intent, analysis] = await Promise.all([
    scoreCompany(company),
    analyzeIntent(company),
    analyzeCompany(company),
  ])

  return {
    company,
    score,
    intent,
    analysis,
    generatedAt: new Date().toISOString(),
  }
}

// ====== 商材 ======

export type Product = {
  id: string
  client_id: string
  name: string
  description: string
  targetIndustries: string[]
  targetEmployeeRange: {
    min: number
    max: number
  }
  targetRevenue?: {
    min?: number
    max?: number
  }
  targetLocations: string[]
  keywords: string[]
  benefits: string[]
  idealCustomerProfile: string
  created_at: string
  updated_at: string
}

export async function getProducts(clientId?: string): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch products:', error)
    return []
  }
  return data || []
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch product:', error)
    return null
  }
  return data
}

export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>

export async function createProduct(input: CreateProductInput): Promise<Product | null> {
  const dbInput = {
    client_id: input.client_id,
    name: input.name,
    description: input.description,
    target_industries: input.targetIndustries || [],
    target_employee_range: input.targetEmployeeRange || { min: 0, max: 10000 },
    target_revenue: input.targetRevenue,
    target_locations: input.targetLocations || [],
    keywords: input.keywords || [],
    benefits: input.benefits || [],
    ideal_customer_profile: input.idealCustomerProfile || '',
  }

  const { data, error } = await supabase
    .from('products')
    .insert(dbInput)
    .select()
    .single()

  if (error) {
    console.error('Error creating product:', error)
    return null
  }

  return data
}
export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete product:', error)
    return false
  }
  return true
}

// ====== オペレーターホーム用データ ======

export type ClientPerformance = {
  id: string
  name: string
  color: string
  bgColor: string
  callsTarget: number
  callsCompleted: number
  connections: number
  appointments: number
  status: string
  statusType: 'success' | 'warning' | 'pending'
}

export type OperatorHomeData = {
  clients: ClientPerformance[]
  totalCalls: number
  totalTarget: number
  totalAppointments: number
  weeklyAppointmentTarget: number
  remainingCompanies: {
    S: number
    A: number
    B: number
  }
}

const CLIENT_COLORS = [
  { color: 'text-blue-600', bgColor: 'bg-blue-500' },
  { color: 'text-green-600', bgColor: 'bg-green-500' },
  { color: 'text-purple-600', bgColor: 'bg-purple-500' },
  { color: 'text-orange-600', bgColor: 'bg-orange-500' },
  { color: 'text-pink-600', bgColor: 'bg-pink-500' },
  { color: 'text-cyan-600', bgColor: 'bg-cyan-500' },
]

export async function getOperatorHomeData(): Promise<OperatorHomeData> {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true })

    if (clientsError) {
      console.error('Failed to fetch clients:', clientsError)
    }

    const allClients = clients || []
    const clientPerformances: ClientPerformance[] = []
    let totalCallsCompleted = 0
    let totalAppointments = 0

    for (let i = 0; i < allClients.length; i++) {
      const client = allClients[i]
      const colorSet = CLIENT_COLORS[i % CLIENT_COLORS.length]

      const { data: todayLogs, error: logsError } = await supabase
        .from('call_logs')
        .select('*')
        .eq('client_id', client.id)
        .gte('called_at', `${today}T00:00:00`)
        .lt('called_at', `${today}T23:59:59`)

      if (logsError) {
        console.error('Failed to fetch call logs:', logsError)
      }

      const logs = todayLogs || []
      const callsCompleted = logs.length
      const connections = logs.filter(c => ['接続', 'アポ獲得'].includes(c.result)).length
      const appointments = logs.filter(c => c.result === 'アポ獲得').length

      totalCallsCompleted += callsCompleted
      totalAppointments += appointments

      const callsTarget = 60
      const progress = (callsCompleted / callsTarget) * 100

      let status = '開始前'
      let statusType: 'success' | 'warning' | 'pending' = 'pending'

      if (callsCompleted === 0) {
        status = '開始前'
        statusType = 'pending'
      } else if (progress >= 80) {
        status = '順調'
        statusType = 'success'
      } else if (progress >= 50) {
        status = '進行中'
        statusType = 'success'
      } else {
        status = 'ペース遅れ'
        statusType = 'warning'
      }

      clientPerformances.push({
        id: client.id,
        name: client.name,
        color: colorSet.color,
        bgColor: colorSet.bgColor,
        callsTarget,
        callsCompleted,
        connections,
        appointments,
        status,
        statusType,
      })
    }

    const { data: allCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('rank, status')

    if (companiesError) {
      console.error('Failed to fetch companies:', companiesError)
    }

    const companies = allCompanies || []
    const remainingCompanies = {
      S: companies.filter(c => c.rank === 'S' && c.status !== '完了').length,
      A: companies.filter(c => c.rank === 'A' && c.status !== '完了').length,
      B: companies.filter(c => c.rank === 'B' && c.status !== '完了').length,
    }

    return {
      clients: clientPerformances,
      totalCalls: totalCallsCompleted,
      totalTarget: Math.max(allClients.length * 60, 60),
      totalAppointments,
      weeklyAppointmentTarget: 3,
      remainingCompanies,
    }
  } catch (error) {
    console.error('getOperatorHomeData error:', error)
    // エラー時はデフォルト値を返す
    return {
      clients: [],
      totalCalls: 0,
      totalTarget: 60,
      totalAppointments: 0,
      weeklyAppointmentTarget: 3,
      remainingCompanies: { S: 0, A: 0, B: 0 },
    }
  }
}

// ====== 商材マッチング ======

export type ProductMatchResult = {
  company: Company
  matchScore: number
  matchLevel: 'excellent' | 'good' | 'fair' | 'low'
  matchReasons: {
    category: string
    reason: string
    score: number
  }[]
  recommendedApproach: string
  talkingPoints: string[]
  potentialObjections: string[]
}

export type ProductMatchSummary = {
  product: Product
  totalMatches: number
  excellentMatches: number
  goodMatches: number
  fairMatches: number
  topIndustries: { industry: string; count: number }[]
  averageMatchScore: number
}

export async function getMatchingCompanies(
  productId: string,
  _options?: { limit?: number; minScore?: number }
): Promise<{ matches: ProductMatchResult[]; summary: ProductMatchSummary } | null> {
  const product = await getProduct(productId)
  if (!product) return null

  const companies = await getCompanies({ client_id: product.client_id })

  const matches: ProductMatchResult[] = companies.map(company => {
    let score = 50
    const reasons: { category: string; reason: string; score: number }[] = []

    // 業界マッチ
    if (product.targetIndustries.includes(company.industry)) {
      score += 20
      reasons.push({ category: '業界', reason: `ターゲット業界(${company.industry})に該当`, score: 20 })
    }

    // 従業員規模マッチ
    if (company.employees >= product.targetEmployeeRange.min &&
        company.employees <= product.targetEmployeeRange.max) {
      score += 15
      reasons.push({ category: '規模', reason: '従業員規模がターゲット範囲内', score: 15 })
    }

    // 地域マッチ
    if (company.location && product.targetLocations.some(loc => company.location?.includes(loc))) {
      score += 10
      reasons.push({ category: '地域', reason: 'ターゲット地域に該当', score: 10 })
    }

    let matchLevel: 'excellent' | 'good' | 'fair' | 'low' = 'low'
    if (score >= 80) matchLevel = 'excellent'
    else if (score >= 65) matchLevel = 'good'
    else if (score >= 50) matchLevel = 'fair'

    return {
      company,
      matchScore: score,
      matchLevel,
      matchReasons: reasons,
      recommendedApproach: score >= 70 ? '積極的アプローチ' : '慎重なアプローチ',
      talkingPoints: product.benefits.slice(0, 3),
      potentialObjections: ['予算の制約', '導入時期の検討'],
    }
  })

  const summary: ProductMatchSummary = {
    product,
    totalMatches: matches.length,
    excellentMatches: matches.filter(m => m.matchLevel === 'excellent').length,
    goodMatches: matches.filter(m => m.matchLevel === 'good').length,
    fairMatches: matches.filter(m => m.matchLevel === 'fair').length,
    topIndustries: [],
    averageMatchScore: matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length || 0,
  }

  return { matches, summary }
}

// ====== インテント + 商材 複合検索 ======

export type IntentProductSearchParams = {
  clientId?: string
  productId?: string
  intentLevels?: ('hot' | 'warm' | 'cold')[]
  buyingStages?: ('awareness' | 'consideration' | 'decision' | 'unknown')[]
  minIntentScore?: number
  minMatchScore?: number
  ranks?: ('S' | 'A' | 'B' | 'C')[]
  industries?: string[]
  minEmployees?: number
  maxEmployees?: number
  locations?: string[]
  hasWebsite?: boolean
  sortBy?: 'intent_score' | 'match_score' | 'combined_score' | 'employees' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export type IntentProductSearchResult = {
  company: Company
  intentScore: number
  intentLevel: 'hot' | 'warm' | 'cold'
  buyingStage: string
  productMatchScore?: number
  productMatchLevel?: 'excellent' | 'good' | 'fair' | 'low'
  combinedScore: number // インテント + 商材マッチの複合スコア
  priorityRank: 'S' | 'A' | 'B' | 'C' // 複合優先度ランク
  salesradarHighlights?: {
    revenue?: string
    capital?: string
    ceo?: string
    foundedDate?: string
    listingStatus?: string
    corporateGrade?: string
    summary?: string
  }
  recommendedActions: string[]
}

export type IntentProductSearchSummary = {
  totalResults: number
  byIntentLevel: { hot: number; warm: number; cold: number }
  byBuyingStage: { awareness: number; consideration: number; decision: number; unknown: number }
  byPriorityRank: { S: number; A: number; B: number; C: number }
  averageIntentScore: number
  averageMatchScore: number
  topIndustries: { industry: string; count: number }[]
}

export async function searchCompaniesWithIntentAndProduct(
  params: IntentProductSearchParams
): Promise<{ results: IntentProductSearchResult[]; summary: IntentProductSearchSummary }> {
  // 基本クエリ
  let query = supabase
    .from('companies')
    .select('*')

  // フィルタ適用
  if (params.clientId) {
    query = query.eq('client_id', params.clientId)
  }
  if (params.intentLevels && params.intentLevels.length > 0) {
    query = query.in('intent_level', params.intentLevels)
  }
  if (params.buyingStages && params.buyingStages.length > 0) {
    query = query.in('buying_stage', params.buyingStages)
  }
  if (params.minIntentScore !== undefined) {
    query = query.gte('intent_score', params.minIntentScore)
  }
  if (params.ranks && params.ranks.length > 0) {
    query = query.in('rank', params.ranks)
  }
  if (params.industries && params.industries.length > 0) {
    query = query.in('industry', params.industries)
  }
  if (params.minEmployees !== undefined) {
    query = query.gte('employees', params.minEmployees)
  }
  if (params.maxEmployees !== undefined) {
    query = query.lte('employees', params.maxEmployees)
  }
  if (params.hasWebsite) {
    query = query.not('website', 'is', null)
  }

  // ソート
  const sortBy = params.sortBy || 'intent_score'
  const sortOrder = params.sortOrder || 'desc'
  if (sortBy === 'intent_score' || sortBy === 'employees' || sortBy === 'created_at') {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  }

  // 取得
  const { data: companies, error } = await query

  if (error) {
    console.error('Search error:', error)
    return {
      results: [],
      summary: {
        totalResults: 0,
        byIntentLevel: { hot: 0, warm: 0, cold: 0 },
        byBuyingStage: { awareness: 0, consideration: 0, decision: 0, unknown: 0 },
        byPriorityRank: { S: 0, A: 0, B: 0, C: 0 },
        averageIntentScore: 0,
        averageMatchScore: 0,
        topIndustries: [],
      },
    }
  }

  // 商材マッチングスコア計算（productIdが指定されている場合）
  let product: Product | null = null
  if (params.productId) {
    product = await getProduct(params.productId)
  }

  // 結果を変換
  let results: IntentProductSearchResult[] = (companies || []).map(company => {
    const intentScore = company.intent_score || 0
    const intentLevel = (company.intent_level || 'cold') as 'hot' | 'warm' | 'cold'
    const buyingStage = company.buying_stage || 'unknown'

    // 商材マッチスコア計算
    let productMatchScore = 0
    let productMatchLevel: 'excellent' | 'good' | 'fair' | 'low' = 'low'

    if (product) {
      // 業界マッチ
      if (product.targetIndustries?.includes(company.industry)) {
        productMatchScore += 30
      }
      // 従業員規模マッチ
      if (product.targetEmployeeRange &&
          company.employees >= product.targetEmployeeRange.min &&
          company.employees <= product.targetEmployeeRange.max) {
        productMatchScore += 25
      }
      // 地域マッチ
      if (company.location && product.targetLocations?.some(loc => company.location?.includes(loc))) {
        productMatchScore += 15
      }
      // SalesRadarデータからの追加スコア
      const salesradar = company.salesradar_data as Record<string, string> | null
      if (salesradar) {
        // 売上高がある企業は+10
        if (salesradar['売上高(円)'] && salesradar['売上高(円)'] !== '') {
          productMatchScore += 10
        }
        // 上場企業は+10
        if (salesradar['上場区分'] && salesradar['上場区分'] !== '未上場') {
          productMatchScore += 10
        }
        // 法人グレードが高い場合+10
        if (salesradar['法人グレード'] && ['A', 'B'].includes(salesradar['法人グレード'])) {
          productMatchScore += 10
        }
      }

      if (productMatchScore >= 80) productMatchLevel = 'excellent'
      else if (productMatchScore >= 60) productMatchLevel = 'good'
      else if (productMatchScore >= 40) productMatchLevel = 'fair'
    }

    // 複合スコア計算（インテント50% + 商材マッチ50%）
    const combinedScore = product
      ? Math.round(intentScore * 0.5 + productMatchScore * 0.5)
      : intentScore

    // 優先度ランク決定
    let priorityRank: 'S' | 'A' | 'B' | 'C' = 'C'
    if (combinedScore >= 80 || (intentLevel === 'hot' && productMatchLevel === 'excellent')) {
      priorityRank = 'S'
    } else if (combinedScore >= 60 || intentLevel === 'hot' || productMatchLevel === 'excellent') {
      priorityRank = 'A'
    } else if (combinedScore >= 40 || intentLevel === 'warm' || productMatchLevel === 'good') {
      priorityRank = 'B'
    }

    // SalesRadarハイライト抽出
    const salesradar = company.salesradar_data as Record<string, string> | null
    const salesradarHighlights = salesradar ? {
      revenue: salesradar['売上高(円)'] || undefined,
      capital: salesradar['資本金(円)'] || undefined,
      ceo: salesradar['代表者名'] || undefined,
      foundedDate: salesradar['設立年月日'] || undefined,
      listingStatus: salesradar['上場区分'] || undefined,
      corporateGrade: salesradar['法人グレード'] || undefined,
      summary: salesradar['法人サマリー'] || undefined,
    } : undefined

    // 推奨アクション生成
    const recommendedActions: string[] = []
    if (intentLevel === 'hot') {
      recommendedActions.push('🔥 即時アプローチ推奨')
    }
    if (buyingStage === 'decision') {
      recommendedActions.push('💰 決裁段階 - クロージング重視')
    } else if (buyingStage === 'consideration') {
      recommendedActions.push('🤔 検討段階 - 詳細提案')
    }
    if (productMatchLevel === 'excellent') {
      recommendedActions.push('⭐ 商材完全マッチ')
    }
    if (salesradarHighlights?.listingStatus && salesradarHighlights.listingStatus !== '未上場') {
      recommendedActions.push('📈 上場企業 - 正式提案書準備')
    }

    return {
      company,
      intentScore,
      intentLevel,
      buyingStage,
      productMatchScore: product ? productMatchScore : undefined,
      productMatchLevel: product ? productMatchLevel : undefined,
      combinedScore,
      priorityRank,
      salesradarHighlights,
      recommendedActions,
    }
  })

  // 商材マッチスコアでフィルタ
  if (params.minMatchScore !== undefined && product) {
    results = results.filter(r => (r.productMatchScore || 0) >= params.minMatchScore!)
  }

  // 地域フィルタ
  if (params.locations && params.locations.length > 0) {
    results = results.filter(r =>
      r.company.location && params.locations!.some(loc => r.company.location?.includes(loc))
    )
  }

  // 複合スコアでソート（sortByがcombined_scoreの場合）
  if (params.sortBy === 'combined_score') {
    results.sort((a, b) => params.sortOrder === 'asc'
      ? a.combinedScore - b.combinedScore
      : b.combinedScore - a.combinedScore
    )
  } else if (params.sortBy === 'match_score' && product) {
    results.sort((a, b) => params.sortOrder === 'asc'
      ? (a.productMatchScore || 0) - (b.productMatchScore || 0)
      : (b.productMatchScore || 0) - (a.productMatchScore || 0)
    )
  }

  // ページネーション
  const offset = params.offset || 0
  const limit = params.limit || 100
  const paginatedResults = results.slice(offset, offset + limit)

  // サマリー計算
  const summary: IntentProductSearchSummary = {
    totalResults: results.length,
    byIntentLevel: {
      hot: results.filter(r => r.intentLevel === 'hot').length,
      warm: results.filter(r => r.intentLevel === 'warm').length,
      cold: results.filter(r => r.intentLevel === 'cold').length,
    },
    byBuyingStage: {
      awareness: results.filter(r => r.buyingStage === 'awareness').length,
      consideration: results.filter(r => r.buyingStage === 'consideration').length,
      decision: results.filter(r => r.buyingStage === 'decision').length,
      unknown: results.filter(r => r.buyingStage === 'unknown').length,
    },
    byPriorityRank: {
      S: results.filter(r => r.priorityRank === 'S').length,
      A: results.filter(r => r.priorityRank === 'A').length,
      B: results.filter(r => r.priorityRank === 'B').length,
      C: results.filter(r => r.priorityRank === 'C').length,
    },
    averageIntentScore: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.intentScore, 0) / results.length)
      : 0,
    averageMatchScore: product && results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + (r.productMatchScore || 0), 0) / results.length)
      : 0,
    topIndustries: Object.entries(
      results.reduce((acc, r) => {
        acc[r.company.industry] = (acc[r.company.industry] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    )
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }

  return { results: paginatedResults, summary }
}

// ホットリード取得（即時アプローチ対象）
export async function getHotLeads(clientId?: string, limit = 20): Promise<IntentProductSearchResult[]> {
  const { results } = await searchCompaniesWithIntentAndProduct({
    clientId,
    intentLevels: ['hot'],
    sortBy: 'combined_score',
    sortOrder: 'desc',
    limit,
  })
  return results
}

// 商材別ベストマッチ取得
export async function getBestMatchesForProduct(
  productId: string,
  limit = 20
): Promise<IntentProductSearchResult[]> {
  const product = await getProduct(productId)
  if (!product) return []

  const { results } = await searchCompaniesWithIntentAndProduct({
    clientId: product.client_id,
    productId,
    minMatchScore: 60,
    sortBy: 'combined_score',
    sortOrder: 'desc',
    limit,
  })
  return results
}

// オペレーター作成
export type CreateOperatorInput = {
  name: string
  email: string
  phone?: string
  zoom_phone_number?: string
  zoom_user_id?: string
  status?: 'active' | 'inactive'
  role?: 'director' | 'operator'
}

export async function createOperator(input: CreateOperatorInput): Promise<Operator | null> {
  const { data, error } = await supabase
    .from('operators')
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone || '',
      zoom_phone_number: input.zoom_phone_number || '',
      zoom_user_id: input.zoom_user_id || '',
      status: input.status || 'active',
      role: input.role || 'operator',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating operator:', error)
    return null
  }

  return data
}

// ====== 企業一括登録（CSV用） ======

export type BulkCompanyInput = {
  name: string
  industry: string
  employees: number
  location?: string
  phone?: string
  website?: string
  client_id: string
  // SalesRadar元データ（全カラム保存）
  salesradar_data?: Record<string, string>
}

export type BulkCreateOptions = {
  skipScraping?: boolean // スクレイピングをスキップ
  onProgress?: (current: number, total: number, companyName: string, phase: 'insert' | 'scrape' | 'analyze') => void
}

export async function bulkCreateCompanies(
  companies: BulkCompanyInput[],
  options?: BulkCreateOptions
): Promise<{
  success: boolean
  imported: number
  errors: string[]
  companies: Company[]
}> {
  const errors: string[] = []
  const createdCompanies: Company[] = []
  const skipScraping = options?.skipScraping ?? true // デフォルトでスクレイピングをスキップ（高速化）
  const onProgress = options?.onProgress

  // バリデーション済みデータを準備
  const validCompanies: Array<{
    index: number
    company: BulkCompanyInput
    scoreResult: AIScoreResult
  }> = []

  // フェーズ1: バリデーション & スコアリング（並列処理可能）
  if (onProgress) {
    onProgress(0, companies.length, 'バリデーション中...', 'insert')
  }

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i]

    // バリデーション
    if (!company.name || company.name.trim() === '') {
      errors.push(`行${i + 1}: 企業名が空です`)
      continue
    }
    if (!company.industry || company.industry.trim() === '') {
      errors.push(`行${i + 1}: 業種が空です`)
      continue
    }
    if (!company.client_id) {
      errors.push(`行${i + 1}: クライアントIDが指定されていません`)
      continue
    }

    // AIスコアリング（同期的に計算、高速）
    const scoreResult = await scoreCompany(company)

    validCompanies.push({ index: i, company, scoreResult })
  }

  // フェーズ2: バッチ挿入（50件ずつ）
  const BATCH_SIZE = 50
  const totalBatches = Math.ceil(validCompanies.length / BATCH_SIZE)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, validCompanies.length)
    const batch = validCompanies.slice(start, end)

    if (onProgress) {
      onProgress(
        end,
        validCompanies.length,
        `${end}/${validCompanies.length}件を登録中...`,
        'insert'
      )
    }

    // バッチ挿入データを構築
    const insertData = batch.map(({ company, scoreResult }) => ({
      name: company.name.trim(),
      industry: company.industry.trim(),
      employees: company.employees || 0,
      location: company.location?.trim() || null,
      phone: company.phone?.trim() || null,
      website: company.website?.trim() || null,
      client_id: company.client_id,
      rank: scoreResult.rank,
      score_value: scoreResult.score,
      score_reasons: scoreResult.reasons,
      status: 'pending',
      salesradar_data: company.salesradar_data || null,
    }))

    // 一括INSERT
    const { data, error } = await supabase
      .from('companies')
      .insert(insertData)
      .select()

    if (error) {
      // バッチ全体がエラーの場合、個別に再試行
      console.error(`Batch ${batchIndex + 1} error:`, error)
      for (const { index, company } of batch) {
        errors.push(`行${index + 1}: ${company.name}の登録に失敗しました - ${error.message}`)
      }
    } else if (data) {
      createdCompanies.push(...data)
    }
  }

  // フェーズ2: スクレイピング & インテント分析（オプション）
  if (!skipScraping && createdCompanies.length > 0) {
    const { scrapeCompanyData, analyzeScrapedData } = await import('./scraper')

    for (let i = 0; i < createdCompanies.length; i++) {
      const company = createdCompanies[i]

      try {
        // スクレイピング実行
        if (onProgress) {
          onProgress(i + 1, createdCompanies.length, company.name, 'scrape')
        }

        const scrapedData = await scrapeCompanyData(company.name, company.website)

        // インテント分析
        if (onProgress) {
          onProgress(i + 1, createdCompanies.length, company.name, 'analyze')
        }

        const intentAnalysis = analyzeScrapedData(scrapedData)

        // 企業分析も実行
        const companyAnalysis = await analyzeCompany(company)

        // DBを更新
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            // スクレイピングデータ
            scraped_data: scrapedData,
            scraped_at: new Date().toISOString(),

            // インテント分析結果
            intent_score: intentAnalysis.intentScore,
            intent_level: intentAnalysis.intentLevel,
            intent_signals: intentAnalysis.signals,
            buying_stage: intentAnalysis.buyingStage,
            intent_summary: intentAnalysis.summary,

            // 企業分析結果
            analysis_data: companyAnalysis,
            analyzed_at: new Date().toISOString(),

            updated_at: new Date().toISOString(),
          })
          .eq('id', company.id)

        if (updateError) {
          console.error(`企業${company.name}の分析データ保存エラー:`, updateError)
          errors.push(`${company.name}: 分析データの保存に失敗`)
        }
      } catch (e) {
        console.error(`企業${company.name}のスクレイピングエラー:`, e)
        errors.push(`${company.name}: 情報収集中にエラー発生`)
      }

      // レート制限対策：1秒待機
      if (i < createdCompanies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  return {
    success: errors.filter(e => !e.includes('分析') && !e.includes('情報収集')).length === 0,
    imported: createdCompanies.length,
    errors,
    companies: createdCompanies,
  }
}

// 単一企業のスクレイピング＆分析を実行
export async function scrapeAndAnalyzeCompany(companyId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const company = await getCompany(companyId)
    if (!company) {
      return { success: false, error: '企業が見つかりません' }
    }

    const { scrapeCompanyData, analyzeScrapedData } = await import('./scraper')

    // スクレイピング実行
    const scrapedData = await scrapeCompanyData(company.name, company.website)

    // インテント分析
    const intentAnalysis = analyzeScrapedData(scrapedData)

    // 企業分析
    const companyAnalysis = await analyzeCompany(company)

    // DBを更新
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        scraped_data: scrapedData,
        scraped_at: new Date().toISOString(),
        intent_score: intentAnalysis.intentScore,
        intent_level: intentAnalysis.intentLevel,
        intent_signals: intentAnalysis.signals,
        buying_stage: intentAnalysis.buyingStage,
        intent_summary: intentAnalysis.summary,
        analysis_data: companyAnalysis,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '不明なエラー' }
  }
}

// ====== ダッシュボード統計 ======

export type DashboardStats = {
  calls: {
    today: number
    total: number
  }
  appointments: {
    today: number
    total: number
    rate: number
  }
  operators: {
    total: number
    active: number
  }
  companies: {
    total: number
    byRank: {
      S: number
      A: number
      B: number
      C: number
    }
  }
  clients: {
    total: number
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // 並列でデータ取得
    const [callLogs, companies, operators, clients] = await Promise.all([
      getCallLogs(),
      getCompanies(),
      getOperators(),
      getClients(),
    ])

    // 今日の日付
    const today = new Date().toISOString().split('T')[0]
    const todayCalls = callLogs.filter(log => log.called_at?.startsWith(today))
    const todayAppointments = todayCalls.filter(log => log.result === 'アポ獲得')

    const totalCalls = callLogs.length
    const totalAppointments = callLogs.filter(log => log.result === 'アポ獲得').length
    const appointmentRate = totalCalls > 0 ? (totalAppointments / totalCalls) * 100 : 0

    return {
      calls: {
        today: todayCalls.length,
        total: totalCalls,
      },
      appointments: {
        today: todayAppointments.length,
        total: totalAppointments,
        rate: appointmentRate,
      },
      operators: {
        total: operators.length,
        active: operators.filter(op => op.status === 'active').length,
      },
      companies: {
        total: companies.length,
        byRank: {
          S: companies.filter(c => c.rank === 'S').length,
          A: companies.filter(c => c.rank === 'A').length,
          B: companies.filter(c => c.rank === 'B').length,
          C: companies.filter(c => c.rank === 'C').length,
        },
      },
      clients: {
        total: clients.length,
      },
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return {
      calls: { today: 0, total: 0 },
      appointments: { today: 0, total: 0, rate: 0 },
      operators: { total: 0, active: 0 },
      companies: { total: 0, byRank: { S: 0, A: 0, B: 0, C: 0 } },
      clients: { total: 0 },
    }
  }
}
