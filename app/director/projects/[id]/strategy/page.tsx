'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getProject, type Project } from '@/lib/projects-api'
import {
  generate3CAnalysis,
  generate4PAnalysis,
  generateSTPAnalysis,
  generateStrategyRoadmap,
  getStrategyAnalyses,
  generateCompetitorSimulation,
  getCompetitorSimulations,
  type ThreeCAnalysis,
  type FourPAnalysis,
  type STPAnalysis,
  type StrategyRoadmap,
  type CompetitorSimulation,
} from '@/lib/strategy-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Brain, Users, BarChart3, Target,
  Map, Swords, Loader2, Sparkles, ChevronRight
} from 'lucide-react'

export default function StrategyPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  // 分析結果
  const [threeCData, setThreeCData] = useState<ThreeCAnalysis | null>(null)
  const [fourPData, setFourPData] = useState<FourPAnalysis | null>(null)
  const [stpData, setStpData] = useState<STPAnalysis | null>(null)
  const [roadmap, setRoadmap] = useState<StrategyRoadmap | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorSimulation[]>([])
  const [newCompetitor, setNewCompetitor] = useState('')

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  async function loadData() {
    setLoading(true)
    try {
      const [projectData, existingAnalyses, competitorData] = await Promise.all([
        getProject(projectId),
        getStrategyAnalyses(projectId),
        getCompetitorSimulations(projectId),
      ])
      setProject(projectData)
      setCompetitors(competitorData)
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  const context = {
    clientName: (project?.client as { name: string } | undefined)?.name || '',
    productName: (project?.product as { name: string } | undefined)?.name || project?.name || '',
    productDescription: project?.description || '',
    targetIndustries: [] as string[],
    benefits: [] as string[],
    targetEmployeeRange: { min: 0, max: 10000 },
    targetLocations: [] as string[],
  }

  async function handleGenerate3C() {
    setGenerating('3c')
    try {
      const result = await generate3CAnalysis(projectId, context)
      setThreeCData(result)
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerate4P() {
    setGenerating('4p')
    try {
      const result = await generate4PAnalysis(projectId, context)
      setFourPData(result)
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerateSTP() {
    setGenerating('stp')
    try {
      const result = await generateSTPAnalysis(projectId, context)
      setStpData(result)
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerateRoadmap() {
    setGenerating('roadmap')
    try {
      const result = await generateStrategyRoadmap(projectId, context)
      setRoadmap(result)
    } finally {
      setGenerating(null)
    }
  }

  async function handleAddCompetitor() {
    if (!newCompetitor.trim()) return
    setGenerating('competitor')
    try {
      const result = await generateCompetitorSimulation(projectId, newCompetitor.trim())
      if (result) {
        setCompetitors(prev => [result, ...prev])
        setNewCompetitor('')
      }
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
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
              <Brain className="w-7 h-7 text-purple-600" />
              AI戦略分析
            </h1>
            <p className="text-gray-500">{project?.name}</p>
          </div>
          <Button
            onClick={() => {
              handleGenerate3C()
              handleGenerate4P()
              handleGenerateSTP()
              handleGenerateRoadmap()
            }}
            className="gap-2"
            disabled={generating !== null}
          >
            <Sparkles className="w-4 h-4" />
            全分析を一括実行
          </Button>
        </div>

        {/* タブ */}
        <Tabs defaultValue="3c" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="3c" className="gap-1">
              <Users className="w-3.5 h-3.5" />
              3C分析
            </TabsTrigger>
            <TabsTrigger value="4p" className="gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              4P分析
            </TabsTrigger>
            <TabsTrigger value="stp" className="gap-1">
              <Target className="w-3.5 h-3.5" />
              STP分析
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-1">
              <Map className="w-3.5 h-3.5" />
              戦略ロードマップ
            </TabsTrigger>
            <TabsTrigger value="competitor" className="gap-1">
              <Swords className="w-3.5 h-3.5" />
              競合シミュレーター
            </TabsTrigger>
          </TabsList>

          {/* 3C分析 */}
          <TabsContent value="3c" className="space-y-4">
            {!threeCData ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Customer × Competitor × Company の3軸で市場を分析します</p>
                  <Button onClick={handleGenerate3C} disabled={generating === '3c'} className="gap-2">
                    {generating === '3c' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    3C分析を生成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Customer（顧客）</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">ターゲットセグメント</p>
                      <div className="flex flex-wrap gap-1">
                        {threeCData.customer.target_segments.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">ニーズ</p>
                      {threeCData.customer.needs.map((n, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-blue-500 shrink-0" />
                          {n}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">ペインポイント</p>
                      {threeCData.customer.pain_points.map((p, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-red-500 shrink-0" />
                          {p}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Competitor（競合）</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {threeCData.competitor.main_competitors.map((c, i) => (
                      <div key={i} className="p-2 bg-gray-50 rounded">
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-green-600">強み: {c.strengths.join(', ')}</p>
                        <p className="text-xs text-red-600">弱み: {c.weaknesses.join(', ')}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">差別化ポイント</p>
                      {threeCData.competitor.differentiation_points.map((d, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-green-500 shrink-0" />
                          {d}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Company（自社）</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">強み</p>
                      {threeCData.company.strengths.map((s, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-green-500 shrink-0" />
                          {s}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">USP</p>
                      {threeCData.company.unique_selling_points.map((u, i) => (
                        <Badge key={i} variant="secondary" className="text-xs mr-1 mb-1">{u}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 4P分析 */}
          <TabsContent value="4p" className="space-y-4">
            {!fourPData ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Product × Price × Place × Promotion で最適なマーケティングミックスを策定します</p>
                  <Button onClick={handleGenerate4P} disabled={generating === '4p'} className="gap-2">
                    {generating === '4p' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    4P分析を生成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['product', 'price', 'place', 'promotion'] as const).map(key => {
                  const data = fourPData[key]
                  const colors: Record<string, string> = {
                    product: 'text-blue-600', price: 'text-green-600',
                    place: 'text-orange-600', promotion: 'text-purple-600',
                  }
                  const labels: Record<string, string> = {
                    product: 'Product（製品）', price: 'Price（価格）',
                    place: 'Place（流通）', promotion: 'Promotion（販促）',
                  }
                  return (
                    <Card key={key}>
                      <CardHeader>
                        <CardTitle className={`text-lg ${colors[key]}`}>{labels[key]}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.entries(data).map(([k, v]) => (
                          <div key={k} className="mb-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">{k}</p>
                            {Array.isArray(v) ? (
                              <div className="flex flex-wrap gap-1">
                                {(v as string[]).map((item, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{item}</Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm">{String(v)}</p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* STP分析 */}
          <TabsContent value="stp" className="space-y-4">
            {!stpData ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Segmentation × Targeting × Positioning で市場を定義します</p>
                  <Button onClick={handleGenerateSTP} disabled={generating === 'stp'} className="gap-2">
                    {generating === 'stp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    STP分析を生成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Segmentation</CardTitle>
                    <CardDescription>市場セグメント</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stpData.segmentation.segments.map((seg, i) => (
                      <div key={i} className="p-2 bg-blue-50 rounded">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{seg.name}</p>
                          <Badge variant="outline" className="text-xs">魅力度: {seg.attractiveness}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">規模: {seg.size}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Targeting</CardTitle>
                    <CardDescription>ターゲット選定</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">選定セグメント</p>
                      {stpData.targeting.selected_segments.map((s, i) => (
                        <Badge key={i} variant="default" className="text-xs mr-1 mb-1">{s}</Badge>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">選定理由</p>
                      <p className="text-sm">{stpData.targeting.rationale}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-purple-600">Positioning</CardTitle>
                    <CardDescription>ポジショニング</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="font-medium text-sm text-purple-700">{stpData.positioning.statement}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">差別化要素</p>
                      {stpData.positioning.key_differentiators.map((d, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-purple-500 shrink-0" />
                          {d}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 戦略ロードマップ */}
          <TabsContent value="roadmap" className="space-y-4">
            {!roadmap ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Map className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">「誰に」「何を」「どうやって」攻めるかの戦略ロードマップを策定します</p>
                  <Button onClick={handleGenerateRoadmap} disabled={generating === 'roadmap'} className="gap-2">
                    {generating === 'roadmap' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    ロードマップを生成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* 勝ち筋仮説 */}
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="py-4">
                    <p className="text-xs font-medium text-yellow-600 mb-1">勝ち筋仮説</p>
                    <p className="font-medium">{roadmap.winning_hypothesis}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-blue-600">誰に（Who）</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="text-xs text-gray-500">ペルソナ</p>
                        <p className="text-sm">{roadmap.target_who.persona}</p>
                      </div>
                      {roadmap.target_who.attributes.map((a, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-blue-500 shrink-0" />
                          {a}
                        </p>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-green-600">何を（What）</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-xs text-gray-500">価値提案</p>
                        <p className="text-sm">{roadmap.target_what.value_proposition}</p>
                      </div>
                      {roadmap.target_what.appeal_points.map((a, i) => (
                        <p key={i} className="text-sm flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-1 text-green-500 shrink-0" />
                          {a}
                        </p>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-purple-600">どうやって（How）</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {roadmap.target_how.approach_sequence.map((a, i) => (
                        <p key={i} className="text-sm">{a}</p>
                      ))}
                      <div className="p-2 bg-purple-50 rounded mt-2">
                        <p className="text-xs text-gray-500">最適タイミング</p>
                        <p className="text-sm">{roadmap.target_how.timing}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 成功指標 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">成功指標 (KPI)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {roadmap.success_metrics.map((m, i) => (
                        <Badge key={i} variant="secondary">{m}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 競合シミュレーター */}
          <TabsContent value="competitor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">競合他社を追加</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newCompetitor}
                    onChange={e => setNewCompetitor(e.target.value)}
                    placeholder="競合他社名を入力"
                    onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
                  />
                  <Button onClick={handleAddCompetitor} disabled={generating === 'competitor'} className="gap-2 shrink-0">
                    {generating === 'competitor' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                    分析生成
                  </Button>
                </div>
              </CardContent>
            </Card>

            {competitors.map(comp => (
              <Card key={comp.id}>
                <CardHeader>
                  <CardTitle className="text-lg">vs {comp.competitor_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">切り返しトーク</p>
                    {comp.counter_talk_scripts.map((script, i) => (
                      <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-red-600">反論: 「{script.objection}」</p>
                        <p className="text-sm mt-1">{script.counter_talk}</p>
                        <p className="text-xs text-blue-600 mt-1">ポイント: {script.key_point}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
