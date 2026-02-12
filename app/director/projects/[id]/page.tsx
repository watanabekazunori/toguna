'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getProject, getProjectStats, getProjectMembers, type Project, type ProjectStats, type ProjectMember } from '@/lib/projects-api'
import { getPivotAlerts, getGoldenCalls, getCallQualityScores, getRejectionAnalysis, getSubsidyReports, getComplianceDocuments, type PivotAlert, type GoldenCall, type CallQualityScore, type SubsidyReport, type ComplianceDocument } from '@/lib/management-api'
import { getDocumentSends, type DocumentSend } from '@/lib/nurturing-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Brain, Phone, Target, Users, TrendingUp,
  AlertTriangle, Award, BarChart3, FileText, Settings,
  Lightbulb, Shield, Zap, Upload, Gamepad2, MapPin,
  Bug, Globe, BarChart2, Newspaper, Heart, ChevronRight
} from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [alerts, setAlerts] = useState<PivotAlert[]>([])
  const [goldenCalls, setGoldenCalls] = useState<GoldenCall[]>([])
  const [qualityScores, setQualityScores] = useState<CallQualityScore[]>([])
  const [documentSends, setDocumentSends] = useState<DocumentSend[]>([])
  const [rejectionAnalysis, setRejectionAnalysis] = useState<any>(null)
  const [subsidyReports, setSubsidyReports] = useState<SubsidyReport[]>([])
  const [complianceDocuments, setComplianceDocuments] = useState<ComplianceDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  async function loadData() {
    setLoading(true)
    try {
      const projectData = await getProject(projectId)
      const [statsData, membersData, alertsData, goldenData, qualityData, sendsData, rejectionData, reportsData, complianceData] = await Promise.all([
        getProjectStats(projectId),
        getProjectMembers(projectId),
        getPivotAlerts(projectId),
        getGoldenCalls(projectId),
        getCallQualityScores({ operator_id: projectId }),
        getDocumentSends({ operator_id: projectId }),
        getRejectionAnalysis(projectId),
        getSubsidyReports(projectData?.client_id || ''),
        getComplianceDocuments({ client_id: projectData?.client_id }),
      ])
      setProject(projectData)
      setStats(statsData)
      setMembers(membersData)
      setAlerts(alertsData)
      setGoldenCalls(goldenData)
      setQualityScores(qualityData)
      setDocumentSends(sendsData)
      setRejectionAnalysis(rejectionData)
      setSubsidyReports(reportsData)
      setComplianceDocuments(complianceData)
    } catch (error) {
      console.error('Failed to load project data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">プロジェクトが見つかりません</p>
      </div>
    )
  }

  const appointmentRate = stats && stats.total_calls > 0
    ? ((stats.total_appointments / stats.total_calls) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <Link href="/director/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500">
              {(project.client as { name: string } | undefined)?.name || 'クライアント未設定'}
              {project.description && ` - ${project.description}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/director/projects/${projectId}/strategy`}>
              <Button variant="outline" className="gap-2">
                <Brain className="w-4 h-4" />
                AI戦略
              </Button>
            </Link>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              設定
            </Button>
          </div>
        </div>

        {/* ピボットアラート */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map(alert => (
              <Card key={alert.id} className={`border-l-4 ${
                alert.severity === 'critical' ? 'border-l-red-500 bg-red-50' :
                alert.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
                'border-l-blue-500 bg-blue-50'
              }`}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${
                      alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{alert.recommended_action}</p>
                      <div className="flex gap-2 mt-1">
                        {alert.pivot_suggestions.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s.title}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">対応する</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* KPIカード */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Phone className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats?.today_calls || 0}</p>
              <p className="text-xs text-gray-500">本日の架電数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats?.today_appointments || 0}</p>
              <p className="text-xs text-gray-500">本日のアポ</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{appointmentRate}%</p>
              <p className="text-xs text-gray-500">アポ率</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats?.active_operators || 0}</p>
              <p className="text-xs text-gray-500">稼働人数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BarChart3 className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats?.remaining_companies || 0}</p>
              <p className="text-xs text-gray-500">残リスト数</p>
            </CardContent>
          </Card>
        </div>

        {/* タブ */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="members">
            <Link href={`/director/projects/${projectId}/members`} className="flex items-center gap-2">
              メンバー
            </Link>
          </TabsTrigger>
            <TabsTrigger value="quality">品質</TabsTrigger>
            <TabsTrigger value="nurturing">ナーチャリング</TabsTrigger>
            <TabsTrigger value="insights">インサイト</TabsTrigger>
            <TabsTrigger value="compliance">コンプライアンス</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 目標進捗 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    目標進捗
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>日次架電目標</span>
                    <span className="font-medium">
                      {stats?.today_calls || 0} / {project.daily_call_target}件
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(((stats?.today_calls || 0) / project.daily_call_target) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-4">
                    <span>月次アポ目標</span>
                    <span className="font-medium">
                      {stats?.total_appointments || 0} / {project.monthly_appointment_target}件
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(((stats?.total_appointments || 0) / project.monthly_appointment_target) * 100, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* クイックアクション */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    クイックアクション
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href={`/director/projects/${projectId}/strategy`}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Brain className="w-4 h-4 text-purple-500" />
                      AI戦略分析を実行
                    </Button>
                  </Link>
                  <Link href={`/director/projects/${projectId}/documents`}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Upload className="w-4 h-4 text-blue-500" />
                      ドキュメント管理
                    </Button>
                  </Link>
                  <Link href={`/director/projects/${projectId}/roleplay`}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Gamepad2 className="w-4 h-4 text-cyan-500" />
                      バーチャル・ロールプレイ
                    </Button>
                  </Link>
                  <Link href={`/director/projects/${projectId}/triggers`}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Newspaper className="w-4 h-4 text-orange-500" />
                      リアルタイムトリガー
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* プロジェクトツール */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    プロジェクトツール
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link href={`/director/projects/${projectId}/map`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">地域マップ</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/risk-flags`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <Bug className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">リスク管理</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/crawl-jobs`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">クロール管理</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/saturation`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">市場飽和度</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/affinity`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">相性分析</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/strategy`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">AI戦略</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/documents`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">資料管理</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/director/projects/${projectId}/roleplay`}>
                      <Card className="p-3 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">ロールプレイ</span>
                          <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                      </Card>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ゴールデンコール */}
            {goldenCalls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    ゴールデンコール（成功通話）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {goldenCalls.map(gc => (
                      <div key={gc.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{gc.selection_reason || '成功通話'}</p>
                          <p className="text-xs text-gray-500">
                            スコア: {gc.quality_score || '-'}点
                          </p>
                        </div>
                        <Button variant="outline" size="sm">再生</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">プロジェクトメンバー</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">メンバーが割り当てられていません</p>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                            {member.operator?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.operator?.name}</p>
                            <p className="text-xs text-gray-500">{member.operator?.email}</p>
                          </div>
                        </div>
                        <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>
                          {member.role === 'admin' ? '管理者' : member.role === 'manager' ? 'マネージャー' : 'アポインター'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  AI Quality Commander
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                {qualityScores.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">通話品質データが蓄積されると、AIによる自動採点結果がここに表示されます</p>
                    <p className="text-sm text-gray-400 mt-2">通話録音とAI文字起こしが有効な場合に利用可能</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">平均スコア</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {(qualityScores.reduce((sum, s) => sum + (s.total_score || 0), 0) / qualityScores.length).toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">採点済み通話数</p>
                        <p className="text-2xl font-bold text-green-600">{qualityScores.length}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">最高スコア</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {Math.max(...qualityScores.map(s => s.total_score || 0))}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {qualityScores.slice(0, 5).map(score => (
                        <div key={score.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">総合スコア: {score.total_score}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                挨拶: {score.greeting_score} | ヒアリング: {score.hearing_score} | 提案: {score.proposal_score}
                              </p>
                            </div>
                            <Badge variant="outline">{score.total_score >= 75 ? '優秀' : score.total_score >= 60 ? '良好' : '改善推奨'}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nurturing">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ナーチャリング状況</CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                {documentSends.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">資料送付・閲覧トラッキング・エンゲージメントスコアがここに表示されます</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">資料送付数</p>
                        <p className="text-2xl font-bold text-blue-600">{documentSends.length}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">配信済み</p>
                        <p className="text-2xl font-bold text-green-600">
                          {documentSends.filter(s => s.status === 'delivered').length}
                        </p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">送付済み</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {documentSends.filter(s => s.status === 'sent').length}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">最近の配信</h4>
                      {documentSends.slice(0, 5).map(send => (
                        <div key={send.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{send.recipient_email || 'メール未設定'}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(send.sent_at).toLocaleString('ja-JP')}
                              </p>
                            </div>
                            <Badge variant={send.status === 'delivered' ? 'default' : 'secondary'}>
                              {send.status === 'delivered' ? '配信済み' : send.status === 'sent' ? '送付済み' : send.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  「不」のデータベース＆インサイト
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                {!rejectionAnalysis || rejectionAnalysis.total === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">断り文句と顧客の不満が構造化されて表示されます</p>
                    <p className="text-sm text-gray-400 mt-2">データが蓄積されると、新商品開発シミュレーションやクロスセル提案が自動生成されます</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">断り件数</p>
                        <p className="text-2xl font-bold text-orange-600">{rejectionAnalysis.total}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">カテゴリ数</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {Object.keys(rejectionAnalysis.by_category).length}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-3">断り理由の内訳</h4>
                      <div className="space-y-2">
                        {Object.entries(rejectionAnalysis.by_category).map(([category, count]: any) => (
                          <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium">{category}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {rejectionAnalysis.top_pain_points && rejectionAnalysis.top_pain_points.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">顧客の主な課題</h4>
                        <div className="space-y-2">
                          {rejectionAnalysis.top_pain_points.slice(0, 5).map((point: string, i: number) => (
                            <div key={i} className="p-2 bg-yellow-50 rounded text-sm">
                              • {point}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rejectionAnalysis.product_opportunities && rejectionAnalysis.product_opportunities.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">商品開発機会</h4>
                        <div className="space-y-2">
                          {rejectionAnalysis.product_opportunities.map((opp: string, i: number) => (
                            <div key={i} className="p-2 bg-green-50 rounded text-sm">
                              ✓ {opp}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  コンプライアンス＆補助金
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                {subsidyReports.length === 0 && complianceDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">補助金実績報告と証憑管理がここに表示されます</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {subsidyReports.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          補助金実績報告
                        </h4>
                        <div className="space-y-2">
                          {subsidyReports.slice(0, 5).map(report => (
                            <div key={report.id} className="p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">
                                    {report.report_type === 'performance' && '実績報告'}
                                    {report.report_type === 'effect' && '効果報告'}
                                    {report.report_type === 'productivity' && '生産性向上報告'}
                                    {report.report_type === 'wage_increase' && '賃上げ報告'}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {report.report_period_start} ~ {report.report_period_end}
                                  </p>
                                </div>
                                <Badge variant={
                                  report.status === 'submitted' ? 'default' :
                                  report.status === 'accepted' ? 'default' :
                                  'secondary'
                                }>
                                  {report.status === 'draft' && '下書き'}
                                  {report.status === 'generated' && '生成済み'}
                                  {report.status === 'reviewed' && '確認済み'}
                                  {report.status === 'submitted' && '提出済み'}
                                  {report.status === 'accepted' && '承認済み'}
                                  {report.status === 'rejected' && '却下'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {complianceDocuments.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          証憑管理 ({complianceDocuments.length})
                        </h4>
                        <div className="space-y-2">
                          {complianceDocuments.slice(0, 5).map(doc => (
                            <div key={doc.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{doc.title}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    タイプ: {doc.document_type === 'contract' && '契約書'}
                                    {doc.document_type === 'order' && '注文書'}
                                    {doc.document_type === 'delivery' && '納品書'}
                                    {doc.document_type === 'invoice' && '請求書'}
                                    {doc.document_type === 'daily_report' && '日報'}
                                    {doc.document_type === 'other' && 'その他'}
                                  </p>
                                </div>
                                <Badge variant="outline" className={doc.is_immutable ? 'bg-green-50' : ''}>
                                  {doc.is_immutable ? '保管中' : '通常'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
