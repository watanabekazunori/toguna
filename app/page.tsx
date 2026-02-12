'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import {
  getOperatorAssignments,
  type OperatorProjectAssignment,
  getProjectStats,
  type ProjectStats,
  updateSalesFloorStatus,
} from '@/lib/projects-api'
import { getOperatorHomeData, type OperatorHomeData } from '@/lib/supabase-api'
import { ErrorAlert } from '@/components/error-alert'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Phone,
  Target,
  TrendingUp,
  Settings,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Sparkles,
  Calendar,
  Edit,
  Rocket,
  Search,
  BrainCircuit,
  Lightbulb,
  Trophy,
  Flame,
  Users,
  Plus,
  X,
} from 'lucide-react'
import Link from 'next/link'

type Period = '昨日' | '今日' | '今週'

type ScheduleSlot = {
  time: string
  projectName: string
  projectColor: string
  projectId: string
  remaining: {
    s: number
    a: number
    b: number
  }
  isActive: boolean
}

export default function OperatorHome() {
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('今日')
  const [assignments, setAssignments] = useState<OperatorProjectAssignment[]>([])
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({})
  const [homeData, setHomeData] = useState<OperatorHomeData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const { user, signOut, isLoading, isDirector } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const fetchData = async () => {
    setIsLoadingData(true)
    setDataError(null)
    try {
      if (!user?.id) return

      // オペレーターのプロジェクト割り当てを取得
      const userAssignments = await getOperatorAssignments(user.id)
      setAssignments(userAssignments)

      // 各プロジェクトの統計を取得
      if (userAssignments.length > 0) {
        const statsPromises = userAssignments.map(a =>
          getProjectStats(a.project_id).catch(err => {
            console.error(`Error fetching stats for project ${a.project_id}:`, err)
            return null
          })
        )
        const stats = await Promise.all(statsPromises)
        const statsMap: Record<string, ProjectStats> = {}
        userAssignments.forEach((assignment, i) => {
          if (stats[i]) {
            statsMap[assignment.project_id] = stats[i]!
          }
        })
        setProjectStats(statsMap)
      }

      // 営業フロア状態を更新（初期状態: idle）
      await updateSalesFloorStatus(user.id, {
        status: 'idle',
      })

      // レガシーデータも取得（互換性のため）
      const data = await getOperatorHomeData()
      setHomeData(data)
    } catch (error) {
      console.error('Failed to fetch home data:', error)
      setDataError('データの取得に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    // 認証が完了してからデータを取得
    if (!isLoading) {
      fetchData()
    }
  }, [isLoading, user?.id])

  // Realtime subscription for new project assignments
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()
    const channel = supabase.channel(`operator-assignments-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'operator_project_assignments',
          filter: `operator_id=eq.${user.id}`,
        },
        () => {
          toast({
            title: '新しいプロジェクトが割り当てられました',
            description: '割り当てを確認するため、ページを更新しています...',
          })
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, toast])

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const handleStartCalling = (projectId: string) => {
    router.push(`/call-list?project_id=${projectId}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">認証確認中...</p>
        </div>
      </div>
    )
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">データ読み込み中...</p>
        </div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">エラーが発生しました</h2>
            <p className="text-slate-600">{dataError}</p>
            <Button onClick={() => window.location.reload()}>再読み込み</Button>
          </div>
        </Card>
      </div>
    )
  }

  // プロジェクトが割り当てられていない場合
  if (assignments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              TOGUNA
            </h1>
            <div className="flex items-center gap-4">
              {isDirector && (
                <Link href="/director">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    ディレクター画面
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-[1920px] mx-auto px-8 py-8">
          <Card className="p-8 max-w-2xl mx-auto bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <div className="text-slate-400 mb-4">
                <Target className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                プロジェクトが割り当てられていません
              </h3>
              <p className="text-sm text-slate-500">
                ディレクター画面からプロジェクトを割り当ててください。
              </p>
              {isDirector && (
                <Link href="/director/projects">
                  <Button className="mt-4">プロジェクト管理へ</Button>
                </Link>
              )}
            </div>
          </Card>
        </main>
      </div>
    )
  }

  const selectedAssignment = assignments[selectedProjectIndex]
  const selectedProject = selectedAssignment?.project
  const selectedStats = selectedAssignment ? projectStats[selectedAssignment.project_id] : null

  // プロジェクトカラー（ここでは簡単に index に基づいて選択）
  const PROJECT_COLORS = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ]
  const selectedProjectColor = PROJECT_COLORS[selectedProjectIndex % PROJECT_COLORS.length]

  // Helper function to calculate rank-based company counts (S8)
  const calculateRankBreakdown = (totalRemaining: number) => {
    // Since ProjectStats only provides total remaining, we can't calculate accurate breakdown
    // Show total remaining and note that S/A/B breakdown requires company list
    // This is a placeholder that shows the total for now
    return {
      s: 0,
      a: 0,
      b: totalRemaining,
    }
  }

  // スケジュールスロットを動的に生成（最大3スロット）
  const scheduleSlots: ScheduleSlot[] = assignments.slice(0, 3).map((assignment, index) => {
    const times = ['9:00-10:00', '10:00-11:00', '11:00-12:00']
    const stats = projectStats[assignment.project_id]
    const rankBreakdown = calculateRankBreakdown(stats?.remaining_companies || 0)
    return {
      time: times[index] || `${9 + index}:00-${10 + index}:00`,
      projectName: assignment.project?.name || 'プロジェクト',
      projectColor: PROJECT_COLORS[index % PROJECT_COLORS.length],
      projectId: assignment.project_id,
      remaining: rankBreakdown,
      isActive: index === selectedProjectIndex,
    }
  })

  // パフォーマンス指標の計算
  const dailyCallTarget = selectedProject?.daily_call_target || 60
  const todayCallProgress = selectedStats
    ? (selectedStats.today_calls / dailyCallTarget) * 100
    : 0

  const weeklyAppointmentTarget = selectedProject?.weekly_appointment_target || 3
  const appointmentProgressPercent = selectedStats
    ? (selectedStats.total_appointments / weeklyAppointmentTarget) * 100
    : 0

  const appointmentRate = selectedStats?.appointment_rate || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo and Current Project */}
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              TOGUNA
            </h1>
            {selectedProject && (
              <Badge className={`${selectedProjectColor} text-white px-4 py-1 text-sm font-medium`}>
                {selectedProject.name}
              </Badge>
            )}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-4">
            {isDirector && (
              <Link href="/director">
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  ディレクター画面
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right">
                <span className="text-sm font-medium block">{user?.name || 'オペレーター'}さん</span>
                <span className="text-xs text-slate-500">{isDirector ? 'ディレクター' : 'オペレーター'}</span>
              </div>
              <Avatar className="h-9 w-9">
                <AvatarFallback className={`text-white ${isDirector ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
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
        {/* Error Alert */}
        {dataError && (
          <ErrorAlert
            message={dataError}
            onRetry={() => fetchData()}
          />
        )}

        {/* Section 1: 6-Project Switcher */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">プロジェクト選択</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {assignments.map((assignment, index) => (
              <Button
                key={assignment.id}
                onClick={() => setSelectedProjectIndex(index)}
                variant={index === selectedProjectIndex ? 'default' : 'outline'}
                className={`px-4 py-2 whitespace-nowrap transition-all ${
                  index === selectedProjectIndex
                    ? `${PROJECT_COLORS[index % PROJECT_COLORS.length]} text-white shadow-lg`
                    : ''
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${PROJECT_COLORS[index % PROJECT_COLORS.length]}`}></div>
                {assignment.project?.name || `プロジェクト ${index + 1}`}
              </Button>
            ))}
            {assignments.length < 6 && (
              <Button variant="outline" size="sm" className="px-3">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </section>

        {/* Section 2: Performance Summary Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">実績サマリー</h2>
            <div className="flex gap-2">
              {(['昨日', '今日', '今週'] as Period[]).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className={
                    selectedPeriod === period
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : ''
                  }
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 架電数 Card */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-all border-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">架電数</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedStats?.today_calls || 0}
                    </span>
                    <span className="text-lg text-slate-500">/ {dailyCallTarget}件</span>
                  </div>
                  <Progress
                    value={Math.min(todayCallProgress, 100)}
                    className="h-2 bg-slate-200 dark:bg-slate-800"
                    indicatorClassName={`${selectedProjectColor} transition-all duration-500`}
                  />
                  <div className="text-sm text-slate-500">
                    {Math.round(todayCallProgress)}% 達成
                  </div>
                </div>
              </div>
            </Card>

            {/* アポ獲得 Card */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-all border-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">アポ獲得</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedStats?.total_appointments || 0}
                    </span>
                    <span className="text-lg text-slate-500">/ {weeklyAppointmentTarget}件</span>
                  </div>
                  <Progress
                    value={Math.min(appointmentProgressPercent, 100)}
                    className="h-2 bg-slate-200 dark:bg-slate-800"
                    indicatorClassName="bg-green-500 transition-all duration-500"
                  />
                  <div className="text-sm text-slate-500">
                    {Math.round(appointmentProgressPercent)}% 達成
                  </div>
                </div>
              </div>
            </Card>

            {/* アポ率 Card */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-all border-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">アポ率</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                      {appointmentRate.toFixed(1)}
                    </span>
                    <span className="text-lg text-slate-500">%</span>
                  </div>
                  <Progress
                    value={Math.min(appointmentRate, 100)}
                    className="h-2 bg-slate-200 dark:bg-slate-800"
                    indicatorClassName="bg-purple-500 transition-all duration-500"
                  />
                  <div className="text-sm text-slate-500">
                    目標: 15% 以上
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Section 3 & 4: AI Coaching and Schedule */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Coaching */}
          <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-shadow border-2">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-bold">AIからのアドバイス</h3>
              </div>

              {/* Priority Actions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Lightbulb className="h-5 w-5" />
                  <h4 className="font-bold">今日の優先アクション</h4>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-lg space-y-3">
                  {selectedStats && selectedStats.remaining_companies > 0 ? (
                    <>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">{selectedStats.remaining_companies}社</span>の企業がまだ架電対象です。
                        優先的にアプローチしましょう。
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">📌 おすすめ対策:</p>
                        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>優先度の高い企業から架電開始</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>AIトークスクリプトを活用</span>
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      架電データが蓄積されると、AIがあなたに合わせたアドバイスを提供します。
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800"></div>

              {/* Today's Goal */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Target className="h-5 w-5" />
                  <h4 className="font-bold">今日の目標</h4>
                </div>
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-l-4 border-orange-500 p-4 rounded-r-lg">
                  {selectedStats && selectedStats.total_appointments < weeklyAppointmentTarget ? (
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      週間目標まであと<span className="font-bold text-orange-600">
                        {weeklyAppointmentTarget - selectedStats.total_appointments}件
                      </span>のアポが必要です。
                      <Flame className="inline h-4 w-4 text-orange-500 ml-1" />
                      <br />
                      本日の架電目標: <span className="font-semibold">{dailyCallTarget}件</span>
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      🎉 週間目標達成！素晴らしいです！
                      <br />
                      引き続き頑張りましょう。
                    </p>
                  )}
                </div>
              </div>

              {/* Tip */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Trophy className="h-5 w-5" />
                  <h4 className="font-bold">今日のヒント</h4>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500 p-4 rounded-r-lg">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    架電前にAIトークスクリプトを生成して、
                    <br />
                    効果的なアプローチを準備しましょう！
                    <TrendingUp className="inline h-4 w-4 text-green-500 ml-1" />
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Today's Schedule */}
          <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-shadow border-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-blue-600" />
                  <h3 className="text-xl font-bold">今日のスケジュール</h3>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  調整
                </Button>
              </div>

              <div className="space-y-3">
                {scheduleSlots.map((slot, index) => (
                  <Card
                    key={index}
                    className={`p-4 transition-all duration-300 ${
                      slot.isActive
                        ? 'border-2 border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-50 dark:bg-blue-950/30'
                        : 'border hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${slot.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}
                          ></div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{slot.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${slot.projectColor}`}></div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{slot.projectName}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        残企業:{' '}
                        <span className="font-semibold">
                          {slot.remaining.s + slot.remaining.a + slot.remaining.b}社
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                          <Edit className="h-3 w-3 mr-1" />
                          時間変更
                        </Button>
                        {slot.isActive && (
                          <Button
                            size="sm"
                            onClick={() => handleStartCalling(slot.projectId)}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl"
                          >
                            <Rocket className="h-3 w-3 mr-1" />
                            架電開始
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full border-dashed border-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 bg-transparent"
              >
                <Search className="h-4 w-4 mr-2" />
                スケジュール外で架電
              </Button>
            </div>
          </Card>
        </section>

        {/* Section 5: Quick Actions */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Button
              onClick={() => selectedProject && handleStartCalling(selectedProject.id)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl h-12"
            >
              <Rocket className="h-5 w-5 mr-2" />
              架電開始
            </Button>
            <Button variant="outline" className="h-12">
              <Calendar className="h-5 w-5 mr-2" />
              スケジュール調整
            </Button>
            <Link href="/performance">
              <Button variant="outline" className="h-12 w-full">
                <TrendingUp className="h-5 w-5 mr-2" />
                成績を見る
              </Button>
            </Link>
            <Button variant="outline" className="h-12">
              <Target className="h-5 w-5 mr-2" />
              レポート確認
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
