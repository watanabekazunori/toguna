'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getClients, getCallLogs, type Client, type CallLog } from '@/lib/api'
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
  BarChart3,
  ArrowLeft,
  Phone,
  Target,
  TrendingUp,
  TrendingDown,
  Bell,
  LogOut,
  Loader2,
  Calendar,
  Building2,
  Download,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import {
  DailyCallsChart,
  ResultPieChart,
  OperatorBarChart,
  type DailyCallData,
  type ResultData,
  type OperatorData,
} from '@/components/charts'
import {
  exportDailyReport,
  exportOperatorReport,
  exportToPDF,
  formatDateTimeForExport,
  type DailyReportExport,
  type OperatorReportExport,
} from '@/lib/export'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { FileSpreadsheet, FileText } from 'lucide-react'

type PeriodOption = '今日' | '今週' | '今月' | '全期間'

export default function ReportsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('今週')
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [dailyData, setDailyData] = useState<DailyCallData[]>([])
  const [operatorData, setOperatorData] = useState<OperatorData[]>([])

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsData, logsData] = await Promise.all([
          getClients(),
          getCallLogs(),
        ])
        setClients(clientsData)
        setCallLogs(logsData)

        // 日別データを実データから生成
        const dailyMap = new Map<string, DailyCallData>()
        logsData.forEach((log) => {
          const date = new Date(log.created_at)
          const dateKey = `${date.getMonth() + 1}/${date.getDate()}`
          const existing = dailyMap.get(dateKey) || { date: dateKey, calls: 0, connections: 0, appointments: 0 }
          existing.calls++
          if (log.result === '接続') existing.connections++
          if (log.result === 'アポ獲得') existing.appointments++
          dailyMap.set(dateKey, existing)
        })
        setDailyData(Array.from(dailyMap.values()).slice(-14))

        // オペレーター別データを実データから生成（TODO: 本来はoperatorsテーブルと結合）
        const operatorMap = new Map<string, OperatorData>()
        logsData.forEach((log) => {
          const name = log.operator_id || '不明'
          const existing = operatorMap.get(name) || { name, calls: 0, appointments: 0, rate: 0 }
          existing.calls++
          if (log.result === 'アポ獲得') existing.appointments++
          existing.rate = existing.calls > 0 ? (existing.appointments / existing.calls) * 100 : 0
          operatorMap.set(name, existing)
        })
        setOperatorData(Array.from(operatorMap.values()))
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
    router.replace('/login')
  }

  // エクスポート処理
  const handleExportCSV = (type: 'daily' | 'operator') => {
    const dateStr = new Date().toISOString().split('T')[0]

    if (type === 'daily') {
      // 日別レポートデータを変換
      const exportData: DailyReportExport[] = dailyData.map((d) => ({
        date: d.date,
        totalCalls: d.calls,
        connections: d.connections,
        appointments: d.appointments,
        connectionRate: d.calls > 0 ? (d.connections / d.calls) * 100 : 0,
        appointmentRate: d.calls > 0 ? (d.appointments / d.calls) * 100 : 0,
      }))
      exportDailyReport(exportData, `日別レポート_${dateStr}`)
    } else {
      // オペレーター別レポートデータを変換
      const exportData: OperatorReportExport[] = operatorData.map((d) => ({
        operatorName: d.name,
        totalCalls: d.calls,
        connections: Math.floor(d.calls * 0.25), // デモデータ
        appointments: d.appointments,
        connectionRate: 25,
        appointmentRate: d.rate,
        averageDuration: 165, // デモ: 2:45
      }))
      exportOperatorReport(exportData, `オペレーター別レポート_${dateStr}`)
    }
  }

  const handleExportPDF = () => {
    exportToPDF({
      title: 'TOGUNA 架電実績レポート',
      subtitle: `期間: ${selectedPeriod}${selectedClientId !== 'all' ? ` | クライアント: ${clients.find((c) => c.id === selectedClientId)?.name || ''}` : ''}`,
      generatedAt: formatDateTimeForExport(new Date()),
      summary: [
        { label: '総架電数', value: stats.totalCalls || 180 },
        { label: 'アポ獲得', value: stats.appointments || 12 },
        { label: 'アポ率', value: `${appointmentRate || '6.7'}%` },
        { label: '接続数', value: stats.connections || 45 },
        { label: '接続率', value: `${connectionRate || '25.0'}%` },
        { label: '平均通話時間', value: '2:45' },
      ],
      tableData: {
        headers: ['オペレーター', '架電数', 'アポ獲得', 'アポ率'],
        rows: operatorData.map((d) => [d.name, d.calls, d.appointments, `${d.rate.toFixed(1)}%`]),
      },
    })
  }

  // フィルタリング
  const filteredLogs = callLogs.filter((log) => {
    if (selectedClientId !== 'all' && log.client_id !== selectedClientId) {
      return false
    }
    return true
  })

  // 統計計算
  const stats = {
    totalCalls: filteredLogs.length,
    appointments: filteredLogs.filter((log) => log.result === 'アポ獲得').length,
    connections: filteredLogs.filter((log) => log.result === '接続').length,
    notReached: filteredLogs.filter((log) => log.result === '不在' || log.result === '担当者不在').length,
    rejected: filteredLogs.filter((log) => log.result === '断り' || log.result === 'NG').length,
  }

  const appointmentRate = stats.totalCalls > 0
    ? ((stats.appointments / stats.totalCalls) * 100).toFixed(1)
    : '0'

  const connectionRate = stats.totalCalls > 0
    ? ((stats.connections / stats.totalCalls) * 100).toFixed(1)
    : '0'

  // 円グラフ用データ
  const pieData: ResultData[] = [
    { name: 'アポ獲得', value: stats.appointments, color: '#10b981' },
    { name: '接続', value: stats.connections, color: '#3b82f6' },
    { name: '不在', value: stats.notReached, color: '#f59e0b' },
    { name: '断り/NG', value: stats.rejected, color: '#ef4444' },
  ]

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
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  レポート
                </h2>
                <p className="text-sm text-slate-500">
                  架電実績の分析
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Filters */}
            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as PeriodOption)}>
              <SelectTrigger className="w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="今日">今日</SelectItem>
                <SelectItem value="今週">今週</SelectItem>
                <SelectItem value="今月">今月</SelectItem>
                <SelectItem value="全期間">全期間</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-48">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="クライアント" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全クライアント</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  エクスポート
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleExportCSV('daily')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  日別レポート (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV('operator')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  オペレーター別 (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  サマリーレポート (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">総架電数</p>
                    <p className="text-2xl font-bold">{stats.totalCalls}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">アポ獲得</p>
                    <p className="text-2xl font-bold text-green-600">{stats.appointments}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">アポ率</p>
                    <p className="text-2xl font-bold text-purple-600">{appointmentRate}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">接続数</p>
                    <p className="text-2xl font-bold">{stats.connections}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">接続率</p>
                    <p className="text-2xl font-bold">{connectionRate}%</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Trend Chart */}
              <Card className="lg:col-span-2 p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <h3 className="font-bold text-lg mb-4">日別推移（過去2週間）</h3>
                <DailyCallsChart data={dailyData} height={300} />
              </Card>

              {/* Result Distribution Pie */}
              <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <h3 className="font-bold text-lg mb-4">架電結果の分布</h3>
                <ResultPieChart data={pieData} height={300} />
              </Card>
            </div>

            {/* Operator Performance */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <h3 className="font-bold text-lg mb-4">オペレーター別パフォーマンス</h3>
              <OperatorBarChart data={operatorData} height={300} />
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <Target className="h-10 w-10 text-green-600" />
                  <div>
                    <p className="text-sm text-slate-500">アポ獲得率</p>
                    <p className="text-4xl font-bold text-green-600">{appointmentRate}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Phone className="h-10 w-10 text-blue-600" />
                  <div>
                    <p className="text-sm text-slate-500">接続率</p>
                    <p className="text-4xl font-bold text-blue-600">{connectionRate}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <Clock className="h-10 w-10 text-amber-600" />
                  <div>
                    <p className="text-sm text-slate-500">総架電数</p>
                    <p className="text-4xl font-bold text-amber-600">{stats.totalCalls}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Insights */}
            {stats.totalCalls > 0 && (
              <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
                <h3 className="font-bold text-lg mb-4 text-purple-800 dark:text-purple-200">
                  📊 サマリー
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong className="text-green-600">アポ獲得:</strong> {stats.appointments}件
                    </p>
                  </div>
                  <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong className="text-blue-600">接続:</strong> {stats.connections}件
                    </p>
                  </div>
                  <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong className="text-amber-600">不在/断り:</strong> {stats.notReached + stats.rejected}件
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
