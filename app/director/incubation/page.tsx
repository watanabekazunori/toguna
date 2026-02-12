'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Bell,
  LogOut,
  Loader2,
  Lightbulb,
  BarChart3,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  getRejectionInsights,
  getRejectionAnalysis,
  getCrossSellRecommendations,
  generateCrossSellRecommendations,
  type RejectionInsight,
  type CrossSellRecommendation,
} from '@/lib/management-api'
import { getProjects, type Project } from '@/lib/projects-api'

type RejectionCategory = 'price' | 'timing' | 'no_need' | 'competitor' | 'authority' | 'budget' | 'satisfaction' | 'other'

const REJECTION_CATEGORY_LABELS: Record<RejectionCategory, string> = {
  price: '価格',
  timing: '時期',
  no_need: '必要性',
  competitor: '競合',
  authority: '権限',
  budget: '予算',
  satisfaction: '満足度',
  other: 'その他',
}

const REJECTION_CATEGORY_COLORS: Record<RejectionCategory, string> = {
  price: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  timing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  no_need: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  competitor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  authority: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  budget: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  satisfaction: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

const SENTIMENT_LABELS: Record<string, string> = {
  neutral: 'ニュートラル',
  negative: 'ネガティブ',
  very_negative: '極度にネガティブ',
}

const STATUS_LABELS: Record<string, string> = {
  suggested: '提案済み',
  accepted: '承認',
  contacted: 'アプローチ済み',
  converted: '転換',
  dismissed: '却下',
}

export default function IncubationPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('insights')

  // Rejection Insights state
  const [rejectionInsights, setRejectionInsights] = useState<RejectionInsight[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [rejectionAnalysis, setRejectionAnalysis] = useState<{
    total: number
    by_category: Record<string, number>
    top_pain_points: string[]
    product_opportunities: string[]
  } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Cross-sell Recommendations state
  const [crossSellRecommendations, setCrossSellRecommendations] = useState<CrossSellRecommendation[]>([])
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false)

  // Projects
  const [projects, setProjects] = useState<Project[]>([])

  // Auth check
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const projectsData = await getProjects({ status: 'active' })
        setProjects(projectsData)

        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].id)
        }
      } catch (error) {
        console.error('Failed to load projects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading && isDirector) {
      loadData()
    }
  }, [authLoading, isDirector])

  // Load rejection insights when project changes
  useEffect(() => {
    if (!selectedProject) return

    const loadRejectionInsights = async () => {
      try {
        const insights = await getRejectionInsights(selectedProject)
        setRejectionInsights(insights)
      } catch (error) {
        console.error('Failed to load rejection insights:', error)
      }
    }

    loadRejectionInsights()
  }, [selectedProject])

  // Load cross-sell recommendations
  useEffect(() => {
    if (activeTab !== 'crosssell') return

    const loadCrossSellRecommendations = async () => {
      try {
        const recs = await getCrossSellRecommendations(selectedProject)
        setCrossSellRecommendations(recs)
      } catch (error) {
        console.error('Failed to load cross-sell recommendations:', error)
      }
    }

    loadCrossSellRecommendations()
  }, [activeTab, selectedProject])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleAnalyzeRejections = async () => {
    if (!selectedProject) return

    setIsAnalyzing(true)
    try {
      const analysis = await getRejectionAnalysis(selectedProject)
      setRejectionAnalysis(analysis)
    } catch (error) {
      console.error('Failed to analyze rejections:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateCrossSellRecommendations = async () => {
    if (!selectedProject) return

    setIsGeneratingRecommendations(true)
    try {
      const recs = await generateCrossSellRecommendations(selectedProject)
      setCrossSellRecommendations(recs)
    } catch (error) {
      console.error('Failed to generate cross-sell recommendations:', error)
    } finally {
      setIsGeneratingRecommendations(false)
    }
  }

  const filteredInsights = rejectionInsights.filter(insight => {
    if (selectedCategory && insight.rejection_category !== selectedCategory) {
      return false
    }
    return true
  })

  const getCategoryColor = (category: string): string => {
    return REJECTION_CATEGORY_COLORS[category as RejectionCategory] || REJECTION_CATEGORY_COLORS.other
  }

  const getCategoryLabel = (category: string): string => {
    return REJECTION_CATEGORY_LABELS[category as RejectionCategory] || category
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
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
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                <Lightbulb className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  プロダクト・インキュベーション
                </h2>
                <p className="text-sm text-slate-500">
                  失注データから新規事業機会を発掘
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto mb-4" />
              <p className="text-slate-600">データを読み込み中...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Project Filter */}
            <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  対象プロジェクト:
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800">
                <TabsTrigger value="insights">「不」データベース</TabsTrigger>
                <TabsTrigger value="crosssell">クロスセル推奨</TabsTrigger>
              </TabsList>

              {/* Tab 1: Rejection Insights */}
              <TabsContent value="insights" className="space-y-6">
                {/* Analysis Summary Cards */}
                {rejectionAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500">総失注件数</p>
                        <p className="text-3xl font-bold">{rejectionAnalysis.total}</p>
                        <p className="text-xs text-slate-500">記録済み</p>
                      </div>
                    </Card>

                    <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500">最多カテゴリ</p>
                        <p className="text-3xl font-bold">
                          {Object.entries(rejectionAnalysis.by_category).length > 0
                            ? getCategoryLabel(
                                Object.entries(rejectionAnalysis.by_category).reduce((a, b) =>
                                  a[1] > b[1] ? a : b
                                )[0]
                              )
                            : '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Object.entries(rejectionAnalysis.by_category).length > 0
                            ? `${Object.values(rejectionAnalysis.by_category).reduce((a, b) => a > b ? a : b, 0)}件`
                            : 'データなし'}
                        </p>
                      </div>
                    </Card>

                    <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500">新規商材アイデア</p>
                        <p className="text-3xl font-bold">{rejectionAnalysis.product_opportunities.length}</p>
                        <p className="text-xs text-slate-500">発掘済み</p>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Category Breakdown */}
                {rejectionAnalysis && Object.keys(rejectionAnalysis.by_category).length > 0 && (
                  <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-amber-600" />
                      失注カテゴリの内訳
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(rejectionAnalysis.by_category)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge className={getCategoryColor(category)}>
                                {getCategoryLabel(category)}
                              </Badge>
                              <span className="text-sm font-medium">{count}件</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all"
                                style={{
                                  width: `${rejectionAnalysis.total > 0 ? (count / rejectionAnalysis.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                )}

                {/* Filter Section */}
                <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">フィルタ</h3>
                    <Button
                      onClick={handleAnalyzeRejections}
                      disabled={isAnalyzing || !selectedProject}
                      size="sm"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          分析中...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          分析を実行
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      カテゴリで絞り込み:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedCategory === '' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory('')}
                      >
                        すべて
                      </Button>
                      {Object.entries(REJECTION_CATEGORY_LABELS).map(([key, label]) => (
                        <Button
                          key={key}
                          variant={selectedCategory === key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory(key)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Insights Table */}
                <Card className="overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-6 py-3 text-left font-bold">日付</th>
                          <th className="px-6 py-3 text-left font-bold">企業</th>
                          <th className="px-6 py-3 text-left font-bold">カテゴリ</th>
                          <th className="px-6 py-3 text-left font-bold">詳細</th>
                          <th className="px-6 py-3 text-left font-bold">センチメント</th>
                          <th className="px-6 py-3 text-left font-bold">潜在ニーズ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInsights.length > 0 ? (
                          filteredInsights.map((insight) => (
                            <tr
                              key={insight.id}
                              className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-xs text-slate-500">
                                {new Date(insight.created_at).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="px-6 py-4 font-medium">{insight.company_id || '-'}</td>
                              <td className="px-6 py-4">
                                <Badge className={getCategoryColor(insight.rejection_category)}>
                                  {getCategoryLabel(insight.rejection_category)}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-xs max-w-xs truncate">
                                {insight.rejection_detail || '-'}
                              </td>
                              <td className="px-6 py-4">
                                {insight.sentiment_score && (
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                      insight.sentiment_score > 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}
                                  >
                                    {insight.sentiment_score > 0 ? 'ポジティブ' : 'ネガティブ'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-xs max-w-xs">
                                {insight.unmet_need ? (
                                  <div className="flex items-start gap-1">
                                    <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <span>{insight.unmet_need}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                              失注インサイトがありません
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Product Opportunities */}
                {rejectionAnalysis && rejectionAnalysis.product_opportunities.length > 0 && (
                  <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-600" />
                      潜在ニーズから生まれた商材アイデア
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rejectionAnalysis.product_opportunities.map((opportunity, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="font-medium text-slate-900 dark:text-slate-100">{opportunity}</p>
                          </div>
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            詳細を確認 <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 2: Cross-Sell Recommendations */}
              <TabsContent value="crosssell" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">AIクロスセル分析</h3>
                  <Button
                    onClick={handleGenerateCrossSellRecommendations}
                    disabled={isGeneratingRecommendations || !selectedProject}
                  >
                    {isGeneratingRecommendations ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        分析実行中...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        AIクロスセル分析実行
                      </>
                    )}
                  </Button>
                </div>

                {crossSellRecommendations.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {crossSellRecommendations.map((rec) => {
                      const targetProject = projects.find(p => p.id === rec.target_project_id)
                      const sourceProject = projects.find(p => p.id === rec.source_project_id)

                      return (
                        <Card
                          key={rec.id}
                          className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-shadow"
                        >
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-sm text-slate-500">企業ID</p>
                                <p className="font-bold text-lg">{rec.company_id}</p>
                              </div>
                              <Badge
                                className={
                                  rec.status === 'suggested'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : rec.status === 'contacted'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    : rec.status === 'converted'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                }
                              >
                                {STATUS_LABELS[rec.status] || rec.status}
                              </Badge>
                            </div>

                            {/* Project Flow */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 mb-1">既存営業 (失注)</p>
                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                  {sourceProject?.name || rec.source_project_id}
                                </p>
                              </div>
                              <ArrowRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 mb-1">新規営業 (推奨)</p>
                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                  {targetProject?.name || rec.target_project_id}
                                </p>
                              </div>
                            </div>

                            {/* Match Score */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">マッチスコア</p>
                                <span className="text-lg font-bold text-blue-600">
                                  {rec.match_score}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                                  style={{ width: `${rec.match_score}%` }}
                                />
                              </div>
                            </div>

                            {/* Match Reasons */}
                            {rec.match_reasons && rec.match_reasons.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">マッチ理由</p>
                                <div className="flex flex-wrap gap-2">
                                  {rec.match_reasons.map((reason, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {reason}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Original Rejection */}
                            {rec.original_rejection_category && (
                              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                <p className="text-xs text-slate-500">元の失注理由</p>
                                <Badge className={getCategoryColor(rec.original_rejection_category)}>
                                  {getCategoryLabel(rec.original_rejection_category)}
                                </Badge>
                              </div>
                            )}

                            {/* Action Button */}
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              アプローチ開始
                            </Button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Card className="p-12 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <TrendingUp className="h-16 w-16 mx-auto mb-4 text-blue-300" />
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                      クロスセル推奨準備中
                    </h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                      失注データを分析してクロスセルの機会を発掘します。
                      「AIクロスセル分析実行」ボタンをクリックして開始してください。
                    </p>
                    <Button
                      onClick={handleGenerateCrossSellRecommendations}
                      disabled={isGeneratingRecommendations || !selectedProject}
                    >
                      {isGeneratingRecommendations ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          分析実行中...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          AIクロスセル分析実行
                        </>
                      )}
                    </Button>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}
