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
  FolderKanban,
  Shield,
  Lightbulb,
  Monitor,
  CalendarCheck,
  Award,
  FileText,
  Send,
  Heart,
  MessageSquare,
  Workflow,
  Mic,
  ShieldAlert,
  BookOpen,
  Receipt,
  FlaskConical,
  CreditCard,
  Menu,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { getDashboardStats, type DashboardStats, getCallLogs, type CallLog } from '@/lib/supabase-api'
import { realtimeService } from '@/lib/realtime'
import { createClient } from '@/lib/supabase/client'

export default function DirectorDashboard() {
  const { user, signOut, isDirector, isLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [todayStats, setTodayStats] = useState<{ calls: number; appointments: number } | null>(null)
  const [dailyTarget] = useState(200) // ハードコーディングされた目標
  const [appointmentTarget] = useState(10) // ハードコーディングされた目標

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

          // 本日の進捗を取得
          const today = new Date().toISOString().split('T')[0]
          const { data: todayCallLogs, error } = await supabase
            .from('call_logs')
            .select('id, result')
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)

          if (!error && todayCallLogs) {
            const callsCount = todayCallLogs.length
            const appointmentsCount = todayCallLogs.filter((log) => log.result === 'アポ獲得').length
            setTodayStats({ calls: callsCount, appointments: appointmentsCount })
          }
        } catch (error) {
          console.error('Failed to fetch dashboard stats:', error)
        } finally {
          setStatsLoading(false)
        }
      }
    }
    fetchStats()
  }, [isLoading, isDirector, supabase])

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!isDirector) return

    const unsubAppointment = realtimeService.subscribeToAppointments((notification) => {
      console.log('New appointment notification:', notification)
      // Update stats optimistically
      if (stats) {
        setStats({
          ...stats,
          appointments: {
            ...stats.appointments,
            today: (stats.appointments.today || 0) + 1,
          },
        })
      }
    })

    const unsubCalls = realtimeService.subscribeToAllCalls((callLog) => {
      console.log('New call log:', callLog)
      // Update stats optimistically
      if (stats) {
        setStats({
          ...stats,
          calls: {
            ...stats.calls,
            today: (stats.calls.today || 0) + 1,
          },
        })
      }
    })

    return () => {
      unsubAppointment()
      unsubCalls()
    }
  }, [isDirector, stats])

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
    { title: 'プロジェクト管理', icon: <FolderKanban className="h-5 w-5" />, href: '/director/projects', badge: 'NEW' },
    { title: 'ゴールデンコール', icon: <Award className="h-5 w-5" />, href: '/director/golden-calls', badge: 'NEW' },
    { title: 'クライアント管理', icon: <Building2 className="h-5 w-5" />, href: '/director/clients' },
    { title: 'オペレーター管理', icon: <Users className="h-5 w-5" />, href: '/director/operators' },
    { title: '商材管理', icon: <Package className="h-5 w-5" />, href: '/director/products' },
    { title: 'アポイント管理', icon: <CalendarCheck className="h-5 w-5" />, href: '/director/appointments' },
    { title: 'セールスフロア', icon: <Monitor className="h-5 w-5" />, href: '/director/sales-floor', badge: 'NEW' },
    { title: 'メンバー管理', icon: <Users className="h-5 w-5" />, href: '/director/projects', badge: 'NEW' },
    { title: 'CSVアップロード', icon: <Upload className="h-5 w-5" />, href: '/director/upload' },
    { title: 'レポート', icon: <BarChart3 className="h-5 w-5" />, href: '/director/reports' },
    { title: 'スケジュール管理', icon: <Calendar className="h-5 w-5" />, href: '/director/schedule' },
    { title: 'AI分析・提案', icon: <Brain className="h-5 w-5" />, href: '/director/ai-suggestions' },
    { title: 'テンプレート管理', icon: <FileText className="h-5 w-5" />, href: '/director/nurturing/templates', badge: 'NEW' },
    { title: '送信履歴・トラッキング', icon: <Send className="h-5 w-5" />, href: '/director/nurturing/sends', badge: 'NEW' },
    { title: 'エンゲージメント', icon: <Heart className="h-5 w-5" />, href: '/director/nurturing/engagement', badge: 'NEW' },
    { title: 'マルチチャネル', icon: <MessageSquare className="h-5 w-5" />, href: '/director/nurturing/channels', badge: 'NEW' },
    { title: 'フォローアップルール', icon: <Workflow className="h-5 w-5" />, href: '/director/nurturing/followup-rules', badge: 'NEW' },
    { title: 'インキュベーション', icon: <Lightbulb className="h-5 w-5" />, href: '/director/incubation', badge: 'NEW' },
    { title: 'コンプライアンス', icon: <Shield className="h-5 w-5" />, href: '/director/compliance', badge: 'NEW' },
    { title: 'AI品質コマンダー', icon: <Mic className="h-5 w-5" />, href: '/director/quality-commander', badge: 'NEW' },
    { title: '不正検知', icon: <ShieldAlert className="h-5 w-5" />, href: '/director/fraud-detection', badge: 'NEW' },
    { title: 'ナレッジDNA', icon: <BookOpen className="h-5 w-5" />, href: '/director/knowledge-dna', badge: 'NEW' },
    { title: 'サポートチャット', icon: <Headphones className="h-5 w-5" />, href: '/director/support-chat', badge: 'NEW' },
    { title: 'インボイス管理', icon: <Receipt className="h-5 w-5" />, href: '/director/invoices', badge: 'NEW' },
    { title: 'トライアル管理', icon: <FlaskConical className="h-5 w-5" />, href: '/director/trial-management', badge: 'NEW' },
    { title: 'プラン管理', icon: <CreditCard className="h-5 w-5" />, href: '/director/plans', badge: 'NEW' },
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
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent hidden sm:block">
              TOGUNA
            </h1>
            <Badge className="bg-purple-500 text-white px-3 py-1 text-xs sm:text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Desktop items */}
            <div className="hidden md:flex items-center gap-4">
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

            {/* Mobile menu items (simplified) */}
            {mobileMenuOpen && (
              <div className="md:hidden absolute top-16 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-full shadow-lg">
                <div className="p-4 space-y-3 flex flex-col">
                  <Link href="/">
                    <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
                      <Headphones className="h-4 w-4" />
                      オペレーター画面
                    </Button>
                  </Link>
                  <div className="flex items-center justify-between py-2 px-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-medium">{user?.name || 'ディレクター'}</span>
                    <Button variant="ghost" size="icon" onClick={handleSignOut}>
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-8">
        {/* Today's Progress Section */}
        {!statsLoading && todayStats !== null && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              本日の進捗
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calls Progress */}
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">本日の架電数</p>
                      <p className="text-3xl font-bold text-blue-600">{todayStats.calls}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">目標: {dailyTarget}件</p>
                      <p className={`text-sm font-bold ${
                        todayStats.calls >= dailyTarget
                          ? 'text-green-600'
                          : todayStats.calls >= dailyTarget * 0.7
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {todayStats.calls >= dailyTarget
                          ? '達成済み'
                          : `残り ${Math.max(0, dailyTarget - todayStats.calls)}件`}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">進捗</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {Math.min(100, Math.round((todayStats.calls / dailyTarget) * 100))}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          todayStats.calls >= dailyTarget
                            ? 'bg-green-500'
                            : todayStats.calls >= dailyTarget * 0.7
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, (todayStats.calls / dailyTarget) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Appointments Progress */}
              <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">本日のアポイント</p>
                      <p className="text-3xl font-bold text-green-600">{todayStats.appointments}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">目標: {appointmentTarget}件</p>
                      <p className={`text-sm font-bold ${
                        todayStats.appointments >= appointmentTarget
                          ? 'text-green-600'
                          : todayStats.appointments >= appointmentTarget * 0.7
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {todayStats.appointments >= appointmentTarget
                          ? '達成済み'
                          : `残り ${Math.max(0, appointmentTarget - todayStats.appointments)}件`}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">進捗</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {Math.min(100, Math.round((todayStats.appointments / appointmentTarget) * 100))}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          todayStats.appointments >= appointmentTarget
                            ? 'bg-green-500'
                            : todayStats.appointments >= appointmentTarget * 0.7
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, (todayStats.appointments / appointmentTarget) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

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
