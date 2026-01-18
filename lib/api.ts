// API呼び出し関数 - Supabase直接接続版
// 全てのAPIをsupabase-api.tsからre-export

export * from './supabase-api'

// CSVアップロード用の関数（将来の拡張用）
export async function uploadCompaniesCSV(_formData: FormData): Promise<{
  success: boolean
  imported: number
  errors: string[]
}> {
  // TODO: Supabase Storageを使用した実装
  console.log('CSV upload not yet implemented with Supabase')
  return {
    success: false,
    imported: 0,
    errors: ['CSVアップロードは現在開発中です'],
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
