'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getOperators, type Operator, getCallLogs } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  ArrowLeft,
  Phone,
  Mail,
  Target,
  TrendingUp,
  Clock,
  Bell,
  LogOut,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react'

type OperatorWithStats = Operator & {
  todayCalls: number
  todayAppointments: number
  weeklyTarget: number
  weeklyProgress: number
  avgCallDuration: string
}

export default function OperatorsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [operators, setOperators] = useState<OperatorWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const weekStartStr = weekStart.toISOString().split('T')[0]

        const [operatorsData, allLogs] = await Promise.all([
          getOperators(),
          getCallLogs(),
        ])

        const operatorsWithStats: OperatorWithStats[] = operatorsData.map((op) => {
          const opLogs = allLogs.filter((l: any) => l.operator_id === op.id)
          const todayLogs = opLogs.filter((l: any) => l.called_at?.startsWith(today))
          const weekLogs = opLogs.filter((l: any) => l.called_at && l.called_at >= weekStartStr)
          const todayApps = todayLogs.filter((l: any) => l.result === 'アポ獲得').length
          const totalDuration = todayLogs.reduce((sum: number, l: any) => sum + (l.duration || 0), 0)
          const avgSecs = todayLogs.length > 0 ? Math.round(totalDuration / todayLogs.length) : 0
          const avgMins = Math.floor(avgSecs / 60)
          const avgRemSecs = avgSecs % 60

          return {
            ...op,
            todayCalls: todayLogs.length,
            todayAppointments: todayApps,
            weeklyTarget: 300,
            weeklyProgress: weekLogs.length,
            avgCallDuration: `${avgMins}:${avgRemSecs.toString().padStart(2, '0')}`,
          }
        })
        setOperators(operatorsWithStats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'オペレーターの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchOperators()
    }
  }, [isDirector])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  // 統計サマリー
  const stats = {
    total: operators.length,
    active: operators.filter((op) => op.status === 'active').length,
    todayCalls: operators.reduce((sum, op) => sum + op.todayCalls, 0),
    todayAppointments: operators.reduce((sum, op) => sum + op.todayAppointments, 0),
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
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  オペレーター管理
                </h2>
                <p className="text-sm text-slate-500">
                  {stats.active}名がアクティブ / 全{stats.total}名
                </p>
              </div>
            </div>
          </div>
          <Link href="/director/operators/new">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-300">
              新規オペレーター追加
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">アクティブ</p>
                <p className="text-2xl font-bold">{stats.active}名</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">本日の架電</p>
                <p className="text-2xl font-bold">{stats.todayCalls}件</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">本日のアポ</p>
                <p className="text-2xl font-bold">{stats.todayAppointments}件</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">平均アポ率</p>
                <p className="text-2xl font-bold">
                  {stats.todayCalls > 0
                    ? ((stats.todayAppointments / stats.todayCalls) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Operators List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : operators.length === 0 ? (
          <Card className="p-12 text-center bg-white/50 dark:bg-slate-900/50">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
              オペレーターが登録されていません
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {operators.map((operator) => (
              <Card
                key={operator.id}
                className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-lg transition-shadow"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback
                          className={`text-white ${
                            operator.status === 'active'
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              : 'bg-slate-400'
                          }`}
                        >
                          {operator.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-lg">{operator.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Mail className="h-3 w-3" />
                          {operator.email}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={
                        operator.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }
                    >
                      {operator.status === 'active' ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          稼働中
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          停止中
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500">本日架電</p>
                      <p className="text-xl font-bold text-blue-600">{operator.todayCalls}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500">アポ獲得</p>
                      <p className="text-xl font-bold text-green-600">
                        {operator.todayAppointments}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500">平均通話</p>
                      <p className="text-xl font-bold text-purple-600">
                        {operator.avgCallDuration}
                      </p>
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">週間目標進捗</span>
                      <span className="font-medium">
                        {operator.weeklyProgress}/{operator.weeklyTarget}件 (
                        {Math.round((operator.weeklyProgress / operator.weeklyTarget) * 100)}%)
                      </span>
                    </div>
                    <Progress
                      value={(operator.weeklyProgress / operator.weeklyTarget) * 100}
                      className="h-2"
                    />
                  </div>

                  {/* Actions */}
                  <Link href={`/director/operators/${operator.id}`}>
                    <Button variant="outline" className="w-full">
                      詳細を見る
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
