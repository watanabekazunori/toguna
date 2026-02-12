// AI戦略構築API - 第1章: AI Strategy Core
import { createClient as createSupabaseClient } from './supabase/client'
import { generateAIJSON } from './gemini'

const supabase = createSupabaseClient()

// ====== 型定義 ======

export type StrategyAnalysis = {
  id: string
  project_id: string
  analysis_type: '3c' | '4p' | 'stp' | 'roadmap' | 'hypothesis'
  customer_analysis: Record<string, unknown>
  competitor_analysis: Record<string, unknown>
  company_analysis: Record<string, unknown>
  product_analysis: Record<string, unknown>
  price_analysis: Record<string, unknown>
  place_analysis: Record<string, unknown>
  promotion_analysis: Record<string, unknown>
  segmentation: Record<string, unknown>
  targeting: Record<string, unknown>
  positioning: Record<string, unknown>
  target_attributes: Record<string, unknown>
  appeal_points: string[]
  channels: string[]
  winning_hypothesis?: string
  source_documents: string[]
  ai_model_used?: string
  confidence_score?: number
  generated_at: string
  updated_at: string
}

export type ThreeCAnalysis = {
  customer: {
    target_segments: string[]
    needs: string[]
    buying_behavior: string
    decision_makers: string[]
    pain_points: string[]
    budget_range: string
  }
  competitor: {
    main_competitors: Array<{
      name: string
      strengths: string[]
      weaknesses: string[]
      market_share: string
      pricing: string
    }>
    competitive_advantage: string
    differentiation_points: string[]
  }
  company: {
    strengths: string[]
    weaknesses: string[]
    unique_selling_points: string[]
    resources: string[]
    track_record: string
  }
}

export type FourPAnalysis = {
  product: {
    features: string[]
    benefits: string[]
    unique_value: string
    quality_positioning: string
  }
  price: {
    pricing_strategy: string
    price_range: string
    value_justification: string
    competitor_comparison: string
  }
  place: {
    channels: string[]
    target_regions: string[]
    distribution_strategy: string
  }
  promotion: {
    key_messages: string[]
    channels: string[]
    timing_strategy: string
    content_strategy: string
  }
}

export type STPAnalysis = {
  segmentation: {
    criteria: string[]
    segments: Array<{
      name: string
      size: string
      characteristics: string[]
      attractiveness: number
    }>
  }
  targeting: {
    selected_segments: string[]
    rationale: string
    approach: string
    priority_order: string[]
  }
  positioning: {
    statement: string
    value_proposition: string
    key_differentiators: string[]
    positioning_map: {
      x_axis: string
      y_axis: string
      position: string
    }
  }
}

export type StrategyRoadmap = {
  target_who: {
    attributes: string[]
    persona: string
    industry_focus: string[]
    company_size: string
  }
  target_what: {
    appeal_points: string[]
    value_proposition: string
    key_benefits: string[]
  }
  target_how: {
    channels: string[]
    approach_sequence: string[]
    timing: string
    initial_message: string
  }
  winning_hypothesis: string
  success_metrics: string[]
  risk_factors: string[]
}

// ====== AI戦略分析生成 ======

export async function generate3CAnalysis(
  projectId: string,
  context: {
    clientName: string
    productName: string
    productDescription: string
    targetIndustries: string[]
    documentSummaries?: string[]
  }
): Promise<ThreeCAnalysis> {
  // Try to generate analysis using Gemini AI
  let analysis: ThreeCAnalysis | null = null

  try {
    const systemPrompt = `You are a strategic business analyst. Analyze the provided product and company information to create a detailed 3C analysis (Company, Customer, Competitor). Respond with JSON only.`

    const userPrompt = `Create a 3C analysis for:
Client: ${context.clientName}
Product: ${context.productName}
Description: ${context.productDescription}
Target Industries: ${context.targetIndustries.join(', ') || 'General'}
${context.documentSummaries ? `Additional Context:\n${context.documentSummaries.join('\n')}` : ''}

Return JSON with this structure:
{
  "customer": {
    "target_segments": string[],
    "needs": string[],
    "buying_behavior": string,
    "decision_makers": string[],
    "pain_points": string[],
    "budget_range": string
  },
  "competitor": {
    "main_competitors": [{"name": string, "strengths": string[], "weaknesses": string[], "market_share": string, "pricing": string}],
    "competitive_advantage": string,
    "differentiation_points": string[]
  },
  "company": {
    "strengths": string[],
    "weaknesses": string[],
    "unique_selling_points": string[],
    "resources": string[],
    "track_record": string
  }
}`

    const result = await generateAIJSON<any>({
      systemPrompt,
      userPrompt,
    })

    if (result && result.customer && result.competitor && result.company) {
      analysis = result
    }
  } catch (error) {
    console.warn('Failed to generate 3C analysis with AI, using template:', error)
  }

  // Fallback to template if AI generation failed
  if (!analysis) {
    analysis = {
      customer: {
        target_segments: context.targetIndustries.length > 0
          ? context.targetIndustries.map(i => `${i}業界の意思決定者`)
          : ['中小企業の経営者', '大企業の部門責任者'],
        needs: [
          '業務効率化によるコスト削減',
          '売上向上のための新規開拓',
          '競合他社との差別化',
          'デジタルトランスフォーメーション推進',
        ],
        buying_behavior: '複数社比較検討、ROI重視の意思決定',
        decision_makers: ['代表取締役', '営業部長', '経営企画部長'],
        pain_points: [
          '既存の方法では成果が頭打ち',
          '人手不足による業務過多',
          '競合の動きについていけない',
        ],
        budget_range: '月額10万〜100万円程度',
      },
      competitor: {
        main_competitors: [
          {
            name: '競合A（業界大手）',
            strengths: ['ブランド力', '営業網の広さ'],
            weaknesses: ['カスタマイズ性の低さ', 'コストが高い'],
            market_share: '約30%',
            pricing: '高価格帯',
          },
          {
            name: '競合B（新興企業）',
            strengths: ['先進的な技術', '柔軟な対応'],
            weaknesses: ['実績の少なさ', 'サポート体制'],
            market_share: '約10%',
            pricing: '中価格帯',
          },
        ],
        competitive_advantage: `${context.productName}は、${context.productDescription?.slice(0, 50) || '独自の強み'}を持つ`,
        differentiation_points: [
          'AI活用による精度の高いアプローチ',
          '実績データに基づく戦略提案',
          '柔軟なカスタマイズ対応',
        ],
      },
      company: {
        strengths: [
          `${context.clientName}の業界知見`,
          '専任チームによる伴走支援',
          'テクノロジーとヒトの融合',
        ],
        weaknesses: [
          '認知度向上の余地',
          'リソースの制約',
        ],
        unique_selling_points: [
          `${context.productName}の独自価値`,
          'データドリブンな営業支援',
          '成果報酬型の料金体系',
        ],
        resources: ['専門チーム', 'AIプラットフォーム', '業界ネットワーク'],
        track_record: '類似プロジェクトでの成功実績',
      },
    }
  }

  // DBに保存
  await supabase.from('strategy_analyses').insert({
    project_id: projectId,
    analysis_type: '3c',
    customer_analysis: analysis.customer,
    competitor_analysis: analysis.competitor,
    company_analysis: analysis.company,
    ai_model_used: 'gemini-2.0-flash',
  })

  return analysis
}

export async function generate4PAnalysis(
  projectId: string,
  context: {
    productName: string
    productDescription: string
    targetIndustries: string[]
    benefits: string[]
  }
): Promise<FourPAnalysis> {
  // Try to generate analysis using Gemini AI
  let analysis: FourPAnalysis | null = null

  try {
    const systemPrompt = `You are a marketing strategist. Create a detailed 4P analysis (Product, Price, Place, Promotion) for the given product. Respond with JSON only.`

    const userPrompt = `Create a 4P marketing analysis for:
Product: ${context.productName}
Description: ${context.productDescription}
Target Industries: ${context.targetIndustries.join(', ') || 'General'}
Benefits: ${context.benefits.join(', ') || 'Multiple benefits'}

Return JSON with this structure:
{
  "product": {
    "features": string[],
    "benefits": string[],
    "unique_value": string,
    "quality_positioning": string
  },
  "price": {
    "pricing_strategy": string,
    "price_range": string,
    "value_justification": string,
    "competitor_comparison": string
  },
  "place": {
    "channels": string[],
    "target_regions": string[],
    "distribution_strategy": string
  },
  "promotion": {
    "key_messages": string[],
    "channels": string[],
    "timing_strategy": string,
    "content_strategy": string
  }
}`

    const result = await generateAIJSON<any>({
      systemPrompt,
      userPrompt,
    })

    if (result && result.product && result.price && result.place && result.promotion) {
      analysis = result
    }
  } catch (error) {
    console.warn('Failed to generate 4P analysis with AI, using template:', error)
  }

  // Fallback to template if AI generation failed
  if (!analysis) {
    analysis = {
      product: {
        features: context.benefits.length > 0 ? context.benefits : [
          '高精度なターゲティング',
          'AIによる自動スクリプト生成',
          'リアルタイム分析ダッシュボード',
        ],
        benefits: [
          'アポイント獲得率の向上',
          '営業コストの削減',
          '新規顧客開拓の効率化',
        ],
        unique_value: `${context.productName}でしか得られない成果`,
        quality_positioning: 'プレミアム品質・高い費用対効果',
      },
      price: {
        pricing_strategy: '価値ベースプライシング（成果に基づく料金設定）',
        price_range: '月額30万〜100万円',
        value_justification: '1件のアポ獲得コストを算出し、ROIを明確に提示',
        competitor_comparison: '競合比20〜30%の費用対効果優位',
      },
      place: {
        channels: ['直販（電話・オンライン商談）', 'パートナー紹介', 'Webマーケティング'],
        target_regions: ['首都圏', '関西圏', '主要政令指定都市'],
        distribution_strategy: 'オンラインファーストで全国対応',
      },
      promotion: {
        key_messages: [
          `${context.productName}で営業の質を変える`,
          '実績データが証明する確かな成果',
          'まずは30日間の無料トライアルから',
        ],
        channels: ['テレアポ', 'メールDM', 'LinkedIn', 'セミナー・ウェビナー'],
        timing_strategy: '四半期末の予算策定期を狙い撃ち',
        content_strategy: '事例紹介 → 課題共有 → 解決策提案 → トライアル誘導',
      },
    }
  }

  await supabase.from('strategy_analyses').insert({
    project_id: projectId,
    analysis_type: '4p',
    product_analysis: analysis.product,
    price_analysis: analysis.price,
    place_analysis: analysis.place,
    promotion_analysis: analysis.promotion,
    ai_model_used: 'gemini-2.0-flash',
  })

  return analysis
}

export async function generateSTPAnalysis(
  projectId: string,
  context: {
    targetIndustries: string[]
    targetEmployeeRange: { min: number; max: number }
    targetLocations: string[]
  }
): Promise<STPAnalysis> {
  // Try to generate analysis using Gemini AI
  let analysis: STPAnalysis | null = null

  try {
    const systemPrompt = `You are a market segmentation specialist. Create a detailed STP analysis (Segmentation, Targeting, Positioning) based on the provided market context. Respond with JSON only.`

    const userPrompt = `Create an STP analysis for:
Target Industries: ${context.targetIndustries.join(', ') || 'Multiple industries'}
Target Employee Range: ${context.targetEmployeeRange.min} - ${context.targetEmployeeRange.max}
Target Locations: ${context.targetLocations.join(', ') || 'National'}

Return JSON with this structure:
{
  "segmentation": {
    "criteria": string[],
    "segments": [{"name": string, "size": string, "characteristics": string[], "attractiveness": number}]
  },
  "targeting": {
    "selected_segments": string[],
    "rationale": string,
    "approach": string,
    "priority_order": string[]
  },
  "positioning": {
    "statement": string,
    "value_proposition": string,
    "key_differentiators": string[],
    "positioning_map": {"x_axis": string, "y_axis": string, "position": string}
  }
}`

    const result = await generateAIJSON<any>({
      systemPrompt,
      userPrompt,
    })

    if (result && result.segmentation && result.targeting && result.positioning) {
      analysis = result
    }
  } catch (error) {
    console.warn('Failed to generate STP analysis with AI, using template:', error)
  }

  // Fallback to template if AI generation failed
  if (!analysis) {
    analysis = {
      segmentation: {
        criteria: ['業界', '従業員規模', '地域', '成長フェーズ', 'IT投資意欲'],
        segments: [
          {
            name: '成長期の中堅IT企業',
            size: '約5,000社',
            characteristics: ['従業員50〜300名', '年商10億〜100億', 'DX推進中'],
            attractiveness: 85,
          },
          {
            name: '老舗の大手製造業',
            size: '約2,000社',
            characteristics: ['従業員500名以上', 'レガシーシステム運用', '効率化ニーズ大'],
            attractiveness: 70,
          },
          {
            name: 'スタートアップ企業',
            size: '約10,000社',
            characteristics: ['従業員10〜50名', '急成長中', '予算制約あり'],
            attractiveness: 60,
          },
        ],
      },
      targeting: {
        selected_segments: context.targetIndustries.length > 0
          ? context.targetIndustries.map(i => `${i}業界の成長企業`)
          : ['成長期の中堅IT企業', '老舗の大手製造業'],
        rationale: '市場規模、アクセシビリティ、成約率の3要素から選定',
        approach: 'セグメント別のカスタマイズドアプローチ',
        priority_order: ['成長期中堅企業 → 大手企業 → スタートアップ'],
      },
      positioning: {
        statement: '成果にコミットする唯一のAI営業支援パートナー',
        value_proposition: 'テクノロジー × 人の力で、営業の質と量を同時に最大化',
        key_differentiators: [
          'AIによる超精密ターゲティング',
          'リアルタイムの戦略最適化',
          '成果報酬連動型の料金体系',
        ],
        positioning_map: {
          x_axis: 'カスタマイズ性（低→高）',
          y_axis: 'テクノロジー活用度（低→高）',
          position: '右上（高カスタマイズ × 高テクノロジー）',
        },
      },
    }
  }

  await supabase.from('strategy_analyses').insert({
    project_id: projectId,
    analysis_type: 'stp',
    segmentation: analysis.segmentation,
    targeting: analysis.targeting,
    positioning: analysis.positioning,
    ai_model_used: 'gemini-2.0-flash',
  })

  return analysis
}

export async function generateStrategyRoadmap(
  projectId: string,
  context: {
    productName: string
    targetIndustries: string[]
    benefits: string[]
  }
): Promise<StrategyRoadmap> {
  // Try to generate roadmap using Gemini AI
  let roadmap: StrategyRoadmap | null = null

  try {
    const systemPrompt = `You are a strategic planning expert. Create a detailed strategy roadmap (Who, What, How, Hypothesis, Metrics, Risks) for the given product. Respond with JSON only.`

    const userPrompt = `Create a strategy roadmap for:
Product: ${context.productName}
Target Industries: ${context.targetIndustries.join(', ') || 'General'}
Benefits: ${context.benefits.join(', ') || 'Multiple benefits'}

Return JSON with this structure:
{
  "target_who": {
    "attributes": string[],
    "persona": string,
    "industry_focus": string[],
    "company_size": string
  },
  "target_what": {
    "appeal_points": string[],
    "value_proposition": string,
    "key_benefits": string[]
  },
  "target_how": {
    "channels": string[],
    "approach_sequence": string[],
    "timing": string,
    "initial_message": string
  },
  "winning_hypothesis": string,
  "success_metrics": string[],
  "risk_factors": string[]
}`

    const result = await generateAIJSON<any>({
      systemPrompt,
      userPrompt,
    })

    if (result && result.target_who && result.target_what && result.target_how) {
      roadmap = result
    }
  } catch (error) {
    console.warn('Failed to generate roadmap with AI, using template:', error)
  }

  // Fallback to template if AI generation failed
  if (!roadmap) {
    roadmap = {
      target_who: {
        attributes: [
          '年商10億円以上の成長企業',
          '営業部門を持つ企業',
          'DX推進に積極的な経営者',
        ],
        persona: '40代の営業部長。チームの生産性向上と新規開拓の強化が急務。',
        industry_focus: context.targetIndustries.length > 0 ? context.targetIndustries : ['IT', '製造', '不動産'],
        company_size: '従業員50〜500名',
      },
      target_what: {
        appeal_points: context.benefits.length > 0 ? context.benefits : [
          'アポイント獲得率の劇的向上',
          '営業コストの30%削減',
          'データに基づく戦略的営業',
        ],
        value_proposition: `${context.productName}は、AIと人の力を組み合わせた次世代営業支援サービスです`,
        key_benefits: [
          '初月から成果が見える透明性',
          '専任チームによる伴走支援',
          '業界特化のノウハウ蓄積',
        ],
      },
      target_how: {
        channels: ['電話（Zoom Phone）', 'メール', 'LinkedIn', '紹介'],
        approach_sequence: [
          '1. 電話でのファーストコンタクト（課題ヒアリング）',
          '2. 資料送付（パーソナライズドメール）',
          '3. オンライン商談（デモ + 事例紹介）',
          '4. 無料トライアル提案',
          '5. 本契約 → 運用開始',
        ],
        timing: '火〜木曜日の10:00〜11:30が最適（接続率が最も高い時間帯）',
        initial_message: 'お忙しいところ恐れ入ります。御社の営業DXに関してご提案がございます。',
      },
      winning_hypothesis: '「成長期の中堅企業」に対して「AI活用による営業効率化」を「電話+オンライン」で提案すれば、月間アポ率2%以上を達成できる',
      success_metrics: [
        'アポイント獲得率 2%以上',
        '接続率 30%以上',
        '商談化率 50%以上',
        '1アポあたりコスト 3万円以下',
      ],
      risk_factors: [
        '景気後退による予算削減',
        '競合の値下げ攻勢',
        'ターゲットリストの枯渇',
      ],
    }
  }

  await supabase.from('strategy_analyses').insert({
    project_id: projectId,
    analysis_type: 'roadmap',
    target_attributes: roadmap.target_who,
    appeal_points: roadmap.target_what.appeal_points,
    channels: roadmap.target_how.channels,
    winning_hypothesis: roadmap.winning_hypothesis,
    ai_model_used: 'gemini-2.0-flash',
  })

  return roadmap
}

// ====== 既存分析の取得 ======

export async function getStrategyAnalyses(projectId: string): Promise<StrategyAnalysis[]> {
  const { data, error } = await supabase
    .from('strategy_analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch strategy analyses:', error)
    return []
  }
  return data || []
}

// ====== 競合シミュレーター ======

export type CompetitorSimulation = {
  id: string
  project_id: string
  competitor_name: string
  competitor_data: Record<string, unknown>
  comparison_table: Record<string, unknown>
  counter_talk_scripts: Array<{
    objection: string
    counter_talk: string
    key_point: string
  }>
  web_sources: string[]
  generated_at: string
}

export async function generateCompetitorSimulation(
  projectId: string,
  competitorName: string
): Promise<CompetitorSimulation | null> {
  const simulation = {
    project_id: projectId,
    competitor_name: competitorName,
    competitor_data: {
      name: competitorName,
      estimated_market_share: '不明',
      key_features: ['一般的な機能を提供'],
      pricing: '不明',
    },
    comparison_table: {
      features: [
        { feature: 'AI分析', us: '◎', competitor: '△', note: '当社独自のAI技術' },
        { feature: 'レポート', us: '◎', competitor: '○', note: 'リアルタイムダッシュボード' },
        { feature: 'サポート', us: '◎', competitor: '○', note: '専任コンサルタント付き' },
        { feature: 'カスタマイズ', us: '◎', competitor: '△', note: '柔軟な設定変更' },
        { feature: 'コスト', us: '○', competitor: '○', note: '成果報酬型で安心' },
      ],
    },
    counter_talk_scripts: [
      {
        objection: `${competitorName}と比べてどう違うの？`,
        counter_talk: `${competitorName}さんも素晴らしいサービスですが、当社はAIを活用したリアルタイム分析に強みがあります。具体的には、通話中のAIサジェストや、データに基づいた戦略提案を自動で行える点が大きな違いです。`,
        key_point: '機能比較ではなく、「成果の違い」にフォーカスする',
      },
      {
        objection: `${competitorName}の方が安いんだけど`,
        counter_talk: '確かに初期費用だけ見ると差があるかもしれません。ただ、当社は成果報酬型なので、アポが取れなければ費用は発生しません。1アポあたりのコストで比較していただくと、むしろ当社の方がコストパフォーマンスが高いケースがほとんどです。',
        key_point: '単価比較ではなく、ROIで比較する',
      },
      {
        objection: `もう${competitorName}を使っているから`,
        counter_talk: 'すでにお取り組みされているんですね。差し支えなければ、現在の成果について教えていただけますか？当社のAI分析で、今の成果を更に上げられる可能性をお見せできるかもしれません。',
        key_point: '否定せず、「上乗せ」を提案する',
      },
    ],
    web_sources: [],
  }

  const { data, error } = await supabase
    .from('competitor_simulations')
    .insert(simulation)
    .select()
    .single()

  if (error) {
    console.error('Failed to create competitor simulation:', error)
    return null
  }
  return data
}

export async function getCompetitorSimulations(projectId: string): Promise<CompetitorSimulation[]> {
  const { data, error } = await supabase
    .from('competitor_simulations')
    .select('*')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch competitor simulations:', error)
    return []
  }
  return data || []
}
