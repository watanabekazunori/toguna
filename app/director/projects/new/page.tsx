'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/lib/projects-api'
import { getClients, getProducts, type Client, type Product } from '@/lib/supabase-api'
import { generate3CAnalysis, generate4PAnalysis, generateSTPAnalysis, generateStrategyRoadmap } from '@/lib/strategy-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, FolderPlus, Rocket, Loader2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function NewProjectPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [strategyProgress, setStrategyProgress] = useState<{
    isGenerating: boolean
    current: number
    total: number
    message: string
  }>({
    isGenerating: false,
    current: 0,
    total: 4,
    message: '',
  })

  const [form, setForm] = useState({
    client_id: '',
    product_id: '',
    name: '',
    description: '',
    daily_call_target: 60,
    weekly_appointment_target: 3,
    monthly_appointment_target: 12,
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (form.client_id) {
      getProducts(form.client_id).then(setProducts)
    }
  }, [form.client_id])

  async function loadData() {
    const clientsData = await getClients()
    setClients(clientsData)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.name) return

    setLoading(true)
    try {
      const project = await createProject({
        client_id: form.client_id,
        product_id: form.product_id || undefined,
        name: form.name,
        description: form.description || undefined,
        daily_call_target: form.daily_call_target,
        weekly_appointment_target: form.weekly_appointment_target,
        monthly_appointment_target: form.monthly_appointment_target,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      })

      if (project) {
        // Start strategy generation in the background
        setStrategyProgress({
          isGenerating: true,
          current: 0,
          total: 4,
          message: 'AI戦略を自動生成中...',
        })

        // Get client and product names for context
        const client = clients.find(c => c.id === form.client_id)
        const product = products.find(p => p.id === form.product_id)

        // Build context objects
        const clientName = client?.name || form.client_id
        const productName = product?.name || form.name
        const targetIndustries = form.description ? [form.description.split('\n')[0]] : []
        const benefits = ['アポイント獲得率の向上', '営業コストの削減', '新規顧客開拓の効率化']

        try {
          // Generate all analyses in parallel
          await Promise.all([
            (async () => {
              await generate3CAnalysis(project.id, {
                clientName,
                productName,
                productDescription: form.description || '',
                targetIndustries,
                documentSummaries: [],
              })
              setStrategyProgress(prev => ({ ...prev, current: 1, message: '3C分析を完成させました' }))
            })(),
            (async () => {
              await generate4PAnalysis(project.id, {
                productName,
                productDescription: form.description || '',
                targetIndustries,
                benefits,
              })
              setStrategyProgress(prev => ({ ...prev, current: 2, message: '4P分析を完成させました' }))
            })(),
            (async () => {
              await generateSTPAnalysis(project.id, {
                targetIndustries,
                targetEmployeeRange: { min: 10, max: 500 },
                targetLocations: ['東京都', '大阪府', '全国'],
              })
              setStrategyProgress(prev => ({ ...prev, current: 3, message: 'STP分析を完成させました' }))
            })(),
            (async () => {
              await generateStrategyRoadmap(project.id, {
                productName,
                targetIndustries,
                benefits,
              })
              setStrategyProgress(prev => ({ ...prev, current: 4, message: 'ロードマップを完成させました' }))
            })(),
          ])

          setStrategyProgress({
            isGenerating: false,
            current: 4,
            total: 4,
            message: '戦略分析が完成しました！',
          })

          // Redirect after a brief delay to show completion
          setTimeout(() => {
            router.push(`/director/projects/${project.id}`)
          }, 1500)
        } catch (error) {
          console.error('Failed to generate strategies:', error)
          // Still redirect even if strategy generation fails
          router.push(`/director/projects/${project.id}`)
        }
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          戻る
        </Button>

        <div className="flex items-center gap-3">
          <FolderPlus className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">新規プロジェクト作成</h1>
            <p className="text-gray-500">クライアントの案件をプロジェクトとして管理します</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本情報</CardTitle>
              <CardDescription>プロジェクトの基本設定を入力してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">クライアント *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="クライアントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">商材（オプション）</Label>
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="商材を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">プロジェクト名 *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: 〇〇社 ITソリューション新規開拓"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="プロジェクトの目的や特記事項"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 目標設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">目標設定</CardTitle>
              <CardDescription>KPI目標を設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>日次架電目標</Label>
                  <Input
                    type="number"
                    value={form.daily_call_target}
                    onChange={e => setForm(f => ({ ...f, daily_call_target: parseInt(e.target.value) || 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>週次アポ目標</Label>
                  <Input
                    type="number"
                    value={form.weekly_appointment_target}
                    onChange={e => setForm(f => ({ ...f, weekly_appointment_target: parseInt(e.target.value) || 3 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>月次アポ目標</Label>
                  <Input
                    type="number"
                    value={form.monthly_appointment_target}
                    onChange={e => setForm(f => ({ ...f, monthly_appointment_target: parseInt(e.target.value) || 12 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>開始日</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>終了日</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 送信 */}
          <Button
            type="submit"
            className="w-full gap-2"
            size="lg"
            disabled={loading || strategyProgress.isGenerating || !form.client_id || !form.name}
          >
            {strategyProgress.isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {strategyProgress.message}
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                {loading ? 'プロジェクト作成中...' : 'プロジェクトを作成'}
              </>
            )}
          </Button>

          {/* Strategy Generation Progress */}
          {strategyProgress.isGenerating && (
            <Card className="bg-blue-50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AI戦略分析の生成進行状況</span>
                    <span className="text-sm text-gray-600">{strategyProgress.current}/{strategyProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(strategyProgress.current / strategyProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className={strategyProgress.current >= 1 ? 'text-green-600 font-medium' : ''}>
                      {strategyProgress.current >= 1 ? '✓' : '○'} 3C分析（顧客・競合・自社）
                    </p>
                    <p className={strategyProgress.current >= 2 ? 'text-green-600 font-medium' : ''}>
                      {strategyProgress.current >= 2 ? '✓' : '○'} 4P分析（製品・価格・流通・販促）
                    </p>
                    <p className={strategyProgress.current >= 3 ? 'text-green-600 font-medium' : ''}>
                      {strategyProgress.current >= 3 ? '✓' : '○'} STP分析（セグメント・ターゲット・ポジショニング）
                    </p>
                    <p className={strategyProgress.current >= 4 ? 'text-green-600 font-medium' : ''}>
                      {strategyProgress.current >= 4 ? '✓' : '○'} 戦略ロードマップ生成
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  )
}
