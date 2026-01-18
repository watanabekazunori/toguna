'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getOperators, getClients, type Operator, type Client } from '@/lib/api'
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
} from 'lucide-react'

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
  const [operators, setOperators] = useState<Operator[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  // デモ用スケジュールデータ
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.push('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [operatorsData, clientsData] = await Promise.all([
          getOperators(),
          getClients(),
        ])
        setOperators(operatorsData)
        setClients(clientsData)

        // デモ用スケジュール生成
        const demoSchedules: ScheduleSlot[] = []
        operatorsData.forEach((op, opIndex) => {
          clientsData.forEach((client, clientIndex) => {
            if ((opIndex + clientIndex) % 3 === 0) {
              demoSchedules.push({
                id: `${op.id}-${client.id}-am`,
                operatorId: op.id,
                operatorName: op.name,
                clientId: client.id,
                clientName: client.name,
                clientColor: clientColors[clientIndex % clientColors.length],
                startTime: '09:00',
                endTime: '12:00',
                target: 30,
              })
            }
            if ((opIndex + clientIndex) % 2 === 0) {
              demoSchedules.push({
                id: `${op.id}-${client.id}-pm`,
                operatorId: op.id,
                operatorName: op.name,
                clientId: client.id,
                clientName: client.name,
                clientColor: clientColors[clientIndex % clientColors.length],
                startTime: '13:00',
                endTime: '18:00',
                target: 50,
              })
            }
          })
        })
        setSchedules(demoSchedules)
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

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
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

          <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <Plus className="h-4 w-4 mr-2" />
            スケジュール追加
          </Button>
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
