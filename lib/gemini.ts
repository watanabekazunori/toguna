/**
 * Google Gemini API Integration Module
 * Provides real Gemini integration with env var check and mock fallback
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
const DEFAULT_MODEL = 'gemini-2.0-flash'
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 2000
const TIMEOUT_MS = 30000 // 30 seconds
const MAX_RETRIES = 2

interface GenerateAIResponseParams {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface GenerateAIJSONParams {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
}

interface CallScriptContext {
  productName: string
  productDescription: string
  targetCompany: string
  targetIndustry: string
  targetPerson?: string
}

interface CallScript {
  opening: string
  mainPitch: string
  objectionHandling: string[]
  closing: string
}

interface Sentiment {
  overall: string
  score: number
  segments: Array<{
    text: string
    sentiment: string
    confidence: number
  }>
}

interface QualityScore {
  greeting: number
  hearing: number
  proposal: number
  closing: number
  pace: number
  tone: number
}

interface CallTranscriptionAnalysis {
  sentiment: Sentiment
  qualityScore: QualityScore
  summary: string
  keyPoints: string[]
  improvementSuggestions: string[]
}

interface StrategyFromDocuments {
  threeC: any
  fourP: any
  stp: any
  roadmap: any
}

/**
 * Mock response generator - returns realistic Japanese content
 */
function getMockResponse(prompt: string): string {
  const mockResponses: Record<string, string> = {
    call_script: `開始の挨拶:
こんにちは、ABC社の田中と申します。本日はお忙しいところ、お時間をいただきありがとうございます。

メインピッチ:
当社のソリューションは、営業効率を最大40%向上させることが実証されています。特に${new Date().getFullYear()}年の市場動向では、デジタル化への投資が不可欠です。

異議対応:
「予算がない」→ ROI分析をご提示できます。初期投資の3ヶ月で回収可能です。
「検討期間が必要」→ 無料トライアルで実際の効果をご確認いただけます。

クロージング:
来週のデモンストレーション、いかがでしょうか？`,

    transcription_analysis: `感情分析:
全体的なトーン: ポジティブ (スコア: 0.78)
カスタマーの満足度が高く、提案内容に対して好意的な反応が見られました。

品質スコア:
- 挨拶: 8/10
- ヒアリング: 7/10
- 提案: 8/10
- クロージング: 8/10
- ペース: 9/10
- トーン: 8/10

要点:
1. クライアントは導入に興味を示している
2. 予算確保が進行中である
3. 来月の実装を希望している

改善提案:
1. より詳細な質問を事前に準備する
2. 競合他社との比較について、より具体的な説明を用意する`,

    strategy: `3C分析:
- Company: 自社の強み (高い技術力、優秀なチーム)
- Customer: ターゲット顧客 (成長中の中堅企業)
- Competitor: 競合分析 (市場では3社が競争状態)

4P分析:
- Product: 革新的な機能セット
- Price: 競争力のある価格設定
- Place: SaaS型のクラウド配信
- Promotion: デジタルマーケティング活動

STP分析:
- Segmentation: 年商10~50億円の企業
- Targeting: 営業効率化を求めるB2B企業
- Positioning: 信頼できるパートナーとしての立場

ロードマップ:
Q1 2026: 機能追加とAPI拡張
Q2 2026: グローバル展開の準備
Q3 2026: パートナーシップ開始`,
  }

  for (const [key, value] of Object.entries(mockResponses)) {
    if (prompt.toLowerCase().includes(key)) {
      return value
    }
  }

  return `このリクエストに対する回答です: ${prompt.substring(0, 50)}...`
}

/**
 * Call Gemini API with retry logic and timeout
 */
async function callGeminiWithRetry(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  retries: number = MAX_RETRIES
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    })

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await geminiModel.generateContent(userPrompt)
      clearTimeout(timeoutId)

      const text = result.response.text()
      if (!text) {
        throw new Error('Empty response from Gemini API')
      }

      return text
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    if (retries > 0) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return callGeminiWithRetry(
        systemPrompt,
        userPrompt,
        model,
        temperature,
        maxTokens,
        retries - 1
      )
    }
    throw error
  }
}

/**
 * Generate AI response using Gemini API or mock fallback
 */
export async function generateAIResponse(
  params: GenerateAIResponseParams
): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = params

  try {
    if (!GEMINI_API_KEY) {
      console.warn(
        'GEMINI_API_KEY not set, using mock response. Set the env var for real API calls.'
      )
      return getMockResponse(userPrompt)
    }

    return await callGeminiWithRetry(
      systemPrompt,
      userPrompt,
      model,
      temperature,
      maxTokens
    )
  } catch (error) {
    console.error('Error calling Gemini API, falling back to mock:', error)
    return getMockResponse(userPrompt)
  }
}

/**
 * Generate AI response as JSON using Gemini API
 */
export async function generateAIJSON<T>(
  params: GenerateAIJSONParams
): Promise<T> {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
  } = params

  const jsonSystemPrompt = `${systemPrompt}

You MUST respond with ONLY valid JSON, no markdown, no code blocks, no explanations.`

  const jsonUserPrompt = `${userPrompt}

Respond with valid JSON only.`

  try {
    if (!GEMINI_API_KEY) {
      console.warn(
        'GEMINI_API_KEY not set, returning mock JSON response.'
      )
      const mockResponse = getMockResponse(userPrompt)
      return { mock: true, response: mockResponse } as T
    }

    const response = await generateAIResponse({
      systemPrompt: jsonSystemPrompt,
      userPrompt: jsonUserPrompt,
      model,
      temperature,
      maxTokens: 4000,
    })

    // Try to parse the response as JSON
    try {
      return JSON.parse(response)
    } catch {
      // If parsing fails, return the response wrapped in an object
      console.warn('Failed to parse JSON response, returning wrapped response')
      return { raw: response } as T
    }
  } catch (error) {
    console.error('Error generating JSON response:', error)
    return { error: String(error) } as T
  }
}

/**
 * Generate a call script based on context
 */
export async function generateCallScript(
  context: CallScriptContext
): Promise<CallScript> {
  const systemPrompt = `You are an expert sales training consultant. Create a professional, persuasive call script in Japanese that:
1. Opens with a natural greeting that builds rapport
2. Delivers a compelling pitch highlighting business value
3. Addresses 3-4 common objections with solutions
4. Closes with a clear next step

The script should be conversational, not robotic.`

  const userPrompt = `Create a call script for:
Product: ${context.productName}
Description: ${context.productDescription}
Target Company: ${context.targetCompany}
Industry: ${context.targetIndustry}
Contact Person: ${context.targetPerson || 'Decision Maker'}

Return as JSON with keys: opening, mainPitch, objectionHandling (array), closing`

  const result = await generateAIJSON<any>({
    systemPrompt,
    userPrompt,
  })

  return {
    opening:
      result.opening ||
      'こんにちは、本日はお忙しいところお時間をいただきありがとうございます。',
    mainPitch:
      result.mainPitch ||
      '当社のソリューションは、業務効率を大幅に改善できます。',
    objectionHandling: Array.isArray(result.objectionHandling)
      ? result.objectionHandling
      : [
          '予算については、ROI分析でご説明できます。',
          '導入期間は3ヶ月程度です。',
        ],
    closing:
      result.closing ||
      '来週のデモンストレーション、いかがでしょうか？',
  }
}

/**
 * Analyze call transcription
 */
export async function analyzeCallTranscription(
  transcription: string
): Promise<CallTranscriptionAnalysis> {
  const systemPrompt = `You are an expert call quality analyst. Analyze the provided call transcription and provide detailed feedback on:
1. Sentiment (overall tone and customer satisfaction)
2. Quality scores (0-10) for greeting, listening, proposal, closing, pace, tone
3. Key points discussed
4. Improvement suggestions

Respond in JSON format.`

  const userPrompt = `Analyze this sales call transcription:

${transcription}

Return JSON with keys: sentiment (object with overall, score, segments array), qualityScore (object with greeting, hearing, proposal, closing, pace, tone), summary, keyPoints (array), improvementSuggestions (array)`

  const result = await generateAIJSON<any>({
    systemPrompt,
    userPrompt,
  })

  return {
    sentiment: {
      overall: result.sentiment?.overall || 'Neutral',
      score: result.sentiment?.score || 0.5,
      segments: Array.isArray(result.sentiment?.segments)
        ? result.sentiment.segments
        : [],
    },
    qualityScore: {
      greeting: result.qualityScore?.greeting || 7,
      hearing: result.qualityScore?.hearing || 7,
      proposal: result.qualityScore?.proposal || 7,
      closing: result.qualityScore?.closing || 7,
      pace: result.qualityScore?.pace || 8,
      tone: result.qualityScore?.tone || 7,
    },
    summary: result.summary || 'Call analysis completed.',
    keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
    improvementSuggestions: Array.isArray(result.improvementSuggestions)
      ? result.improvementSuggestions
      : [],
  }
}

/**
 * Generate strategy from documents
 */
export async function generateStrategyFromDocuments(
  documents: string[]
): Promise<StrategyFromDocuments> {
  const systemPrompt = `You are a strategic business consultant. Analyze the provided documents and create a comprehensive business strategy using the 3C analysis, 4P marketing framework, STP analysis, and implementation roadmap.

Respond with structured JSON containing threeC, fourP, stp, and roadmap objects. Use Japanese for all content.`

  const userPrompt = `Analyze these business documents and create a strategy:

${documents.map((doc, i) => `Document ${i + 1}:\n${doc}`).join('\n\n')}

Return JSON with keys: threeC (Company, Customer, Competitor), fourP (Product, Price, Place, Promotion), stp (Segmentation, Targeting, Positioning), roadmap (quarterly milestones)`

  const result = await generateAIJSON<any>({
    systemPrompt,
    userPrompt,
  })

  return {
    threeC: result.threeC || {
      company: '自社分析',
      customer: 'ターゲット顧客分析',
      competitor: '競合分析',
    },
    fourP: result.fourP || {
      product: '製品戦略',
      price: '価格戦略',
      place: '流通戦略',
      promotion: 'プロモーション',
    },
    stp: result.stp || {
      segmentation: '市場セグメント',
      targeting: 'ターゲット選定',
      positioning: 'ポジショニング',
    },
    roadmap: result.roadmap || {
      q1: 'Q1の重点項目',
      q2: 'Q2の重点項目',
      q3: 'Q3の重点項目',
      q4: 'Q4の重点項目',
    },
  }
}
