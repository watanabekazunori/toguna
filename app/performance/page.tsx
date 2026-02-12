'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { getCallQualityScores, type CallQualityScore } from '@/lib/management-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft,
  TrendingUp,
  Phone,
  Target,
  Award,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'

type CallLog = {
  id: string
  operator_id: string
  company_id: string
  result: string
  duration: number
  called_at: string
  created_at: string
}

type Operator = {
  id: string
  name: string
}

export default function PerformancePage() {
  const { user, isLoading, isDirector } = useAuth()
  const router = useRouter()
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [qualityScores, setQualityScores] = useState<CallQualityScore[]>([])
  const [allOperators, setAllOperators] = useState<Operator[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auth and role checks
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
      } else if (isDirector) {
        router.push('/director')
      }
    }
  }, [isLoading, user, isDirector, router])

  // Data fetching
  useEffect(() => {
    if (!user?.id || isDirector) return

    const fetchData = async () => {
      setIsLoadingData(true)
      setError(null)
      try {
        const supabase = createClient()

        // Fetch call logs for this operator
        const { data: logs, error: logsError } = await supabase
          .from('call_logs')
          .select('*')
          .eq('operator_id', user.id)
          .order('called_at', { ascending: false })

        if (logsError) throw logsError
        setCallLogs(logs || [])

        // Fetch quality scores for this operator
        const scores = await getCallQualityScores({ operator_id: user.id })
        setQualityScores(scores)

        // Fetch all operators for ranking
        const { data: operators, error: operatorsError } = await supabase
          .from('operators')
          .select('id, name')

        if (operatorsError) throw operatorsError
        setAllOperators(operators || [])
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('データの取得に失敗しました。')
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [user?.id, isDirector])

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // ===== Data calculations =====

  // 1. Today's performance (今日の成績)
  const today = new Date().toISOString().split('T')[0]
  const todayLogs = callLogs.filter(log => log.called_at.startsWith(today))
  const todayConnections = todayLogs.filter(log =>
    ['接続', 'アポ獲得', '資料送付'].includes(log.result)
  ).length
  const todayAppointments = todayLogs.filter(log => log.result === 'アポ獲得').length
  const todayRejections = todayLogs.filter(log => log.result === '断り').length
  const todayRejectionRate =
    todayLogs.length > 0 ? ((todayRejections / todayLogs.length) * 100).toFixed(1) : '0'

  // 2. Weekly trend (週間トレンド) - last 7 days
  const weeklyData = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayName = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
    const dayLogs = callLogs.filter(log => log.called_at.startsWith(dateStr))
    weeklyData.push({
      day: `${dateStr.split('-')[2]}(${dayName})`,
      calls: dayLogs.length,
    })
  }

  // 3. Monthly summary (月間サマリー)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthlyLogs = callLogs.filter(log => log.called_at.startsWith(currentMonth))
  const monthlyAppointments = monthlyLogs.filter(log => log.result === 'アポ獲得').length
  const monthlyTarget = 12 // assumed target
  const monthlyProgress = (monthlyAppointments / monthlyTarget) * 100

  // 4. Quality score trend (品質スコア推移)
  const qualityTrend = qualityScores
    .slice(-10)
    .sort((a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime())
    .map((score, idx) => ({
      idx: idx + 1,
      score: score.total_score,
      date: new Date(score.scored_at).toLocaleDateString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
      }),
    }))

  // 5. Appointment rate ranking (アポ率ランキング)
  const operatorStats = allOperators.map(op => {
    const opLogs = callLogs.filter(log => log.operator_id === op.id)
    const opAppointments = opLogs.filter(log => log.result === 'アポ獲得').length
    const appointmentRate = opLogs.length > 0 ? (opAppointments / opLogs.length) * 100 : 0
    return {
      id: op.id,
      name: op.name,
      appointmentRate: parseFloat(appointmentRate.toFixed(1)),
      totalCalls: opLogs.length,
    }
  })

  const sortedStats = [...operatorStats].sort((a, b) => b.appointmentRate - a.appointmentRate)
  const userRank = sortedStats.findIndex(op => op.id === user.id) + 1
  const userStats = operatorStats.find(op => op.id === user.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">成績ダッシュボード</h1>
              <p className="text-sm text-slate-500">{user.name}さんの個人成績</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Section 1: 今日の成績 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">今日の成績</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Phone className="h-5 w-5" />
                    <span className="text-sm text-slate-600">架電数</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{todayLogs.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm text-slate-600">接続数</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{todayConnections}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Target className="h-5 w-5" />
                    <span className="text-sm text-slate-600">アポ獲得</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{todayAppointments}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm text-slate-600">断り率</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{todayRejectionRate}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 2: 週間トレンド */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">週間トレンド</h2>
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="calls" fill="#3b82f6" name="架電数" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Section 3: 月間サマリー */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">月間サマリー</h2>
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">今月の実績</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">アポ獲得数</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {monthlyAppointments} / {monthlyTarget}件
                  </span>
                </div>
                <Progress
                  value={Math.min(monthlyProgress, 100)}
                  className="h-2"
                />
                <p className="text-sm text-slate-500 mt-2">
                  達成度: {Math.round(monthlyProgress)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">累計架電数</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {monthlyLogs.length}件
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: 品質スコア推移 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">品質スコア推移</h2>
          {qualityTrend.length > 0 ? (
            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={qualityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#8b5cf6"
                      name="品質スコア"
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center text-slate-500">
                品質スコアデータはまだありません
              </CardContent>
            </Card>
          )}
        </section>

        {/* Section 5: アポ率ランキング */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">アポ率ランキング</h2>
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                全オペレーターの成績
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedStats.slice(0, 10).map((stat, idx) => (
                  <div
                    key={stat.id}
                    className={`p-4 rounded-lg border ${
                      stat.id === user.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-lg w-10 h-10 flex items-center justify-center">
                          {idx + 1}
                        </Badge>
                        <div>
                          <p className={`font-semibold ${stat.id === user.id ? 'text-blue-900' : 'text-slate-900'}`}>
                            {stat.name}
                            {stat.id === user.id && ' (あなた)'}
                          </p>
                          <p className="text-xs text-slate-500">架電数: {stat.totalCalls}件</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">
                          {stat.appointmentRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
