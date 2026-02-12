'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getAppointments, updateAppointment, type Appointment } from '@/lib/nurturing-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const statusConfig: Record<string, { label: string; color: string }> = {
  tentative: { label: '仮予定', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '確定', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
  no_show: { label: 'ノーショー', color: 'bg-gray-100 text-gray-800' },
}

export default function OperatorAppointmentsPage() {
  const { user, isLoading: authLoading, isDirector } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && isDirector) {
      router.replace('/director')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.id) return

      setIsLoading(true)
      try {
        const data = await getAppointments({
          operator_id: user.id,
        })
        setAppointments(data)
      } catch (error) {
        console.error('Failed to fetch appointments:', error)
        toast({
          title: 'エラー',
          description: 'アポイント一覧の読み込みに失敗しました',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading && user?.id && !isDirector) {
      fetchAppointments()
    }
  }, [user, authLoading, isDirector, toast])

  async function handleCompleteAppointment(appointmentId: string) {
    setIsUpdating(appointmentId)
    try {
      await updateAppointment(appointmentId, {
        status: 'completed',
      })

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: 'completed' } : apt
        )
      )

      toast({
        title: '成功',
        description: 'アポイントを完了しました',
        variant: 'default',
      })
    } catch (error) {
      console.error('Failed to complete appointment:', error)
      toast({
        title: 'エラー',
        description: 'アポイントの更新に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(null)
    }
  }

  const upcomingAppointments = appointments.filter(
    (apt) =>
      apt.status !== 'completed' &&
      apt.status !== 'cancelled' &&
      apt.status !== 'no_show' &&
      new Date(apt.scheduled_at) > new Date()
  )

  const completedAppointments = appointments.filter(
    (apt) => apt.status === 'completed'
  )

  const renderAppointmentCard = (appointment: Appointment, showCompleteButton = false) => {
    const config = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.tentative
    const scheduledDate = new Date(appointment.scheduled_at)
    const isUpcoming = scheduledDate > new Date()

    return (
      <Card key={appointment.id} className={isUpcoming ? 'border-l-4 border-l-blue-500' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {appointment.company?.name || '企業名未登録'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {appointment.project?.name || 'プロジェクト未設定'}
              </p>
            </div>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 日時情報 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>{scheduledDate.toLocaleDateString('ja-JP')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>
                {scheduledDate.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {appointment.duration_minutes && ` (${appointment.duration_minutes}分)`}
              </span>
            </div>
          </div>

          {/* 企業情報 */}
          {appointment.company && (
            <div className="pt-2 border-t border-gray-200">
              <div className="space-y-2 text-sm">
                {appointment.company.industry && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">業種:</span>
                    <span className="font-medium">{appointment.company.industry}</span>
                  </div>
                )}
                {appointment.company.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">電話:</span>
                    <span className="font-medium">{appointment.company.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 会議情報 */}
          {(appointment.meeting_type || appointment.meeting_url) && (
            <div className="pt-2 border-t border-gray-200">
              <div className="space-y-2 text-sm">
                {appointment.meeting_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">形式:</span>
                    <Badge variant="outline">
                      {appointment.meeting_type === 'online' ? 'オンライン' : appointment.meeting_type === 'onsite' ? '対面' : '電話'}
                    </Badge>
                  </div>
                )}
                {appointment.meeting_url && (
                  <a
                    href={appointment.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    会議URL
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 備考 */}
          {appointment.notes && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">備考:</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                {appointment.notes}
              </p>
            </div>
          )}

          {/* 営業担当者情報 */}
          {appointment.assigned_sales_rep && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">営業担当者:</p>
              <p className="text-sm font-medium text-gray-900">
                {appointment.assigned_sales_rep}
              </p>
              {appointment.sales_rep_email && (
                <p className="text-xs text-gray-500">{appointment.sales_rep_email}</p>
              )}
            </div>
          )}

          {/* 完了ボタン */}
          {showCompleteButton && appointment.status !== 'completed' && (
            <Button
              onClick={() => handleCompleteAppointment(appointment.id)}
              disabled={isUpdating === appointment.id}
              className="w-full gap-2"
            >
              {isUpdating === appointment.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isUpdating === appointment.id ? '完了中...' : '完了'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isDirector) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">マイアポイント</h1>
          <p className="text-gray-500 mt-1">割り当てられたアポイント一覧</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* 予定のアポイント */}
            {upcomingAppointments.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-gray-900">予定中のアポイント</h2>
                  <Badge variant="secondary">{upcomingAppointments.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingAppointments.map((apt) =>
                    renderAppointmentCard(apt, true)
                  )}
                </div>
              </div>
            )}

            {/* 完了したアポイント */}
            {completedAppointments.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900">完了したアポイント</h2>
                  <Badge variant="secondary">{completedAppointments.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedAppointments.map((apt) =>
                    renderAppointmentCard(apt, false)
                  )}
                </div>
              </div>
            )}

            {/* アポイントなし */}
            {appointments.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">アポイントが割り当てられていません</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
