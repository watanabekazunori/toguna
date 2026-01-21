// API呼び出し関数 - Supabase直接接続版
// 全てのAPIをsupabase-api.tsからre-export

export * from './supabase-api'

// スクレイパーモジュールをre-export
export {
  scrapeCompanyData,
  analyzeScrapedData,
  bulkScrapeCompanies,
  type ScrapedData,
  type IntentSignalFromScraping,
} from './scraper'

import { bulkCreateCompanies, type BulkCompanyInput, type Company } from './supabase-api'

// CSVカラム定義
export const CSV_COLUMNS = {
  name: '企業名',
  industry: '業種',
  employees: '従業員数',
  location: '所在地',
  phone: '電話番号',
  website: 'ウェブサイト',
} as const

export type CSVRow = {
  [key: string]: string
}

// CSVパース関数
export function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue

    const row: CSVRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    rows.push(row)
  }

  return rows
}

// CSVからBulkCompanyInputに変換
export function csvRowsToCompanies(rows: CSVRow[], clientId: string): BulkCompanyInput[] {
  return rows.map(row => ({
    name: row['企業名'] || row['name'] || '',
    industry: row['業種'] || row['industry'] || '',
    employees: parseInt(row['従業員数'] || row['employees'] || '0', 10) || 0,
    location: row['所在地'] || row['location'] || undefined,
    phone: row['電話番号'] || row['phone'] || undefined,
    website: row['ウェブサイト'] || row['website'] || undefined,
    client_id: clientId,
  }))
}

// CSVアップロード用の関数
export async function uploadCompaniesCSV(formData: FormData): Promise<{
  success: boolean
  imported: number
  errors: string[]
  companies: Company[]
}> {
  const file = formData.get('file') as File | null
  const clientId = formData.get('client_id') as string | null

  if (!file) {
    return {
      success: false,
      imported: 0,
      errors: ['ファイルが選択されていません'],
      companies: [],
    }
  }

  if (!clientId) {
    return {
      success: false,
      imported: 0,
      errors: ['クライアントが選択されていません'],
      companies: [],
    }
  }

  try {
    const content = await file.text()
    const rows = parseCSV(content)

    if (rows.length === 0) {
      return {
        success: false,
        imported: 0,
        errors: ['CSVファイルにデータがありません'],
        companies: [],
      }
    }

    const companies = csvRowsToCompanies(rows, clientId)
    const result = await bulkCreateCompanies(companies)

    return result
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [error instanceof Error ? error.message : 'CSVの処理中にエラーが発生しました'],
      companies: [],
    }
  }
}

export function getCSVTemplateURL(): string {
  return '/templates/companies-template.csv'
}

// バッチ分析
export async function runBatchAnalysis(companies: Array<{ name?: string; industry?: string; employees?: number; location?: string }>): Promise<{
  results: Array<{
    company: { name?: string; industry?: string; employees?: number; location?: string }
    score: { rank: 'S' | 'A' | 'B' | 'C'; score: number; reasons: string[] }
    intent: { score: number; level: 'hot' | 'warm' | 'cold'; signals: Array<{ type: string; title: string; description: string; date: string; strength: string }>; buyingStage: string; bestContactTiming: string; summary: string }
    analysis: { overview: { description: string; headquarters: string; businessModel: string }; marketPosition: { rank: string; trend: string; strengths: string[]; weaknesses: string[] }; competitors: Array<{ name: string; strength: string; weakness: string }>; opportunities: string[]; risks: string[]; recommendedApproach: { strategy: string; talkingPoints: string[]; objectionHandling: string[]; idealTiming: string } }
    generatedAt: string
  }>
  summary: {
    totalAnalyzed: number
    hotLeads: number
    warmLeads: number
    coldLeads: number
    averageScore: number
  }
}> {
  const { runFullAnalysis } = await import('./supabase-api')
  const results = await Promise.all(companies.map(c => runFullAnalysis(c)))

  return {
    results,
    summary: {
      totalAnalyzed: companies.length,
      hotLeads: results.filter(r => r.intent.level === 'hot').length,
      warmLeads: results.filter(r => r.intent.level === 'warm').length,
      coldLeads: results.filter(r => r.intent.level === 'cold').length,
      averageScore: results.reduce((sum, r) => sum + r.score.score, 0) / results.length,
    },
  }
}
