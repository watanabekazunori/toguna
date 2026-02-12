'use client'

import { useState, useEffect } from 'react'
import { getSalesFloorStatus, type SalesFloorEntry } from '@/lib/projects-api'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MessageSquare, Phone, Users, Activity, Loader } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'

const supabase = createSupabaseClient()

type MessageType = 'encouragement' | 'instruction' | 'warning'

const quickTemplates = {
  encouragement: '良い調子です！',
  instruction: 'スクリプト通りに進めて',
  warning: 'ヒアリングを深めて',
}

interface DialogState {
  operatorId: string | null
  projectId: string | null
  messageType: MessageType
}

export default function SalesFloorPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [entries, setEntries] = useState<SalesFloorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>({
    operatorId: null,
    projectId: null,
    messageType: 'encouragement',
  })
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    loadData()
    const refreshInterval = setInterval(loadData, 10000)
    return () => clearInterval(refreshInterval)
  }, [])

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('sales_floor_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_floor_status' },
        (payload) => {
          console.log('Realtime update:', payload)
          loadData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadData() {
    setRefreshing(true)
    try {
      const data = await getSalesFloorStatus()
      setEntries(data)
    } catch (error) {
      console.error('Failed to load sales floor status:', error)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!dialogState.operatorId || !messageText.trim()) return

    setSendingMessage(true)
    try {
      const { error } = await supabase.from('whisper_messages').insert({
        operator_id: dialogState.operatorId,
        project_id: dialogState.projectId,
        message: messageText,
        message_type: dialogState.messageType,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      toast({
        title: 'メッセージを送信しました',
        description: 'オペレーターがメッセージを受け取りました',
        variant: 'default',
      })

      setDialogOpen(false)
      setMessageText('')
      setDialogState({
        operatorId: null,
        projectId: null,
        messageType: 'encouragement',
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: 'エラー',
        description: 'メッセージの送信に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setSendingMessage(false)
    }
  }

  function handleQuickTemplate(template: string) {
    setMessageText(template)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'calling':
      case 'on_call':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'idle':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      case 'break':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'offline':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'calling':
      case 'on_call':
        return '架電中'
      case 'idle':
        return '待機'
      case 'break':
        return '休憩'
      case 'offline':
        return '離席'
      default:
        return status
    }
  }

  const stats = {
    total: entries.length,
    calling: entries.filter(
      (e) => e.status === 'calling' || e.status === 'on_call'
    ).length,
    idle: entries.filter((e) => e.status === 'idle').length,
    break: entries.filter((e) => e.status === 'break').length,
  }

  const callDuration = (startTime: string | undefined) => {
    if (!startTime) return '-'
    const start = new Date(startTime)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - start.getTime()) / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}分${secs}秒`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">セールスフロア</h1>
            <p className="text-gray-500">リアルタイム稼働状況モニタリング</p>
          </div>
          <Button onClick={loadData} disabled={refreshing} variant="outline">
            {refreshing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              '更新'
            )}
          </Button>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">総オペレーター数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Phone className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.calling}</p>
              <p className="text-xs text-gray-500">架電中</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Activity className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.idle}</p>
              <p className="text-xs text-gray-500">待機中</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <MessageSquare className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.break}</p>
              <p className="text-xs text-gray-500">休憩中</p>
            </CardContent>
          </Card>
        </div>

        {/* オペレーターグリッド */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">オペレーターがオンラインにいません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                className={`overflow-hidden transition-all ${
                  entry.status === 'calling' || entry.status === 'on_call'
                    ? 'border-2 border-green-400 shadow-lg'
                    : ''
                }`}
              >
                <CardHeader className={`pb-3 ${getStatusColor(entry.status).replace(
                  'text-',
                  'bg-'
                )}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {entry.operator?.name || 'オペレーター'}
                      </h3>
                    </div>
                    <Badge className={getStatusColor(entry.status)}>
                      {getStatusLabel(entry.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-4">
                  {/* プロジェクト */}
                  <div className="text-sm">
                    <p className="text-gray-500 text-xs">プロジェクト</p>
                    <p className="font-medium text-gray-900">
                      {entry.current_project_id || '未割り当て'}
                    </p>
                  </div>

                  {/* 現在の架電先 */}
                  <div className="text-sm">
                    <p className="text-gray-500 text-xs">架電先企業</p>
                    <p className="font-medium text-gray-900">
                      {entry.current_company_id || '-'}
                    </p>
                  </div>

                  {/* 通話時間 */}
                  {(entry.status === 'calling' || entry.status === 'on_call') && (
                    <div className="text-sm">
                      <p className="text-gray-500 text-xs">通話時間</p>
                      <p className="font-mono font-semibold text-green-600">
                        {callDuration(entry.call_start_time)}
                      </p>
                    </div>
                  )}

                  {/* 本日の実績 */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">架電数</p>
                      <p className="text-lg font-bold text-blue-600">
                        {entry.calls_today}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">アポ数</p>
                      <p className="text-lg font-bold text-green-600">
                        {entry.appointments_today}
                      </p>
                    </div>
                  </div>

                  {/* ウィスパーボタン */}
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() =>
                          setDialogState({
                            operatorId: entry.operator_id,
                            projectId: entry.current_project_id || null,
                            messageType: 'encouragement',
                          })
                        }
                      >
                        <MessageSquare className="w-4 h-4" />
                        ウィスパー送信
                      </Button>
                    </DialogTrigger>
                    {dialogState.operatorId === entry.operator_id && (
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>ウィスパーメッセージ</DialogTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            {entry.operator?.name} へメッセージを送信
                          </p>
                        </DialogHeader>

                        <div className="space-y-4">
                          {/* メッセージタイプ選択 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              メッセージタイプ
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="messageType"
                                  value="encouragement"
                                  checked={dialogState.messageType === 'encouragement'}
                                  onChange={(e) =>
                                    setDialogState({
                                      ...dialogState,
                                      messageType: e.target.value as MessageType,
                                    })
                                  }
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">激励</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="messageType"
                                  value="instruction"
                                  checked={dialogState.messageType === 'instruction'}
                                  onChange={(e) =>
                                    setDialogState({
                                      ...dialogState,
                                      messageType: e.target.value as MessageType,
                                    })
                                  }
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">指示</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="messageType"
                                  value="warning"
                                  checked={dialogState.messageType === 'warning'}
                                  onChange={(e) =>
                                    setDialogState({
                                      ...dialogState,
                                      messageType: e.target.value as MessageType,
                                    })
                                  }
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">注意</span>
                              </label>
                            </div>
                          </div>

                          {/* クイックテンプレート */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              クイックテンプレート
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                              {Object.entries(quickTemplates).map(([type, template]) => (
                                <Button
                                  key={type}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickTemplate(template)}
                                  className="justify-start text-left"
                                >
                                  {template}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* メッセージ入力 */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              メッセージ
                            </label>
                            <textarea
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              placeholder="メッセージを入力してください..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={4}
                            />
                          </div>

                          {/* 送信ボタン */}
                          <Button
                            onClick={handleSendMessage}
                            disabled={!messageText.trim() || sendingMessage}
                            className="w-full"
                          >
                            {sendingMessage ? '送信中...' : '送信'}
                          </Button>
                        </div>
                      </DialogContent>
                    )}
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
