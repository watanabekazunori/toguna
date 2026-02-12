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
import { Checkbox } from '@/components/ui/checkbox'
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
  AlertCircle,
  ArrowLeft,
  Bell,
  Clock,
  LogOut,
  Plus,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Calendar,
} from 'lucide-react'

type TrialAccount = {
  id: string
  client_id: string
  client_name: string
  plan_type: 'free_trial' | 'limited' | 'full'
  start_date: string
  end_date: string
  max_operators: number
  max_calls_per_day: number
  features_enabled: string[]
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  created_at: string
}

type Stats = {
  total_trials: number
  active_count: number
  conversion_rate: number
  average_trial_duration: number
}

const FEATURES = [
  { id: 'ai_analysis', label: 'AI分析' },
  { id: 'call_recording', label: '通話録音' },
  { id: 'nurturing', label: 'ナーチャリング' },
  { id: 'incubation', label: 'インキュベーション' },
  { id: 'compliance', label: 'コンプライアンス' },
]

const FEATURE_LABELS: Record<string, string> = {
  ai_analysis: 'AI分析',
  call_recording: '通話録音',
  nurturing: 'ナーチャリング',
  incubation: 'インキュベーション',
  compliance: 'コンプライアンス',
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  free_trial: 'フリートライアル',
  limited: 'リミテッド',
  full: 'フル機能',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  converted:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled:
    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

export default function TrialManagementPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [trials, setTrials] = useState<TrialAccount[]>([])
  const [stats, setStats] = useState<Stats>({
    total_trials: 0,
    active_count: 0,
    conversion_rate: 0,
    average_trial_duration: 0,
  })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])

  const [formData, setFormData] = useState({
    client_id: '',
    plan_type: 'free_trial' as const,
    duration: 14,
    max_operators: 3,
  })

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    fetchTrials()
    fetchClients()
  }, [])

  const fetchTrials = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('trial_accounts')
        .select('*, client_id')
        .order('created_at', { ascending: false })

      if (error) throw error

      const trialsWithNames = await Promise.all(
        (data || []).map(async (trial) => {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', trial.client_id)
            .single()

          return {
            ...trial,
            client_name: client?.name || 'Unknown',
          }
        })
      )

      setTrials(trialsWithNames)

      // Calculate stats
      const total = trialsWithNames.length
      const active = trialsWithNames.filter((t) => t.status === 'active').length
      const converted = trialsWithNames.filter(
        (t) => t.status === 'converted'
      ).length
      const conversionRate =
        total > 0 ? Math.round((converted / total) * 100) : 0

      const durations = trialsWithNames.map((t) => {
        const start = new Date(t.start_date).getTime()
        const end = new Date(t.end_date).getTime()
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      })
      const avgDuration =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0

      setStats({
        total_trials: total,
        active_count: active,
        conversion_rate: conversionRate,
        average_trial_duration: avgDuration,
      })
    } catch (error) {
      console.error('Error fetching trials:', error)
    } finally {
      setLoading(false)
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

  const handleCreateTrial = async () => {
    if (!formData.client_id) {
      alert('クライアントを選択してください')
      return
    }

    try {
      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + formData.duration * 24 * 60 * 60 * 1000)

      const { error } = await supabase.from('trial_accounts').insert([
        {
          client_id: formData.client_id,
          plan_type: formData.plan_type,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          max_operators: formData.max_operators,
          max_calls_per_day: 50,
          features_enabled: selectedFeatures,
          status: 'active',
        },
      ])

      if (error) throw error

      setDialogOpen(false)
      setFormData({
        client_id: '',
        plan_type: 'free_trial',
        duration: 14,
        max_operators: 3,
      })
      setSelectedFeatures([])
      fetchTrials()
    } catch (error) {
      console.error('Error creating trial:', error)
      alert('トライアルの作成に失敗しました')
    }
  }

  const getRemainingDays = (endDate: string): number => {
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const handleStatusChange = async (
    trialId: string,
    newStatus: 'active' | 'expired' | 'converted' | 'cancelled'
  ) => {
    try {
      const { error } = await supabase
        .from('trial_accounts')
        .update({ status: newStatus })
        .eq('id', trialId)

      if (error) throw error
      fetchTrials()
    } catch (error) {
      console.error('Error updating trial status:', error)
    }
  }

  const handleExtendTrial = async (trialId: string) => {
    try {
      const trial = trials.find((t) => t.id === trialId)
      if (!trial) return

      const currentEnd = new Date(trial.end_date)
      const newEnd = new Date(
        currentEnd.getTime() + 14 * 24 * 60 * 60 * 1000
      )

      const { error } = await supabase
        .from('trial_accounts')
        .update({ end_date: newEnd.toISOString().split('T')[0] })
        .eq('id', trialId)

      if (error) throw error
      fetchTrials()
    } catch (error) {
      console.error('Error extending trial:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
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

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">
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
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  トライアルモード管理
                </h2>
                <p className="text-sm text-slate-500">
                  トライアル期間とアップグレード管理
                </p>
              </div>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                <Plus className="h-4 w-4 mr-2" />
                新規トライアル作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新規トライアル作成</DialogTitle>
                <DialogDescription>
                  新しいトライアルアカウントを作成します
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">クライアント</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, client_id: value })
                    }
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

                <div className="space-y-2">
                  <Label htmlFor="plan">プラン種別</Label>
                  <Select
                    value={formData.plan_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, plan_type: value })
                    }
                  >
                    <SelectTrigger id="plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_trial">フリートライアル</SelectItem>
                      <SelectItem value="limited">リミテッド</SelectItem>
                      <SelectItem value="full">フル機能</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">トライアル期間</Label>
                  <Select
                    value={formData.duration.toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        duration: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14日</SelectItem>
                      <SelectItem value="30">30日</SelectItem>
                      <SelectItem value="60">60日</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operators">オペレーター上限</Label>
                  <Input
                    id="operators"
                    type="number"
                    min="1"
                    value={formData.max_operators}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_operators: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>有効な機能</Label>
                  <div className="space-y-2">
                    {FEATURES.map((feature) => (
                      <div key={feature.id} className="flex items-center gap-2">
                        <Checkbox
                          id={feature.id}
                          checked={selectedFeatures.includes(feature.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFeatures([
                                ...selectedFeatures,
                                feature.id,
                              ])
                            } else {
                              setSelectedFeatures(
                                selectedFeatures.filter((f) => f !== feature.id)
                              )
                            }
                          }}
                        />
                        <Label
                          htmlFor={feature.id}
                          className="cursor-pointer font-normal"
                        >
                          {feature.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreateTrial}
                  className="w-full bg-blue-600 text-white"
                >
                  作成
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">総トライアル数</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.total_trials}
                </p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">アクティブ</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.active_count}
                </p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">コンバージョン率</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.conversion_rate}%
                </p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">平均期間</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.average_trial_duration}日
                </p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Trial Accounts */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">トライアルアカウント</h3>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : trials.length === 0 ? (
            <Card className="p-12 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <p className="text-slate-500">
                トライアルアカウントはありません
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {trials.map((trial) => {
                const remainingDays = getRemainingDays(trial.end_date)
                const isExpiringSoon = remainingDays <= 3 && remainingDays > 0

                return (
                  <Card
                    key={trial.id}
                    className={`p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ${
                      isExpiringSoon ? 'border-orange-300 dark:border-orange-700' : ''
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">
                            {trial.client_name}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge className={STATUS_COLORS[trial.status]}>
                              {trial.status === 'active'
                                ? 'アクティブ'
                                : trial.status === 'expired'
                                  ? '期限切れ'
                                  : trial.status === 'converted'
                                    ? '有料化'
                                    : 'キャンセル'}
                            </Badge>
                            <Badge variant="outline">
                              {PLAN_TYPE_LABELS[trial.plan_type]}
                            </Badge>
                          </div>
                        </div>
                        {isExpiringSoon && (
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-slate-500">開始日</p>
                          <p className="font-medium">
                            {new Date(trial.start_date).toLocaleDateString(
                              'ja-JP'
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">終了日</p>
                          <p className="font-medium">
                            {new Date(trial.end_date).toLocaleDateString(
                              'ja-JP'
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">残り日数</p>
                          <p
                            className={`font-medium ${isExpiringSoon ? 'text-orange-600' : ''}`}
                          >
                            {remainingDays}日
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">オペレーター上限</p>
                          <p className="font-medium">
                            {trial.max_operators}名
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500 mb-2">有効な機能</p>
                        <div className="flex gap-1 flex-wrap">
                          {trial.features_enabled.map((feature) => (
                            <Badge
                              key={feature}
                              variant="secondary"
                              className="text-xs"
                            >
                              {FEATURE_LABELS[feature] || feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {trial.status === 'active' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExtendTrial(trial.id)}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            延長 (+14日)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusChange(trial.id, 'converted')
                            }
                          >
                            有料化へ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() =>
                              handleStatusChange(trial.id, 'cancelled')
                            }
                          >
                            キャンセル
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
