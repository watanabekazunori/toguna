'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  getCompanies,
  getClients,
  getProducts,
  runFullAnalysis,
  type Company,
  type Client,
  type Product,
  type FullAnalysisResult,
  type ProductMatchResult,
} from '@/lib/api'
import { CompanyAnalysisModal } from '@/components/company-analysis-modal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  Bell,
  Settings,
  LogOut,
  Search,
  Flame,
  Building2,
  Users,
  MapPin,
  Lightbulb,
  Phone,
  ExternalLink,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
  ThermometerSun,
  Snowflake,
  Eye,
  Zap,
  Package,
  Target,
  Sparkles,
} from 'lucide-react'

type SortOption = 'rank' | 'name' | 'employees' | 'intent' | 'match'

// 商材マッチ情報
type ProductMatch = {
  productId: string
  productName: string
  matchScore: number
  matchLevel: 'excellent' | 'good' | 'fair' | 'low'
  matchReasons: string[]
}

// 企業に分析データを紐付けるための拡張型
type CompanyWithAnalysis = Company & {
  fullAnalysis?: FullAnalysisResult
  isAnalyzing?: boolean
  productMatches?: ProductMatch[]
}

const rankColors: Record<string, { badge: string; border: string; text: string }> = {
  S: { badge: 'bg-red-500', border: 'border-l-red-500', text: 'text-red-600' },
  A: { badge: 'bg-orange-500', border: 'border-l-orange-500', text: 'text-orange-600' },
  B: { badge: 'bg-blue-500', border: 'border-l-blue-500', text: 'text-blue-600' },
  C: { badge: 'bg-slate-400', border: 'border-l-slate-400', text: 'text-slate-600' },
}

export default function CallListPage() {
  const { user, signOut, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [companies, setCompanies] = useState<CompanyWithAnalysis[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 分析モーダル用
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithAnalysis | null>(null)
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false)

  // Filters
  const [selectedClientId, setSelectedClientId] = useState<string>(searchParams.get('client_id') || '')
  const [statusFilter, setStatusFilter] = useState<string>('全て')
  const [rankFilter, setRankFilter] = useState<string>('全て')
  const [sortBy, setSortBy] = useState<SortOption>('rank')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch clients and products on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsData, productsData] = await Promise.all([
          getClients(),
          getProducts(),
        ])

        setClients(clientsData)
        if (clientsData.length > 0 && !selectedClientId) {
          setSelectedClientId(clientsData[0].id)
        }

        setProducts(productsData)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('データの取得に失敗しました')
      }
    }
    fetchData()
  }, [])

  // Fetch companies when client or rank changes
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!selectedClientId) return

      setIsLoading(true)
      setError(null)

      try {
        const data = await getCompanies({
          client_id: selectedClientId,
          rank: rankFilter !== '全て' ? rankFilter.replace('判定', '') : undefined,
          search: searchQuery || undefined,
        })

        setCompanies(data)
      } catch (err) {
        console.error('Failed to fetch companies:', err)
        setError('企業データの取得に失敗しました')
        setCompanies([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompanies()
  }, [selectedClientId, rankFilter])

  // 商材選択時にマッチングスコアを計算
  useEffect(() => {
    if (!selectedProductId || companies.length === 0) return

    const selectedProduct = products.find((p: Product) => p.id === selectedProductId)
    if (!selectedProduct) return

    // 簡易マッチングロジック（本来はAPIで計算）
    const calculateMatch = (company: CompanyWithAnalysis): ProductMatch => {
      let score = 0
      const reasons: string[] = []

      // 業界マッチング
      if (selectedProduct.targetIndustries.includes(company.industry)) {
        score += 30
        reasons.push(`業界（${company.industry}）がターゲットに合致`)
      }

      // 従業員数マッチング
      if (
        company.employees >= selectedProduct.targetEmployeeRange.min &&
        company.employees <= selectedProduct.targetEmployeeRange.max
      ) {
        score += 25
        reasons.push(`従業員数（${company.employees}名）がターゲット規模内`)
      }

      // 地域マッチング
      if (selectedProduct.targetLocations.some((loc: string) => company.location?.includes(loc.replace(/[都道府県]$/, '')))) {
        score += 20
        reasons.push(`所在地（${company.location}）がターゲット地域内`)
      }

      // ランクによるボーナス
      if (company.rank === 'S') {
        score += 15
        reasons.push('S判定企業（高優先度）')
      } else if (company.rank === 'A') {
        score += 10
        reasons.push('A判定企業（優先度高）')
      }

      // インテントスコアボーナス
      if (company.fullAnalysis?.intent?.level === 'hot') {
        score += 10
        reasons.push('HOTリード（購買意欲高）')
      }

      // スコアを100以下に制限
      score = Math.min(score, 100)

      // マッチレベルを決定
      let matchLevel: 'excellent' | 'good' | 'fair' | 'low'
      if (score >= 80) matchLevel = 'excellent'
      else if (score >= 60) matchLevel = 'good'
      else if (score >= 40) matchLevel = 'fair'
      else matchLevel = 'low'

      return {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        matchScore: score,
        matchLevel,
        matchReasons: reasons,
      }
    }

    // 各企業にマッチ情報を追加
    setCompanies((prev: CompanyWithAnalysis[]) =>
      prev.map((company: CompanyWithAnalysis) => ({
        ...company,
        productMatches: [calculateMatch(company)],
      }))
    )
  }, [selectedProductId, products])

  // Get selected client
  const selectedClient = clients.find((c: Client) => c.id === selectedClientId)

  // Filter companies
  const filteredCompanies = companies.filter((company: CompanyWithAnalysis) => {
    const statusMatch = statusFilter === '全て' || company.status === statusFilter
    const searchMatch =
      searchQuery === '' || company.name.toLowerCase().includes(searchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a: CompanyWithAnalysis, b: CompanyWithAnalysis) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'employees':
        return b.employees - a.employees
      case 'rank':
        const rankOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }
        return (rankOrder[a.rank] ?? 4) - (rankOrder[b.rank] ?? 4)
      case 'intent':
        // インテントスコアで降順ソート（HOT優先）
        const aIntentScore = a.fullAnalysis?.intent?.score || 0
        const bIntentScore = b.fullAnalysis?.intent?.score || 0
        return bIntentScore - aIntentScore
      case 'match':
        // 商材マッチスコアで降順ソート
        const aMatchScore = a.productMatches?.[0]?.matchScore || 0
        const bMatchScore = b.productMatches?.[0]?.matchScore || 0
        return bMatchScore - aMatchScore
      default:
        return 0
    }
  })

  // マッチレベルのバッジ色を取得
  const getMatchBadgeColor = (level?: 'excellent' | 'good' | 'fair' | 'low') => {
    switch (level) {
      case 'excellent':
        return 'bg-green-500 text-white'
      case 'good':
        return 'bg-blue-500 text-white'
      case 'fair':
        return 'bg-amber-500 text-white'
      case 'low':
        return 'bg-slate-400 text-white'
      default:
        return 'bg-slate-300 text-slate-600'
    }
  }

  // マッチレベルのラベルを取得
  const getMatchLabel = (level?: 'excellent' | 'good' | 'fair' | 'low') => {
    switch (level) {
      case 'excellent':
        return '最適'
      case 'good':
        return '良好'
      case 'fair':
        return '適合'
      case 'low':
        return '低'
      default:
        return '-'
    }
  }

  // Pagination
  const totalPages = Math.ceil(sortedCompanies.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedCompanies = sortedCompanies.slice(startIndex, startIndex + itemsPerPage)

  // Stats
  const stats = {
    total: companies.length,
    s: companies.filter((c: CompanyWithAnalysis) => c.rank === 'S').length,
    a: companies.filter((c: CompanyWithAnalysis) => c.rank === 'A').length,
    b: companies.filter((c: CompanyWithAnalysis) => c.rank === 'B').length,
  }

  const handleCall = (companyId: string) => {
    router.push(`/call?company_id=${companyId}&client_id=${selectedClientId}`)
  }

  // 企業のフル分析を実行
  const handleRunAnalysis = async (company: CompanyWithAnalysis) => {
    setSelectedCompany(company)
    setAnalysisModalOpen(true)
    setIsRunningAnalysis(true)

    try {
      const fullAnalysis = await runFullAnalysis({
        name: company.name,
        industry: company.industry,
        employees: company.employees,
        location: company.location,
      })

      // 企業リストを更新
      setCompanies((prev: CompanyWithAnalysis[]) =>
        prev.map((c: CompanyWithAnalysis) =>
          c.id === company.id ? { ...c, fullAnalysis } : c
        )
      )
      setSelectedCompany({ ...company, fullAnalysis })
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setIsRunningAnalysis(false)
    }
  }

  // インテントアイコンを取得
  const getIntentIcon = (level?: 'hot' | 'warm' | 'cold') => {
    switch (level) {
      case 'hot':
        return <Flame className="h-4 w-4 text-red-500" />
      case 'warm':
        return <ThermometerSun className="h-4 w-4 text-orange-500" />
      case 'cold':
        return <Snowflake className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  // インテントバッジの色を取得
  const getIntentBadgeColor = (level?: 'hot' | 'warm' | 'cold') => {
    switch (level) {
      case 'hot':
        return 'bg-red-500 text-white'
      case 'warm':
        return 'bg-orange-500 text-white'
      case 'cold':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-slate-400 text-white'
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  if (authLoading) {
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
            <Link href="/">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            {selectedClient && (
              <Badge className="bg-blue-500 text-white px-4 py-1 text-sm font-medium">
                {selectedClient.name}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name || 'オペレーター'}さん</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  {user?.name?.charAt(0) || 'O'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="space-y-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              戻る
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                架電リスト
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                全{stats.total}社 | S判定 {stats.s}社 | A判定 {stats.a}社 | B判定 {stats.b}社
              </p>
            </div>

            {/* Client Selector */}
            <div className="w-64">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="クライアントを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: Client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Product Matching Section */}
        {products.length > 0 && (
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-2 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">
                    商材マッチング
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    商材を選択すると、マッチ度の高い企業を優先表示
                  </p>
                </div>
              </div>
              <div className="flex-1 max-w-sm">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <Package className="h-4 w-4 mr-2 text-purple-600" />
                    <SelectValue placeholder="商材を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">選択なし</SelectItem>
                    {products.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProductId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProductId('')
                    // マッチ情報をクリア
                    setCompanies((prev: CompanyWithAnalysis[]) =>
                      prev.map((c: CompanyWithAnalysis) => ({ ...c, productMatches: undefined }))
                    )
                  }}
                >
                  クリア
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Filter & Sort Section */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-2">
          <div className="space-y-6">
            {/* Filters */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                フィルター
              </h3>
              <div className="flex flex-wrap gap-4">
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="ステータス" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全て">全て</SelectItem>
                      <SelectItem value="未架電">未架電</SelectItem>
                      <SelectItem value="時期尚早">時期尚早</SelectItem>
                      <SelectItem value="架電済み">架電済み</SelectItem>
                      <SelectItem value="NG">NG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select value={rankFilter} onValueChange={setRankFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全て">全て</SelectItem>
                      <SelectItem value="S判定">S判定</SelectItem>
                      <SelectItem value="A判定">A判定</SelectItem>
                      <SelectItem value="B判定">B判定</SelectItem>
                      <SelectItem value="C判定">C判定</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sort */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                並び替え
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'rank' as SortOption, label: 'ランク順' },
                  { value: 'match' as SortOption, label: 'マッチ度順', disabled: !selectedProductId },
                  { value: 'intent' as SortOption, label: 'インテント順' },
                  { value: 'name' as SortOption, label: '企業名順' },
                  { value: 'employees' as SortOption, label: '従業員数順' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={sortBy === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy(option.value)}
                    disabled={'disabled' in option && option.disabled}
                    className={
                      sortBy === option.value
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                        : ''
                    }
                  >
                    {option.value === 'match' && <Target className="h-3 w-3 mr-1" />}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                検索
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="企業名で検索..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Results Summary */}
        <div className="flex items-center gap-3 p-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-xl border-2 border-red-200 dark:border-red-800">
          <Flame className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              絞り込み結果: {filteredCompanies.length}社
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {statusFilter !== '全て' && `${statusFilter} × `}
              {rankFilter !== '全て' && rankFilter}
            </p>
          </div>
        </div>

        {/* Company List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : paginatedCompanies.length === 0 ? (
          <Card className="p-12 text-center bg-white/50 dark:bg-slate-900/50">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
              該当する企業がありません
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {paginatedCompanies.map((company) => {
              const colors = rankColors[company.rank] || rankColors.C
              return (
                <Card
                  key={company.id}
                  className={`p-6 hover:shadow-xl transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-l-4 ${colors.border}`}
                >
                  <div className="space-y-4">
                    {/* Company Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={`${colors.badge} text-white px-3 py-1`}>
                          <Flame className="h-3 w-3 mr-1" />
                          {company.rank}判定
                        </Badge>
                        {/* インテントバッジ */}
                        {company.fullAnalysis?.intent && (
                          <Badge className={getIntentBadgeColor(company.fullAnalysis.intent.level)}>
                            {getIntentIcon(company.fullAnalysis.intent.level)}
                            <span className="ml-1">
                              {company.fullAnalysis.intent.level === 'hot'
                                ? 'HOT'
                                : company.fullAnalysis.intent.level === 'warm'
                                ? 'WARM'
                                : 'COLD'}
                              ({company.fullAnalysis.intent.score})
                            </span>
                          </Badge>
                        )}
                        {/* 商材マッチバッジ */}
                        {company.productMatches && company.productMatches[0] && (
                          <Badge className={getMatchBadgeColor(company.productMatches[0].matchLevel)}>
                            <Target className="h-3 w-3 mr-1" />
                            {getMatchLabel(company.productMatches[0].matchLevel)}
                            ({company.productMatches[0].matchScore}%)
                          </Badge>
                        )}
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {company.name}
                        </h3>
                        {company.status && (
                          <Badge variant="outline" className="text-xs">
                            {company.status}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Company Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {company.industry || '業種未設定'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {company.employees || '-'}名
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {company.location || '所在地未設定'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {company.phone || '-'}
                      </div>
                    </div>

                    {/* 商材マッチ理由 */}
                    {company.productMatches && company.productMatches[0] && company.productMatches[0].matchReasons.length > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 border-l-4 border-purple-500 p-4 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <Target className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                              商材マッチ理由 ({company.productMatches[0].productName}):
                            </p>
                            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                              {company.productMatches[0].matchReasons.map((reason, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 bg-purple-500 rounded-full" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Reason (if available) */}
                    {company.rank === 'S' && !company.productMatches && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                              S判定の理由:
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              業種・規模が最適。アポ獲得の可能性が高い企業です。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      {/* 分析ボタン */}
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => {
                          if (company.fullAnalysis) {
                            setSelectedCompany(company)
                            setAnalysisModalOpen(true)
                          } else {
                            handleRunAnalysis(company)
                          }
                        }}
                      >
                        {company.fullAnalysis ? (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            分析詳細
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            AI分析
                          </>
                        )}
                      </Button>
                      {company.website && (
                        <Button
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => window.open(company.website, '_blank')}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          HP閲覧
                        </Button>
                      )}
                      <Button
                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl"
                        onClick={() => handleCall(company.id)}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        架電する
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-2">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  表示: {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedCompanies.length)}{' '}
                  / {sortedCompanies.length}社
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    前へ
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={
                        currentPage === page
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                          : ''
                      }
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Auto Call Mode Button */}
              <div className="flex justify-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white shadow-2xl shadow-purple-500/50 hover:shadow-3xl text-lg px-8"
                >
                  <Rocket className="h-5 w-5 mr-2" />
                  自動で次々架電モード
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 企業分析モーダル */}
        <CompanyAnalysisModal
          open={analysisModalOpen}
          onOpenChange={setAnalysisModalOpen}
          company={selectedCompany}
          analysisResult={selectedCompany?.fullAnalysis || null}
          isLoading={isRunningAnalysis}
          onRunAnalysis={() => {
            if (selectedCompany) {
              handleRunAnalysis(selectedCompany)
            }
          }}
        />
      </main>
    </div>
  )
}
