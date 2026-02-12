'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  ChevronDown,
  Search,
  Clock,
  Building2,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Transcription {
  id: string
  call_log_id: string
  recording_url: string
  transcription_text: string
  transcription_segments: Array<{
    text: string
    start_time: number
    end_time: number
  }>
  sentiment_analysis: {
    overall: 'positive' | 'neutral' | 'negative'
    score: number
    segments: Array<{
      text: string
      sentiment: 'positive' | 'neutral' | 'negative'
      confidence: number
    }>
  }
  duration_seconds: number
  created_at: string
  operator_name: string
  company_name: string
  quality_score?: number
}

export default function TranscriptionsPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector } = useAuth()
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [filteredTranscriptions, setFilteredTranscriptions] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterOperator, setFilterOperator] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([])

  const projectId = params?.id as string

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/')
    }
  }, [user, isDirector, router])

  // Fetch transcriptions
  const fetchTranscriptions = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // Get call recordings with joins to get operator and company info
      const { data, error: fetchError } = await supabase
        .from('call_recordings')
        .select(
          `
          id,
          call_log_id,
          recording_url,
          transcription_text,
          transcription_segments,
          sentiment_analysis,
          duration_seconds,
          created_at,
          call_logs (
            id,
            operator_id,
            company_id,
            users!call_logs_operator_id_fkey (
              id,
              name
            ),
            companies (
              id,
              name
            )
          )
        `
        )
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Transform and filter by project
      const transformedData: Transcription[] = (data || [])
        .map((item: any) => ({
          id: item.id,
          call_log_id: item.call_log_id,
          recording_url: item.recording_url,
          transcription_text: item.transcription_text || '',
          transcription_segments: item.transcription_segments || [],
          sentiment_analysis: item.sentiment_analysis || {
            overall: 'neutral',
            score: 0,
            segments: [],
          },
          duration_seconds: item.duration_seconds || 0,
          created_at: item.created_at,
          operator_name: item.call_logs?.users?.name || '不明',
          company_name: item.call_logs?.companies?.name || '不明',
        }))
        .filter((trans) => trans.transcription_text)

      setTranscriptions(transformedData)

      // Extract unique operators
      const uniqueOperators = Array.from(
        new Map(
          transformedData.map((t) => [t.operator_name, { id: t.operator_name, name: t.operator_name }])
        ).values()
      )
      setOperators(uniqueOperators)
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
      console.error('Error fetching transcriptions:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTranscriptions()
  }, [fetchTranscriptions])

  // Filter transcriptions
  useEffect(() => {
    let filtered = [...transcriptions]

    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.transcription_text.toLowerCase().includes(keyword) ||
          t.company_name.toLowerCase().includes(keyword)
      )
    }

    if (filterOperator) {
      filtered = filtered.filter((t) => t.operator_name === filterOperator)
    }

    if (filterDate) {
      filtered = filtered.filter((t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0]
        return date === filterDate
      })
    }

    setFilteredTranscriptions(filtered)
  }, [transcriptions, searchKeyword, filterOperator, filterDate])

  // Highlight keywords in transcription text
  const highlightKeywords = (text: string, keyword: string): React.ReactNode => {
    if (!keyword) return text

    const regex = new RegExp(`(${keyword})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-300 dark:bg-yellow-600 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  // Get sentiment color
  const getSentimentColor = (
    sentiment: 'positive' | 'neutral' | 'negative'
  ): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 dark:text-green-400'
      case 'negative':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Get sentiment badge color
  const getSentimentBadgeColor = (
    sentiment: 'positive' | 'neutral' | 'negative'
  ): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
      case 'negative':
        return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
      default:
        return 'bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200'
    }
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  // Get sentiment label
  const getSentimentLabel = (sentiment: 'positive' | 'neutral' | 'negative'): string => {
    switch (sentiment) {
      case 'positive':
        return '肯定的'
      case 'negative':
        return '否定的'
      default:
        return '中立'
    }
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
        <h1 className="text-4xl font-bold text-slate-900">通話トランスクリプション</h1>
        <p className="text-slate-600 mt-2">通話内容の自動テキスト化と分析</p>
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

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">データを読み込み中...</p>
        </Card>
      ) : transcriptions.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">トランスクリプションデータがありません</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">フィルタリング</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="キーワード検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Operator filter */}
              <Select value={filterOperator} onValueChange={setFilterOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="オペレータを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全て</SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.name}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date filter */}
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <p className="text-sm text-slate-600">
              {filteredTranscriptions.length}件のトランスクリプション
            </p>
          </Card>

          {/* Transcriptions List */}
          <div className="space-y-4">
            {filteredTranscriptions.length === 0 ? (
              <Card className="p-8 text-center text-slate-600">
                検索条件に合うトランスクリプションはありません
              </Card>
            ) : (
              filteredTranscriptions.map((trans) => (
                <Collapsible key={trans.id}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <h3 className="font-bold text-slate-900">
                                {trans.company_name}
                              </h3>
                              <Badge className={getSentimentBadgeColor(trans.sentiment_analysis.overall)}>
                                {getSentimentLabel(trans.sentiment_analysis.overall)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {trans.operator_name}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {formatDuration(trans.duration_seconds)}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {new Date(trans.created_at).toLocaleDateString('ja-JP')}
                              </div>
                            </div>
                          </div>
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="border-t border-slate-200 p-6 space-y-6">
                      {/* Sentiment Analysis */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">感情分析</h4>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-slate-600">全体スコア</span>
                              <span className="font-bold text-slate-900">
                                {(trans.sentiment_analysis.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  trans.sentiment_analysis.overall === 'positive'
                                    ? 'bg-green-500'
                                    : trans.sentiment_analysis.overall === 'negative'
                                      ? 'bg-red-500'
                                      : 'bg-gray-500'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    trans.sentiment_analysis.score * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sentiment Segments */}
                      {trans.sentiment_analysis.segments.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-slate-900">セグメント感情分析</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {trans.sentiment_analysis.segments.slice(0, 10).map((seg, i) => (
                              <div
                                key={i}
                                className={`p-3 rounded-lg text-sm ${
                                  seg.sentiment === 'positive'
                                    ? 'bg-green-50 border-l-4 border-green-500'
                                    : seg.sentiment === 'negative'
                                      ? 'bg-red-50 border-l-4 border-red-500'
                                      : 'bg-gray-50 border-l-4 border-gray-500'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-slate-700">{seg.text}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs whitespace-nowrap ${getSentimentColor(
                                      seg.sentiment
                                    )}`}
                                  >
                                    {getSentimentLabel(seg.sentiment)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full Transcription */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">完全なテキスト</h4>
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                          {highlightKeywords(trans.transcription_text, searchKeyword)}
                        </div>
                      </div>

                      {/* Recording Link */}
                      {trans.recording_url && (
                        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">録音ファイルあり</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(trans.recording_url, '_blank')}
                          >
                            再生
                          </Button>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                ))
              )}
          </div>
        </div>
      )}
    </div>
  )
}
