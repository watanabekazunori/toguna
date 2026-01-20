"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getOperatorHomeData, type OperatorHomeData } from "@/lib/supabase-api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
} from "lucide-react"
import Link from "next/link"

type Period = "昨日" | "今日" | "今週"

type ScheduleSlot = {
  time: string
  project: string
  projectColor: string
  clientId: string
  remaining: {
    s: number
    a: number
    b: number
  }
  isActive: boolean
}

export default function OperatorHome() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("今日")
  const [homeData, setHomeData] = useState<OperatorHomeData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const { user, signOut, isLoading, isDirector } = useAuth()
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      setIsLoadingData(true)
      setDataError(null)
      try {
        const data = await getOperatorHomeData()
        setHomeData(data)
      } catch (error) {
        console.error('Failed to fetch home data:', error)
        setDataError('データの取得に失敗しました')
      } finally {
        setIsLoadingData(false)
      }
    }
    // 認証が完了してからデータを取得
    if (!isLoading) {
      fetchData()
    }
  }, [isLoading])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleStartCalling = (clientId: string) => {
    router.push(`/call-list?client_id=${clientId}`)
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

  const clients = homeData?.clients || []
  const totalCalls = homeData?.totalCalls || 0
  const totalTarget = homeData?.totalTarget || 0
  const totalAppointments = homeData?.totalAppointments || 0
  const weeklyAppointmentTarget = homeData?.weeklyAppointmentTarget || 3
  const remainingCompanies = homeData?.remainingCompanies || { S: 0, A: 0, B: 0 }

  // スケジュールスロットをクライアントデータから動的に生成
  const scheduleSlots: ScheduleSlot[] = clients.slice(0, 3).map((client, index) => {
    const times = ["9:00-10:00", "10:00-11:00", "11:00-12:00"]
    return {
      time: times[index] || `${9 + index}:00-${10 + index}:00`,
      project: client.name,
      projectColor: client.bgColor,
      clientId: client.id,
      remaining: {
        s: remainingCompanies.S,
        a: remainingCompanies.A,
        b: remainingCompanies.B,
      },
      isActive: index === 0,
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              TOGUNA
            </h1>
            {clients.length > 0 && (
              <Badge className="bg-blue-500 text-white px-4 py-1 text-sm font-medium">{clients[0].name}</Badge>
            )}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-4">
            {/* ディレクター画面への切り替えボタン（ディレクターのみ表示） */}
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
        {/* Section 1: Performance Summary */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">実績サマリー</h2>
            <div className="flex gap-2">
              {(["昨日", "今日", "今週"] as Period[]).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className={
                    selectedPeriod === period
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                      : ""
                  }
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Client Cards */}
            {clients.length === 0 ? (
              <Card className="p-6 col-span-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-2 border-dashed">
                <div className="text-center py-8">
                  <div className="text-slate-400 mb-4">
                    <Target className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    クライアントが登録されていません
                  </h3>
                  <p className="text-sm text-slate-500">
                    ディレクター画面からクライアントを登録してください。
                  </p>
                </div>
              </Card>
            ) : (
              clients.map((client) => {
                const progress = (client.callsCompleted / client.callsTarget) * 100
                const connectionRate =
                  client.callsCompleted > 0 ? Math.round((client.connections / client.callsCompleted) * 100) : 0

                return (
                  <Card
                    key={client.id}
                    className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                  >
                    <div className="space-y-4">
                      {/* Client Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${client.bgColor}`}></div>
                          <h3 className={`text-lg font-bold ${client.color}`}>{client.name}</h3>
                        </div>
                        <Badge
                          variant={
                            client.statusType === "success"
                              ? "default"
                              : client.statusType === "warning"
                                ? "destructive"
                                : "secondary"
                          }
                          className="font-medium"
                        >
                          {client.statusType === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {client.statusType === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {client.statusType === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {client.status}
                        </Badge>
                      </div>

                      {/* Calls Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">架電</span>
                          <span className="text-lg font-bold">
                            {client.callsCompleted}/{client.callsTarget}{" "}
                            <span className="text-sm text-slate-500">({Math.round(progress)}%)</span>
                          </span>
                        </div>
                        <Progress
                          value={progress}
                          className="h-3 bg-slate-200 dark:bg-slate-800"
                          indicatorClassName={`${client.bgColor} transition-all duration-500`}
                        />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <div className="text-sm text-slate-600 dark:text-slate-400">接続</div>
                          <div className="text-2xl font-bold">
                            {client.connections}
                            <span className="text-sm text-slate-500 ml-1">件</span>
                          </div>
                          {connectionRate > 0 && <div className="text-xs text-slate-500">({connectionRate}%)</div>}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-600 dark:text-slate-400">アポ</div>
                          <div className="text-2xl font-bold flex items-center gap-1">
                            {client.appointments}
                            <span className="text-sm text-slate-500">件</span>
                            {client.appointments > 0 && <Sparkles className="h-4 w-4 text-yellow-500" />}
                          </div>
                        </div>
                      </div>

                      {/* Start Calling Button */}
                      <Button
                        onClick={() => handleStartCalling(client.id)}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl"
                      >
                        <Rocket className="h-4 w-4 mr-2" />
                        架電開始
                      </Button>
                    </div>
                  </Card>
                )
              })
            )}

            {/* Total Summary Card */}
            <Card className="p-6 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/30 border-0">
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  合計サマリー
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      <span>合計架電</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {totalCalls}/{totalTarget}件
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      <span>合計アポ</span>
                    </div>
                    <span className="text-2xl font-bold">{totalAppointments}/{weeklyAppointmentTarget}件</span>
                  </div>
                  <div className="pt-2">
                    <Progress
                      value={totalTarget > 0 ? (totalCalls / totalTarget) * 100 : 0}
                      className="h-2 bg-blue-400"
                      indicatorClassName="bg-white"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Section 2 & 3: AI Coaching and Schedule */}
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
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    昨日のNG率が<span className="font-bold text-amber-600">60%</span>
                    と高めです。（先週比+10%）
                    <br />
                    主な理由: <span className="font-semibold">受付突破失敗 48%</span>
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">📌 おすすめ対策:</p>
                    <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>
                          S判定企業を優先架電（
                          <span className="font-semibold text-green-600">成功率75%</span>）
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>受付突破スクリプトを見直す</span>
                      </li>
                    </ul>
                    <Button variant="link" className="h-auto p-0 text-blue-600 dark:text-blue-400">
                      改善案を見る →
                    </Button>
                  </div>
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
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    WHEREで<span className="font-bold text-orange-600">アポ1件</span>
                    取れば週間目標達成！
                    <Flame className="inline h-4 w-4 text-orange-500 ml-1" />
                    <br />
                    <span className="font-semibold">S判定の残り35社</span>に集中しましょう。
                  </p>
                </div>
              </div>

              {/* Yesterday's Win */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Trophy className="h-5 w-5" />
                  <h4 className="font-bold">昨日の良かった点</h4>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500 p-4 rounded-r-lg">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    接続率<span className="font-bold text-green-600">30%</span>達成！
                    <br />
                    （平均25%を上回りました）
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
                        ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-50 dark:bg-blue-950/30"
                        : "border hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${slot.isActive ? "bg-green-500 animate-pulse" : "bg-slate-300"}`}
                          ></div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{slot.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${slot.projectColor}`}></div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{slot.project}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        残リスト:{" "}
                        <span className="font-semibold">
                          S{slot.remaining.s} / A{slot.remaining.a} / B{slot.remaining.b}
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
                            onClick={() => handleStartCalling(slot.clientId)}
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
      </main>

      {/* Notifications */}
      <div className="fixed bottom-6 right-6 space-y-3 max-w-md z-50">
        <Card className="p-4 shadow-2xl border-l-4 border-green-500 bg-white dark:bg-slate-900 animate-slide-in-from-right">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300">山田開発のログ記録完了</p>
              <Button variant="link" className="h-auto p-0 text-xs text-blue-600">
                確認
              </Button>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-2xl border-l-4 border-amber-500 bg-white dark:bg-slate-900 animate-slide-in-from-right">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300">WHEREペース遅れ</p>
              <Button variant="link" className="h-auto p-0 text-xs text-blue-600">
                対策を見る
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
