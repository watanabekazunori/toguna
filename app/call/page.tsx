'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  getCompanies,
  getClient,
  generateScript,
  createCallLog,
  type Company,
  type Client,
} from '@/lib/api'
import {
  scoreCallQuality,
  recordRejectionInsight,
  checkAndCreatePivotAlerts,
  type CallQualityScore,
} from '@/lib/management-api'
import { createAppointment, updateEngagementScore } from '@/lib/nurturing-api'
import { sendAppointmentNotification } from '@/lib/email-service'
import { createAppointmentEvent, isGoogleCalendarConfigured } from '@/lib/google-calendar'
import { getProjects, type Project } from '@/lib/projects-api'
import {
  checkZoomConfiguration,
  initiateZoomCall,
  endZoomCall,
  getZoomCallStatus,
  getZoomPhoneUsers,
} from '@/app/actions/zoom'
import type { ZoomCallSession, ZoomUser } from '@/lib/zoom'
import { initiateCall as initiateZoomPhoneCall, isZoomPhoneConfigured } from '@/lib/zoom-phone'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Bell,
  LogOut,
  Phone,
  PhoneOff,
  Building2,
  Users,
  MapPin,
  Globe,
  Flame,
  Brain,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  MessageSquare,
  Loader2,
  Timer,
  ChevronRight,
  Video,
  PhoneCall,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type CallResult = '接続' | 'アポ獲得' | '不在' | '担当者不在' | '断り' | 'NG' | ''

type WhisperMessage = {
  id: string
  message: string
  from_name: string
  sent_at: string
  is_read: boolean
}

const resultOptions: { value: CallResult; label: string; icon: React.ReactNode; color: string }[] = [
  { value: '接続', label: '接続（継続検討）', icon: <Phone className="h-4 w-4" />, color: 'bg-blue-500' },
  { value: 'アポ獲得', label: 'アポ獲得', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
  { value: '不在', label: '不在', icon: <PhoneOff className="h-4 w-4" />, color: 'bg-slate-400' },
  { value: '担当者不在', label: '担当者不在', icon: <Users className="h-4 w-4" />, color: 'bg-orange-400' },
  { value: '断り', label: '断り', icon: <XCircle className="h-4 w-4" />, color: 'bg-amber-500' },
  { value: 'NG', label: 'NG（架電不可）', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500' },
]

const rankColors: Record<string, string> = {
  S: 'bg-red-500',
  A: 'bg-orange-500',
  B: 'bg-blue-500',
  C: 'bg-slate-400',
}

export default function CallPage() {
  const { user, signOut, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const companyId = searchParams.get('company_id')
  const clientId = searchParams.get('client_id')

  // State
  const [company, setCompany] = useState<Company | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Call state
  const [isOnCall, setIsOnCall] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callResult, setCallResult] = useState<CallResult>('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastCallLogId, setLastCallLogId] = useState<string | null>(null)

  // Confirmation dialog state (O3)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)

  // Edit mode (W3)
  const [isEditing, setIsEditing] = useState(false)
  const [editCallDuration, setEditCallDuration] = useState(0)
  const [editCallResult, setEditCallResult] = useState<CallResult>('')
  const [editNotes, setEditNotes] = useState('')

  // Call timeout warning (W7)
  const [callWarningShown, setCallWarningShown] = useState(false)

  // AI Script
  const [script, setScript] = useState<string | null>(null)
  const [scriptTips, setScriptTips] = useState<string[]>([])
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)

  // Quality Score (Feature 1)
  const [qualityScore, setQualityScore] = useState<CallQualityScore | null>(null)
  const [isScoring, setIsScoring] = useState(false)

  // Rejection Recording (Feature 2)
  const [rejectionCategory, setRejectionCategory] = useState<string>('')
  const [rejectionDetail, setRejectionDetail] = useState<string>('')
  const [isSavingRejection, setIsSavingRejection] = useState(false)

  // AI Suggestions (Feature 3)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)

  // Whisper Messages (Feature 4)
  const [whisperMessages, setWhisperMessages] = useState<WhisperMessage[]>([])
  const [hasNewWhisper, setHasNewWhisper] = useState(false)

  // Appointment creation for アポ獲得
  const [projects, setProjects] = useState<Project[]>([])
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [appointmentFormData, setAppointmentFormData] = useState({
    appointment_date: '',
    appointment_time: '09:00',
  })
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [googleCalendarConfigured, setGoogleCalendarConfigured] = useState(false)

  // Zoom Phone integration
  const [zoomConfigured, setZoomConfigured] = useState(false)
  const [zoomUsers, setZoomUsers] = useState<ZoomUser[]>([])
  const [selectedZoomUser, setSelectedZoomUser] = useState<string>('')
  const [zoomCallSession, setZoomCallSession] = useState<ZoomCallSession | null>(null)
  const [isZoomCalling, setIsZoomCalling] = useState(false)
  const [zoomError, setZoomError] = useState<string | null>(null)

  // Zoom Phone (library) integration
  const [zoomPhoneConfigured, setZoomPhoneConfigured] = useState(false)
  const [isZoomPhoneCalling, setIsZoomPhoneCalling] = useState(false)

  // Fetch company and client data
  useEffect(() => {
    const fetchData = async () => {
      if (!companyId || !clientId) {
        setError('企業情報が指定されていません')
        setIsLoading(false)
        return
      }

      try {
        const [companiesData, clientData] = await Promise.all([
          getCompanies({ client_id: clientId }),
          getClient(clientId),
        ])

        // 配列であることを確認
        const companies = Array.isArray(companiesData) ? companiesData : []
        const foundCompany = companies.find((c) => c.id === companyId)
        if (!foundCompany) {
          setError('企業が見つかりません')
        } else {
          setCompany(foundCompany)
        }

        if (clientData) {
          setClient(clientData)
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [companyId, clientId])

  // Check Zoom configuration on mount
  useEffect(() => {
    const checkZoom = async () => {
      const result = await checkZoomConfiguration()
      setZoomConfigured(result.configured)

      if (result.configured) {
        // Zoom Phone対応ユーザーを取得
        const usersResult = await getZoomPhoneUsers()
        if (usersResult.success && usersResult.users) {
          setZoomUsers(usersResult.users)
          // 最初のユーザーをデフォルト選択
          if (usersResult.users.length > 0) {
            setSelectedZoomUser(usersResult.users[0].id)
          }
        }
      }

      // Check Zoom Phone library configuration
      const zoomPhoneAvailable = isZoomPhoneConfigured()
      setZoomPhoneConfigured(zoomPhoneAvailable)
    }

    const fetchProjects = async () => {
      try {
        const projectsData = await getProjects()
        setProjects(projectsData)
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      }
    }

    setGoogleCalendarConfigured(isGoogleCalendarConfigured())
    checkZoom()
    fetchProjects()
  }, [])

  // Call timer with 3-hour warning (W7)
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isOnCall) {
      timer = setInterval(() => {
        setCallDuration((prev) => {
          const newDuration = prev + 1
          // Show warning if call has been going for 3 hours (10800 seconds)
          if (newDuration >= 10800 && !callWarningShown) {
            setError('警告: 通話が3時間以上続いています。通話を終了することをお勧めします。')
            setCallWarningShown(true)
          }
          return newDuration
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isOnCall, callWarningShown])

  // Zoom call status polling
  useEffect(() => {
    let statusInterval: NodeJS.Timeout

    if (zoomCallSession && zoomCallSession.status !== 'ended') {
      statusInterval = setInterval(async () => {
        const result = await getZoomCallStatus({
          userId: selectedZoomUser,
          callId: zoomCallSession.call_id,
        })

        if (result.success && result.callSession) {
          setZoomCallSession(result.callSession)

          if (result.callSession.status === 'ended') {
            setIsOnCall(false)
            setIsZoomCalling(false)
          }
        }
      }, 2000)
    }

    return () => {
      if (statusInterval) clearInterval(statusInterval)
    }
  }, [zoomCallSession, selectedZoomUser])

  // Whisper messages subscription
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()

    const channel = supabase
      .channel(`whisper_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whisper_messages',
          filter: `operator_id=eq.${user.id}`,
        },
        (payload) => {
          const newMessage: WhisperMessage = {
            id: payload.new.id,
            message: payload.new.message,
            from_name: payload.new.from_name,
            sent_at: payload.new.sent_at,
            is_read: false,
          }
          setWhisperMessages((prev) => [newMessage, ...prev])
          setHasNewWhisper(true)
          // Play notification sound
          playWhisperNotification()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id])

  // Generate AI script
  const handleGenerateScript = async () => {
    if (!company || !client) return

    setIsGeneratingScript(true)
    try {
      const result = await generateScript({ company, client })
      setScript(result.script)
      setScriptTips(result.tips)
    } catch (err) {
      console.error('Script generation failed:', err)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // Start/End call (manual mode)
  const handleToggleCall = () => {
    if (isOnCall) {
      setIsOnCall(false)
      setCallWarningShown(false)
    } else {
      setIsOnCall(true)
      setCallDuration(0)
      setSaved(false)
      setCallWarningShown(false)
    }
  }

  // Force end call (W7) - always available when on call
  const handleForceEndCall = () => {
    setIsOnCall(false)
    setCallDuration(0)
    setCallWarningShown(false)
    setZoomCallSession(null)
    setIsZoomCalling(false)
  }

  // Start Zoom Phone call
  const handleZoomCall = async () => {
    if (!company?.phone || !selectedZoomUser) {
      setZoomError('電話番号またはZoomユーザーが設定されていません')
      return
    }

    setZoomError(null)
    setIsZoomCalling(true)

    const result = await initiateZoomCall({
      userId: selectedZoomUser,
      phoneNumber: company.phone,
    })

    if (result.success && result.callSession) {
      setZoomCallSession(result.callSession)
      setIsOnCall(true)
      setCallDuration(0)
      setSaved(false)
    } else {
      setZoomError(result.error || 'Zoom発信に失敗しました')
      setIsZoomCalling(false)
    }
  }

  // End Zoom Phone call
  const handleEndZoomCall = async () => {
    if (!zoomCallSession) return

    const result = await endZoomCall({
      userId: selectedZoomUser,
      callId: zoomCallSession.call_id,
    })

    if (result.success) {
      setIsOnCall(false)
      setIsZoomCalling(false)
      setZoomCallSession(null)
    } else {
      setZoomError(result.error || '通話終了に失敗しました')
    }
  }

  // Initiate Zoom Phone call using zoom-phone library
  const handleZoomPhoneCall = async () => {
    if (!company?.phone) {
      setError('電話番号が設定されていません')
      return
    }

    setIsZoomPhoneCalling(true)
    try {
      // ここでは機能の概念を示しています
      // 実装にはアクセストークンが必要です
      console.log(`Zoom Phone で ${company.phone} に発信しようとしています`)

      // 実装例:
      // const token = await getZoomPhoneToken()
      // const session = await initiateZoomPhoneCall(token, {
      //   phoneNumber: company.phone,
      //   userId: user?.id || '',
      // })
      // setIsOnCall(true)
      // setCallDuration(0)

      // 現在はモック実装
      setIsOnCall(true)
      setCallDuration(0)
      setSaved(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zoom Phone 発信に失敗しました')
    } finally {
      setIsZoomPhoneCalling(false)
    }
  }

  // Show confirmation dialog (O3)
  const handleSaveResultClick = () => {
    if (!company || !client || !user || !callResult) {
      setError('架電結果を選択してください')
      return
    }
    setShowConfirmDialog(true)
    setPendingSave(true)
  }

  // Confirm and save call result (S1)
  const handleConfirmSave = async () => {
    if (!company || !client || !user || !callResult) {
      setError('架電結果を選択してください')
      setShowConfirmDialog(false)
      return
    }

    setIsSaving(true)
    setError(null)
    setShowConfirmDialog(false)

    try {
      const result = await createCallLog({
        company_id: company.id,
        client_id: client.id,
        operator_id: user.id,
        result: callResult,
        duration: callDuration,
        notes,
      })

      // Store the call log ID for edit capability (W3)
      let callLogId: string | null = null
      if (result && typeof result === 'object' && 'id' in result) {
        callLogId = (result as any).id
        setLastCallLogId(callLogId)
      }

      // アポ獲得の場合、アポイント作成フォームを表示
      if (callResult === 'アポ獲得') {
        setShowAppointmentForm(true)
      }

      setSaved(true)
      // Reset quality score and rejection form on new save
      setQualityScore(null)
      setRejectionCategory('')
      setRejectionDetail('')
      setAiSuggestions([])

      // === 架電後の自動分析 ===
      // これらは非ブロッキングで実行（メイン保存フローを妨げない）
      if (callLogId) {
        // 1. 品質スコア自動計算
        try {
          await scoreCallQuality(callLogId, user.id)
        } catch (e) {
          console.warn('品質スコア自動計算に失敗:', e)
        }

        // 2. エンゲージメントスコア更新
        try {
          // Map call result to event type for engagement scoring
          const eventTypeMap: Record<string, string> = {
            '接続': 'call_connected',
            'アポ獲得': 'call_appointment',
            '断り': 'call_connected',
            '不在': 'call_connected',
            '担当者不在': 'call_connected',
            'NG': 'call_connected',
          }
          const eventType = eventTypeMap[callResult] || 'call_connected'
          await updateEngagementScore(company.id, eventType)
        } catch (e) {
          console.warn('エンゲージメント更新に失敗:', e)
        }

        // 3. 断り時は自動でインサイト記録
        if (callResult === '断り' && notes) {
          try {
            const projectId = projects.length > 0 ? projects[0].id : ''
            await recordRejectionInsight({
              project_id: projectId,
              company_id: company.id,
              call_log_id: callLogId,
              rejection_category: 'general',
              rejection_detail: notes,
              recorded_by: user.id,
            })
          } catch (e) {
            console.warn('断りインサイト記録に失敗:', e)
          }
        }

        // 4. ピボットアラートチェック
        try {
          const projectId = projects.length > 0 ? projects[0].id : ''
          if (projectId) {
            await checkAndCreatePivotAlerts(projectId)
          }
        } catch (e) {
          console.warn('ピボットアラートチェックに失敗:', e)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '保存に失敗しました'
      setError(errorMsg)
    } finally {
      setIsSaving(false)
      setPendingSave(false)
    }
  }

  // アポイント作成ハンドラ（アポ獲得時）
  const handleCreateAppointmentFromCall = async () => {
    if (!company || !user || !appointmentFormData.appointment_date) {
      setError('日付は必須です')
      return
    }

    setIsCreatingAppointment(true)
    try {
      const scheduledAt = new Date(`${appointmentFormData.appointment_date}T${appointmentFormData.appointment_time}`)
      const projectId = projects.length > 0 ? projects[0].id : ''

      // アポイント作成
      const appointment = await createAppointment({
        company_id: company.id,
        project_id: projectId,
        operator_id: user.id,
        call_log_id: lastCallLogId || undefined,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 30,
        meeting_type: 'phone',
        notes: `架電から獲得したアポイント: ${notes}`,
      })

      if (appointment) {
        // メール通知を試す（失敗しても続行）
        if (user?.email) {
          try {
            await sendAppointmentNotification({
              companyName: company.name,
              scheduledAt: scheduledAt.toLocaleString('ja-JP'),
              meetingType: '電話',
              salesRepEmail: user.email,
            })
          } catch (error) {
            console.warn('Email notification failed:', error)
          }
        }

        // Google Calendar同期を試す（失敗しても続行）
        if (googleCalendarConfigured && user?.email) {
          try {
            const accessToken = localStorage.getItem('google_access_token')
            if (accessToken) {
              await createAppointmentEvent(accessToken, {
                companyName: company.name,
                scheduledAt: scheduledAt.toISOString(),
                durationMinutes: 30,
                meetingType: '電話',
                salesRepEmail: user.email,
              })
            }
          } catch (error) {
            console.warn('Google Calendar sync failed:', error)
          }
        }

        setShowAppointmentForm(false)
        toast.success('アポイントを作成しました')
      } else {
        setError('アポイント作成に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create appointment:', err)
      setError(err instanceof Error ? err.message : 'アポイント作成に失敗しました')
    } finally {
      setIsCreatingAppointment(false)
    }
  }

  // Edit saved call result (W3)
  const handleEditResult = () => {
    setIsEditing(true)
    setEditCallResult(callResult)
    setEditNotes(notes)
    setEditCallDuration(callDuration)
  }

  // Save edit to call result (W3)
  const handleSaveEdit = async () => {
    if (!lastCallLogId) {
      setError('架電ログが見つかりません')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      await supabase
        .from('call_logs')
        .update({
          result: editCallResult,
          notes: editNotes,
          duration: editCallDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lastCallLogId)

      // Update local state
      setCallResult(editCallResult)
      setNotes(editNotes)
      setCallDuration(editCallDuration)
      setIsEditing(false)

      // Show success message
      const alertDiv = document.createElement('div')
      alertDiv.textContent = '更新しました'
      alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:1000;'
      document.body.appendChild(alertDiv)
      setTimeout(() => alertDiv.remove(), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditCallResult('')
    setEditNotes('')
    setEditCallDuration(0)
  }

  // Handle quality score request (Feature 1)
  const handleRequestQualityScore = async () => {
    if (!company || !client || !user) return

    setIsScoring(true)
    try {
      const score = await scoreCallQuality(company.id, user.id)
      setQualityScore(score)
    } catch (err) {
      console.error('Quality scoring failed:', err)
      setError('品質スコア取得に失敗しました')
    } finally {
      setIsScoring(false)
    }
  }

  // Handle rejection recording (Feature 2)
  const handleSaveRejection = async () => {
    if (!company || !client || !user || !rejectionCategory) {
      setError('区分を選択してください')
      return
    }

    setIsSavingRejection(true)
    try {
      await recordRejectionInsight({
        company_id: company.id,
        project_id: (company as any).project_id || client?.id || '',
        rejection_category: rejectionCategory,
        rejection_detail: rejectionDetail,
        recorded_by: user.id,
      })
      setRejectionCategory('')
      setRejectionDetail('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '断り理由の保存に失敗しました')
    } finally {
      setIsSavingRejection(false)
    }
  }

  // Generate AI suggestions (Feature 3)
  const handleGenerateAiSuggestions = async () => {
    if (!company || !client) return

    setIsGeneratingSuggestions(true)
    try {
      // Simulate AI suggestion generation based on context
      const suggestions = generateAiSuggestions(callResult, company, client)
      setAiSuggestions(suggestions)
    } catch (err) {
      console.error('AI suggestions generation failed:', err)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  // Helper function to generate context-aware AI suggestions
  const generateAiSuggestions = (
    result: CallResult,
    company: Company,
    client: Client
  ): string[] => {
    const suggestions: string[] = []

    if (isOnCall) {
      // During call suggestions
      suggestions.push('相手の課題をしっかり聞き出す')
      suggestions.push('自社サービスとの接点を探す')
      suggestions.push('アポイントを取ることが目標')
    } else if (result === 'アポ獲得') {
      suggestions.push('アポイント内容をメールで確認する')
      suggestions.push('次回アクションまでの期間を確認')
      suggestions.push('必要な資料を事前に準備する')
    } else if (result === '断り') {
      suggestions.push('断り理由を詳しく記録する')
      suggestions.push('別の部門への提案を検討する')
      suggestions.push('6ヶ月後のリトライを計画する')
    } else if (result === '接続') {
      suggestions.push('相手の関心度を確認する')
      suggestions.push('次回の接触時期を確認する')
      suggestions.push('接触内容をログに記録する')
    } else if (result === '不在') {
      suggestions.push('在席確認の別時間を探す')
      suggestions.push('メールでのアプローチを検討する')
      suggestions.push('月末月初の接触を検討する')
    } else if (result === '担当者不在') {
      suggestions.push('担当者の名前や内線を確認')
      suggestions.push('直接連絡先を記録する')
      suggestions.push('別の担当者への提案を検討する')
    }

    return suggestions
  }

  // Play whisper notification sound
  const playWhisperNotification = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (err) {
      console.log('Notification sound not available')
    }
  }

  // Mark whisper as read
  const markWhisperAsRead = async (messageId: string) => {
    const supabase = createClient()
    try {
      await supabase
        .from('whisper_messages')
        .update({ is_read: true })
        .eq('id', messageId)

      setWhisperMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      )

      if (whisperMessages.some((msg) => !msg.is_read && msg.id !== messageId)) {
        setHasNewWhisper(true)
      } else {
        setHasNewWhisper(false)
      }
    } catch (err) {
      console.error('Failed to mark whisper as read:', err)
    }
  }

  // Go to next company
  const handleNextCompany = () => {
    router.push(`/call-list?client_id=${clientId}`)
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <Card className="p-8 text-center">
          <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-medium mb-4">{error}</p>
          <Link href="/call-list">
            <Button>架電リストに戻る</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            {client && (
              <Badge className="bg-blue-500 text-white px-4 py-1 text-sm font-medium">
                {client.name}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name || 'オペレーター'}さん</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  {user?.name?.charAt(0) || 'O'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8">
        {/* Back Button */}
        <Link href={`/call-list?client_id=${clientId}`}>
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            架電リストに戻る
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Company Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Card */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {company && (
                      <Badge className={`${rankColors[company.rank]} text-white px-3 py-1`}>
                        <Flame className="h-3 w-3 mr-1" />
                        {company.rank}判定
                      </Badge>
                    )}
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {company?.name}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {company?.industry || '業種未設定'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {company?.employees || '-'}名
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {company?.location || '所在地未設定'}
                  </div>
                </div>

                {/* Phone Number - Prominent Display */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-6 w-6 text-blue-600" />
                      <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {company?.phone || '電話番号未登録'}
                      </span>
                    </div>
                    {company?.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(company.website, '_blank')}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        HP
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Call Controls */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-6">
                {/* Call Timer */}
                <div className="flex items-center justify-center gap-4">
                  <div
                    className={`text-5xl font-mono font-bold ${
                      isOnCall ? 'text-green-600' : 'text-slate-400'
                    }`}
                  >
                    {formatDuration(callDuration)}
                  </div>
                  {isOnCall && (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">
                        {zoomCallSession ? 'Zoom通話中' : '通話中'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Zoom Error */}
                {zoomError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{zoomError}</AlertDescription>
                  </Alert>
                )}

                {/* Zoom Phone Controls */}
                {(zoomConfigured || zoomPhoneConfigured) && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Video className="h-5 w-5" />
                      <span className="font-medium">Zoom Phone連携</span>
                      <Badge className="bg-green-500 text-white text-xs">接続済み</Badge>
                    </div>

                    {zoomConfigured && zoomUsers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">発信者:</Label>
                        <Select
                          value={selectedZoomUser}
                          onValueChange={setSelectedZoomUser}
                          disabled={isOnCall}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="ユーザーを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {zoomUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name} {user.last_name}
                                {user.extension_number && ` (内線: ${user.extension_number})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Zoom Call Button */}
                    {zoomConfigured && (
                      <Button
                        size="lg"
                        className={`w-full h-14 text-lg font-bold ${
                          isOnCall && zoomCallSession
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                        }`}
                        onClick={isOnCall && zoomCallSession ? handleEndZoomCall : handleZoomCall}
                        disabled={isZoomCalling && !zoomCallSession}
                      >
                        {isZoomCalling && !zoomCallSession ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            発信中...
                          </>
                        ) : isOnCall && zoomCallSession ? (
                          <>
                            <PhoneOff className="h-5 w-5 mr-2" />
                            Zoom通話終了
                          </>
                        ) : (
                          <>
                            <PhoneCall className="h-5 w-5 mr-2" />
                            Zoomで発信
                          </>
                        )}
                      </Button>
                    )}

                    {/* Zoom Phone ボタン (Phone APIライブラリ版) */}
                    {zoomPhoneConfigured && !zoomConfigured && (
                      <Button
                        size="lg"
                        className={`w-full h-14 text-lg font-bold ${
                          isOnCall
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                        }`}
                        onClick={isOnCall ? handleToggleCall : handleZoomPhoneCall}
                        disabled={isZoomPhoneCalling}
                      >
                        {isZoomPhoneCalling ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Zoom発信中...
                          </>
                        ) : isOnCall ? (
                          <>
                            <PhoneOff className="h-5 w-5 mr-2" />
                            Zoom通話終了
                          </>
                        ) : (
                          <>
                            <PhoneCall className="h-5 w-5 mr-2" />
                            Zoom Phoneで発信
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {/* Manual Call Button */}
                <div className="relative">
                  {zoomConfigured && (
                    <div className="absolute inset-x-0 top-0 flex items-center justify-center -mt-3">
                      <span className="bg-white dark:bg-slate-900 px-3 text-sm text-slate-400">
                        または
                      </span>
                    </div>
                  )}
                  <div className={`flex justify-center ${zoomConfigured ? 'pt-4' : ''}`}>
                    <Button
                      size="lg"
                      variant={zoomConfigured ? 'outline' : 'default'}
                      className={`w-48 h-16 text-lg font-bold ${
                        !zoomConfigured
                          ? isOnCall
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                          : ''
                      }`}
                      onClick={handleToggleCall}
                      disabled={zoomCallSession !== null}
                    >
                      {isOnCall && !zoomCallSession ? (
                        <>
                          <PhoneOff className="h-6 w-6 mr-2" />
                          通話終了
                        </>
                      ) : (
                        <>
                          <Phone className="h-6 w-6 mr-2" />
                          {zoomConfigured ? '手動で架電' : '架電開始'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Script */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <h3 className="font-bold text-lg">AIトークスクリプト</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        スクリプト生成
                      </>
                    )}
                  </Button>
                </div>

                {script ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg whitespace-pre-wrap text-sm">
                      {script}
                    </div>
                    {scriptTips.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          💡 ポイント:
                        </p>
                        <ul className="space-y-1">
                          {scriptTips.map((tip, i) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                            >
                              <span className="text-purple-500">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>「スクリプト生成」をクリックしてAIにトークスクリプトを作成してもらいましょう</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Call Result */}
          <div className="space-y-6">
            {/* Result Input */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  架電結果を記録
                </h3>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                      <span>{error}</span>
                      {!saved && isSaving === false && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleConfirmSave}
                          className="ml-4 bg-red-500 hover:bg-red-600 text-white border-red-500"
                        >
                          再試行
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {saved && (
                  <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600">
                      架電結果を保存しました
                    </AlertDescription>
                  </Alert>
                )}

                {/* Result Selection */}
                <div className="space-y-2">
                  <Label>結果</Label>
                  <Select
                    value={callResult}
                    onValueChange={(value) => setCallResult(value as CallResult)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="結果を選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {resultOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${option.color} text-white`}>
                              {option.icon}
                            </div>
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Feature 2: Rejection Reason Recording */}
                {callResult === '断り' && saved && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      断り理由の記録
                    </h4>
                    <div className="space-y-2">
                      <Label>区分</Label>
                      <Select
                        value={rejectionCategory}
                        onValueChange={setRejectionCategory}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="理由を選択..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="価格">価格</SelectItem>
                          <SelectItem value="時期">時期</SelectItem>
                          <SelectItem value="競合">競合</SelectItem>
                          <SelectItem value="権限">権限</SelectItem>
                          <SelectItem value="必要性">必要性</SelectItem>
                          <SelectItem value="その他">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>詳細</Label>
                      <Textarea
                        placeholder="具体的な理由や補足情報..."
                        value={rejectionDetail}
                        onChange={(e) => setRejectionDetail(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleSaveRejection}
                      disabled={isSavingRejection || !rejectionCategory}
                    >
                      {isSavingRejection ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        '断り理由を保存'
                      )}
                    </Button>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>メモ</Label>
                  <Textarea
                    placeholder="通話内容や次回アクションをメモ..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                  />
                </div>

                {/* Call Info */}
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    通話時間: {formatDuration(callDuration)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    架電日時: {new Date().toLocaleString('ja-JP')}
                  </div>
                </div>

                {/* Save Button - with confirmation (S1/O3) */}
                <Button
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg"
                  onClick={handleSaveResultClick}
                  disabled={isSaving || !callResult || isEditing}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      結果を保存
                    </>
                  )}
                </Button>

                {/* Edit Button (W3) */}
                {saved && !isEditing && (
                  <Button
                    variant="outline"
                    className="w-full h-10"
                    onClick={handleEditResult}
                  >
                    編集
                  </Button>
                )}

                {/* Edit Form (W3) */}
                {isEditing && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="space-y-2">
                      <Label>結果（編集）</Label>
                      <Select
                        value={editCallResult}
                        onValueChange={(value) => setEditCallResult(value as CallResult)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="結果を選択..." />
                        </SelectTrigger>
                        <SelectContent>
                          {resultOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded ${option.color} text-white`}>
                                  {option.icon}
                                </div>
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>メモ（編集）</Label>
                      <Textarea
                        placeholder="通話内容や次回アクションをメモ..."
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            更新中...
                          </>
                        ) : (
                          '更新'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                )}

                {/* Feature 1: Quality Score Button */}
                {saved && !isEditing && (
                  <Button
                    variant="outline"
                    className="w-full h-10"
                    onClick={handleRequestQualityScore}
                    disabled={isScoring}
                  >
                    {isScoring ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        採点中...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        品質スコア
                      </>
                    )}
                  </Button>
                )}

                {/* Next Company Button (S1 - always show when saved, even on error) */}
                {saved && !isEditing && (
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={handleNextCompany}
                  >
                    次の企業へ
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </Card>

            {/* Feature 1: Quality Score Card */}
            {qualityScore && saved && (
              <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-purple-900 dark:text-purple-100">
                      <TrendingUp className="h-5 w-5" />
                      品質スコア
                    </h3>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {qualityScore.total_score.toFixed(1)}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="space-y-3">
                    {[
                      { label: '挨拶', value: qualityScore.greeting_score },
                      { label: 'ヒアリング', value: qualityScore.hearing_score },
                      { label: '提案', value: qualityScore.proposal_score },
                      { label: 'クロージング', value: qualityScore.closing_score },
                      { label: '話速', value: qualityScore.speech_pace_score },
                      { label: 'トーン', value: qualityScore.tone_score },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {item.label}
                          </span>
                          <span className="text-purple-700 dark:text-purple-300 font-semibold">
                            {item.value}/100
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${item.value}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Positive Points */}
                  {qualityScore.positive_points.length > 0 && (
                    <div className="pt-3 border-t border-purple-200 dark:border-purple-700 space-y-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        良い点:
                      </p>
                      <ul className="space-y-1">
                        {qualityScore.positive_points.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                          >
                            <span className="text-purple-500 mt-1">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvement Points */}
                  {qualityScore.improvement_points.length > 0 && (
                    <div className="pt-3 border-t border-purple-200 dark:border-purple-700 space-y-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        改善提案:
                      </p>
                      <ul className="space-y-1">
                        {qualityScore.improvement_points.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                          >
                            <span className="text-blue-500 mt-1">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Feature 3: AI Suggestions Panel */}
            <Card className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-cyan-200 dark:border-cyan-800">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-cyan-900 dark:text-cyan-100">
                    <Lightbulb className="h-5 w-5" />
                    AIリアルタイムサジェスト
                  </h3>
                  {callResult && !isOnCall && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateAiSuggestions}
                      disabled={isGeneratingSuggestions}
                      className="h-8"
                    >
                      {isGeneratingSuggestions ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {isOnCall && !callResult ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg">
                      <p className="text-sm text-cyan-900 dark:text-cyan-200 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        通話中のサジェスト
                      </p>
                    </div>
                    <ul className="space-y-2">
                      <li className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-500 mt-0.5">•</span>
                        相手の課題をしっかり聞き出す
                      </li>
                      <li className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-500 mt-0.5">•</span>
                        自社サービスとの接点を探す
                      </li>
                      <li className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-500 mt-0.5">•</span>
                        アポイントを取ることが目標
                      </li>
                    </ul>
                  </div>
                ) : aiSuggestions.length > 0 ? (
                  <ul className="space-y-2">
                    {aiSuggestions.map((suggestion, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                      >
                        <span className="text-cyan-500 mt-0.5">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                    <p className="text-sm">架電結果を選択してサジェストを表示</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Tips */}
            <Card className="p-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-3">
                💡 架電のコツ
              </h3>
              <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <li>• 最初の10秒で興味を引く</li>
                <li>• 相手の課題に寄り添う</li>
                <li>• 具体的な数字で説得力を</li>
                <li>• 次のアクションを明確に</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Confirmation Dialog (S1/O3) */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-6 max-w-md">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-bold">確認</h3>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  通話結果を「<span className="font-semibold">{callResult}</span>」として保存しますか？
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowConfirmDialog(false)
                      setPendingSave(false)
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleConfirmSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Appointment Creation Form (for アポ獲得) */}
        {showAppointmentForm && company && user && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-6 max-w-md">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-bold">アポイント作成</h3>
                </div>
                <p className="text-sm text-slate-600">
                  {company.name} とのアポイント詳細を入力してください
                </p>

                {/* 日付 */}
                <div className="space-y-2">
                  <Label htmlFor="apt-date">日付</Label>
                  <input
                    id="apt-date"
                    type="date"
                    value={appointmentFormData.appointment_date}
                    onChange={(e) => setAppointmentFormData({ ...appointmentFormData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 時間 */}
                <div className="space-y-2">
                  <Label htmlFor="apt-time">時間</Label>
                  <input
                    id="apt-time"
                    type="time"
                    value={appointmentFormData.appointment_time}
                    onChange={(e) => setAppointmentFormData({ ...appointmentFormData, appointment_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAppointmentForm(false)}
                  >
                    スキップ
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleCreateAppointmentFromCall}
                    disabled={isCreatingAppointment}
                  >
                    {isCreatingAppointment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        作成中...
                      </>
                    ) : (
                      '作成'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Force End Call Button (W7) - shown when on call and stuck */}
        {isOnCall && (
          <div className="fixed bottom-8 left-8 z-40">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg h-12"
              onClick={handleForceEndCall}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              通話を強制終了
            </Button>
          </div>
        )}

        {/* Whisper Panel - Floating */}
        {isOnCall && whisperMessages.length > 0 && (
          <div className="fixed bottom-8 right-8 w-96 max-h-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col z-40">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Volume2 className="h-5 w-5 text-white" />
                  {hasNewWhisper && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                <h3 className="font-bold text-white text-sm">ウィスパー</h3>
              </div>
              {whisperMessages.some((msg) => !msg.is_read) && (
                <Badge className="bg-red-400 text-white text-xs">
                  {whisperMessages.filter((msg) => !msg.is_read).length}
                </Badge>
              )}
            </div>

            {/* Messages */}
            <div className="overflow-y-auto flex-1 space-y-2 p-4">
              {whisperMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm cursor-pointer transition-all ${
                    msg.is_read
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700'
                  }`}
                  onClick={() => !msg.is_read && markWhisperAsRead(msg.id)}
                >
                  <div className="font-semibold text-xs text-cyan-600 dark:text-cyan-400 mb-1">
                    {msg.from_name}
                  </div>
                  <div className="line-clamp-3">{msg.message}</div>
                  <div className="text-xs mt-2 opacity-60">
                    {new Date(msg.sent_at).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
