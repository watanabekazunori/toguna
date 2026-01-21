// 企業情報スクレイピング・収集モジュール
// 各種ソースから企業のインテントデータを収集

export type ScrapedData = {
  // 基本情報（公式サイトから）
  companyInfo?: {
    description?: string
    foundedYear?: number
    ceo?: string
    headquarters?: string
    businessModel?: string
    employeeCount?: number
  }

  // 採用情報（求人サイトから）
  hiringSignals?: {
    isHiring: boolean
    jobCount: number
    positions: string[]
    urgency: 'high' | 'medium' | 'low' | 'none'
    lastPosted?: string
  }

  // ニュース・プレスリリース
  newsSignals?: {
    recentNews: Array<{
      title: string
      date: string
      source: string
      type: 'funding' | 'expansion' | 'product' | 'partnership' | 'other'
      url?: string
    }>
    fundingInfo?: {
      amount?: string
      round?: string
      date?: string
    }
  }

  // SNS活動
  socialSignals?: {
    twitterActive: boolean
    linkedinActive: boolean
    recentPostCount: number
    engagementLevel: 'high' | 'medium' | 'low' | 'none'
  }

  // 収集メタデータ
  scrapedAt: string
  sources: string[]
  errors: string[]
}

export type IntentSignalFromScraping = {
  type: 'hiring' | 'expansion' | 'funding' | 'news' | 'technology' | 'social'
  title: string
  description: string
  date: string
  strength: 'high' | 'medium' | 'low'
  source: string
}

// Google検索で企業の公式サイトを探す
async function findCompanyWebsite(companyName: string): Promise<string | null> {
  try {
    // Google Custom Search APIを使う場合はここで実装
    // 現在はシンプルに企業名からURLを推測
    const sanitized = companyName
      .replace(/株式会社|有限会社|合同会社/g, '')
      .trim()
      .toLowerCase()

    // よくあるドメインパターンを試す
    const possibleDomains = [
      `https://${sanitized}.co.jp`,
      `https://${sanitized}.jp`,
      `https://www.${sanitized}.co.jp`,
      `https://www.${sanitized}.jp`,
    ]

    for (const url of possibleDomains) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok) {
          return url
        }
      } catch {
        // 次のURLを試す
      }
    }

    return null
  } catch {
    return null
  }
}

// 企業の公式サイトから情報を取得
async function scrapeCompanyWebsite(url: string): Promise<Partial<ScrapedData['companyInfo']>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TOGUNA-Bot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return {}
    }

    const html = await response.text()

    // シンプルなHTML解析（正規表現ベース）
    const info: Partial<ScrapedData['companyInfo']> = {}

    // 会社概要を抽出
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    if (descMatch) {
      info.description = descMatch[1].slice(0, 500)
    }

    // 設立年を探す
    const foundedMatch = html.match(/設立[：:]\s*(\d{4})年|(\d{4})年\s*設立/i)
    if (foundedMatch) {
      info.foundedYear = parseInt(foundedMatch[1] || foundedMatch[2], 10)
    }

    // 従業員数を探す
    const employeeMatch = html.match(/従業員[数]?[：:]\s*(\d+)[名人]|(\d+)[名人]\s*（|社員数[：:]\s*(\d+)/i)
    if (employeeMatch) {
      info.employeeCount = parseInt(employeeMatch[1] || employeeMatch[2] || employeeMatch[3], 10)
    }

    // 代表者を探す
    const ceoMatch = html.match(/代表[取締役社長]*[：:]\s*([^\s<]+)/i)
    if (ceoMatch) {
      info.ceo = ceoMatch[1].slice(0, 50)
    }

    return info
  } catch {
    return {}
  }
}

// Google Newsから企業ニュースを検索
async function searchCompanyNews(companyName: string): Promise<ScrapedData['newsSignals']> {
  try {
    // Google News RSSフィード（日本語）
    const query = encodeURIComponent(`${companyName} 資金調達 OR 新サービス OR 業務提携`)
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=ja&gl=JP&ceid=JP:ja`

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TOGUNA-Bot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return { recentNews: [] }
    }

    const xml = await response.text()
    const newsItems: ScrapedData['newsSignals'] = { recentNews: [] }

    // XMLから記事を抽出（シンプルな正規表現）
    const itemMatches = xml.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/g)

    let count = 0
    for (const match of itemMatches) {
      if (count >= 5) break

      const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
      const pubDate = match[2]

      // ニュースの種類を判定
      let newsType: 'funding' | 'expansion' | 'product' | 'partnership' | 'other' = 'other'
      if (/資金調達|調達|出資|投資/.test(title)) {
        newsType = 'funding'

        // 資金調達額を抽出
        const amountMatch = title.match(/(\d+(?:\.\d+)?)\s*億円|(\d+)万円/)
        if (amountMatch) {
          newsItems.fundingInfo = {
            amount: amountMatch[0],
            date: new Date(pubDate).toISOString().split('T')[0],
          }
        }
      } else if (/拡大|拡張|新拠点|オープン/.test(title)) {
        newsType = 'expansion'
      } else if (/新サービス|リリース|発表|ローンチ/.test(title)) {
        newsType = 'product'
      } else if (/提携|パートナー|協業|連携/.test(title)) {
        newsType = 'partnership'
      }

      newsItems.recentNews!.push({
        title,
        date: new Date(pubDate).toISOString().split('T')[0],
        source: 'Google News',
        type: newsType,
      })

      count++
    }

    return newsItems
  } catch {
    return { recentNews: [] }
  }
}

// 求人情報を検索（Indeedなど）
async function searchJobPostings(companyName: string): Promise<ScrapedData['hiringSignals']> {
  try {
    // Indeed検索（スクレイピング）
    const query = encodeURIComponent(companyName)
    const indeedUrl = `https://jp.indeed.com/jobs?q=${query}&l=`

    const response = await fetch(indeedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return {
        isHiring: false,
        jobCount: 0,
        positions: [],
        urgency: 'none',
      }
    }

    const html = await response.text()

    // 求人数を抽出
    const jobCountMatch = html.match(/(\d+(?:,\d+)?)\s*件/i)
    const jobCount = jobCountMatch ? parseInt(jobCountMatch[1].replace(',', ''), 10) : 0

    // 職種を抽出（簡易）
    const positions: string[] = []
    const positionMatches = html.matchAll(/class="jobTitle"[^>]*>([^<]+)</gi)
    let posCount = 0
    for (const match of positionMatches) {
      if (posCount >= 5) break
      positions.push(match[1].trim())
      posCount++
    }

    // 緊急度を判定
    let urgency: 'high' | 'medium' | 'low' | 'none' = 'none'
    if (jobCount >= 10) {
      urgency = 'high'
    } else if (jobCount >= 5) {
      urgency = 'medium'
    } else if (jobCount >= 1) {
      urgency = 'low'
    }

    return {
      isHiring: jobCount > 0,
      jobCount,
      positions,
      urgency,
      lastPosted: jobCount > 0 ? new Date().toISOString().split('T')[0] : undefined,
    }
  } catch {
    return {
      isHiring: false,
      jobCount: 0,
      positions: [],
      urgency: 'none',
    }
  }
}

// PR TIMESからプレスリリースを検索
async function searchPressReleases(companyName: string): Promise<ScrapedData['newsSignals']> {
  try {
    const query = encodeURIComponent(companyName)
    const prtimesUrl = `https://prtimes.jp/main/action.php?run=html&page=searchkey&search_word=${query}`

    const response = await fetch(prtimesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return { recentNews: [] }
    }

    const html = await response.text()
    const newsItems: ScrapedData['newsSignals'] = { recentNews: [] }

    // プレスリリースタイトルを抽出
    const titleMatches = html.matchAll(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi)
    let count = 0
    for (const match of titleMatches) {
      if (count >= 5) break

      const title = match[1].trim()
      let newsType: 'funding' | 'expansion' | 'product' | 'partnership' | 'other' = 'other'

      if (/資金調達|調達|出資/.test(title)) newsType = 'funding'
      else if (/拡大|新拠点/.test(title)) newsType = 'expansion'
      else if (/新サービス|リリース|発表/.test(title)) newsType = 'product'
      else if (/提携|パートナー/.test(title)) newsType = 'partnership'

      newsItems.recentNews!.push({
        title,
        date: new Date().toISOString().split('T')[0],
        source: 'PR TIMES',
        type: newsType,
      })

      count++
    }

    return newsItems
  } catch {
    return { recentNews: [] }
  }
}

// メイン：企業情報を収集
export async function scrapeCompanyData(
  companyName: string,
  website?: string
): Promise<ScrapedData> {
  const errors: string[] = []
  const sources: string[] = []
  const scrapedData: ScrapedData = {
    scrapedAt: new Date().toISOString(),
    sources: [],
    errors: [],
  }

  // 1. 公式サイトから情報収集
  try {
    const siteUrl = website || (await findCompanyWebsite(companyName))
    if (siteUrl) {
      const companyInfo = await scrapeCompanyWebsite(siteUrl)
      if (companyInfo && Object.keys(companyInfo).length > 0) {
        scrapedData.companyInfo = companyInfo as ScrapedData['companyInfo']
        sources.push('公式サイト')
      }
    }
  } catch (e) {
    errors.push(`公式サイト取得エラー: ${e instanceof Error ? e.message : '不明'}`)
  }

  // 2. Google Newsから情報収集
  try {
    const newsSignals = await searchCompanyNews(companyName)
    if (newsSignals && newsSignals.recentNews && newsSignals.recentNews.length > 0) {
      scrapedData.newsSignals = newsSignals
      sources.push('Google News')
    }
  } catch (e) {
    errors.push(`ニュース取得エラー: ${e instanceof Error ? e.message : '不明'}`)
  }

  // 3. PR TIMESからプレスリリース収集
  try {
    const prSignals = await searchPressReleases(companyName)
    if (prSignals && prSignals.recentNews && prSignals.recentNews.length > 0) {
      // 既存のニュースとマージ
      if (!scrapedData.newsSignals) {
        scrapedData.newsSignals = { recentNews: [] }
      }
      scrapedData.newsSignals.recentNews = [
        ...(scrapedData.newsSignals.recentNews || []),
        ...prSignals.recentNews,
      ]
      if (prSignals.fundingInfo) {
        scrapedData.newsSignals.fundingInfo = prSignals.fundingInfo
      }
      sources.push('PR TIMES')
    }
  } catch (e) {
    errors.push(`PR TIMES取得エラー: ${e instanceof Error ? e.message : '不明'}`)
  }

  // 4. 求人情報を収集
  try {
    const hiringSignals = await searchJobPostings(companyName)
    if (hiringSignals && (hiringSignals.isHiring || hiringSignals.jobCount > 0)) {
      scrapedData.hiringSignals = hiringSignals
      sources.push('Indeed')
    }
  } catch (e) {
    errors.push(`求人情報取得エラー: ${e instanceof Error ? e.message : '不明'}`)
  }

  scrapedData.sources = sources
  scrapedData.errors = errors

  return scrapedData
}

// スクレイピング結果からインテントシグナルを生成
export function analyzeScrapedData(scrapedData: ScrapedData): {
  signals: IntentSignalFromScraping[]
  intentScore: number
  intentLevel: 'hot' | 'warm' | 'cold'
  buyingStage: 'awareness' | 'consideration' | 'decision' | 'unknown'
  summary: string
} {
  const signals: IntentSignalFromScraping[] = []
  let intentScore = 30 // ベーススコア

  // 採用シグナルの分析
  if (scrapedData.hiringSignals?.isHiring) {
    const hiring = scrapedData.hiringSignals
    let strength: 'high' | 'medium' | 'low' = 'low'

    if (hiring.urgency === 'high') {
      intentScore += 25
      strength = 'high'
    } else if (hiring.urgency === 'medium') {
      intentScore += 15
      strength = 'medium'
    } else {
      intentScore += 8
    }

    signals.push({
      type: 'hiring',
      title: `採用活動中（${hiring.jobCount}件の求人）`,
      description: hiring.positions.length > 0
        ? `募集職種: ${hiring.positions.slice(0, 3).join(', ')}など`
        : '積極的に採用活動を行っています',
      date: hiring.lastPosted || new Date().toISOString().split('T')[0],
      strength,
      source: 'Indeed',
    })
  }

  // ニュースシグナルの分析
  if (scrapedData.newsSignals?.recentNews) {
    for (const news of scrapedData.newsSignals.recentNews.slice(0, 3)) {
      let strength: 'high' | 'medium' | 'low' = 'medium'
      let scoreAdd = 10

      if (news.type === 'funding') {
        scoreAdd = 20
        strength = 'high'
      } else if (news.type === 'expansion') {
        scoreAdd = 15
        strength = 'high'
      } else if (news.type === 'product') {
        scoreAdd = 12
        strength = 'medium'
      }

      intentScore += scoreAdd

      signals.push({
        type: news.type === 'funding' ? 'funding' : news.type === 'expansion' ? 'expansion' : 'news',
        title: news.title.slice(0, 100),
        description: `${news.source}で報道`,
        date: news.date,
        strength,
        source: news.source,
      })
    }

    // 資金調達情報
    if (scrapedData.newsSignals.fundingInfo?.amount) {
      intentScore += 15
    }
  }

  // スコア上限
  intentScore = Math.min(intentScore, 100)

  // インテントレベル判定
  let intentLevel: 'hot' | 'warm' | 'cold' = 'cold'
  if (intentScore >= 70) {
    intentLevel = 'hot'
  } else if (intentScore >= 45) {
    intentLevel = 'warm'
  }

  // 購買ステージ判定
  let buyingStage: 'awareness' | 'consideration' | 'decision' | 'unknown' = 'unknown'
  if (scrapedData.newsSignals?.fundingInfo) {
    buyingStage = 'consideration' // 資金調達後は投資検討期
  } else if (scrapedData.hiringSignals?.urgency === 'high') {
    buyingStage = 'consideration' // 急成長中
  } else if (signals.length >= 2) {
    buyingStage = 'awareness'
  }

  // サマリー生成
  const summaryParts: string[] = []
  if (scrapedData.hiringSignals?.isHiring) {
    summaryParts.push(`採用活動中（${scrapedData.hiringSignals.jobCount}件）`)
  }
  if (scrapedData.newsSignals?.fundingInfo) {
    summaryParts.push(`資金調達${scrapedData.newsSignals.fundingInfo.amount}`)
  }
  if (scrapedData.newsSignals?.recentNews && scrapedData.newsSignals.recentNews.length > 0) {
    summaryParts.push(`最近のニュース${scrapedData.newsSignals.recentNews.length}件`)
  }

  const summary = summaryParts.length > 0
    ? `${summaryParts.join('、')}。${intentLevel === 'hot' ? '高い購買意欲' : intentLevel === 'warm' ? '中程度の関心' : '要フォローアップ'}。`
    : 'インテント情報なし。継続的なモニタリングを推奨。'

  return {
    signals,
    intentScore,
    intentLevel,
    buyingStage,
    summary,
  }
}

// 企業一括スクレイピング（レート制限対策付き）
export async function bulkScrapeCompanies(
  companies: Array<{ id: string; name: string; website?: string }>,
  onProgress?: (current: number, total: number, companyName: string) => void
): Promise<Map<string, ScrapedData>> {
  const results = new Map<string, ScrapedData>()

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i]

    if (onProgress) {
      onProgress(i + 1, companies.length, company.name)
    }

    try {
      const data = await scrapeCompanyData(company.name, company.website)
      results.set(company.id, data)
    } catch (error) {
      results.set(company.id, {
        scrapedAt: new Date().toISOString(),
        sources: [],
        errors: [error instanceof Error ? error.message : 'スクレイピング失敗'],
      })
    }

    // レート制限対策：1秒待機
    if (i < companies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
