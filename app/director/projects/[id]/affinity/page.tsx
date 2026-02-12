'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Sparkles, TrendingUp, Users, Target,
  Loader2, CheckCircle2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Operator {
  id: string
  name: string
  email: string
}

interface AffinityScore {
  id: string
  operator_id: string
  operator?: Operator
  industry: string
  region: string
  score: number
  success_count: number
  total_calls: number
  last_calculated_at: string
}

interface OperatorIndustryMatch {
  operator_id: string
  operator_name: string
  industry: string
  score: number
  success_rate: number
  success_count: number
  total_calls: number
}

interface Company {
  id: string
  industry?: string
}

interface CallLog {
  id: string
  operator_id: string
  company_id: string
  company?: Company
  result: string
}

export default function AffinityPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector } = useAuth()
  const projectId = params?.id as string

  const [affinityScores, setAffinityScores] = useState<AffinityScore[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [topMatches, setTopMatches] = useState<OperatorIndustryMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/')
    }
  }, [user, isDirector, router])

  // Fetch affinity scores and related data
  const fetchData = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // Fetch operators
      const { data: operatorsData, error: operatorsError } = await supabase
        .from('operators')
        .select('id, name, email')
        .order('name')

      if (operatorsError) throw operatorsError

      setOperators(operatorsData || [])

      // Fetch affinity scores for project
      // First get companies for this project to filter affinity scores
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, industry')
        .eq('project_id', projectId)

      if (companiesError) throw companiesError

      const companyIds = (companiesData || []).map(c => c.id)
      const industrySet = new Set(
        (companiesData || [])
          .filter(c => c.industry)
          .map(c => c.industry as string)
      )

      // Fetch affinity scores where company_id is in our project
      let affinity: AffinityScore[] = []
      if (companyIds.length > 0) {
        const { data: affinityData, error: affinityError } = await supabase
          .from('affinity_scores')
          .select('*')
          .in('company_id', companyIds)

        if (affinityError) throw affinityError
        affinity = (affinityData || []).map(score => ({
          ...score,
          industry: score.industry || 'その他',
          region: score.region || '不明',
        }))
      }

      setAffinityScores(affinity)
      setIndustries(Array.from(industrySet).sort())

      // Calculate top matches
      const matchMap = new Map<string, OperatorIndustryMatch>()

      affinity.forEach(score => {
        const key = `${score.operator_id}-${score.industry}`
        const existing = matchMap.get(key)

        if (existing) {
          existing.success_count += score.success_count || 0
          existing.total_calls += score.total_calls || 0
          existing.score = Math.max(existing.score, score.score || 0)
        } else {
          const operator = operatorsData?.find(op => op.id === score.operator_id)
          matchMap.set(key, {
            operator_id: score.operator_id,
            operator_name: operator?.name || 'Unknown',
            industry: score.industry,
            score: score.score || 0,
            success_count: score.success_count || 0,
            total_calls: score.total_calls || 0,
            success_rate: 0,
          })
        }
      })

      const matches = Array.from(matchMap.values())
      matches.forEach(match => {
        match.success_rate =
          match.total_calls > 0 ? (match.success_count / match.total_calls) * 100 : 0
      })

      matches.sort((a, b) => b.score - a.score)
      setTopMatches(matches.slice(0, 10))
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
      console.error('Error fetching affinity data:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Recalculate affinity scores
  const handleRecalculate = async () => {
    if (!projectId) return

    try {
      setRecalculating(true)
      setError(null)
      const supabase = createClient()

      // Fetch all call logs for the project
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, industry')
        .eq('project_id', projectId)

      if (companiesError) throw companiesError

      const companyIds = (companiesData || []).map(c => c.id)
      if (companyIds.length === 0) {
        setError('このプロジェクトに企業が登録されていません')
        return
      }

      // Fetch call logs
      const { data: callLogsData, error: callLogsError } = await supabase
        .from('call_logs')
        .select('id, operator_id, company_id, result')
        .in('company_id', companyIds)

      if (callLogsError) throw callLogsError

      // Group by operator_id + company industry
      const industryMap = new Map<string, string>()
      ;(companiesData || []).forEach(c => {
        industryMap.set(c.id, c.industry || 'その他')
      })

      const groupedData = new Map<
        string,
        {
          operator_id: string
          industry: string
          total: number
          success: number
        }
      >()

      ;(callLogsData || []).forEach(log => {
        const industry = industryMap.get(log.company_id) || 'その他'
        const key = `${log.operator_id}-${industry}`
        const existing = groupedData.get(key)
        const isSuccess = log.result === 'アポ獲得' || log.result === 'success'

        if (existing) {
          existing.total += 1
          if (isSuccess) existing.success += 1
        } else {
          groupedData.set(key, {
            operator_id: log.operator_id,
            industry,
            total: 1,
            success: isSuccess ? 1 : 0,
          })
        }
      })

      // Upsert into affinity_scores
      const upsertData = Array.from(groupedData.values()).map(item => {
        // Use a deterministic ID based on operator_id + industry
        // Since we don't have company_id based affinity in task requirements,
        // we'll create entries with industry and region
        const score = item.total > 0 ? (item.success / item.total) * 100 : 0
        return {
          operator_id: item.operator_id,
          industry: item.industry,
          region: '全体', // Aggregate across regions
          score: Math.round(score * 10) / 10,
          success_count: item.success,
          total_calls: item.total,
          last_calculated_at: new Date().toISOString(),
        }
      })

      // Delete existing affinity scores for this project first
      const projectOperators = new Set<string>()
      ;(companiesData || []).forEach(() => {})

      // Delete and recreate affinity scores
      if (upsertData.length > 0) {
        // Note: Using company-based affinity scores from the actual schema
        // Since the actual affinity_scores has company_id, we'll work with that
        const { error: deleteError } = await supabase
          .from('affinity_scores')
          .delete()
          .in('company_id', companyIds)

        if (deleteError) console.warn('Delete warning:', deleteError)

        // Recreate affinity scores (company-based)
        const companyAffinityData = new Map<string, any[]>()

        ;(callLogsData || []).forEach(log => {
          const key = log.company_id
          if (!companyAffinityData.has(key)) {
            companyAffinityData.set(key, [])
          }
          companyAffinityData.get(key)!.push(log)
        })

        const insertData: any[] = []
        companyAffinityData.forEach((logs, companyId) => {
          logs.forEach(log => {
            const industryName = industryMap.get(log.company_id) || 'その他'
            const successCount = logs.filter(
              l => l.result === 'アポ獲得' || l.result === 'success'
            ).length
            const successRate =
              logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0

            insertData.push({
              operator_id: log.operator_id,
              company_id: companyId,
              score: successRate,
              factors: {
                industry: industryName,
                success_rate: successRate,
              },
              calculated_at: new Date().toISOString(),
            })
          })
        })

        if (insertData.length > 0) {
          const { error: insertError } = await supabase
            .from('affinity_scores')
            .insert(insertData)

          if (insertError) throw insertError
        }
      }

      // Refresh data
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : '再計算に失敗しました'
      setError(message)
      console.error('Error recalculating affinity:', err)
    } finally {
      setRecalculating(false)
    }
  }

  // Calculate heatmap colors
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500 text-white'
    if (score >= 60) return 'bg-green-300 text-gray-800'
    if (score >= 40) return 'bg-yellow-300 text-gray-800'
    if (score >= 20) return 'bg-orange-300 text-gray-800'
    return 'bg-red-300 text-white'
  }

  const buildHeatmapMatrix = () => {
    const matrix: Record<string, Record<string, number | null>> = {}

    operators.forEach(op => {
      matrix[op.id] = {}
      industries.forEach(ind => {
        matrix[op.id][ind] = null
      })
    })

    affinityScores.forEach(score => {
      if (matrix[score.operator_id] && industries.includes(score.industry)) {
        // Take the best score for this operator-industry combo
        const existing = matrix[score.operator_id][score.industry]
        const newScore = score.score || 0
        matrix[score.operator_id][score.industry] =
          existing !== null ? Math.max(existing, newScore) : newScore
      }
    })

    return matrix
  }

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

  const heatmapMatrix = buildHeatmapMatrix()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <Sparkles className="w-6 h-6 text-purple-500" />
                オペレーター相性分析
              </h1>
              <p className="text-gray-500 text-sm">業種別のオペレーター適性と相性スコア</p>
            </div>
          </div>
          <Button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {recalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                計算中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                再計算
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-red-700">エラー: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* トップマッチ */}
        {topMatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                トップマッチング（業種別適性スコア）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topMatches.map((match, idx) => (
                  <div
                    key={`${match.operator_id}-${match.industry}`}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-transparent rounded-lg border border-green-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-sm font-bold">
                          {idx + 1}
                        </span>
                        <h4 className="font-medium text-gray-900">
                          {match.operator_name}
                        </h4>
                        <span className="text-gray-500">→</span>
                        <Badge variant="outline" className="bg-purple-50 border-purple-300">
                          {match.industry}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>成功率: {match.success_rate.toFixed(1)}%</span>
                        <span>通話数: {match.total_calls}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {match.score.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">相性スコア</p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 相性マトリックス（ヒートマップ） */}
        {operators.length > 0 && industries.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                相性マトリックス（業種別）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-bold text-sm text-gray-700 sticky left-0 z-10">
                        オペレーター
                      </th>
                      {industries.map(industry => (
                        <th
                          key={industry}
                          className="border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-xs text-gray-700 min-w-[100px]"
                        >
                          {industry}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operators.map(operator => (
                      <tr key={operator.id}>
                        <td className="border border-gray-300 bg-gray-50 px-4 py-2 font-medium text-sm text-gray-900 sticky left-0 z-10 whitespace-nowrap">
                          {operator.name}
                        </td>
                        {industries.map(industry => {
                          const score = heatmapMatrix[operator.id]?.[industry]
                          return (
                            <td
                              key={`${operator.id}-${industry}`}
                              className={`border border-gray-300 px-3 py-2 text-center font-semibold text-sm ${
                                score !== null
                                  ? getScoreColor(score)
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {score !== null ? score.toFixed(1) : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* スケール凡例 */}
              <div className="mt-6 flex items-center gap-4 text-sm">
                <span className="font-medium text-gray-700">スコアスケール:</span>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 bg-red-300 rounded" />
                    <span className="text-gray-600">低</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 bg-yellow-300 rounded" />
                    <span className="text-gray-600">中</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 bg-green-300 rounded" />
                    <span className="text-gray-600">高</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 bg-green-500 rounded" />
                    <span className="text-gray-600">非常に高</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {operators.length === 0
                  ? 'オペレーターが登録されていません'
                  : '業種データがありません'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 推奨事項パネル */}
        {topMatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                推奨事項
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topMatches.slice(0, 5).map((match, idx) => (
                  <div
                    key={`${match.operator_id}-${match.industry}`}
                    className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {match.operator_name}は{match.industry}業界に最適です
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        成功率{match.success_rate.toFixed(1)}% • 相性スコア{match.score.toFixed(
                          1
                        )}点
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        このオペレーターを{match.industry}関連企業の架電に優先的に割り当てることをお勧めします。
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
