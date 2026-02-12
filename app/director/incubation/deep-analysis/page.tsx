'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  LogOut,
  Bell,
  TrendingDown,
  BarChart3,
  Copy,
  CheckCircle2,
} from 'lucide-react'

interface RejectionInsight {
  id: string
  project_id: string
  category: string
  pain_point: string
  unmet_need: string
  created_at: string
}

interface Project {
  id: string
  name: string
}

interface CategoryDistribution {
  price: number
  timing: number
  no_need: number
  competitor: number
  authority: number
  budget: number
  satisfaction: number
  other: number
}

interface PainPointCluster {
  representative: string
  points: string[]
  size: number
}

interface UnmetNeed {
  need: string
  frequency: number
  uniqueness: number
  opportunityScore: number
}

export default function DeepAnalysisPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [allInsights, setAllInsights] = useState<RejectionInsight[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all')

  const [categoryDist, setCategoryDist] = useState<CategoryDistribution | null>(null)
  const [clusters, setClusters] = useState<PainPointCluster[]>([])
  const [unmetNeeds, setUnmetNeeds] = useState<UnmetNeed[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<Array<{ month: string; count: number }>>([])
  const [crossProjectMatrix, setCrossProjectMatrix] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Fetch projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .limit(100)

        if (projectsError) throw projectsError
        setProjects((projectsData || []) as Project[])

        // Fetch all rejection insights
        const { data: insightsData, error: insightsError } = await supabase
          .from('rejection_insights')
          .select('*')
          .order('created_at', { ascending: false })

        if (insightsError) throw insightsError

        const insights = (insightsData || []) as RejectionInsight[]
        setAllInsights(insights)

        analyzeData(insights, '')
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector])

  useEffect(() => {
    analyzeData(allInsights, selectedProjectId)
  }, [selectedProjectId, timeRange])

  const filterByTimeRange = (insights: RejectionInsight[]): RejectionInsight[] => {
    if (timeRange === 'all') return insights

    const now = new Date()
    const startDate = new Date()

    if (timeRange === 'month') {
      startDate.setMonth(now.getMonth() - 1)
    } else if (timeRange === 'quarter') {
      startDate.setMonth(now.getMonth() - 3)
    } else if (timeRange === 'year') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    return insights.filter((i) => new Date(i.created_at) >= startDate)
  }

  const analyzeData = (insights: RejectionInsight[], projectId: string) => {
    let filtered = insights

    if (projectId) {
      filtered = filtered.filter((i) => i.project_id === projectId)
    }

    filtered = filterByTimeRange(filtered)

    // 1. Category Distribution
    const categories: CategoryDistribution = {
      price: 0,
      timing: 0,
      no_need: 0,
      competitor: 0,
      authority: 0,
      budget: 0,
      satisfaction: 0,
      other: 0,
    }

    filtered.forEach((insight) => {
      const category = insight.category as keyof CategoryDistribution
      if (category in categories) {
        categories[category]++
      } else {
        categories.other++
      }
    })

    setCategoryDist(categories)

    // 2. Pain Point Clustering
    const painPointMap = new Map<string, Set<string>>()
    filtered.forEach((insight) => {
      const existing = painPointMap.get(insight.pain_point) || new Set()
      existing.add(insight.id)
      painPointMap.set(insight.pain_point, existing)
    })

    const clusterArray: PainPointCluster[] = Array.from(painPointMap.entries())
      .map(([point, ids]) => ({
        representative: point,
        points: [point],
        size: ids.size,
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)

    setClusters(clusterArray)

    // 3. Unmet Needs Analysis
    const unmetNeedsMap = new Map<string, { count: number; projects: Set<string> }>()
    filtered.forEach((insight) => {
      const existing = unmetNeedsMap.get(insight.unmet_need) || { count: 0, projects: new Set() }
      existing.count++
      existing.projects.add(insight.project_id)
      unmetNeedsMap.set(insight.unmet_need, existing)
    })

    const needArray: UnmetNeed[] = Array.from(unmetNeedsMap.entries())
      .map(([need, data]) => ({
        need,
        frequency: data.count,
        uniqueness: data.projects.size,
        opportunityScore: data.count * Math.log(data.projects.size + 1),
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 10)

    setUnmetNeeds(needArray)

    // 4. Monthly Trend
    const monthlyMap = new Map<string, number>()
    filtered.forEach((insight) => {
      const date = new Date(insight.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1)
    })

    const trend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
        count,
      }))
      .slice(-12)

    setMonthlyTrend(trend)

    // 5. Cross-Project Comparison Matrix
    const matrix: Record<string, Record<string, number>> = {}
    const categoryKeys = Object.keys(categories)

    projects.forEach((p) => {
      matrix[p.name] = {}
      categoryKeys.forEach((cat) => {
        matrix[p.name][cat] = filtered.filter(
          (i) => i.project_id === p.id && (i.category === cat || (i.category === undefined && cat === 'other'))
        ).length
      })
    })

    setCrossProjectMatrix(matrix)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const generateReportSummary = (): string => {
    if (!categoryDist || unmetNeeds.length === 0) {
      return '分析データがありません'
    }

    const topCategory = Object.entries(categoryDist).sort(([, a], [, b]) => b - a)[0]
    const topUnmetNeed = unmetNeeds[0]
    const topCluster = clusters[0]

    return `【「不」データ深層分析レポート】

生成日時: ${new Date().toLocaleDateString('ja-JP')}

■ 主要カテゴリ分析
最多却下理由: ${topCategory[0]} (${topCategory[1]}件)

■ ペインポイント分析
最大クラスタ: "${topCluster?.representative}" (${topCluster?.size}件の指摘)

■ 未充足ニーズ分析
機会スコア最高: "${topUnmetNeed.need}"
- 頻度: ${topUnmetNeed.frequency}件
- プロジェクト数: ${topUnmetNeed.uniqueness}個
- 機会スコア: ${topUnmetNeed.opportunityScore.toFixed(2)}

■ カテゴリ分布
${Object.entries(categoryDist || {})
  .filter(([, count]) => count > 0)
  .map(([cat, count]) => `  ${cat}: ${count}件`)
  .join('\n')}

■ 推奨アクション
1. 最多却下理由「${topCategory[0]}」への対策検討
2. ペインポイント「${topCluster?.representative}」の詳細分析
3. 未充足ニーズ「${topUnmetNeed.need}」のソリューション開発`
  }

  const handleCopyReport = async () => {
    const summary = generateReportSummary()
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError('コピーに失敗しました')
    }
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const totalRejections = Object.values(categoryDist || {}).reduce((sum, count) => sum + count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/director">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            <Badge className="bg-purple-500 text-white px-4 py-1 text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name}</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {user?.name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director/incubation">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingDown className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  「不」データ深層分析
                </h2>
                <p className="text-sm text-slate-500">
                  却下データの詳細分析と機会発掘
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleCopyReport}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
          >
            {copied && <CheckCircle2 className="h-4 w-4 mr-2" />}
            {!copied && <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'コピー完了' : 'レポート出力'}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="プロジェクト選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全プロジェクト</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              <SelectItem value="month">過去1ヶ月</SelectItem>
              <SelectItem value="quarter">過去3ヶ月</SelectItem>
              <SelectItem value="year">過去1年</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {isLoading ? (
          <Card className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <p className="text-sm text-slate-500 mb-2">総却下件数</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totalRejections}</p>
              </Card>

              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <p className="text-sm text-slate-500 mb-2">ペインポイント数</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{clusters.length}</p>
              </Card>

              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <p className="text-sm text-slate-500 mb-2">未充足ニーズ</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{unmetNeeds.length}</p>
              </Card>

              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <p className="text-sm text-slate-500 mb-2">関連プロジェクト</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {new Set(allInsights.map((i) => i.project_id)).size}
                </p>
              </Card>
            </div>

            {/* 1. Category Distribution */}
            {categoryDist && (
              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  カテゴリ分布
                </h3>

                <div className="space-y-3">
                  {Object.entries(categoryDist)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => {
                      const percentage = ((count / totalRejections) * 100).toFixed(1)
                      return (
                        <div key={category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium capitalize">{category}</span>
                            <span className="text-sm text-slate-500">
                              {count}件 ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </Card>
            )}

            {/* 2. Pain Point Clustering */}
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                ペインポイント クラスタリング
              </h3>

              <div className="space-y-3">
                {clusters.map((cluster, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {cluster.representative}
                        </p>
                      </div>
                      <Badge variant="secondary">{cluster.size}件</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 3. Unmet Needs Analysis */}
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                未充足ニーズ分析（機会スコア順）
              </h3>

              <div className="space-y-3">
                {unmetNeeds.map((need, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {need.need}
                        </p>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>頻度: {need.frequency}件</span>
                          <span>プロジェクト数: {need.uniqueness}個</span>
                          <span className="text-blue-600 font-medium">
                            スコア: {need.opportunityScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {need.opportunityScore.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-purple-400 h-full rounded-full"
                        style={{
                          width: `${(need.opportunityScore / (unmetNeeds[0]?.opportunityScore || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 4. Monthly Trend */}
            {monthlyTrend.length > 0 && (
              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                  却下トレンド（月別）
                </h3>

                <div className="flex items-end gap-1 h-48">
                  {monthlyTrend.map((data, idx) => {
                    const maxCount = Math.max(...monthlyTrend.map((d) => d.count))
                    const height = ((data.count / maxCount) * 100) || 10
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t" style={{ height: `${height}%` }} />
                        <p className="text-xs text-slate-500 mt-2 text-center truncate">{data.month}</p>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* 5. Cross-Project Comparison */}
            {Object.keys(crossProjectMatrix).length > 0 && (
              <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6 overflow-x-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                  プロジェクト別カテゴリ比較
                </h3>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-2 font-medium text-slate-600 dark:text-slate-400">
                        プロジェクト
                      </th>
                      {Object.keys(categoryDist || {}).map((cat) => (
                        <th
                          key={cat}
                          className="text-center py-2 px-2 font-medium text-slate-600 dark:text-slate-400 capitalize"
                        >
                          {cat}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(crossProjectMatrix).map(([projectName, categories]) => (
                      <tr
                        key={projectName}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-2 px-2 font-medium text-slate-900 dark:text-slate-100">
                          {projectName}
                        </td>
                        {Object.keys(categoryDist || {}).map((cat) => (
                          <td key={cat} className="text-center py-2 px-2">
                            <Badge variant="outline">
                              {(categories as Record<string, number>)[cat] || 0}
                            </Badge>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
