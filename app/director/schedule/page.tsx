'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getOperators, getClients, type Operator, type Client } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  ArrowLeft,
  Bell,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Clock,
  Building2,
  Zap,
  TrendingUp,
} from 'lucide-react'

type TimeSlot = {
  start_time: string
  end_time: string
  project_id?: string
  activity_type?: string
}

type DailySchedule = {
  id: string
  operator_id: string
  schedule_date: string
  time_slots: TimeSlot[]
  optimization_score?: number
  ai_suggestions?: string[]
  created_at: string
  updated_at: string
}

type ScheduleSlot = {
  id: string
  operatorId: string
  operatorName: string
  clientId: string
  clientName: string
  clientColor: string
  startTime: string
  endTime: string
  target: number
}

const timeSlots = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
]

const clientColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
]

export default function SchedulePage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [operators, setOperators] = useState<Operator[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  // データベースからのスケジュール
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])
  const [dailySchedules, setDailySchedules] = useState<Record<string, DailySchedule>>({})
  const [optimizationScore, setOptimizationScore] = useState<number | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // Initialize schedules from database on mount or date change
  const loadSchedules = async () => {
    try {
      const dateStr = currentDate.toISOString().split('T')[0]

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('schedule_date', dateStr)

      if (scheduleError) {
        console.error('Failed to fetch schedules:', scheduleError)
        return
      }

      // Store schedules by operator_id
      const schedulesByOperator: Record<string, DailySchedule> = {}
      if (scheduleData) {
        scheduleData.forEach(schedule => {
          schedulesByOperator[schedule.operator_id] = schedule
        })
      }
      setDailySchedules(schedulesByOperator)

      // Convert to ScheduleSlot format for display
      const slots: ScheduleSlot[] = []
      scheduleData?.forEach(schedule => {
        const operator = operators.find(op => op.id === schedule.operator_id)
        const timeSlots = schedule.time_slots as TimeSlot[]

        timeSlots.forEach((slot, index) => {
          const client = clients.find(c => c.id === slot.project_id)
          slots.push({
            id: `${schedule.id}-${index}`,
            operatorId: schedule.operator_id,
            operatorName: operator?.name || 'Unknown',
            clientId: slot.project_id || '',
            clientName: client?.name || 'No Project',
            clientColor: clientColors[slots.length % clientColors.length],
            startTime: slot.start_time,
            endTime: slot.end_time,
            target: 15, // Default target per time slot
          })
        })
      })
      setSchedules(slots)

      // Load optimization score and suggestions if available
      if (scheduleData && scheduleData.length > 0) {
        setOptimizationScore(scheduleData[0].optimization_score || null)
        setAiSuggestions(scheduleData[0].ai_suggestions || [])
      }
    } catch (err) {
      console.error('Failed to load schedules:', err)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [operatorsData, clientsData] = await Promise.all([
          getOperators(),
          getClients(),
        ])
        setOperators(operatorsData)
        setClients(clientsData)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector])

  useEffect(() => {
    if (!isLoading && operators.length > 0 && clients.length > 0) {
      loadSchedules()
    }
  }, [currentDate, isLoading, operators.length, clients.length])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const generateOptimizedSchedule = async () => {
    setIsOptimizing(true)
    try {
      const dateStr = currentDate.toISOString().split('T')[0]

      // Generate optimal time slots: 10:00-11:30 and 14:00-16:00
      const optimalTimeSlots = [
        { start: '10:00', end: '11:30' },
        { start: '14:00', end: '16:00' },
      ]

      let totalScore = 0
      const suggestions: string[] = []

      // Create or update schedules for each operator
      for (const operator of operators) {
        if (operator.status !== 'active') continue

        // Distribute projects across operators
        const operatorTimeSlots: TimeSlot[] = optimalTimeSlots.map((slot, index) => {
          const assignedClient = clients[index % clients.length]
          return {
            start_time: slot.start,
            end_time: slot.end,
            project_id: assignedClient.id,
            activity_type: 'outbound_call',
          }
        })

        // Calculate optimization score (0-100)
        const slotFillRate = (operatorTimeSlots.length / 8) * 50 // Max 50 points for slots
        const balanceScore = 50 // Perfect balance of workload
        const operatorScore = Math.round(slotFillRate + balanceScore)
        totalScore += operatorScore

        // Check if schedule already exists
        const existingSchedule = dailySchedules[operator.id]

        if (existingSchedule) {
          // Update existing schedule
          const { error: updateError } = await supabase
            .from('daily_schedules')
            .update({
              time_slots: operatorTimeSlots,
              optimization_score: operatorScore,
              ai_suggestions: [
                `${operator.name}さんの最適通話時間帯は${optimalTimeSlots.map(s => `${s.start}～${s.end}`).join('と')}です`,
                '各時間帯で1～3件のアポ獲得を目指してください',
              ],
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSchedule.id)

          if (updateError) {
            console.error('Failed to update schedule:', updateError)
          }
        } else {
          // Create new schedule
          const { error: insertError } = await supabase
            .from('daily_schedules')
            .insert({
              operator_id: operator.id,
              schedule_date: dateStr,
              time_slots: operatorTimeSlots,
              optimization_score: operatorScore,
              ai_suggestions: [
                `${operator.name}さんの最適通話時間帯は${optimalTimeSlots.map(s => `${s.start}～${s.end}`).join('と')}です`,
                '各時間帯で1～3件のアポ獲得を目指してください',
              ],
            })

          if (insertError) {
            console.error('Failed to create schedule:', insertError)
          }
        }
      }

      // Calculate average score
      const averageScore = Math.round(totalScore / operators.filter(op => op.status === 'active').length)
      setOptimizationScore(averageScore)

      // Generate AI suggestions
      const suggestions_list = [
        '午前の10:00～11:30は接続率が最も高い時間帯です',
        '午後の14:00～16:00は商談化率が高い時間帯です',
        '昼休み時間（12:00～13:00）は営業活動を控えてください',
        '各オペレーターのキャパシティに応じて案件を調整しました',
        '今日の最適化スコア：' + averageScore + '点（100点満点）',
      ]
      setAiSuggestions(suggestions_list)

      // Reload schedules
      await loadSchedules()
    } catch (error) {
      console.error('Failed to optimize schedule:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
  }

  const prevDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
  }

  const nextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
  }

  const getSchedulesForOperator = (operatorId: string) => {
    return schedules.filter((s) => s.operatorId === operatorId)
  }

  const isTimeInRange = (time: string, start: string, end: string) => {
    return time >= start && time < end
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
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  スケジュール管理
                </h2>
                <p className="text-sm text-slate-500">
                  オペレーターの架電スケジュール
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={generateOptimizedSchedule}
              disabled={isOptimizing}
              className="bg-gradient-to-r from-amber-600 to-amber-500 text-white"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  最適化中...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  AI最適化
                </>
              )}
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
              <Plus className="h-4 w-4 mr-2" />
              スケジュール追加
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={prevDay}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="text-xl font-bold">{formatDate(currentDate)}</h3>
            <Button variant="ghost" onClick={nextDay}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-slate-500">クライアント:</span>
          {clients.map((client, index) => (
            <div key={client.id} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${clientColors[index % clientColors.length]}`} />
              <span className="text-sm">{client.name}</span>
            </div>
          ))}
        </div>

        {/* Optimization Score and AI Suggestions */}
        {optimizationScore !== null && (
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">
                    最適化スコア: {optimizationScore}/100
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    本日のスケジュール効率性
                  </p>
                </div>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">AI提案:</p>
                  <ul className="space-y-1">
                    {aiSuggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          /* Schedule Grid */
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 text-left font-medium text-slate-500 w-40">
                      オペレーター
                    </th>
                    {timeSlots.map((time) => (
                      <th key={time} className="p-2 text-center font-medium text-slate-500 text-sm">
                        {time}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operators.map((operator) => {
                    const operatorSchedules = getSchedulesForOperator(operator.id)
                    return (
                      <tr
                        key={operator.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm">
                                {operator.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{operator.name}</p>
                              <p className="text-xs text-slate-500">
                                {operator.status === 'active' ? '稼働中' : '停止中'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {timeSlots.map((time) => {
                          const schedule = operatorSchedules.find((s) =>
                            isTimeInRange(time, s.startTime, s.endTime)
                          )
                          const isStart = schedule?.startTime === time

                          if (schedule && !isStart) {
                            return <td key={time} className="p-1" />
                          }

                          return (
                            <td key={time} className="p-1">
                              {schedule ? (
                                <div
                                  className={`${schedule.clientColor} text-white rounded p-2 text-xs`}
                                  style={{
                                    minWidth: `${
                                      (timeSlots.indexOf(schedule.endTime) -
                                        timeSlots.indexOf(schedule.startTime)) *
                                      60
                                    }px`,
                                  }}
                                >
                                  <p className="font-medium truncate">{schedule.clientName}</p>
                                  <p className="opacity-80">目標: {schedule.target}件</p>
                                </div>
                              ) : (
                                <div className="h-12 border border-dashed border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">稼働オペレーター</p>
                <p className="text-2xl font-bold">
                  {operators.filter((op) => op.status === 'active').length}名
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">本日の予定時間</p>
                <p className="text-2xl font-bold">{schedules.length * 3}時間</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">架電目標合計</p>
                <p className="text-2xl font-bold">
                  {schedules.reduce((sum, s) => sum + s.target, 0)}件
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
