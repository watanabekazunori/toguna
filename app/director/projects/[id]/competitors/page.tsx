'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { generateCompetitorSimulation, getCompetitorSimulations, type CompetitorSimulation } from '@/lib/strategy-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'

export default function CompetitorsPage() {
  const { isDirector, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [simulations, setSimulations] = useState<CompetitorSimulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [competitorName, setCompetitorName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Expanded simulation
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createClient()

  // 認可チェック
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.push('/director')
    }
  }, [isDirector, authLoading, router])

  // データロード
  useEffect(() => {
    if (projectId && isDirector) {
      loadSimulations()
    }
  }, [projectId, isDirector])

  async function loadSimulations() {
    try {
      setLoading(true)
      const data = await getCompetitorSimulations(projectId)
      setSimulations(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load simulations:', err)
      setError(err instanceof Error ? err.message : 'シミュレーションの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSimulation() {
    setSubmitError(null)

    if (!competitorName.trim()) {
      setSubmitError('競合企業名を入力してください')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await generateCompetitorSimulation(projectId, competitorName.trim())
      if (result) {
        setCompetitorName('')
        setDialogOpen(false)
        await loadSimulations()
      } else {
        setSubmitError('シミュレーションの生成に失敗しました')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isDirector) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">アクセス権限がありません</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/director/projects/${projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                競合分析
              </h1>
              <p className="text-sm text-gray-500">競合企業の比較分析とカウンタートーク</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新規分析
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>競合企業を分析</DialogTitle>
                <DialogDescription>競合企業名を入力して分析を実行します</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    競合企業名
                  </label>
                  <Input
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="例: 株式会社XXX"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateSimulation()
                      }
                    }}
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {submitError}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false)
                      setCompetitorName('')
                      setSubmitError(null)
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleCreateSimulation}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    分析実行
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* シミュレーション一覧 */}
        {simulations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">競合分析がありません</p>
              <p className="text-sm text-gray-400 mt-2">新規分析ボタンから分析を追加します</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {simulations.map((simulation) => (
              <Card key={simulation.id} className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{simulation.competitor_name}</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">
                        分析日時: {new Date(simulation.generated_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === simulation.id ? null : simulation.id)}
                    >
                      {expandedId === simulation.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {expandedId === simulation.id && (
                  <CardContent className="space-y-6">
                    {/* 競合情報 */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">競合企業情報</h3>
                      <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">企業名:</span>{' '}
                          <span className="text-gray-600">
                            {String(simulation.competitor_data?.name || simulation.competitor_name)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">推定市場シェア:</span>{' '}
                          <span className="text-gray-600">
                            {String(simulation.competitor_data?.estimated_market_share || '不明')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">主な機能:</span>{' '}
                          <span className="text-gray-600">
                            {Array.isArray(simulation.competitor_data?.key_features)
                              ? simulation.competitor_data.key_features.join('、')
                              : '情報なし'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">価格:</span>{' '}
                          <span className="text-gray-600">
                            {String(simulation.competitor_data?.pricing || '不明')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 比較表 */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">機能比較表</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-200 px-3 py-2 text-left font-semibold">機能</th>
                              <th className="border border-gray-200 px-3 py-2 text-center font-semibold w-20">
                                当社
                              </th>
                              <th className="border border-gray-200 px-3 py-2 text-center font-semibold w-20">
                                競合
                              </th>
                              <th className="border border-gray-200 px-3 py-2 text-left font-semibold">特記事項</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(simulation.comparison_table?.features) &&
                              simulation.comparison_table.features.map((row: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="border border-gray-200 px-3 py-2">{row.feature}</td>
                                  <td className="border border-gray-200 px-3 py-2 text-center font-semibold">
                                    {row.us}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 text-center font-semibold">
                                    {row.competitor}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 text-xs text-gray-600">
                                    {row.note}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* カウンタートーク */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">カウンタートークスクリプト</h3>
                      <div className="space-y-3">
                        {Array.isArray(simulation.counter_talk_scripts) &&
                          simulation.counter_talk_scripts.map((script: any, idx: number) => (
                            <div key={idx} className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
                              <div>
                                <Badge className="bg-blue-600 text-white mb-2">異論 {idx + 1}</Badge>
                                <p className="text-sm text-gray-900 font-medium italic">
                                  「{script.objection}」
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-1">対応話法:</p>
                                <p className="text-sm text-gray-700">{script.counter_talk}</p>
                              </div>
                              <div className="bg-white rounded p-2">
                                <p className="text-xs font-semibold text-gray-600 mb-1">重要なポイント:</p>
                                <p className="text-xs text-gray-600">{script.key_point}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* 情報パネル */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">
              <strong>ヒント:</strong> 競合分析は営業チーム全体で共有して、カウンタートークスクリプトを活用してください。
              定期的に新しい競合企業を追加分析することで、市場トレンドをキャッチできます。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
