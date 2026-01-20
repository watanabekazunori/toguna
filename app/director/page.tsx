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
  Settings,
  LogOut,
  Upload,
  BarChart3,
  Calendar,
  Brain,
  ChevronRight,
  Target,
  Package,
  Headphones,
} from 'lucide-react'
import Link from 'next/link'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { getDashboardStats, type DashboardStats } from '@/lib/supabase-api'

export default function DirectorDashboard() {
  const { user, signOut, isDirector, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isDirector) {
      router.replace('/')
    }
  }, [isLoading, isDirector, router])

  useEffect(() => {
    const fetchStats = async () => {
      if (!isLoading && isDirector) {
        try {
          const data = await getDashboardStats()
          setStats(data)
        } catch (error) {
          console.error('Failed to fetch dashboard stats:', error)
        } finally {
          setStatsLoading(false)
        }
      }
    }
    fetchStats()
  }, [isLoading, isDirector])

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

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
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
            {/* オペレーター画面への切り替えボタン */}
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2">
                <Headphones className="h-4 w-4" />
                オペレーター画面
              </Button>
            </Link>
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
            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">本日の架電数</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {statsLoading ? '-' : stats?.calls.today || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Phone className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">アポイント獲得</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {statsLoading ? '-' : stats?.appointments.today || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">オペレーター数</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {statsLoading ? '-' : stats?.operators.total || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">登録企業数</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {statsLoading ? '-' : stats?.companies.total || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Menu Section */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            管理メニュー
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </main>
    </div>
  )
}
