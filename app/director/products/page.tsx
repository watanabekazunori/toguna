'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Bell,
  LogOut,
  Loader2,
  ArrowLeft,
  Plus,
  Package,
  Target,
  Users,
  MapPin,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  Sparkles,
  Building2,
  TrendingUp,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Product, getProducts, deleteProduct, getMatchingCompanies, ProductMatchResult, ProductMatchSummary } from '@/lib/api'

// フォールバック用の空配列（APIが実データを返す）

export default function ProductsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [matchResults, setMatchResults] = useState<{
    matches: ProductMatchResult[]
    summary: ProductMatchSummary
  } | null>(null)
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getProducts()
        setProducts(data)
      } catch (err) {
        console.error('Failed to fetch products:', err)
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleDelete = async () => {
    if (!selectedProduct) return
    try {
      await deleteProduct(selectedProduct.id)
      setProducts(products.filter((p) => p.id !== selectedProduct.id))
    } catch (err) {
      console.error('Failed to delete product:', err)
    }
    setShowDeleteDialog(false)
    setSelectedProduct(null)
  }

  const handleFindMatches = async (product: Product) => {
    setSelectedProduct(product)
    setShowMatchDialog(true)
    setIsLoadingMatches(true)

    try {
      const results = await getMatchingCompanies(product.id, { limit: 10 })
      setMatchResults(results)
    } catch (err) {
      console.error('Failed to find matches:', err)
      setMatchResults(null)
    } finally {
      setIsLoadingMatches(false)
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMatchLevelBadge = (level: string) => {
    switch (level) {
      case 'excellent':
        return <Badge className="bg-green-500 text-white">最適</Badge>
      case 'good':
        return <Badge className="bg-blue-500 text-white">良好</Badge>
      case 'fair':
        return <Badge className="bg-amber-500 text-white">適合</Badge>
      default:
        return <Badge className="bg-slate-500 text-white">低</Badge>
    }
  }

  if (authLoading || !isDirector) {
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
            <Link href="/director">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            <Badge className="bg-purple-500 text-white px-4 py-1 text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name}</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {user?.name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  商材管理
                </h2>
                <p className="text-sm text-slate-500">
                  商材を登録してマッチする企業を自動検出
                </p>
              </div>
            </div>
          </div>

          <Link href="/director/products/new">
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
              <Plus className="h-4 w-4 mr-2" />
              商材を追加
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="商材を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              商材がありません
            </h3>
            <p className="text-slate-500 mb-4">
              商材を追加して、マッチする企業を自動で見つけましょう
            </p>
            <Link href="/director/products/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                最初の商材を追加
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-lg">{product.name}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        詳細を見る
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setSelectedProduct(product)
                          setShowDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {product.description}
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">
                      {product.targetIndustries.slice(0, 3).join('、')}
                      {product.targetIndustries.length > 3 && ' 他'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">
                      {product.targetEmployeeRange.min}〜{product.targetEmployeeRange.max}名
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">
                      {product.targetLocations.slice(0, 2).join('、')}
                      {product.targetLocations.length > 2 && ' 他'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {product.keywords.slice(0, 4).map((keyword, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  onClick={() => handleFindMatches(product)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  マッチ企業を検索
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>商材を削除</DialogTitle>
            <DialogDescription>
              「{selectedProduct?.name}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Results Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              「{selectedProduct?.name}」にマッチする企業
            </DialogTitle>
          </DialogHeader>

          {isLoadingMatches ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
              <p className="text-slate-600">AIがマッチング分析中...</p>
            </div>
          ) : matchResults ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {matchResults.summary.totalMatches}
                  </p>
                  <p className="text-xs text-slate-500">マッチ企業数</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {matchResults.summary.excellentMatches}
                  </p>
                  <p className="text-xs text-slate-500">最適マッチ</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {matchResults.summary.goodMatches}
                  </p>
                  <p className="text-xs text-slate-500">良好マッチ</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {matchResults.summary.averageMatchScore}%
                  </p>
                  <p className="text-xs text-slate-500">平均スコア</p>
                </Card>
              </div>

              {/* Top Industries */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  マッチ度の高い業界
                </h4>
                <div className="flex flex-wrap gap-2">
                  {matchResults.summary.topIndustries.map((ind, i) => (
                    <Badge key={i} variant="outline">
                      {ind.industry}: {ind.count}社
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* Match Results */}
              <div className="space-y-4">
                <h4 className="font-medium">おすすめ企業（上位10社）</h4>
                {matchResults.matches.map((match, i) => (
                  <Card key={i} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          <Building2 className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <h5 className="font-bold">{match.company.name}</h5>
                          <p className="text-sm text-slate-500">
                            {match.company.industry} / {match.company.employees}名 / {match.company.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getMatchLevelBadge(match.matchLevel)}
                        <span className="text-lg font-bold text-purple-600">
                          {match.matchScore}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <p className="text-sm font-medium text-slate-700">マッチ理由:</p>
                      <div className="flex flex-wrap gap-2">
                        {match.matchReasons.map((reason, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">
                            {reason.category}: {reason.reason}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                        推奨アプローチ:
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {match.recommendedApproach}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
                  閉じる
                </Button>
                <Link href="/call-list">
                  <Button className="bg-gradient-to-r from-blue-600 to-cyan-600">
                    架電リストに追加
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
