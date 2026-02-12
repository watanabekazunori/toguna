'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Smile,
  Frown,
  Minus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SentimentData {
  id: string
  operator_name: string
  created_at: string
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative'
    score: number
    segments: Array<{
      text: string
      sentiment: 'positive' | 'neutral' | 'negative'
      confidence: number
    }>
  }
}

interface OperatorSentiment {
  operator_name: string
  positive_count: number
  neutral_count: number
  negative_count: number
  avg_score: number
  total_calls: number
}

interface PhraseSentiment {
  phrase: string
  sentiment: 'positive' | 'negative'
  frequency: number
}

interface SentimentTrend {
  date: string
  positive: number
  neutral: number
  negative: number
}

export default function SentimentPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector } = useAuth()
  const [allData, setAllData] = useState<SentimentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('week')

  const projectId = params?.id as string

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/')
    }
  }, [user, isDirector, router])

  // Fetch sentiment data
  const fetchSentimentData = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('call_recordings')
        .select(
          `
          id,
          sentiment_analysis,
          created_at,
          call_logs (
            users!call_logs_operator_id_fkey (
              name
            )
          )
        `
        )
        .not('sentiment_analysis', 'is', null)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Transform data
      const transformedData: SentimentData[] = (data || []).map((item: any) => ({
        id: item.id,
        operator_name: item.call_logs?.users?.name || '不明',
        created_at: item.created_at,
        sentiment: item.sentiment_analysis || {
          overall: 'neutral',
          score: 0,
          segments: [],
        },
      }))

      setAllData(transformedData)
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
      console.error('Error fetching sentiment data:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSentimentData()
  }, [fetchSentimentData])

  // Calculate overall sentiment distribution
  const calculateDistribution = () => {
    let positive = 0
    let neutral = 0
    let negative = 0

    allData.forEach((item) => {
      switch (item.sentiment.overall) {
        case 'positive':
          positive++
          break
        case 'negative':
          negative++
          break
        default:
          neutral++
      }
    })

    const total = positive + neutral + negative || 1
    return {
      positive: (positive / total) * 100,
      neutral: (neutral / total) * 100,
      negative: (negative / total) * 100,
      total,
      positive_count: positive,
      neutral_count: neutral,
      negative_count: negative,
    }
  }

  // Calculate sentiment trend
  const calculateTrend = (): SentimentTrend[] => {
    const trendsMap = new Map<string, { positive: number; neutral: number; negative: number }>()

    allData.forEach((item) => {
      const date = new Date(item.created_at)
      let key = ''

      if (timeRange === 'week') {
        const weekStart = new Date(date)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        key = weekStart.toISOString().split('T')[0]
      } else {
        key = date.toISOString().split('T')[0]
      }

      if (!trendsMap.has(key)) {
        trendsMap.set(key, { positive: 0, neutral: 0, negative: 0 })
      }

      const current = trendsMap.get(key)!
      switch (item.sentiment.overall) {
        case 'positive':
          current.positive++
          break
        case 'negative':
          current.negative++
          break
        default:
          current.neutral++
      }
    })

    return Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  // Calculate per-operator sentiment
  const calculateOperatorSentiment = (): OperatorSentiment[] => {
    const operatorMap = new Map<
      string,
      {
        positive_count: number
        neutral_count: number
        negative_count: number
        scores: number[]
      }
    >()

    allData.forEach((item) => {
      const op = item.operator_name
      if (!operatorMap.has(op)) {
        operatorMap.set(op, { positive_count: 0, neutral_count: 0, negative_count: 0, scores: [] })
      }

      const current = operatorMap.get(op)!
      switch (item.sentiment.overall) {
        case 'positive':
          current.positive_count++
          break
        case 'negative':
          current.negative_count++
          break
        default:
          current.neutral_count++
      }
      current.scores.push(item.sentiment.score || 0)
    })

    return Array.from(operatorMap.entries()).map(([name, data]) => ({
      operator_name: name,
      positive_count: data.positive_count,
      neutral_count: data.neutral_count,
      negative_count: data.negative_count,
      total_calls: data.positive_count + data.neutral_count + data.negative_count,
      avg_score: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b) / data.scores.length : 0,
    }))
  }

  // Extract top phrases
  const extractTopPhrases = (): { positive: PhraseSentiment[]; negative: PhraseSentiment[] } => {
    const phraseMap = new Map<string, { sentiment: 'positive' | 'negative'; frequency: number }>()

    allData.forEach((item) => {
      item.sentiment.segments.forEach((seg) => {
        if (seg.sentiment === 'positive' || seg.sentiment === 'negative') {
          if (!phraseMap.has(seg.text)) {
            phraseMap.set(seg.text, { sentiment: seg.sentiment, frequency: 0 })
          }
          const current = phraseMap.get(seg.text)!
          if (current.sentiment === seg.sentiment) {
            current.frequency++
          }
        }
      })
    })

    const phrases = Array.from(phraseMap.entries()).map(([phrase, data]) => ({
      phrase,
      sentiment: data.sentiment,
      frequency: data.frequency,
    }))

    const positive = phrases
      .filter((p) => p.sentiment === 'positive')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    const negative = phrases
      .filter((p) => p.sentiment === 'negative')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    return { positive, negative }
  }

  // Check for sentiment alerts
  const checkSentimentAlerts = () => {
    const threshold = 0.35 // Negative sentiment threshold
    const recentData = allData.slice(0, 20) // Last 20 calls
    const negativeCount = recentData.filter((item) => item.sentiment.overall === 'negative').length
    const negativeRate = negativeCount / recentData.length

    return {
      hasAlert: negativeRate > threshold,
      rate: negativeRate,
      count: negativeCount,
    }
  }

  const distribution = calculateDistribution()
  const trend = calculateTrend()
  const operatorSentiments = calculateOperatorSentiment()
  const topPhrases = extractTopPhrases()
  const alert = checkSentimentAlerts()

  const getMaxTrendValue = () => {
    let max = 0
    trend.forEach((t) => {
      max = Math.max(max, t.positive, t.neutral, t.negative)
    })
    return max || 1
  }

  if (!user || !isDirector) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/director/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロジェクトに戻る
          </Button>
        </Link>
        <h1 className="text-4xl font-bold text-slate-900">感情分析ダッシュボード</h1>
        <p className="text-slate-600 mt-2">通話内容の感情分析と傾向分析</p>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">エラー</h3>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Sentiment Alert */}
      {alert.hasAlert && (
        <Alert className="bg-red-50 border-red-200 mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold text-red-900">警告:</span>
            <span className="text-red-800 ml-2">
              直近20件の通話で{(alert.rate * 100).toFixed(1)}%が否定的です。
              詳細を確認し、サポートが必要かご検討ください。
            </span>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">データを読み込み中...</p>
        </Card>
      ) : allData.length === 0 ? (
        <Card className="p-12 text-center">
          <Minus className="h-16 w-16 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">感情分析データがありません</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Overall Distribution */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">全体感情分布</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Stats */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Smile className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-slate-900">肯定的</span>
                      </div>
                      <span className="font-bold text-green-600">
                        {distribution.positive.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${distribution.positive}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 w-12 text-right">
                    {distribution.positive_count}件
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Minus className="h-5 w-5 text-gray-600" />
                        <span className="font-medium text-slate-900">中立的</span>
                      </div>
                      <span className="font-bold text-gray-600">
                        {distribution.neutral.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gray-500 transition-all"
                        style={{ width: `${distribution.neutral}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 w-12 text-right">
                    {distribution.neutral_count}件
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Frown className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-slate-900">否定的</span>
                      </div>
                      <span className="font-bold text-red-600">
                        {distribution.negative.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${distribution.negative}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 w-12 text-right">
                    {distribution.negative_count}件
                  </span>
                </div>
              </div>

              {/* Donut Chart */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                    {/* Background circle */}
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="20"
                    />
                    {/* Positive segment */}
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="20"
                      strokeDasharray={`${(distribution.positive / 100) * 565.48} 565.48`}
                    />
                    {/* Neutral segment */}
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="#6b7280"
                      strokeWidth="20"
                      strokeDasharray={`${(distribution.neutral / 100) * 565.48} 565.48`}
                      strokeDashoffset={-((distribution.positive / 100) * 565.48)}
                    />
                    {/* Negative segment */}
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="20"
                      strokeDasharray={`${(distribution.negative / 100) * 565.48} 565.48`}
                      strokeDashoffset={-((distribution.positive + distribution.neutral) / 100) * 565.48}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-900">
                        {distribution.total}
                      </p>
                      <p className="text-sm text-slate-600">件の通話</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Sentiment Trend */}
          <Card className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">感情トレンド</h2>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">日別</SelectItem>
                  <SelectItem value="week">週別</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {trend.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-600">
                      {new Date(item.date).toLocaleDateString('ja-JP')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.positive + item.neutral + item.negative}件
                    </span>
                  </div>
                  <div className="flex h-8 gap-1 bg-slate-100 rounded-lg overflow-hidden">
                    {getMaxTrendValue() > 0 && (
                      <>
                        <div
                          className="bg-green-500 transition-all"
                          style={{
                            width: `${(item.positive / getMaxTrendValue()) * 100}%`,
                          }}
                          title={`肯定的: ${item.positive}`}
                        />
                        <div
                          className="bg-gray-500 transition-all"
                          style={{
                            width: `${(item.neutral / getMaxTrendValue()) * 100}%`,
                          }}
                          title={`中立的: ${item.neutral}`}
                        />
                        <div
                          className="bg-red-500 transition-all"
                          style={{
                            width: `${(item.negative / getMaxTrendValue()) * 100}%`,
                          }}
                          title={`否定的: ${item.negative}`}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Per-Operator Sentiment */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">オペレーター別感情スコア</h2>
            <div className="space-y-4">
              {operatorSentiments.map((op) => (
                <div key={op.operator_name} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900">{op.operator_name}</h3>
                    <Badge variant="outline">{op.total_calls}件</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {op.positive_count}
                      </div>
                      <div className="text-xs text-slate-600">肯定的</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {op.neutral_count}
                      </div>
                      <div className="text-xs text-slate-600">中立的</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {op.negative_count}
                      </div>
                      <div className="text-xs text-slate-600">否定的</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">平均スコア</span>
                    <span className="font-bold text-slate-900">
                      {(op.avg_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all ${
                        op.avg_score > 0.5
                          ? 'bg-green-500'
                          : op.avg_score > 0.3
                            ? 'bg-gray-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(op.avg_score * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Phrases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Positive Phrases */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-green-600 mb-6 flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                肯定的フレーズ TOP 5
              </h2>
              <div className="space-y-3">
                {topPhrases.positive.length > 0 ? (
                  topPhrases.positive.map((phrase, i) => (
                    <div key={i} className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-700 text-sm">{phrase.phrase}</span>
                        <Badge className="bg-green-500 text-white text-xs whitespace-nowrap">
                          {phrase.frequency}回
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-600 text-sm">肯定的フレーズがありません</p>
                )}
              </div>
            </Card>

            {/* Negative Phrases */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-red-600 mb-6 flex items-center gap-2">
                <TrendingDown className="h-6 w-6" />
                否定的フレーズ TOP 5
              </h2>
              <div className="space-y-3">
                {topPhrases.negative.length > 0 ? (
                  topPhrases.negative.map((phrase, i) => (
                    <div key={i} className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-700 text-sm">{phrase.phrase}</span>
                        <Badge className="bg-red-500 text-white text-xs whitespace-nowrap">
                          {phrase.frequency}回
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-600 text-sm">否定的フレーズがありません</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
