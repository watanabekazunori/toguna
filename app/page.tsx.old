"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
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
} from "lucide-react"

type Period = "昨日" | "今日" | "今週"

type Project = {
  id: string
  name: string
  color: string
  bgColor: string
  callsTarget: number
  callsCompleted: number
  connections: number
  appointments: number
  status: string
  statusType: "success" | "warning" | "pending"
}

type ScheduleSlot = {
  time: string
  project: string
  projectColor: string
  remaining: {
    s: number
    a: number
    b: number
  }
  isActive: boolean
}

export default function OperatorHome() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("今日")
  const { user, signOut, isLoading } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const projects: Project[] = [
    {
      id: "where",
      name: "WHERE",
      color: "text-blue-600",
      bgColor: "bg-blue-500",
      callsTarget: 60,
      callsCompleted: 30,
      connections: 10,
      appointments: 2,
      status: "順調",
      statusType: "success",
    },
    {
      id: "abc",
      name: "ABC",
      color: "text-green-600",
      bgColor: "bg-green-500",
      callsTarget: 60,
      callsCompleted: 0,
      connections: 0,
      appointments: 0,
      status: "午後開始",
      statusType: "pending",
    },
  ]

  const scheduleSlots: ScheduleSlot[] = [
    {
      time: "9:00-10:00",
      project: "WHERE",
      projectColor: "bg-blue-500",
      remaining: { s: 40, a: 250, b: 2110 },
      isActive: true,
    },
    {
      time: "10:00-11:00",
      project: "ABC",
      projectColor: "bg-green-500",
      remaining: { s: 30, a: 180, b: 1590 },
      isActive: false,
    },
    {
      time: "11:00-12:00",
      project: "GHI",
      projectColor: "bg-purple-500",
      remaining: { s: 25, a: 200, b: 1800 },
      isActive: false,
    },
  ]

  const totalCalls = projects.reduce((sum, p) => sum + p.callsCompleted, 0)
  const totalTarget = projects.reduce((sum, p) => sum + p.callsTarget, 0)
  const totalAppointments = projects.reduce((sum, p) => sum + p.appointments, 0)

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
            <Badge className="bg-blue-500 text-white px-4 py-1 text-sm font-medium">WHERE</Badge>
          </div>

          {/* User Actions */}
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
            {/* Project Cards */}
            {projects.map((project) => {
              const progress = (project.callsCompleted / project.callsTarget) * 100
              const connectionRate =
                project.callsCompleted > 0 ? Math.round((project.connections / project.callsCompleted) * 100) : 0

              return (
                <Card
                  key={project.id}
                  className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                >
                  <div className="space-y-4">
                    {/* Project Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${project.bgColor}`}></div>
                        <h3 className={`text-lg font-bold ${project.color}`}>{project.name}</h3>
                      </div>
                      <Badge
                        variant={
                          project.statusType === "success"
                            ? "default"
                            : project.statusType === "warning"
                              ? "destructive"
                              : "secondary"
                        }
                        className="font-medium"
                      >
                        {project.statusType === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {project.statusType === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {project.statusType === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {project.status}
                      </Badge>
                    </div>

                    {/* Calls Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">架電</span>
                        <span className="text-lg font-bold">
                          {project.callsCompleted}/{project.callsTarget}{" "}
                          <span className="text-sm text-slate-500">({Math.round(progress)}%)</span>
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        className="h-3 bg-slate-200 dark:bg-slate-800"
                        indicatorClassName={`${project.bgColor} transition-all duration-500`}
                      />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-600 dark:text-slate-400">接続</div>
                        <div className="text-2xl font-bold">
                          {project.connections}
                          <span className="text-sm text-slate-500 ml-1">件</span>
                        </div>
                        {connectionRate > 0 && <div className="text-xs text-slate-500">({connectionRate}%)</div>}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-slate-600 dark:text-slate-400">アポ</div>
                        <div className="text-2xl font-bold flex items-center gap-1">
                          {project.appointments}
                          <span className="text-sm text-slate-500">件</span>
                          {project.appointments > 0 && <Sparkles className="h-4 w-4 text-yellow-500" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}

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
                    <span className="text-2xl font-bold">{totalAppointments}/3件</span>
                  </div>
                  <div className="pt-2">
                    <Progress
                      value={(totalCalls / totalTarget) * 100}
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
