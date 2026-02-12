'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  getDocumentSends,
  getDocumentTracking,
  type DocumentSend,
  type DocumentTrackingEvent,
} from '@/lib/nurturing-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { sendDocumentEmail } from '@/lib/email-service'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  FileIcon,
  Eye,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Eye as EyeIcon,
  MousePointerClick,
  Download,
  Share2,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

const channelConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  email: { label: 'メール', icon: <Mail className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
  dm: {
    label: 'DM',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'bg-green-100 text-green-800',
  },
  letter: {
    label: '手紙',
    icon: <FileIcon className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-800',
  },
  fax: { label: 'FAX', icon: <FileIcon className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'ドラフト', color: 'bg-gray-100 text-gray-800' },
  sent: { label: '送信済み', color: 'bg-blue-100 text-blue-800' },
  delivered: { label: '配信済み', color: 'bg-green-100 text-green-800' },
  bounced: { label: 'バウンス', color: 'bg-red-100 text-red-800' },
  failed: { label: '失敗', color: 'bg-red-100 text-red-800' },
}

const trackingEventConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  open: { label: '開封', icon: <EyeIcon className="w-3 h-3" /> },
  page_view: { label: 'ページ表示', icon: <Globe className="w-3 h-3" /> },
  link_click: { label: 'リンク クリック', icon: <MousePointerClick className="w-3 h-3" /> },
  download: { label: 'ダウンロード', icon: <Download className="w-3 h-3" /> },
  forward: { label: '転送', icon: <Share2 className="w-3 h-3" /> },
}

type SendWithCompany = DocumentSend & {
  company?: { id: string; name: string }
  trackingStats?: {
    opens: number
    clicks: number
    lastOpened?: string
    daysSinceSent: number
  }
}

export default function DocumentSendsPage() {
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // 状態管理
  const [sends, setSends] = useState<SendWithCompany[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSendId, setSelectedSendId] = useState<string | null>(null)
  const [trackingEvents, setTrackingEvents] = useState<DocumentTrackingEvent[]>([])
  const [isLoadingTracking, setIsLoadingTracking] = useState(false)
  const [allTrackingData, setAllTrackingData] = useState<Map<string, DocumentTrackingEvent[]>>(new Map())

  // フィルター用日付
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // 認証確認
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isDirector) return

      setIsLoading(true)
      try {
        const [projectsData, sendsData] = await Promise.all([getProjects(), getDocumentSends()])

        setProjects(projectsData)

        // 各送付情報にcompany_nameとトラッキング情報を取得
        const sendsWithCompany: SendWithCompany[] = await Promise.all(
          sendsData.map(async (send) => {
            const { data: company } = await supabase
              .from('companies')
              .select('id, name')
              .eq('id', send.company_id)
              .single()

            // トラッキング情報を取得
            const trackingEventsForSend = await getDocumentTracking(send.id)
            const opens = trackingEventsForSend.filter((e) => e.event_type === 'open').length
            const clicks = trackingEventsForSend.filter((e) => e.event_type === 'link_click').length
            const lastOpened = trackingEventsForSend
              .filter((e) => e.event_type === 'open')
              .sort((a, b) => new Date(b.tracked_at).getTime() - new Date(a.tracked_at).getTime())[0]?.tracked_at

            // 送信日からの経過日数を計算
            const sentDate = new Date(send.sent_at)
            const now = new Date()
            const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))

            return {
              ...send,
              company: company || undefined,
              trackingStats: {
                opens,
                clicks,
                lastOpened,
                daysSinceSent,
              },
            }
          })
        )

        setSends(sendsWithCompany)

        // トラッキングデータをマップに保存（詳細表示用）
        const trackingMap = new Map<string, DocumentTrackingEvent[]>()
        for (const send of sendsData) {
          const events = await getDocumentTracking(send.id)
          trackingMap.set(send.id, events)
        }
        setAllTrackingData(trackingMap)
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
  }, [isDirector, supabase])

  // トラッキングイベント取得
  useEffect(() => {
    const fetchTracking = async () => {
      if (!selectedSendId) return

      setIsLoadingTracking(true)
      try {
        const events = await getDocumentTracking(selectedSendId)
        setTrackingEvents(events)
      } catch (error) {
        console.error('Failed to fetch tracking events:', error)
        toast.error('トラッキング情報の読み込みに失敗しました')
      } finally {
        setIsLoadingTracking(false)
      }
    }

    if (selectedSendId) {
      fetchTracking()
    }
  }, [selectedSendId])

  // フィルター処理
  const filteredSends = sends.filter((send) => {
    // プロジェクトフィルター
    if (selectedProject !== 'all') {
      const project = projects.find((p) => p.id === selectedProject)
      // 注: company_idとproject_idのマッピングが必要な場合、ここで追加
    }

    // チャネルフィルター
    if (selectedChannel !== 'all' && send.channel !== selectedChannel) {
      return false
    }

    // ステータスフィルター
    if (selectedStatus !== 'all' && send.status !== selectedStatus) {
      return false
    }

    // 日付フィルター
    if (dateFrom) {
      const sendDate = new Date(send.sent_at)
      const filterDate = new Date(dateFrom)
      if (sendDate < filterDate) return false
    }

    if (dateTo) {
      const sendDate = new Date(send.sent_at)
      const filterDate = new Date(dateTo)
      filterDate.setHours(23, 59, 59, 999)
      if (sendDate > filterDate) return false
    }

    return true
  })

  // 統計計算
  const totalSends = filteredSends.length
  const openCount = trackingEvents.filter((e) => e.event_type === 'open').length
  const clickCount = trackingEvents.filter((e) => e.event_type === 'link_click').length
  const bounceCount = filteredSends.filter((s) => s.status === 'bounced').length

  const openRate = totalSends > 0 ? Math.round((openCount / totalSends) * 100) : 0
  const clickRate = totalSends > 0 ? Math.round((clickCount / totalSends) * 100) : 0
  const bounceRate = totalSends > 0 ? Math.round((bounceCount / totalSends) * 100) : 0

  // フォーマット関数
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ドキュメント送信時にメール送信を試みる
  const handleSendDocument = async (send: SendWithCompany) => {
    try {
      const company = send.company
      if (!company) {
        toast.error('企業情報が見つかりません')
        return
      }

      // メール送信を試みる
      const result = await sendDocumentEmail({
        to: company.name, // 注: 実際にはメールアドレスが必要ですが、ここでは企業情報を使用
        companyName: company.name,
        subject: send.subject || 'ドキュメント送信',
        body: `${company.name} 様宛にドキュメントをお送りします。`,
        documentUrl: (send as Record<string, unknown>).document_url as string || undefined,
      })

      if (result.success) {
        toast.success(`メール送信に成功しました (ID: ${result.messageId})`)
      } else {
        toast.error(`メール送信に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error('Document send error:', error)
      toast.error('ドキュメント送信処理に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <FileText className="w-8 h-8 text-blue-600" />
                送信履歴 & トラッキング
              </h1>
              <p className="text-gray-500 mt-1">ドキュメント送付の履歴と開封・クリック追跡</p>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">総送付数</p>
                <p className="text-3xl font-bold text-blue-600">{totalSends}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">開封率</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-green-600">{openRate}%</p>
                  <p className="text-xs text-gray-500">({openCount})</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">クリック率</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-purple-600">{clickRate}%</p>
                  <p className="text-xs text-gray-500">({clickCount})</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">バウンス率</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-red-600">{bounceRate}%</p>
                  <p className="text-xs text-gray-500">({bounceCount})</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">配信済み</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {filteredSends.filter((s) => s.status === 'delivered').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* フィルター */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">チャネル</label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="email">メール</SelectItem>
                    <SelectItem value="dm">DM</SelectItem>
                    <SelectItem value="letter">手紙</SelectItem>
                    <SelectItem value="fax">FAX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">ステータス</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="draft">ドラフト</SelectItem>
                    <SelectItem value="sent">送信済み</SelectItem>
                    <SelectItem value="delivered">配信済み</SelectItem>
                    <SelectItem value="bounced">バウンス</SelectItem>
                    <SelectItem value="failed">失敗</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">開始日</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedProject('all')
                    setSelectedChannel('all')
                    setSelectedStatus('all')
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  リセット
                </Button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <label className="text-sm font-medium text-gray-700 block mb-2">終了日</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* 送付一覧 */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : filteredSends.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">送付履歴がありません</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>企業名</TableHead>
                      <TableHead>テンプレート</TableHead>
                      <TableHead>チャネル</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>送信日時</TableHead>
                      <TableHead>開封状況</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSends.map((send) => {
                      const statusCfg = statusConfig[send.status]
                      const channelCfg = channelConfig[send.channel]
                      const trackingCount = allTrackingData.get(send.id)?.length || 0

                      // トラッキング状態を判定
                      const isOpened = (send.trackingStats?.opens || 0) > 0
                      const daysSinceSent = send.trackingStats?.daysSinceSent || 0
                      const isOverdue = daysSinceSent > 3 && !isOpened

                      return (
                        <TableRow
                          key={send.id}
                          className={selectedSendId === send.id ? 'bg-blue-50' : ''}
                        >
                          <TableCell className="font-medium">
                            {send.company?.name || '不明'}
                          </TableCell>
                          <TableCell className="text-sm">{send.subject || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge className={`${channelCfg.color} border-0 flex items-center gap-1 w-fit`}>
                              {channelCfg.icon}
                              {channelCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusCfg.color} border-0`}>
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(send.sent_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              {isOpened ? (
                                <Badge className="bg-green-100 text-green-800 border-0 flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  開封済み
                                </Badge>
                              ) : isOverdue ? (
                                <Badge className="bg-orange-100 text-orange-800 border-0 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  未開封
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50">
                                  待機中
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={selectedSendId === send.id ? 'default' : 'outline'}
                              onClick={() =>
                                setSelectedSendId(selectedSendId === send.id ? null : send.id)
                              }
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              詳細
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* トラッキング詳細 */}
        {selectedSendId && (
          <Card>
            <CardHeader>
              <CardTitle>トラッキング詳細</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTracking ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : trackingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">トラッキングイベントはありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trackingEvents.map((event, index) => {
                    const eventCfg = trackingEventConfig[event.event_type]
                    return (
                      <div key={event.id} className="flex items-start gap-3">
                        {/* タイムライン */}
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            {eventCfg.icon}
                          </div>
                          {index < trackingEvents.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-200 my-1" />
                          )}
                        </div>

                        {/* イベント情報 */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{eventCfg.label}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(event.tracked_at).toLocaleTimeString('ja-JP')}
                            </span>
                          </div>
                          {event.page_number && (
                            <p className="text-xs text-gray-600">
                              ページ: {event.page_number}
                            </p>
                          )}
                          {event.duration_seconds && (
                            <p className="text-xs text-gray-600">
                               時間: {event.duration_seconds}秒
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
