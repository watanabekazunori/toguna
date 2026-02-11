'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getOperator, getCallLogs, type Operator, type CallLog } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  User,
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
  Calendar,
  BarChart3,
} from 'lucide-react'

export default function OperatorDetailPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const operatorId = params.id as string

  const [operator, setOperator] = useState<Operator | null>(null)
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [operatorData, logsData] = await Promise.all([
          getOperator(operatorId),
          getCallLogs({ operator_id: operatorId }),
        ])
        setOperator(operatorData)
        setCallLogs(logsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector && operatorId) {
      fetchData()
    }
  }, [isDirector, operatorId])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  // 統計計算
  const stats = {
    totalCalls: callLogs.length,
    appointments: callLogs.filter((log) => log.result === 'アポ獲得').length,
    connections: callLogs.filter((log) => log.result === '接続').length,
    avgDuration: callLogs.length > 0
      ? Math.round(callLogs.reduce((sum, log) => sum + log.duration, 0) / callLogs.length)
      : 0,
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
        {/* Back Button */}
        <Link href="/director/operators">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            オペレーター一覧に戻る
          </Button>
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200">
            <p className="text-red-600">{error}</p>
          </Card>
        ) : operator ? (
          <>
            {/* Operator Profile */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback
                    className={`text-2xl text-white ${
                      operator.status === 'active'
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                        : 'bg-slate-400'
                    }`}
                  >
                    {operator.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">{operator.name}</h2>
                    <Badge
                      className={
                        operator.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }
                    >
                      {operator.status === 'active' ? '稼働中' : '停止中'}
                    </Badge>
                    {operator.role === 'director' && (
                      <Badge className="bg-purple-100 text-purple-700">ディレクター</Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {operator.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {operator.phone || '未登録'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      登録日: {new Date(operator.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">総架電数</p>
                    <p className="text-2xl font-bold">{stats.totalCalls}件</p>
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
                    <p className="text-2xl font-bold">{stats.appointments}件</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">接続数</p>
                    <p className="text-2xl font-bold">{stats.connections}件</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">平均通話時間</p>
                    <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Call Logs */}
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  架電履歴
                </h3>
              </div>
              {callLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>架電履歴がありません</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日時</TableHead>
                      <TableHead>結果</TableHead>
                      <TableHead>通話時間</TableHead>
                      <TableHead>メモ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callLogs.slice(0, 20).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.called_at).toLocaleString('ja-JP')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              log.result === 'アポ獲得'
                                ? 'bg-green-100 text-green-700'
                                : log.result === '接続'
                                ? 'bg-blue-100 text-blue-700'
                                : log.result === 'NG'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }
                          >
                            {log.result}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDuration(log.duration)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        ) : null}
      </main>
    </div>
  )
}
