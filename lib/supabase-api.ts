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

export async function createCallLog(input: Omit<CallLog, 'id' | 'called_at'>): Promise<CallLog | null> {
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

export async function scoreCompany(company: Partial<Company>): Promise<AIScoreResult> {
  // 従業員数と業界に基づく簡易スコアリング
  let score = 50
  const reasons: string[] = []

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

  if (company.industry) {
    const highPotentialIndustries = ['IT', '金融', '不動産', 'コンサルティング']
    if (highPotentialIndustries.includes(company.industry)) {
      score += 15
      reasons.push(`${company.industry}業界は導入実績多数`)
    }
  }

  if (company.location?.includes('東京')) {
    score += 5
    reasons.push('東京都内で訪問対応しやすい')
  }

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
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Failed to create product:', error)
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
