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
  checkZoomConfiguration,
  initiateZoomCall,
  endZoomCall,
  getZoomCallStatus,
  getZoomPhoneUsers,
} from '@/app/actions/zoom'
import type { ZoomCallSession, ZoomUser } from '@/lib/zoom'
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
} from 'lucide-react'

type CallResult = '接続' | 'アポ獲得' | '不在' | '担当者不在' | '断り' | 'NG' | ''

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

  // AI Script
  const [script, setScript] = useState<string | null>(null)
  const [scriptTips, setScriptTips] = useState<string[]>([])
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)

  // Zoom Phone integration
  const [zoomConfigured, setZoomConfigured] = useState(false)
  const [zoomUsers, setZoomUsers] = useState<ZoomUser[]>([])
  const [selectedZoomUser, setSelectedZoomUser] = useState<string>('')
  const [zoomCallSession, setZoomCallSession] = useState<ZoomCallSession | null>(null)
  const [isZoomCalling, setIsZoomCalling] = useState(false)
  const [zoomError, setZoomError] = useState<string | null>(null)

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
    }
    checkZoom()
  }, [])

  // Call timer
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isOnCall) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isOnCall])

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
    } else {
      setIsOnCall(true)
      setCallDuration(0)
      setSaved(false)
    }
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

  // Save call result
  const handleSaveResult = async () => {
    if (!company || !client || !user || !callResult) {
      setError('架電結果を選択してください')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await createCallLog({
        company_id: company.id,
        client_id: client.id,
        operator_id: user.id,
        result: callResult,
        duration: callDuration,
        notes,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
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
                {zoomConfigured && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Video className="h-5 w-5" />
                      <span className="font-medium">Zoom Phone連携</span>
                      <Badge className="bg-green-500 text-white text-xs">接続済み</Badge>
                    </div>

                    {zoomUsers.length > 0 && (
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
                    <AlertDescription>{error}</AlertDescription>
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

                {/* Save Button */}
                <Button
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg"
                  onClick={handleSaveResult}
                  disabled={isSaving || !callResult}
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

                {/* Next Company Button */}
                {saved && (
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
      </main>
    </div>
  )
}
