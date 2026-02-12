'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getHighEngagementCompanies, type EngagementScore } from '@/lib/nurturing-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Loader2,
  AlertTriangle,
  Eye,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'

const alertLevelConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: 'なし', color: 'bg-gray-100 text-gray-800', icon: <Minus className="w-4 h-4" /> },
  low: { label: '低', color: 'bg-blue-100 text-blue-800', icon: <AlertTriangle className="w-4 h-4" /> },
  medium: {
    label: '中',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  high: { label: '高', color: 'bg-orange-100 text-orange-800', icon: <Zap className="w-4 h-4" /> },
  critical: {
    label: '危機',
    color: 'bg-red-100 text-red-800',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
}

type CompanyWithScore = EngagementScore & { company_name?: string }

export default function EngagementDashboardPage() {
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // 状態管理
  const [companies, setCompanies] = useState<CompanyWithScore[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedAlertLevel, setSelectedAlertLevel] = useState<string>('all')
  const [minScore, setMinScore] = useState<string>('0')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'total_score' | 'trend'>('total_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 認証確認
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isDirector) return

      setIsLoading(true)
      try {
        const [projectsData] = await Promise.all([getProjects()])
        setProjects(projectsData)

        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].id)
          const engagementData = await getHighEngagementCompanies(projectsData[0].id, 0)

          // 各エンゲージメントスコアに企業名を追加
          const companiesWithNames: CompanyWithScore[] = await Promise.all(
            engagementData.map(async (score) => {
              const { data: company } = await supabase
                .from('companies')
                .select('name')
                .eq('id', score.company_id)
                .single()

              return {
                ...score,
                company_name: company?.name || '不明',
              }
            })
          )

          setCompanies(companiesWithNames)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('データの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector, supabase])

  // プロジェクト変更時にスコアを取得
  useEffect(() => {
    const fetchEngagement = async () => {
      if (selectedProject === 'all' || !isDirector) return

      try {
        const engagementData = await getHighEngagementCompanies(selectedProject, 0)

        // 各エンゲージメントスコアに企業名を追加
        const companiesWithNames: CompanyWithScore[] = await Promise.all(
          engagementData.map(async (score) => {
            const { data: company } = await supabase
              .from('companies')
              .select('name')
              .eq('id', score.company_id)
              .single()

            return {
              ...score,
              company_name: company?.name || '不明',
            }
          })
        )

        setCompanies(companiesWithNames)
      } catch (error) {
        console.error('Failed to fetch engagement scores:', error)
        toast.error('スコアの読み込みに失敗しました')
      }
    }

    if (selectedProject !== 'all') {
      fetchEngagement()
    }
  }, [selectedProject, isDirector, supabase])

  // フィルター処理
  const filteredCompanies = companies.filter((company) => {
    // アラートレベルフィルター
    if (selectedAlertLevel !== 'all' && company.alert_level !== selectedAlertLevel) {
      return false
    }

    // 最低スコアフィルター
    const minScoreValue = parseInt(minScore) || 0
    if (company.total_score < minScoreValue) {
      return false
    }

    return true
  })

  // ソート処理
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    let compareValue = 0

    if (sortBy === 'total_score') {
      compareValue = a.total_score - b.total_score
    } else if (sortBy === 'trend') {
      const trendValue: Record<string, number> = {
        rising: 3,
        stable: 2,
        declining: 1,
      }
      compareValue =
        (trendValue[a.score_trend] || 0) - (trendValue[b.score_trend] || 0)
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  // 統計計算
  const totalScoredCompanies = companies.length
  const avgScore = companies.length > 0
    ? Math.round(companies.reduce((sum, c) => sum + c.total_score, 0) / companies.length)
    : 0
  const hotLeadsCount = companies.filter((c) => c.alert_level === 'critical').length
  const risingTrendCount = companies.filter((c) => c.score_trend === 'rising').length

  // スコア内訳バーの描画
  const renderScoreBreakdown = (company: CompanyWithScore) => {
    const total = company.total_score || 1
    const callPct = (company.call_score / total) * 100
    const docPct = (company.document_score / total) * 100
    const webPct = (company.web_activity_score / total) * 100
    const socialPct = (company.social_score / total) * 100

    return (
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-200">
        {company.call_score > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${callPct}%` }}
            title={`通話: ${company.call_score}`}
          />
        )}
        {company.document_score > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${docPct}%` }}
            title={`ドキュメント: ${company.document_score}`}
          />
        )}
        {company.web_activity_score > 0 && (
          <div
            className="bg-purple-500"
            style={{ width: `${webPct}%` }}
            title={`Web活動: ${company.web_activity_score}`}
          />
        )}
        {company.social_score > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${socialPct}%` }}
            title={`ソーシャル: ${company.social_score}`}
          />
        )}
      </div>
    )
  }

  // トレンドアイコン取得
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'stable':
      default:
        return <Minus className="w-4 h-4 text-gray-400" />
    }
  }

  // トレンドラベル取得
  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'rising':
        return '上昇中'
      case 'declining':
        return '低下中'
      case 'stable':
      default:
        return '安定'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                エンゲージメント スコア
              </h1>
              <p className="text-gray-500 mt-1">企業別のエンゲージメント評価ダッシュボード</p>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">スコアリング済み企業</p>
                <p className="text-3xl font-bold text-blue-600">{totalScoredCompanies}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">平均スコア</p>
                <p className="text-3xl font-bold text-purple-600">{avgScore}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">ホットリード</p>
                <p className="text-3xl font-bold text-red-600">{hotLeadsCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">上昇トレンド</p>
                <p className="text-3xl font-bold text-green-600">{risingTrendCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* フィルターとソート */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">プロジェクト</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  アラートレベル
                </label>
                <Select value={selectedAlertLevel} onValueChange={setSelectedAlertLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="critical">危機</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  最小スコア
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">ソート</label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'total_score' | 'trend')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total_score">スコア</SelectItem>
                    <SelectItem value="trend">トレンド</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedProject('all')
                    setSelectedAlertLevel('all')
                    setMinScore('0')
                    setSortBy('total_score')
                    setSortOrder('desc')
                  }}
                >
                  リセット
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 企業テーブル */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : sortedCompanies.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">スコアリング済みの企業がありません</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>企業名</TableHead>
                      <TableHead>スコア</TableHead>
                      <TableHead>スコア内訳</TableHead>
                      <TableHead>トレンド</TableHead>
                      <TableHead>アラート</TableHead>
                      <TableHead>最終活動</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCompanies.map((company) => {
                      const alertConfig = alertLevelConfig[company.alert_level]
                      return (
                        <TableRow
                          key={company.id}
                          className={selectedCompanyId === company.id ? 'bg-blue-50' : ''}
                        >
                          <TableCell className="font-medium">
                            {company.company_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-blue-600">
                                {company.total_score}
                              </span>
                              <span className="text-xs text-gray-500">/100</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              {renderScoreBreakdown(company)}
                              <div className="grid grid-cols-4 gap-1 text-xs">
                                <div>
                                  <span className="text-gray-500">通話</span>
                                  <p className="font-medium">{company.call_score}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">ドキュ</span>
                                  <p className="font-medium">{company.document_score}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Web</span>
                                  <p className="font-medium">{company.web_activity_score}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">社会</span>
                                  <p className="font-medium">{company.social_score}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTrendIcon(company.score_trend)}
                              <span className="text-sm">{getTrendLabel(company.score_trend)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${alertConfig.color} border-0 flex items-center gap-1 w-fit`}>
                              {alertConfig.icon}
                              {alertConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {company.last_activity_at
                              ? new Date(company.last_activity_at).toLocaleDateString('ja-JP')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={selectedCompanyId === company.id ? 'default' : 'outline'}
                              onClick={() =>
                                setSelectedCompanyId(
                                  selectedCompanyId === company.id ? null : company.id
                                )
                              }
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              詳細
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 詳細パネル */}
        {selectedCompanyId && (
          <Card>
            <CardHeader>
              <CardTitle>
                {sortedCompanies.find((c) => c.id === selectedCompanyId)?.company_name} - エンゲージメント詳細
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedCompanies.find((c) => c.id === selectedCompanyId) && (
                <div className="space-y-6">
                  {/* スコア詳細 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">スコア構成</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600">通話スコア</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {sortedCompanies.find((c) => c.id === selectedCompanyId)?.call_score}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600">ドキュメントスコア</p>
                        <p className="text-2xl font-bold text-green-600">
                          {sortedCompanies.find((c) => c.id === selectedCompanyId)?.document_score}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600">Web活動スコア</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {sortedCompanies.find((c) => c.id === selectedCompanyId)?.web_activity_score}
                        </p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600">ソーシャルスコア</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {sortedCompanies.find((c) => c.id === selectedCompanyId)?.social_score}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ステータス情報 */}
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">ステータス</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">トレンド</p>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(sortedCompanies.find((c) => c.id === selectedCompanyId)?.score_trend || 'stable')}
                          <span className="text-sm font-medium">
                            {getTrendLabel(sortedCompanies.find((c) => c.id === selectedCompanyId)?.score_trend || 'stable')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">アラートレベル</p>
                        <Badge
                          className={`${
                            alertLevelConfig[
                              sortedCompanies.find((c) => c.id === selectedCompanyId)?.alert_level || 'none'
                            ].color
                          } border-0 flex items-center gap-1 w-fit`}
                        >
                          {alertLevelConfig[
                            sortedCompanies.find((c) => c.id === selectedCompanyId)?.alert_level || 'none'
                          ].icon}
                          {alertLevelConfig[
                            sortedCompanies.find((c) => c.id === selectedCompanyId)?.alert_level || 'none'
                          ].label}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">最終活動</p>
                        <p className="text-sm font-medium">
                          {sortedCompanies.find((c) => c.id === selectedCompanyId)?.last_activity_at
                            ? new Date(
                                sortedCompanies.find((c) => c.id === selectedCompanyId)?.last_activity_at || ''
                              ).toLocaleDateString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
