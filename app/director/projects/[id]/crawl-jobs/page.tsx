'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { scrapeCompanyData, analyzeScrapedData } from '@/lib/scraper'

type CrawlJob = {
  id: string
  company_id: string
  job_type: 'website' | 'news' | 'financial' | 'social' | 'all'
  target_url: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  result_data: Record<string, any> | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  company?: { id: string; name: string }
}

type Company = {
  id: string
  name: string
}

const jobTypeLabels: Record<string, string> = {
  website: 'Webサイト',
  news: 'ニュース',
  financial: '財務データ',
  social: 'ソーシャル',
  all: 'すべて',
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-400 rounded-full animate-spin" />
    case 'running':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />
    default:
      return null
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return '保留中'
    case 'running':
      return '実行中'
    case 'completed':
      return '完了'
    case 'failed':
      return '失敗'
    default:
      return status
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800'
    case 'running':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function CrawlJobsPage() {
  const { isDirector, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // フォーム状態
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    company_id: '',
    job_type: 'all' as const,
    target_url: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 展開状態
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  // オートリフレッシュ
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

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
      loadData()
    }
  }, [projectId, isDirector])

  // オートリフレッシュセットアップ
  useEffect(() => {
    if (crawlJobs.some(job => job.status === 'running' || job.status === 'pending')) {
      const interval = setInterval(loadData, 10000) // 10秒ごとにリロード
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    }
  }, [crawlJobs])

  async function loadData() {
    try {
      // プロジェクトに属する企業を取得
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('project_id', projectId)

      if (companiesError) throw companiesError

      const companyIds = (companiesData || []).map(c => c.id)
      setCompanies(companiesData || [])

      // クローロールを取得（企業IDでフィルター）
      if (companyIds.length > 0) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('crawl_jobs')
          .select('*')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false })

        if (jobsError) throw jobsError

        // 企業情報をマッピング
        const jobsWithCompanies = (jobsData || []).map(job => ({
          ...job,
          company: companiesData?.find(c => c.id === job.company_id),
        }))

        setCrawlJobs(jobsWithCompanies)
      }

      // 最初のロードの場合のみloadingを解除
      if (loading) {
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      if (loading) {
        setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
        setLoading(false)
      }
    }
  }

  // サマリー計算
  const totalJobs = crawlJobs.length
  const completedJobs = crawlJobs.filter(j => j.status === 'completed').length
  const runningJobs = crawlJobs.filter(j => j.status === 'running').length
  const failedJobs = crawlJobs.filter(j => j.status === 'failed').length

  // ジョブ作成と実行
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!formData.company_id) {
      setSubmitError('企業を選択してください')
      return
    }

    setIsSubmitting(true)
    try {
      // Insert job record
      const { data: jobData, error: jobError } = await supabase
        .from('crawl_jobs')
        .insert([
          {
            company_id: formData.company_id,
            job_type: formData.job_type,
            target_url: formData.target_url || null,
            status: 'running',
            result_data: null,
            error_message: null,
            started_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (jobError) throw jobError

      // Fetch company data to get name for scraper
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, website')
        .eq('id', formData.company_id)
        .single()

      // Execute scraper based on job_type
      let resultData: any = null
      try {
        if (formData.job_type === 'all' || formData.job_type === 'website') {
          const scrapedData = await scrapeCompanyData(companyData?.name || '', companyData?.website)
          const analyzed = analyzeScrapedData(scrapedData)
          resultData = {
            scraped_data: scrapedData,
            analysis: analyzed,
          }
        }
      } catch (scrapeError) {
        console.error('Scraper error:', scrapeError)
        throw scrapeError
      }

      // Update job with results
      await supabase
        .from('crawl_jobs')
        .update({
          status: 'completed',
          result_data: resultData,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobData.id)

      // フォームをリセット
      setFormData({
        company_id: '',
        job_type: 'all',
        target_url: '',
      })
      setShowForm(false)

      // データをリロード
      await loadData()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'ジョブの実行に失敗しました'
      setSubmitError(errorMsg)

      // Update job status to failed
      if (formData.company_id) {
        const { data: failedJob } = await supabase
          .from('crawl_jobs')
          .select('id')
          .eq('company_id', formData.company_id)
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (failedJob) {
          await supabase
            .from('crawl_jobs')
            .update({
              status: 'failed',
              error_message: errorMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', failedJob.id)
        }
      }
      await loadData()
    } finally {
      setIsSubmitting(false)
    }
  }

  // 全企業のクローロール実行
  async function handleRunAll() {
    if (companies.length === 0) {
      setError('企業が存在しません')
      return
    }

    if (!confirm(`${companies.length}個の企業に対してクローロールを実行しますか？`)) {
      return
    }

    setIsSubmitting(true)
    try {
      const jobsToInsert = companies.map(company => ({
        company_id: company.id,
        job_type: 'all',
        target_url: null,
        status: 'pending',
        result_data: null,
        error_message: null,
      }))

      const { error } = await supabase
        .from('crawl_jobs')
        .insert(jobsToInsert)

      if (error) throw error

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ジョブの実行に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 結果の詳細表示
  const ResultViewer = ({ result }: { result: Record<string, any> | null }) => {
    if (!result) return null

    return (
      <div className="bg-gray-50 rounded p-3 text-xs space-y-2 max-h-64 overflow-y-auto">
        {Object.entries(result).map(([key, value]) => (
          <div key={key} className="border-b border-gray-200 last:border-b-0 pb-2">
            <p className="font-semibold text-gray-700">{key}</p>
            <pre className="text-gray-600 mt-1 overflow-x-auto">
              {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    )
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
                <Zap className="w-6 h-6 text-yellow-500" />
                クローロール管理
              </h1>
              <p className="text-sm text-gray-500">Web データ収集の自動化</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRunAll}
              disabled={isSubmitting || companies.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              全企業を実行
            </Button>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="w-4 h-4" />
              新規ジョブ
            </Button>
          </div>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* フォーム */}
        {showForm && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>新規クローロール</span>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      企業 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.company_id}
                      onChange={(e) => setFormData({...formData, company_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">企業を選択</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ジョブタイプ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.job_type}
                      onChange={(e) => setFormData({...formData, job_type: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(jobTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ターゲットURL（オプション）
                    </label>
                    <Input
                      value={formData.target_url}
                      onChange={(e) => setFormData({...formData, target_url: e.target.value})}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>
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
                    onClick={() => setShowForm(false)}
                  >
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    作成
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-gray-900">{totalJobs}</p>
              <p className="text-sm text-gray-500 mt-1">全ジョブ数</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-green-600">{completedJobs}</p>
              <p className="text-sm text-green-700 mt-1">完了</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-blue-600">{runningJobs}</p>
              <p className="text-sm text-blue-700 mt-1">実行中</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-red-600">{failedJobs}</p>
              <p className="text-sm text-red-700 mt-1">失敗</p>
            </CardContent>
          </Card>
        </div>

        {/* ジョブリスト */}
        {crawlJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">クローロールがありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {crawlJobs.map(job => (
              <Card
                key={job.id}
                className={`border-l-4 ${
                  job.status === 'completed' ? 'border-l-green-500' :
                  job.status === 'running' ? 'border-l-blue-500' :
                  job.status === 'failed' ? 'border-l-red-500' :
                  'border-l-gray-500'
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-6">
                          {getStatusIcon(job.status)}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {job.company?.name || 'Unknown Company'}
                        </h4>
                        <Badge className={getStatusColor(job.status)}>
                          {getStatusLabel(job.status)}
                        </Badge>
                        <Badge variant="outline" className="ml-2">
                          {jobTypeLabels[job.job_type]}
                        </Badge>
                      </div>

                      {job.target_url && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">ターゲット:</span>{' '}
                          <a
                            href={job.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {job.target_url}
                          </a>
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                        <span>作成: {new Date(job.created_at).toLocaleString('ja-JP')}</span>
                        {job.started_at && (
                          <span>開始: {new Date(job.started_at).toLocaleString('ja-JP')}</span>
                        )}
                        {job.completed_at && (
                          <span>完了: {new Date(job.completed_at).toLocaleString('ja-JP')}</span>
                        )}
                      </div>

                      {job.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <p className="font-medium mb-1">エラー:</p>
                          <p>{job.error_message}</p>
                        </div>
                      )}

                      {job.result_data && job.status === 'completed' && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            {expandedJobId === job.id ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                結果を非表示
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                結果を表示
                              </>
                            )}
                          </button>
                          {expandedJobId === job.id && (
                            <div className="mt-3">
                              <ResultViewer result={job.result_data} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {job.status === 'completed' && job.result_data && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          結果
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 情報パネル */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">
              <strong>注：</strong> 実行中のジョブは10秒ごとに自動更新されます。複数のジョブを効率的に管理するには、「全企業を実行」ボタンを使用してください。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
