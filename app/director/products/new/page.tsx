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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Bell,
  LogOut,
  Loader2,
  ArrowLeft,
  Package,
  Save,
  Plus,
  X,
  Sparkles,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createProduct, CreateProductInput, getClients, Client } from '@/lib/api'

const INDUSTRIES = [
  'IT',
  '金融',
  '保険',
  '不動産',
  '製造業',
  '商社',
  'コンサルティング',
  '広告',
  'メディア',
  '小売',
  '物流',
  '建設',
  '医療',
  '教育',
  'スタートアップ',
  'クリエイティブ',
  'その他',
]

const LOCATIONS = [
  '北海道',
  '東北',
  '東京都',
  '神奈川県',
  '千葉県',
  '埼玉県',
  '関東その他',
  '中部',
  '愛知県',
  '大阪府',
  '関西その他',
  '中国',
  '四国',
  '九州',
  '福岡県',
  '沖縄',
  '全国',
]

export default function NewProductPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [isGeneratingICP, setIsGeneratingICP] = useState(false)

  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    description: '',
    targetIndustries: [] as string[],
    targetEmployeeRange: { min: 10, max: 500 },
    targetRevenue: { min: undefined as number | undefined, max: undefined as number | undefined },
    targetLocations: [] as string[],
    keywords: [] as string[],
    benefits: [] as string[],
    idealCustomerProfile: '',
  })

  const [newKeyword, setNewKeyword] = useState('')
  const [newBenefit, setNewBenefit] = useState('')

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients()
        setClients(data)
      } catch {
        console.error('Failed to fetch clients')
      }
    }
    fetchClients()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, newKeyword.trim()],
      })
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((k) => k !== keyword),
    })
  }

  const handleAddBenefit = () => {
    if (newBenefit.trim() && !formData.benefits.includes(newBenefit.trim())) {
      setFormData({
        ...formData,
        benefits: [...formData.benefits, newBenefit.trim()],
      })
      setNewBenefit('')
    }
  }

  const handleRemoveBenefit = (benefit: string) => {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((b) => b !== benefit),
    })
  }

  const toggleIndustry = (industry: string) => {
    if (formData.targetIndustries.includes(industry)) {
      setFormData({
        ...formData,
        targetIndustries: formData.targetIndustries.filter((i) => i !== industry),
      })
    } else {
      setFormData({
        ...formData,
        targetIndustries: [...formData.targetIndustries, industry],
      })
    }
  }

  const toggleLocation = (location: string) => {
    if (formData.targetLocations.includes(location)) {
      setFormData({
        ...formData,
        targetLocations: formData.targetLocations.filter((l) => l !== location),
      })
    } else {
      setFormData({
        ...formData,
        targetLocations: [...formData.targetLocations, location],
      })
    }
  }

  const handleGenerateICP = async () => {
    setIsGeneratingICP(true)
    // シミュレーション: AIが理想顧客プロファイルを生成
    setTimeout(() => {
      const industries = formData.targetIndustries.join('、') || '指定なし'
      const employees = `${formData.targetEmployeeRange.min}〜${formData.targetEmployeeRange.max}名`
      const locations = formData.targetLocations.join('、') || '全国'
      const keywords = formData.keywords.join('、') || '未設定'

      setFormData({
        ...formData,
        idealCustomerProfile: `${industries}業界の${employees}規模の企業で、${locations}に拠点を持つ。${keywords}に関心があり、${formData.benefits.join('や') || '導入メリット'}を求めている企業がターゲット。`,
      })
      setIsGeneratingICP(false)
    }, 1500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const productData: CreateProductInput = {
        client_id: formData.client_id,
        name: formData.name,
        description: formData.description,
        targetIndustries: formData.targetIndustries,
        targetEmployeeRange: formData.targetEmployeeRange,
        targetRevenue: formData.targetRevenue.min || formData.targetRevenue.max
          ? formData.targetRevenue
          : undefined,
        targetLocations: formData.targetLocations,
        keywords: formData.keywords,
        benefits: formData.benefits,
        idealCustomerProfile: formData.idealCustomerProfile,
      }

      await createProduct(productData)
      router.replace('/director/products')
    } catch (err) {
      console.error('Failed to create product:', err)
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

      <main className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link href="/director/products">
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
                商材を追加
              </h2>
              <p className="text-sm text-slate-500">
                商材情報を入力してマッチング対象を設定
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">基本情報</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="client">クライアント *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, client_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="クライアントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">商材名 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="例: オフィス移転コンサルティング"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">商材説明 *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="商材の特徴やサービス内容を入力..."
                  rows={3}
                  required
                />
              </div>
            </div>
          </Card>

          {/* Target Settings */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">ターゲット設定</h3>
            <div className="space-y-6">
              {/* Industries */}
              <div>
                <Label>ターゲット業界</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {INDUSTRIES.map((industry) => (
                    <Badge
                      key={industry}
                      variant={
                        formData.targetIndustries.includes(industry)
                          ? 'default'
                          : 'outline'
                      }
                      className={`cursor-pointer transition-colors ${
                        formData.targetIndustries.includes(industry)
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'hover:bg-slate-100'
                      }`}
                      onClick={() => toggleIndustry(industry)}
                    >
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Employee Range */}
              <div>
                <Label>ターゲット従業員規模</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    type="number"
                    value={formData.targetEmployeeRange.min}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetEmployeeRange: {
                          ...formData.targetEmployeeRange,
                          min: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    placeholder="最小"
                    className="w-32"
                  />
                  <span className="text-slate-500">〜</span>
                  <Input
                    type="number"
                    value={formData.targetEmployeeRange.max}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetEmployeeRange: {
                          ...formData.targetEmployeeRange,
                          max: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    placeholder="最大"
                    className="w-32"
                  />
                  <span className="text-slate-500">名</span>
                </div>
              </div>

              {/* Locations */}
              <div>
                <Label>ターゲット地域</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LOCATIONS.map((location) => (
                    <Badge
                      key={location}
                      variant={
                        formData.targetLocations.includes(location)
                          ? 'default'
                          : 'outline'
                      }
                      className={`cursor-pointer transition-colors ${
                        formData.targetLocations.includes(location)
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'hover:bg-slate-100'
                      }`}
                      onClick={() => toggleLocation(location)}
                    >
                      {location}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Keywords & Benefits */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">キーワード・ベネフィット</h3>
            <div className="space-y-6">
              {/* Keywords */}
              <div>
                <Label>検索キーワード</Label>
                <p className="text-sm text-slate-500 mb-2">
                  この商材に関連するキーワードを追加（企業の特徴やニーズとマッチング）
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="キーワードを入力"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                  />
                  <Button type="button" onClick={handleAddKeyword} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {keyword}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-500"
                        onClick={() => handleRemoveKeyword(keyword)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Benefits */}
              <div>
                <Label>導入メリット</Label>
                <p className="text-sm text-slate-500 mb-2">
                  顧客が得られるメリットを追加
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newBenefit}
                    onChange={(e) => setNewBenefit(e.target.value)}
                    placeholder="メリットを入力"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBenefit())}
                  />
                  <Button type="button" onClick={handleAddBenefit} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.benefits.map((benefit) => (
                    <Badge
                      key={benefit}
                      variant="secondary"
                      className="flex items-center gap-1 bg-green-100 text-green-700"
                    >
                      {benefit}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-red-500"
                        onClick={() => handleRemoveBenefit(benefit)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ICP */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">理想顧客プロファイル (ICP)</h3>
                <p className="text-sm text-slate-500">
                  AIがマッチング精度を上げるための顧客像を生成します
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateICP}
                disabled={isGeneratingICP}
              >
                {isGeneratingICP ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AIで生成
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={formData.idealCustomerProfile}
              onChange={(e) =>
                setFormData({ ...formData, idealCustomerProfile: e.target.value })
              }
              placeholder="理想的な顧客像を入力、またはAIで自動生成..."
              rows={4}
            />
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/director/products">
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </Link>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              disabled={isSaving || !formData.name || !formData.description}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  商材を保存
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
