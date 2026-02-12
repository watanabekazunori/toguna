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

// CSVカラム定義（シンプル形式）
export const CSV_COLUMNS = {
  name: '企業名',
  industry: '業種',
  employees: '従業員数',
  location: '所在地',
  phone: '電話番号',
  website: 'ウェブサイト',
} as const

// SalesRadar形式のカラムマッピング
export const SALES_RADAR_COLUMNS = {
  name: '法人名称',
  industry: '業種',
  industryLarge: '業種(大分類1)',
  industryMedium: '業種(中分類1)',
  employees: '従業員数(人)',
  location: '本社所在地(WEBサイト掲載)',
  locationRegistry: '本社所在地(登記情報)',
  prefecture: '都道府県(WEBサイト掲載)',
  prefectureRegistry: '都道府県(登記情報)',
  phone: '電話番号',
  website: 'サイトURL',
  email: 'メールアドレス',
  capital: '資本金(円)',
  revenue: '売上高(円)',
  ceo: '代表者名',
  foundedDate: '設立年月日',
  corporateNumber: '法人番号',
  corporateGrade: '法人グレード',
  listingStatus: '上場区分',
  summary: '法人サマリー',
} as const

export type CSVRow = {
  [key: string]: string
}

// CSVパース関数（引用符付きフィールド対応）
export function parseCSV(content: string): CSVRow[] {
  // BOMを削除（UTF-8 BOM: U+FEFF）
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1)
  }

  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  // ヘッダーをパース（引用符対応）
  const headers = parseCSVLine(lines[0])
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const row: CSVRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return rows
}

// CSVの1行をパース（引用符対応）
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"'
        i++ // 次の文字をスキップ
      } else {
        // クォートのトグル
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      // フィールド終了
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // 最後のフィールドを追加
  result.push(current.trim())
  return result
}

// 従業員数の文字列をパース（SalesRadar形式対応）
function parseEmployeeCount(value: string | undefined): number {
  if (!value) return 0

  // 数値のみの場合
  const numMatch = value.match(/^(\d+)$/)
  if (numMatch) return parseInt(numMatch[1], 10)

  // 「～5未満」「5以上～10未満」などの形式
  const rangeMatch = value.match(/(\d+)以上/)
  if (rangeMatch) return parseInt(rangeMatch[1], 10)

  // 「～5未満」の場合は3を返す
  if (value.includes('未満') && !value.includes('以上')) {
    const maxMatch = value.match(/(\d+)未満/)
    if (maxMatch) return Math.floor(parseInt(maxMatch[1], 10) / 2)
  }

  return 0
}

// CSVからBulkCompanyInputに変換（SalesRadar形式対応）
export function csvRowsToCompanies(rows: CSVRow[], clientId: string): BulkCompanyInput[] {
  return rows.map(row => {
    // SalesRadar形式かシンプル形式か判定
    const isSalesRadar = '法人名称' in row || 'サイトURL' in row

    let name = ''
    let industry = ''
    let employees = 0
    let location: string | undefined
    let phone: string | undefined
    let website: string | undefined

    if (isSalesRadar) {
      // SalesRadar形式
      name = row['法人名称'] || ''
      // 業種は大分類を使用、なければ業種カラム
      industry = row['業種(大分類1)'] || row['業種']?.split(',')[0]?.split('/')[0] || ''
      employees = parseEmployeeCount(row['従業員数(人)'])
      location = row['本社所在地(WEBサイト掲載)'] || row['本社所在地(登記情報)'] ||
                 (row['都道府県(WEBサイト掲載)'] || row['都道府県(登記情報)'] || '')
      phone = row['電話番号'] || undefined
      website = row['サイトURL'] || undefined
    } else {
      // シンプル形式
      name = row['企業名'] || row['name'] || ''
      industry = row['業種'] || row['industry'] || ''
      employees = parseInt(row['従業員数'] || row['employees'] || '0', 10) || 0
      location = row['所在地'] || row['location'] || undefined
      phone = row['電話番号'] || row['phone'] || undefined
      website = row['ウェブサイト'] || row['website'] || undefined
    }

    return {
      name: name.trim(),
      industry: industry.trim(),
      employees,
      location: location?.trim() || undefined,
      phone: phone?.trim() || undefined,
      website: website?.trim() || undefined,
      client_id: clientId,
      // SalesRadar形式の場合は全カラムを保存
      salesradar_data: isSalesRadar ? row : undefined,
    }
  })
}

// SheetJS型定義
type XLSXType = {
  read: (data: ArrayBuffer, opts?: { type: string }) => {
    SheetNames: string[]
    Sheets: Record<string, unknown>
  }
  utils: {
    sheet_to_json: <T>(sheet: unknown, opts?: { defval: string }) => T[]
  }
}

// Excelファイルをパース（SheetJS CDN版）
export async function parseExcel(file: File): Promise<CSVRow[]> {
  // SheetJSをCDNから動的にロード
  if (typeof window !== 'undefined' && !(window as unknown as { XLSX?: unknown }).XLSX) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('SheetJS load failed'))
      document.head.appendChild(script)
    })
  }

  const XLSX = (window as unknown as { XLSX: XLSXType }).XLSX
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  // 最初のシートを使用
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // シートをJSONに変換
  const data = XLSX.utils.sheet_to_json<CSVRow>(worksheet, { defval: '' })
  return data
}

// ファイルタイプを判定
function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')
}

// CSV/Excelアップロード用の関数（Shift-JIS対応）
export async function uploadCompaniesCSV(formData: FormData): Promise<{
  success: boolean
  imported: number
  errors: string[]
  skipped: number
  duplicates: Array<{ name: string; phone: string }>
  companies: Company[]
}> {
  const file = formData.get('file') as File | null
  const clientId = formData.get('client_id') as string | null
  const skipDuplicates = (formData.get('skip_duplicates') as string | null) === 'true'

  if (!file) {
    return {
      success: false,
      imported: 0,
      errors: ['ファイルが選択されていません'],
      skipped: 0,
      duplicates: [],
      companies: [],
    }
  }

  if (!clientId) {
    return {
      success: false,
      imported: 0,
      errors: ['クライアントが選択されていません'],
      skipped: 0,
      duplicates: [],
      companies: [],
    }
  }

  try {
    let rows: CSVRow[]

    // ファイルタイプに応じてパース
    if (isExcelFile(file)) {
      rows = await parseExcel(file)
    } else {
      // ArrayBufferで読み込んでエンコーディング検出
      const buffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(buffer)

      // エンコーディング検出（Shift-JISまたはUTF-8）
      const encoding = detectEncoding(uint8)

      // デコード
      const decoder = new TextDecoder(encoding)
      const content = decoder.decode(uint8)

      rows = parseCSV(content)
    }

    if (rows.length === 0) {
      return {
        success: false,
        imported: 0,
        errors: ['CSVファイルにデータがありません'],
        skipped: 0,
        duplicates: [],
        companies: [],
      }
    }

    const companies = csvRowsToCompanies(rows, clientId)

    // 重複チェック
    const { validCompanies, duplicateCompanies, duplicateErrors } = await checkDuplicates(
      companies,
      skipDuplicates
    )

    const result = await bulkCreateCompanies(validCompanies)

    return {
      ...result,
      skipped: duplicateCompanies.length,
      duplicates: duplicateCompanies,
      errors: [...duplicateErrors, ...result.errors],
    }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [error instanceof Error ? error.message : 'CSVの処理中にエラーが発生しました'],
      skipped: 0,
      duplicates: [],
      companies: [],
    }
  }
}

// エンコーディング検出
function detectEncoding(uint8: Uint8Array): string {
  // UTF-8 BOM チェック
  if (uint8.length >= 3 && uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    return 'utf-8'
  }

  // Shift-JIS マルチバイト文字を検出
  // Shift-JISのリード バイト: 0x81-0x9F, 0xE0-0xEF
  // トレーリング バイト: 0x40-0x7E, 0x80-0xFC
  for (let i = 0; i < Math.min(uint8.length - 1, 5000); i++) {
    const byte1 = uint8[i]
    if ((byte1 >= 0x81 && byte1 <= 0x9F) || (byte1 >= 0xE0 && byte1 <= 0xEF)) {
      const byte2 = uint8[i + 1]
      if ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFC)) {
        // Shift-JIS の2バイト文字パターンマッチ
        return 'shift-jis'
      }
    }
  }

  // デフォルトはUTF-8
  return 'utf-8'
}

// 重複チェック
async function checkDuplicates(
  companies: BulkCompanyInput[],
  skipDuplicates: boolean
): Promise<{
  validCompanies: BulkCompanyInput[]
  duplicateCompanies: Array<{ name: string; phone: string }>
  duplicateErrors: string[]
}> {
  const duplicateCompanies: Array<{ name: string; phone: string }> = []
  const duplicateErrors: string[] = []

  if (companies.length === 0) {
    return { validCompanies: [], duplicateCompanies: [], duplicateErrors: [] }
  }

  try {
    // 企業名と電話番号の組み合わせを抽出
    const companyNames = companies.map((c: BulkCompanyInput) => c.name)

    // supabase-apiから関数をインポート
    const { getCompanies } = await import('./supabase-api')

    // DBから既存の企業を取得（名前でフィルタリング）
    const existingCompanies = await getCompanies()
    const filteredExisting = existingCompanies.filter((c) => companyNames.includes(c.name))

    // 既存企業との比較
    const existingSet = new Set(
      filteredExisting.map((c: { name: string; phone?: string }) => `${c.name}|${c.phone || ''}`)
    )

    const validCompanies: BulkCompanyInput[] = []

    companies.forEach((company: BulkCompanyInput) => {
      const key = `${company.name}|${company.phone || ''}`
      if (existingSet.has(key)) {
        duplicateCompanies.push({
          name: company.name,
          phone: company.phone || '',
        })
        if (!skipDuplicates) {
          duplicateErrors.push(`重複: ${company.name}${company.phone ? `(${company.phone})` : ''}`)
        }
      } else {
        validCompanies.push(company)
      }
    })

    return { validCompanies, duplicateCompanies, duplicateErrors }
  } catch (err) {
    duplicateErrors.push(
      `重複チェック中にエラーが発生しました: ${err instanceof Error ? err.message : '不明なエラー'}`
    )
    return { validCompanies: companies, duplicateCompanies: [], duplicateErrors }
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
