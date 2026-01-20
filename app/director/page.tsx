'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  Users,
  Building2,
  TrendingUp,
  Settings,
  LogOut,
  Upload,
  BarChart3,
  Calendar,
  Brain,
  ChevronRight,
  Target,
  CheckCircle2,
  Clock,
  Package,
} from 'lucide-react'
import Link from 'next/link'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { DailyCallsChart, HourlyChart, type DailyCallData, type HourlyData } from '@/components/charts'

type StatCard = {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
  href?: string
}

// デモ用データ生成
const generateDailyData = (): DailyCallData[] => {
  const data: DailyCallData[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const calls = Math.floor(Math.random() * 80) + 100
    const connections = Math.floor(calls * (0.3 + Math.random() * 0.2))
    const appointments = Math.floor(connections * (0.05 + Math.random() * 0.1))
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      calls,
      connections,
      appointments,
    })
  }
  return data
}

const generateHourlyData = (): HourlyData[] => {
  const hours = ['9時', '10時', '11時', '12時', '13時', '14時', '15時', '16時', '17時']
  return hours.map((hour) => {
    const calls = Math.floor(Math.random() * 20) + 10
    const connections = Math.floor(calls * (0.2 + Math.random() * 0.3))
    return { hour, calls, connections }
  })
}

export default function DirectorDashboard() {
  const { user, signOut, isDirector, isLoading } = useAuth()
  const router = useRouter()
  const [dailyData] = useState<DailyCallData[]>(generateDailyData)
  const [hourlyData] = useState<HourlyData[]>(generateHourlyData)

  useEffect(() => {
    if (!isLoading && !isDirector) {
      router.push('/')
    }
  }, [isLoading, isDirector, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isDirector) {
    return null
  }

  const stats: StatCard[] = [
    {
      title: '本日の架電数',
      value: 156,
      change: '+12%',
      changeType: 'positive',
      icon: <Phone className="h-5 w-5" />,
    },
    {
      title: 'アポイント獲得',
      value: 8,
      change: '+3',
      changeType: 'positive',
      icon: <Target className="h-5 w-5" />,
    },
    {
      title: 'アクティブオペレーター',
      value: 4,
      icon: <Users className="h-5 w-5" />,
      href: '/director/operators',
    },
    {
      title: '登録企業数',
      value: 1250,
      change: '+45',
      changeType: 'positive',
      icon: <Building2 className="h-5 w-5" />,
    },
  ]

  const menuItems = [
    { title: 'クライアント管理', icon: <Building2 className="h-5 w-5" />, href: '/director/clients' },
    { title: 'オペレーター管理', icon: <Users className="h-5 w-5" />, href: '/director/operators' },
    { title: '商材管理', icon: <Package className="h-5 w-5" />, href: '/director/products', badge: 'NEW' },
    { title: 'CSVアップロード', icon: <Upload className="h-5 w-5" />, href: '/director/upload' },
    { title: 'レポート', icon: <BarChart3 className="h-5 w-5" />, href: '/director/reports' },
    { title: 'スケジュール管理', icon: <Calendar className="h-5 w-5" />, href: '/director/schedule' },
    { title: 'AI分析・提案', icon: <Brain className="h-5 w-5" />, href: '/director/ai-suggestions' },
    { title: '設定', icon: <Settings className="h-5 w-5" />, href: '/director/settings' },
  ]

  const recentActivities = [
    { type: 'call', message: '田中さんがWHEREでアポ獲得', time: '5分前', status: 'success' },
    { type: 'upload', message: '新規リスト200件をアップロード', time: '30分前', status: 'info' },
    { type: 'alert', message: 'ABCプロジェクトのペース遅れ', time: '1時間前', status: 'warning' },
    { type: 'call', message: '鈴木さんが本日の目標達成', time: '2時間前', status: 'success' },
  ]

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              TOGUNA
            </h1>
            <Badge className="bg-purple-500 text-white px-4 py-1 text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name || 'ディレクター'}</span>
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

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-8">
        {/* Stats Grid */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            本日のサマリー
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {stat.value}
                    </p>
                    {stat.change && (
                      <p
                        className={`text-sm font-medium ${
                          stat.changeType === 'positive'
                            ? 'text-green-600'
                            : stat.changeType === 'negative'
                            ? 'text-red-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {stat.change} 前日比
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    {stat.icon}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Charts Section */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            週間パフォーマンス
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">
                日別架電実績
              </h3>
              <DailyCallsChart data={dailyData} height={280} />
            </Card>
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">
                本日の時間帯別
              </h3>
              <HourlyChart data={hourlyData} height={280} />
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <section className="lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              管理メニュー
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menuItems.map((item, index) => (
                <Link key={index} href={item.href}>
                  <Card className="p-4 hover:shadow-lg transition-all duration-300 border hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer group bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.icon}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activities */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              最近のアクティビティ
            </h2>
            <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0"
                  >
                    <div
                      className={`p-2 rounded-full ${
                        activity.status === 'success'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                          : activity.status === 'warning'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                      }`}
                    >
                      {activity.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : activity.status === 'warning' ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {activity.message}
                      </p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
