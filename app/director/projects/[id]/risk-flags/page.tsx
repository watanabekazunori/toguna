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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  ArrowLeft,
  Plus,
  X,
  CheckCircle2,
  Filter,
  Loader2,
} from 'lucide-react'

type RiskFlag = {
  id: string
  company_id: string
  flag_type: 'lawsuit' | 'financial_warning' | 'negative_press' | 'executive_change' | 'compliance_issue' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  source_url: string | null
  detected_at: string
  resolved_at: string | null
  is_active: boolean
  created_at: string
  company?: { id: string; name: string }
}

type Company = {
  id: string
  name: string
}

const flagTypeLabels: Record<string, string> = {
  lawsuit: '訴訟',
  financial_warning: '財務警告',
  negative_press: 'ネガティブ報道',
  executive_change: '経営陣変更',
  compliance_issue: 'コンプライアンス問題',
  other: 'その他',
}

const severityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '非常に高い',
}

const severityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 border-gray-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
}

const getFlagTypeIcon = (type: string) => {
  switch (type) {
    case 'lawsuit':
      return '⚖️'
    case 'financial_warning':
      return '💰'
    case 'negative_press':
      return '📰'
    case 'executive_change':
      return '👤'
    case 'compliance_issue':
      return '📋'
    default:
      return '⚠️'
  }
}

export default function RiskFlagsPage() {
  const { isDirector, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // フィルター状態
  const [filterFlagType, setFilterFlagType] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortField, setSortField] = useState<'detected_at' | 'severity'>('detected_at')

  // フォーム状態
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    company_id: '',
    flag_type: 'other' as const,
    severity: 'medium' as const,
    title: '',
    description: '',
    source_url: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // プロジェクトに属する企業を取得
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('project_id', projectId)

      if (companiesError) throw companiesError

      const companyIds = (companiesData || []).map(c => c.id)
      setCompanies(companiesData || [])

      // リスクフラグを取得（企業IDでフィルター）
      if (companyIds.length > 0) {
        const { data: flagsData, error: flagsError } = await supabase
          .from('company_risk_flags')
          .select('*')
          .in('company_id', companyIds)
          .order('detected_at', { ascending: false })

        if (flagsError) throw flagsError

        // 企業情報をマッピング
        const flagsWithCompanies = (flagsData || []).map(flag => ({
          ...flag,
          company: companiesData?.find(c => c.id === flag.company_id),
        }))

        setRiskFlags(flagsWithCompanies)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // フィルター処理
  const filteredFlags = riskFlags.filter(flag => {
    if (filterFlagType !== 'all' && flag.flag_type !== filterFlagType) return false
    if (filterSeverity !== 'all' && flag.severity !== filterSeverity) return false
    if (filterStatus === 'active' && !flag.is_active) return false
    if (filterStatus === 'resolved' && flag.is_active) return false
    return true
  })

  // ソート
  const sortedFlags = [...filteredFlags].sort((a, b) => {
    if (sortField === 'detected_at') {
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    }
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
  })

  // グループ化（重要度別）
  const groupedByGroup = (flags: RiskFlag[]) => {
    const groups: Record<string, RiskFlag[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    }
    flags.forEach(flag => {
      if (groups[flag.severity]) {
        groups[flag.severity].push(flag)
      }
    })
    return groups
  }

  const grouped = groupedByGroup(sortedFlags)

  // サマリー計算
  const totalFlags = riskFlags.length
  const criticalCount = riskFlags.filter(f => f.severity === 'critical').length
  const unresolvedCount = riskFlags.filter(f => f.is_active).length

  // フラグ追加
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!formData.company_id) {
      setSubmitError('企業を選択してください')
      return
    }
    if (!formData.title.trim()) {
      setSubmitError('タイトルを入力してください')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('company_risk_flags').insert([
        {
          company_id: formData.company_id,
          flag_type: formData.flag_type,
          severity: formData.severity,
          title: formData.title,
          description: formData.description || null,
          source_url: formData.source_url || null,
          detected_at: new Date().toISOString(),
          is_active: true,
        },
      ])

      if (error) throw error

      // フォームをリセット
      setFormData({
        company_id: '',
        flag_type: 'other',
        severity: 'medium',
        title: '',
        description: '',
        source_url: '',
      })
      setShowForm(false)

      // データをリロード
      await loadData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'フラグの追加に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ステータス切り替え
  async function toggleStatus(flagId: string, currentActive: boolean) {
    try {
      const updateData = currentActive
        ? { is_active: false, resolved_at: new Date().toISOString() }
        : { is_active: true, resolved_at: null }

      const { error } = await supabase
        .from('company_risk_flags')
        .update(updateData)
        .eq('id', flagId)

      if (error) throw error

      await loadData()
    } catch (err) {
      console.error('Failed to update flag status:', err)
      setError(err instanceof Error ? err.message : 'ステータスの更新に失敗しました')
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
                <AlertTriangle className="w-6 h-6 text-orange-500" />
                リスクフラグ管理
              </h1>
              <p className="text-sm text-gray-500">企業のリスク要因を管理</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            新規フラグ
          </Button>
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
                <span>新規リスクフラグ</span>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                      フラグタイプ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.flag_type}
                      onChange={(e) => setFormData({...formData, flag_type: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(flagTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      重要度 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData({...formData, severity: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(severityLabels).map(([sev, label]) => (
                        <option key={sev} value={sev}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      タイトル <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="例: 訴訟提起"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="詳細な説明を入力"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ソースURL
                  </label>
                  <Input
                    value={formData.source_url}
                    onChange={(e) => setFormData({...formData, source_url: e.target.value})}
                    placeholder="https://example.com"
                    type="url"
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
                    onClick={() => setShowForm(false)}
                  >
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    保存
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-gray-900">{totalFlags}</p>
              <p className="text-sm text-gray-500 mt-1">全フラグ数</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-sm text-red-700 mt-1">非常に高い重要度</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-orange-600">{unresolvedCount}</p>
              <p className="text-sm text-gray-500 mt-1">未解決</p>
            </CardContent>
          </Card>
        </div>

        {/* フィルター */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-gray-600">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">フィルター</span>
              </div>
              <select
                value={filterFlagType}
                onChange={(e) => setFilterFlagType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">すべてのタイプ</option>
                {Object.entries(flagTypeLabels).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">すべての重要度</option>
                {Object.entries(severityLabels).map(([sev, label]) => (
                  <option key={sev} value={sev}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">すべてのステータス</option>
                <option value="active">未解決のみ</option>
                <option value="resolved">解決済みのみ</option>
              </select>

              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm ml-auto"
              >
                <option value="detected_at">検出日時でソート</option>
                <option value="severity">重要度でソート</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* フラグリスト（重要度でグループ化） */}
        {sortedFlags.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">該当するリスクフラグがありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
              const flagsInGroup = grouped[severity]
              if (flagsInGroup.length === 0) return null

              return (
                <div key={severity}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      severity === 'critical' ? 'bg-red-500' :
                      severity === 'high' ? 'bg-orange-500' :
                      severity === 'medium' ? 'bg-amber-500' :
                      'bg-gray-500'
                    }`} />
                    {severityLabels[severity]} ({flagsInGroup.length})
                  </h3>

                  <div className="space-y-3">
                    {flagsInGroup.map(flag => (
                      <Card key={flag.id} className="border-l-4" style={{
                        borderLeftColor: severity === 'critical' ? '#ef4444' :
                                        severity === 'high' ? '#f97316' :
                                        severity === 'medium' ? '#eab308' :
                                        '#9ca3af'
                      }}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{getFlagTypeIcon(flag.flag_type)}</span>
                                <h4 className="text-lg font-semibold text-gray-900">{flag.title}</h4>
                                <Badge
                                  variant="outline"
                                  className={`${severityColors[severity]}`}
                                >
                                  {severityLabels[severity]}
                                </Badge>
                              </div>

                              {flag.company && (
                                <p className="text-sm text-gray-600 mb-2">
                                  <span className="font-medium">企業:</span> {flag.company.name}
                                </p>
                              )}

                              {flag.description && (
                                <p className="text-sm text-gray-700 mb-2">{flag.description}</p>
                              )}

                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                                <span>検出: {new Date(flag.detected_at).toLocaleDateString('ja-JP')}</span>
                                {flag.resolved_at && (
                                  <span>解決: {new Date(flag.resolved_at).toLocaleDateString('ja-JP')}</span>
                                )}
                                {flag.source_url && (
                                  <a
                                    href={flag.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    ソース
                                  </a>
                                )}
                              </div>

                              <Badge variant={flag.is_active ? 'default' : 'secondary'} className="mt-2">
                                {flag.is_active ? '未解決' : '解決済み'}
                              </Badge>
                            </div>

                            <Button
                              variant={flag.is_active ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => toggleStatus(flag.id, flag.is_active)}
                              className="gap-1 whitespace-nowrap"
                            >
                              {flag.is_active ? (
                                <>
                                  <X className="w-4 h-4" />
                                  解決
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  再有効化
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
