'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Bell,
  LogOut,
  Plus,
  TrendingUp,
  Zap,
  Users,
  Phone,
  Headphones,
  HardDrive,
  Check,
} from 'lucide-react'

type Plan = {
  id: string
  name: string
  price: number
  description: string
  max_operators: number
  max_calls_per_day: number
  features: {
    ai_analysis: boolean
    call_recording: boolean
    support: 'email' | 'phone' | 'dedicated'
    storage_gb: number
  }
}

type ClientPlan = {
  id: string
  client_id: string
  client_name: string
  plan_name: string
  monthly_price: number
  max_operators: number
  max_calls_per_day: number
  status: 'active' | 'inactive'
  started_at: string
  ended_at: string | null
}

type PlanChangeHistory = {
  id: string
  client_id: string
  client_name: string
  from_plan: string
  to_plan: string
  changed_at: string
  changed_by: string
}

const PLANS: Plan[] = [
  {
    id: 'free_trial',
    name: 'フリートライアル',
    price: 0,
    description: '試してみたい方向け',
    max_operators: 3,
    max_calls_per_day: 30,
    features: {
      ai_analysis: false,
      call_recording: false,
      support: 'email',
      storage_gb: 5,
    },
  },
  {
    id: 'starter',
    name: 'スタータープラン',
    price: 50000,
    description: '小規模チーム向け',
    max_operators: 5,
    max_calls_per_day: 100,
    features: {
      ai_analysis: true,
      call_recording: true,
      support: 'email',
      storage_gb: 50,
    },
  },
  {
    id: 'business',
    name: 'ビジネスプラン',
    price: 150000,
    description: '成長中の企業向け',
    max_operators: 20,
    max_calls_per_day: 500,
    features: {
      ai_analysis: true,
      call_recording: true,
      support: 'phone',
      storage_gb: 500,
    },
  },
  {
    id: 'enterprise',
    name: 'エンタープライズ',
    price: 300000,
    description: '大規模組織向け',
    max_operators: 100,
    max_calls_per_day: 5000,
    features: {
      ai_analysis: true,
      call_recording: true,
      support: 'dedicated',
      storage_gb: 2000,
    },
  },
]

export default function PlansPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [clientPlans, setClientPlans] = useState<ClientPlan[]>([])
  const [history, setHistory] = useState<PlanChangeHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    client_id: '',
    new_plan: '',
    effective_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    fetchClientPlans()
    fetchHistory()
    fetchClients()
  }, [])

  const fetchClientPlans = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('client_plans')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })

      if (error) throw error

      const plansWithNames = await Promise.all(
        (data || []).map(async (plan) => {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', plan.client_id)
            .single()

          return {
            ...plan,
            client_name: client?.name || 'Unknown',
          }
        })
      )

      setClientPlans(plansWithNames)
    } catch (error) {
      console.error('Error fetching client plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('plan_change_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const historyWithNames = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', entry.client_id)
            .single()

          return {
            ...entry,
            client_name: client?.name || 'Unknown',
          }
        })
      )

      setHistory(historyWithNames)
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const handleChangePlan = async () => {
    if (!formData.client_id || !formData.new_plan) {
      alert('クライアントと新しいプランを選択してください')
      return
    }

    try {
      const currentPlan = clientPlans.find(
        (p) => p.client_id === formData.client_id && p.status === 'active'
      )

      const newPlanDetails = PLANS.find((p) => p.id === formData.new_plan)
      if (!newPlanDetails) throw new Error('Plan not found')

      // Insert new plan
      const { error: insertError } = await supabase
        .from('client_plans')
        .insert([
          {
            client_id: formData.client_id,
            plan_name: newPlanDetails.name,
            monthly_price: newPlanDetails.price,
            max_operators: newPlanDetails.max_operators,
            max_calls_per_day: newPlanDetails.max_calls_per_day,
            features: newPlanDetails.features,
            status: 'active',
            started_at: new Date(formData.effective_date)
              .toISOString()
              .split('T')[0],
            ended_at: null,
          },
        ])

      if (insertError) throw insertError

      // Update old plan to inactive
      if (currentPlan) {
        const { error: updateError } = await supabase
          .from('client_plans')
          .update({
            status: 'inactive',
            ended_at: new Date(formData.effective_date)
              .toISOString()
              .split('T')[0],
          })
          .eq('id', currentPlan.id)

        if (updateError) throw updateError

        // Add to history
        const { error: historyError } = await supabase
          .from('plan_change_history')
          .insert([
            {
              client_id: formData.client_id,
              from_plan: currentPlan.plan_name,
              to_plan: newPlanDetails.name,
              changed_at: new Date().toISOString(),
              changed_by: user?.id || 'unknown',
            },
          ])

        if (historyError) throw historyError
      }

      setDialogOpen(false)
      setFormData({
        client_id: '',
        new_plan: '',
        effective_date: new Date().toISOString().split('T')[0],
      })
      fetchClientPlans()
      fetchHistory()
    } catch (error) {
      console.error('Error changing plan:', error)
      alert('プラン変更に失敗しました')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const getSupportLabel = (support: string): string => {
    switch (support) {
      case 'email':
        return 'メール'
      case 'phone':
        return '電話'
      case 'dedicated':
        return '専任サポート'
      default:
        return support
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

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  プラン管理
                </h2>
                <p className="text-sm text-slate-500">
                  利用可能なプランとクライアント管理
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans Comparison */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">利用可能なプラン</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col"
              >
                <h4 className="font-bold text-lg mb-1">{plan.name}</h4>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>

                <div className="mb-4">
                  {plan.price > 0 ? (
                    <div>
                      <p className="text-3xl font-bold">
                        ¥{plan.price.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-500">/月</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-green-600">無料</p>
                  )}
                </div>

                <div className="space-y-3 flex-1 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {plan.max_operators}名まで
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {plan.max_calls_per_day}件/日
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {plan.features.storage_gb}GB
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {getSupportLabel(plan.features.support)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    {plan.features.ai_analysis && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm">AI分析</span>
                      </div>
                    )}
                    {plan.features.call_recording && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm">通話録音</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Plan Change Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">プラン変更</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  プラン変更
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>プラン変更</DialogTitle>
                  <DialogDescription>
                    クライアントのプランを変更します
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">クライアント</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => {
                        setFormData({ ...formData, client_id: value })
                        // Auto-fill current plan
                        const current = clientPlans.find(
                          (p) => p.client_id === value && p.status === 'active'
                        )
                      }}
                    >
                      <SelectTrigger id="client">
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

                  {formData.client_id && (
                    <div className="space-y-2">
                      <Label>現在のプラン</Label>
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm font-medium">
                          {
                            clientPlans.find(
                              (p) =>
                                p.client_id === formData.client_id &&
                                p.status === 'active'
                            )?.plan_name
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="new-plan">新しいプラン</Label>
                    <Select
                      value={formData.new_plan}
                      onValueChange={(value) =>
                        setFormData({ ...formData, new_plan: value })
                      }
                    >
                      <SelectTrigger id="new-plan">
                        <SelectValue placeholder="新しいプランを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANS.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="effective-date">有効日</Label>
                    <Input
                      id="effective-date"
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          effective_date: e.target.value,
                        })
                      }
                    />
                  </div>

                  <Button
                    onClick={handleChangePlan}
                    className="w-full bg-blue-600 text-white"
                  >
                    変更
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>クライアント</TableHead>
                    <TableHead>現在のプラン</TableHead>
                    <TableHead className="text-right">月額料金</TableHead>
                    <TableHead className="text-right">オペレーター</TableHead>
                    <TableHead className="text-right">架電限度</TableHead>
                    <TableHead>開始日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span>読み込み中...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : clientPlans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <span className="text-slate-500">
                          クライアントプランがありません
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">
                          {plan.client_name}
                        </TableCell>
                        <TableCell>{plan.plan_name}</TableCell>
                        <TableCell className="text-right">
                          ¥{plan.monthly_price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.max_operators}
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.max_calls_per_day}
                        </TableCell>
                        <TableCell>
                          {new Date(plan.started_at).toLocaleDateString(
                            'ja-JP'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Change History */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">プラン変更履歴</h3>
          <Card className="p-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>クライアント</TableHead>
                    <TableHead>変更前</TableHead>
                    <TableHead>変更後</TableHead>
                    <TableHead>変更日時</TableHead>
                    <TableHead>変更者</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <span className="text-slate-500">
                          変更履歴がありません
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.client_name}
                        </TableCell>
                        <TableCell>{entry.from_plan}</TableCell>
                        <TableCell>{entry.to_plan}</TableCell>
                        <TableCell>
                          {new Date(entry.changed_at).toLocaleDateString(
                            'ja-JP'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {entry.changed_by}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
