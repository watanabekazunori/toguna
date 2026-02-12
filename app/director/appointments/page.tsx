'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getAppointments, createAppointment, updateAppointment, type Appointment } from '@/lib/nurturing-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { getCompanies, type Company } from '@/lib/supabase-api'
import { getOperators, type Operator } from '@/lib/supabase-api'
import { sendAppointmentNotification } from '@/lib/email-service'
import { createAppointmentEvent, isGoogleCalendarConfigured } from '@/lib/google-calendar'
import { getGoogleAuthURL } from '@/lib/google-calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Calendar,
  ArrowLeft,
  Video,
  MapPin,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FolderKanban,
  AlertCircle,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

// ステータスバッジの色設定
const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  tentative: { label: '仮予定', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: '確定', bgColor: 'bg-blue-100', textColor: 'text-blue-800', icon: <CheckCircle2 className="w-3 h-3" /> },
  completed: { label: '完了', bgColor: 'bg-green-100', textColor: 'text-green-800', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: 'キャンセル', bgColor: 'bg-red-100', textColor: 'text-red-800', icon: <XCircle className="w-3 h-3" /> },
  no_show: { label: 'ノーショー', bgColor: 'bg-gray-100', textColor: 'text-gray-800', icon: <AlertCircle className="w-3 h-3" /> },
}

// 日付範囲タイプ
type DateRangeType = 'today' | 'week' | 'month' | 'custom'

export default function AppointmentsPage() {
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // 状態管理
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  // フィルター状態
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRangeType>('today')
  const [customDateFrom, setCustomDateFrom] = useState<string>('')
  const [customDateTo, setCustomDateTo] = useState<string>('')

  // 新規アポイント作成ダイアログ状態
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<string | null>(null)
  const [googleCalendarConfigured, setGoogleCalendarConfigured] = useState(false)

  // フォーム状態
  const [formData, setFormData] = useState({
    company_id: '',
    operator_id: '',
    appointment_date: '',
    appointment_time: '09:00',
    duration_minutes: '30',
    meeting_type: 'online' as 'online' | 'onsite' | 'phone',
    notes: '',
  })

  // 認証確認
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // Google Calendar設定確認
  useEffect(() => {
    setGoogleCalendarConfigured(isGoogleCalendarConfigured())
  }, [])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isDirector) return

      setIsLoading(true)
      try {
        const [appointmentsData, projectsData, companiesData, operatorsData] = await Promise.all([
          getAppointments(),
          getProjects(),
          getCompanies(),
          getOperators(),
        ])
        setAppointments(appointmentsData)
        setProjects(projectsData)
        setCompanies(companiesData)
        setOperators(operatorsData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('データの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector])

  // 日付範囲を計算
  const getDateRange = (): { from: string; to: string } => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const from = new Date(now)
    let to = new Date(now)

    if (dateRange === 'today') {
      to.setHours(23, 59, 59, 999)
    } else if (dateRange === 'week') {
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7
      to = new Date(now)
      to.setDate(to.getDate() + daysUntilSunday)
      to.setHours(23, 59, 59, 999)
    } else if (dateRange === 'month') {
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      to.setHours(23, 59, 59, 999)
    } else {
      // custom
      if (customDateFrom) from.setTime(new Date(customDateFrom).getTime())
      if (customDateTo) {
        to = new Date(customDateTo)
        to.setHours(23, 59, 59, 999)
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    }
  }

  // フィルター処理
  const filteredAppointments = appointments.filter((appointment) => {
    // プロジェクトフィルター
    if (selectedProject !== 'all' && appointment.project_id !== selectedProject) {
      return false
    }

    // ステータスフィルター
    if (selectedStatus !== 'all' && appointment.status !== selectedStatus) {
      return false
    }

    // 日付範囲フィルター
    const { from, to } = getDateRange()
    const appointmentDate = new Date(appointment.scheduled_at)
    if (appointmentDate < new Date(from) || appointmentDate > new Date(to)) {
      return false
    }

    return true
  })

  // 日付でグループ化
  const groupedAppointments = filteredAppointments.reduce((acc, apt) => {
    const date = new Date(apt.scheduled_at).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(apt)
    return acc
  }, {} as Record<string, Appointment[]>)

  // サマリー統計
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todayCount = appointments.filter((apt) => {
    const aptDate = new Date(apt.scheduled_at)
    return aptDate >= todayStart && aptDate <= todayEnd
  }).length

  const confirmedCount = appointments.filter((apt) => apt.status === 'confirmed').length
  const completedCount = appointments.filter((apt) => apt.status === 'completed').length
  const cancelledCount = appointments.filter(
    (apt) => apt.status === 'cancelled' || apt.status === 'no_show'
  ).length

  // ステータス更新ハンドラ
  const handleStatusUpdate = async (appointmentId: string, newStatus: 'completed' | 'cancelled') => {
    setIsUpdating(appointmentId)
    try {
      const result = await updateAppointment(appointmentId, { status: newStatus })
      if (result) {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === appointmentId ? result : apt))
        )
        const statusLabel = newStatus === 'completed' ? '完了' : 'キャンセル'
        toast.success(`アポイントを${statusLabel}にしました`)
      } else {
        toast.error('更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update appointment:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsUpdating(null)
    }
  }

  // 新規アポイント作成ハンドラ
  const handleCreateAppointment = async () => {
    if (!formData.company_id || !formData.appointment_date) {
      toast.error('企業と日付は必須です')
      return
    }

    setIsCreating(true)
    try {
      // 日時を結合
      const scheduledAt = new Date(`${formData.appointment_date}T${formData.appointment_time}`)
      const selectedCompany = companies.find(c => c.id === formData.company_id)

      if (!selectedCompany) {
        toast.error('企業が見つかりません')
        return
      }

      // 日本のプロジェクトを取得（最初のプロジェクト）
      const projectId = projects.length > 0 ? projects[0].id : ''

      // アポイント作成
      const appointment = await createAppointment({
        company_id: formData.company_id,
        project_id: projectId,
        operator_id: formData.operator_id || undefined,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(formData.duration_minutes),
        meeting_type: formData.meeting_type,
        notes: formData.notes || undefined,
      })

      if (appointment) {
        // メール通知を試す（失敗しても続行）
        if (formData.operator_id) {
          const operator = operators.find(o => o.id === formData.operator_id)
          if (operator?.email) {
            try {
              const meetingTypeLabel = formData.meeting_type === 'online' ? 'ビデオ' : formData.meeting_type === 'onsite' ? '訪問' : '電話'
              await sendAppointmentNotification({
                companyName: selectedCompany.name,
                scheduledAt: scheduledAt.toLocaleString('ja-JP'),
                meetingType: meetingTypeLabel,
                salesRepEmail: operator.email,
                notes: formData.notes,
              })
            } catch (error) {
              console.warn('Email notification failed:', error)
              // 続行
            }
          }
        }

        // Google Calendar同期を試す（失敗しても続行）
        if (googleCalendarConfigured && formData.operator_id) {
          const operator = operators.find(o => o.id === formData.operator_id)
          if (operator?.email) {
            try {
              const accessToken = localStorage.getItem('google_access_token')
              if (accessToken) {
                const meetingTypeLabel = formData.meeting_type === 'online' ? 'ビデオ' : formData.meeting_type === 'onsite' ? '訪問' : '電話'
                await createAppointmentEvent(accessToken, {
                  companyName: selectedCompany.name,
                  scheduledAt: scheduledAt.toISOString(),
                  durationMinutes: parseInt(formData.duration_minutes),
                  meetingType: meetingTypeLabel,
                  salesRepEmail: operator.email,
                  notes: formData.notes,
                })
              }
            } catch (error) {
              console.warn('Google Calendar sync failed:', error)
              // 続行
            }
          }
        }

        // リストをリフレッシュ
        const updatedAppointments = await getAppointments()
        setAppointments(updatedAppointments)

        // フォームをリセット
        setFormData({
          company_id: '',
          operator_id: '',
          appointment_date: '',
          appointment_time: '09:00',
          duration_minutes: '30',
          meeting_type: 'online',
          notes: '',
        })

        setShowCreateDialog(false)
        toast.success('アポイントを作成しました')
      } else {
        toast.error('アポイント作成に失敗しました')
      }
    } catch (error) {
      console.error('Failed to create appointment:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsCreating(false)
    }
  }

  // Google Calendar同期ハンドラ
  const handleSyncToGoogleCalendar = async (appointment: Appointment) => {
    if (!googleCalendarConfigured) {
      toast.error('Google Calendar未設定 - 設定画面で連携してください')
      return
    }

    setIsSyncingCalendar(appointment.id)
    try {
      const accessToken = localStorage.getItem('google_access_token')
      if (!accessToken) {
        // 再認証が必要
        const authUrl = getGoogleAuthURL()
        if (authUrl) {
          window.location.href = authUrl
        } else {
          toast.error('Google Calendar設定が完了していません')
        }
        return
      }

      const meetingTypeLabel = appointment.meeting_type === 'online' ? 'ビデオ' : appointment.meeting_type === 'onsite' ? '訪問' : '電話'

      await createAppointmentEvent(accessToken, {
        companyName: appointment.company?.name || '不明',
        scheduledAt: appointment.scheduled_at,
        durationMinutes: appointment.duration_minutes,
        meetingType: meetingTypeLabel,
        salesRepEmail: appointment.sales_rep_email || 'noreply@toguna.jp',
        notes: appointment.notes,
      })

      toast.success('Google Calendarに同期しました')
    } catch (error) {
      console.error('Failed to sync to Google Calendar:', error)
      toast.error('Google Calendar同期に失敗しました')
    } finally {
      setIsSyncingCalendar(null)
    }
  }

  // ミーティングタイプアイコン取得
  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'online':
        return <Video className="w-4 h-4" />
      case 'onsite':
        return <MapPin className="w-4 h-4" />
      case 'phone':
        return <Phone className="w-4 h-4" />
      default:
        return null
    }
  }

  // ミーティングタイプラベル取得
  const getMeetingTypeLabel = (type: string) => {
    switch (type) {
      case 'online':
        return 'ビデオ'
      case 'onsite':
        return '訪問'
      case 'phone':
        return '電話'
      default:
        return type
    }
  }

  // 時間表示フォーマット
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-8 h-8 text-blue-600" />
                アポイント管理
              </h1>
              <p className="text-gray-500 mt-1">スケジュール確認と管理</p>
            </div>
          </div>

          {/* 新規作成ボタン */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Plus className="w-5 h-5" />
                新規アポイント作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新規アポイント作成</DialogTitle>
                <DialogDescription>
                  アポイントの詳細情報を入力してください
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* 企業選択 */}
                <div>
                  <Label htmlFor="company">企業</Label>
                  <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                    <SelectTrigger id="company">
                      <SelectValue placeholder="企業を選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* オペレーター選択 */}
                <div>
                  <Label htmlFor="operator">オペレーター</Label>
                  <Select value={formData.operator_id} onValueChange={(value) => setFormData({ ...formData, operator_id: value })}>
                    <SelectTrigger id="operator">
                      <SelectValue placeholder="オペレーターを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 日付選択 */}
                <div>
                  <Label htmlFor="date">日付</Label>
                  <input
                    id="date"
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 時間選択 */}
                <div>
                  <Label htmlFor="time">時間</Label>
                  <input
                    id="time"
                    type="time"
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 期間選択 */}
                <div>
                  <Label htmlFor="duration">期間</Label>
                  <Select value={formData.duration_minutes} onValueChange={(value) => setFormData({ ...formData, duration_minutes: value })}>
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30分</SelectItem>
                      <SelectItem value="60">60分</SelectItem>
                      <SelectItem value="90">90分</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ミーティングタイプ選択 */}
                <div>
                  <Label htmlFor="type">形式</Label>
                  <Select value={formData.meeting_type} onValueChange={(value) => setFormData({ ...formData, meeting_type: value as 'online' | 'onsite' | 'phone' })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">ビデオ</SelectItem>
                      <SelectItem value="onsite">訪問</SelectItem>
                      <SelectItem value="phone">電話</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* メモ */}
                <div>
                  <Label htmlFor="notes">備考</Label>
                  <Textarea
                    id="notes"
                    placeholder="メモを入力..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* 作成ボタン */}
                <Button
                  onClick={handleCreateAppointment}
                  disabled={isCreating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      作成
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">今日のアポ</p>
                <p className="text-3xl font-bold text-blue-600">{todayCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">確定済み</p>
                <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">完了</p>
                <p className="text-3xl font-bold text-emerald-600">{completedCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">キャンセル/ノーショー</p>
                <p className="text-3xl font-bold text-red-600">{cancelledCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* フィルター行 */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* プロジェクト選択 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">プロジェクト</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ステータス選択 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">ステータス</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="tentative">仮予定</SelectItem>
                    <SelectItem value="confirmed">確定</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                    <SelectItem value="no_show">ノーショー</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 日付範囲選択 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">日付範囲</label>
                <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">今日</SelectItem>
                    <SelectItem value="week">今週</SelectItem>
                    <SelectItem value="month">今月</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* リセットボタン */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedProject('all')
                    setSelectedStatus('all')
                    setDateRange('today')
                  }}
                >
                  リセット
                </Button>
              </div>
            </div>

            {/* カスタム日付入力（カスタム選択時のみ表示） */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">開始日</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">終了日</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* タイムラインビュー */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : Object.keys(groupedAppointments).length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">アポイントがありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAppointments).map(([dateStr, dateAppointments]) => (
              <div key={dateStr}>
                {/* 日付ヘッダー */}
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{dateStr}</h2>
                  <span className="text-sm text-gray-500">
                    {dateAppointments.length}件
                  </span>
                </div>

                {/* アポイントカード一覧 */}
                <div className="space-y-3">
                  {dateAppointments.map((appointment) => {
                    const config = statusConfig[appointment.status]
                    return (
                      <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            {/* 時間 */}
                            <div className="md:col-span-1">
                              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                <Clock className="w-4 h-4 text-blue-600" />
                                {formatTime(appointment.scheduled_at)}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {appointment.duration_minutes}分
                              </p>
                            </div>

                            {/* 企業情報 */}
                            <div className="md:col-span-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <p className="font-semibold text-gray-900">
                                    {appointment.company?.name || '不明'}
                                  </p>
                                </div>
                                {appointment.company?.industry && (
                                  <p className="text-xs text-gray-500 ml-6">
                                    {appointment.company.industry}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* ミーティングタイプとプロジェクト */}
                            <div className="md:col-span-2 space-y-2">
                              <div className="flex items-center gap-2">
                                {getMeetingTypeIcon(appointment.meeting_type)}
                                <span className="text-sm text-gray-700">
                                  {getMeetingTypeLabel(appointment.meeting_type)}
                                </span>
                              </div>
                              {appointment.project?.name && (
                                <Badge variant="outline" className="w-fit">
                                  <FolderKanban className="w-3 h-3 mr-1" />
                                  {appointment.project.name}
                                </Badge>
                              )}
                            </div>

                            {/* ステータスバッジ */}
                            <div className="md:col-span-1">
                              <Badge
                                className={`${config.bgColor} ${config.textColor} border-0 flex items-center gap-1 w-fit`}
                              >
                                {config.icon}
                                {config.label}
                              </Badge>
                            </div>

                            {/* 営業担当者 */}
                            <div className="md:col-span-2">
                              {appointment.assigned_sales_rep ? (
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {appointment.assigned_sales_rep}
                                  </p>
                                  {appointment.sales_rep_email && (
                                    <p className="text-xs text-gray-500">
                                      {appointment.sales_rep_email}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">割り当てなし</p>
                              )}
                            </div>

                            {/* アクションボタン */}
                            <div className="md:col-span-2 flex gap-2 justify-end flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSyncToGoogleCalendar(appointment)}
                                disabled={isSyncingCalendar === appointment.id}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                title="Google Calendarに同期"
                              >
                                {isSyncingCalendar === appointment.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    同期
                                  </>
                                )}
                              </Button>

                              {appointment.status !== 'completed' &&
                                appointment.status !== 'cancelled' &&
                                appointment.status !== 'no_show' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() =>
                                        handleStatusUpdate(appointment.id, 'completed')
                                      }
                                      disabled={isUpdating === appointment.id}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      {isUpdating === appointment.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-4 h-4 mr-1" />
                                          完了にする
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleStatusUpdate(appointment.id, 'cancelled')
                                      }
                                      disabled={isUpdating === appointment.id}
                                      className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      {isUpdating === appointment.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <XCircle className="w-4 h-4 mr-1" />
                                          キャンセル
                                        </>
                                      )}
                                    </Button>
                                  </>
                                )}
                            </div>
                          </div>

                          {/* ノーツ表示 */}
                          {appointment.notes && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-1">メモ:</p>
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {appointment.notes}
                              </p>
                            </div>
                          )}

                          {/* アウトカム表示 */}
                          {appointment.outcome && appointment.status === 'completed' && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-1">結果:</p>
                              <p className="text-sm text-gray-700">{appointment.outcome}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
