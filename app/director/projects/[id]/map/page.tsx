'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, MapPin, Building2, CheckCircle2, Phone,
  AlertCircle, X, ChevronDown, ChevronUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  location: string
  industry?: string
  status: string
  employees?: number
  phone?: string
  website?: string
}

interface RegionGroup {
  region: string
  companies: Company[]
  stats: {
    total: number
    未対応: number
    架電済: number
    アポ獲得: number
    NG: number
  }
}

const REGION_ORDER = [
  '東京都',
  '大阪府',
  '京都府',
  '兵庫県',
  '愛知県',
  '福岡県',
  '北海道',
  '神奈川県',
  '埼玉県',
  '千葉県',
]

const STATUS_COLORS = {
  '未対応': 'bg-gray-100 text-gray-700 border-gray-300',
  '架電済': 'bg-blue-100 text-blue-700 border-blue-300',
  'アポ獲得': 'bg-green-100 text-green-700 border-green-300',
  'NG': 'bg-red-100 text-red-700 border-red-300',
}

const STATUS_ICONS = {
  '未対応': <AlertCircle className="w-4 h-4" />,
  '架電済': <Phone className="w-4 h-4" />,
  'アポ獲得': <CheckCircle2 className="w-4 h-4" />,
  'NG': <X className="w-4 h-4" />,
}

export default function MapPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector } = useAuth()
  const projectId = params?.id as string

  const [regions, setRegions] = useState<RegionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/')
    }
  }, [user, isDirector, router])

  // Extract prefecture/region from location string
  const extractRegion = (location: string): string => {
    if (!location) return '不明'

    // Match patterns like "東京都渋谷区", "大阪府大阪市", etc.
    const prefectureMatch = location.match(/^([^都道府県]+[都道府県])/)
    if (prefectureMatch) {
      return prefectureMatch[1]
    }
    return location.split('市')[0] || location
  }

  // Fetch companies for the project
  const fetchCompanies = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', projectId)
        .order('location', { ascending: true })

      if (fetchError) throw fetchError

      // Group companies by region
      const grouped = (data || []).reduce((acc, company) => {
        const region = extractRegion(company.location || '不明')
        const existing = acc.find((g: RegionGroup) => g.region === region)

        if (existing) {
          existing.companies.push(company)
        } else {
          acc.push({
            region,
            companies: [company],
            stats: {
              total: 0,
              未対応: 0,
              架電済: 0,
              アポ獲得: 0,
              NG: 0,
            },
          })
        }
        return acc
      }, [] as RegionGroup[])

      // Calculate statistics for each region
      grouped.forEach((group: RegionGroup) => {
        group.stats.total = group.companies.length
        group.companies.forEach((company: Company) => {
          const status = (company.status || '未対応') as keyof typeof group.stats
          if (status in group.stats) {
            group.stats[status]++
          }
        })
      })

      // Sort regions: prioritize Tokyo, Osaka, then alphabetical
      grouped.sort((a: RegionGroup, b: RegionGroup) => {
        const aIndex = REGION_ORDER.indexOf(a.region)
        const bIndex = REGION_ORDER.indexOf(b.region)

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex
        }
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.region.localeCompare(b.region, 'ja')
      })

      setRegions(grouped)
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
      console.error('Error fetching companies:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const toggleRegion = (region: string) => {
    const newExpanded = new Set(expandedRegions)
    if (newExpanded.has(region)) {
      newExpanded.delete(region)
    } else {
      newExpanded.add(region)
    }
    setExpandedRegions(newExpanded)
  }

  const totalCompanies = regions.reduce((sum, r) => sum + r.stats.total, 0)
  const totalStats = {
    未対応: 0,
    架電済: 0,
    アポ獲得: 0,
    NG: 0,
  }

  regions.forEach(region => {
    Object.entries(region.stats).forEach(([status, count]) => {
      if (status !== 'total' && status in totalStats) {
        totalStats[status as keyof typeof totalStats] += count as number
      }
    })
  })

  if (!user || !isDirector) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <Link href={`/director/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-500" />
              企業地域分布
            </h1>
            <p className="text-gray-500 text-sm">地図ビュー: 企業を地域別に表示</p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-red-700">エラー: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* 統計パネル */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">統計情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{totalCompanies}</p>
                <p className="text-xs text-gray-500 mt-1">総企業数</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{totalStats.未対応}</p>
                <p className="text-xs text-gray-500 mt-1">未対応</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{totalStats.架電済}</p>
                <p className="text-xs text-gray-500 mt-1">架電済</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{totalStats.アポ獲得}</p>
                <p className="text-xs text-gray-500 mt-1">アポ獲得</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{totalStats.NG}</p>
                <p className="text-xs text-gray-500 mt-1">NG</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 地域別カード */}
        {regions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">企業が登録されていません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {regions.map(region => (
              <Card key={region.region} className="overflow-hidden">
                {/* 地域ヘッダー */}
                <button
                  onClick={() => toggleRegion(region.region)}
                  className="w-full text-left p-6 hover:bg-gray-50 transition-colors border-b border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{region.region}</h3>
                        <p className="text-sm text-gray-500">
                          {region.stats.total} 件の企業
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        {region.stats.未対応 > 0 && (
                          <Badge variant="outline" className="gap-1 bg-gray-50">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            {region.stats.未対応}
                          </Badge>
                        )}
                        {region.stats.架電済 > 0 && (
                          <Badge variant="outline" className="gap-1 bg-blue-50">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {region.stats.架電済}
                          </Badge>
                        )}
                        {region.stats.アポ獲得 > 0 && (
                          <Badge variant="outline" className="gap-1 bg-green-50">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {region.stats.アポ獲得}
                          </Badge>
                        )}
                        {region.stats.NG > 0 && (
                          <Badge variant="outline" className="gap-1 bg-red-50">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {region.stats.NG}
                          </Badge>
                        )}
                      </div>
                      {expandedRegions.has(region.region) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* 企業リスト（展開時） */}
                {expandedRegions.has(region.region) && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {region.companies.map(company => (
                        <div
                          key={company.id}
                          className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <h4 className="font-medium text-gray-900 truncate">
                                {company.name}
                              </h4>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              {company.industry && (
                                <p>業種: {company.industry}</p>
                              )}
                              {company.employees && (
                                <p>従業員数: 約{company.employees}名</p>
                              )}
                              {company.phone && (
                                <p>電話: {company.phone}</p>
                              )}
                              {company.website && (
                                <p>
                                  ウェブ:{' '}
                                  <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {company.website}
                                  </a>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-4">
                            <Badge
                              variant="outline"
                              className={`gap-1.5 ${
                                STATUS_COLORS[company.status as keyof typeof STATUS_COLORS] ||
                                STATUS_COLORS['未対応']
                              }`}
                            >
                              {STATUS_ICONS[company.status as keyof typeof STATUS_ICONS] ||
                                STATUS_ICONS['未対応']}
                              {company.status || '未対応'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
