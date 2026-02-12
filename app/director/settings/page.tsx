'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  ArrowLeft,
  Bell,
  LogOut,
  Building2,
  Phone,
  Key,
  Palette,
  Save,
  Loader2,
  CheckCircle2,
  Video,
  RefreshCw,
  Users,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { checkZoomConfiguration, getZoomPhoneUsers } from '@/app/actions/zoom'
import type { ZoomUser } from '@/lib/zoom'

type SettingsData = {
  companyName: string
  adminEmail: string
  notifyAppointment: boolean
  notifyDailyReport: boolean
  notifyWeeklyReport: boolean
  autoScoring: boolean
  defaultCallTarget: number
  workStartTime: string
  workEndTime: string
  theme: string
  language: string
}

export default function SettingsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Zoom設定状態
  const [zoomStatus, setZoomStatus] = useState<{
    checking: boolean
    configured: boolean
    error?: string
  }>({ checking: true, configured: false })
  const [zoomUsers, setZoomUsers] = useState<ZoomUser[]>([])
  const [loadingZoomUsers, setLoadingZoomUsers] = useState(false)

  // 設定状態
  const [settings, setSettings] = useState<SettingsData>({
    companyName: 'TOGUNA',
    adminEmail: 'admin@toguna.com',
    notifyAppointment: true,
    notifyDailyReport: true,
    notifyWeeklyReport: false,
    autoScoring: true,
    defaultCallTarget: 60,
    workStartTime: '09:00',
    workEndTime: '18:00',
    theme: 'system',
    language: 'ja',
  })

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // Load settings from database on mount
  useEffect(() => {
    if (user?.id) {
      loadSettings()
    }
  }, [user?.id])

  // Zoom設定チェック
  useEffect(() => {
    const checkZoom = async () => {
      const result = await checkZoomConfiguration()
      setZoomStatus({
        checking: false,
        configured: result.configured,
        error: result.error,
      })

      // 接続済みの場合はユーザー一覧を取得
      if (result.configured) {
        loadZoomUsers()
      }
    }
    checkZoom()
  }, [])

  const loadZoomUsers = async () => {
    setLoadingZoomUsers(true)
    const result = await getZoomPhoneUsers()
    if (result.success && result.users) {
      setZoomUsers(result.users)
    }
    setLoadingZoomUsers(false)
  }

  const handleTestZoomConnection = async () => {
    setZoomStatus({ ...zoomStatus, checking: true })
    const result = await checkZoomConfiguration()
    setZoomStatus({
      checking: false,
      configured: result.configured,
      error: result.error,
    })

    if (result.configured) {
      loadZoomUsers()
    }
  }

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('settings_key, settings_value')
        .eq('user_id', user?.id)

      if (fetchError) throw fetchError

      if (data && data.length > 0) {
        const loadedSettings: Partial<SettingsData> = {}
        data.forEach((item) => {
          if (typeof item.settings_value === 'object' && item.settings_value !== null) {
            Object.assign(loadedSettings, item.settings_value)
          }
        })

        if (Object.keys(loadedSettings).length > 0) {
          setSettings((prev) => ({ ...prev, ...loadedSettings }))
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('設定の読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user?.id)

      if (deleteError) throw deleteError

      const { error: insertError } = await supabase
        .from('user_settings')
        .insert([
          {
            user_id: user?.id,
            settings_key: 'app_settings',
            settings_value: settings,
            updated_at: new Date().toISOString(),
          },
        ])

      if (insertError) throw insertError

      setIsSaving(false)
      setSaved(true)

      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('設定の保存に失敗しました')
      setIsSaving(false)
    }
  }

  if (authLoading || !isDirector || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
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

      <main className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                エラー
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
        )}

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
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  設定
                </h2>
                <p className="text-sm text-slate-500">
                  システム設定と環境設定
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                保存しました
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </div>

        {/* General Settings */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            一般設定
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">会社名</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) =>
                    setSettings({ ...settings, companyName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">管理者メールアドレス</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={settings.adminEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, adminEmail: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            通知設定
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">アポ獲得通知</p>
                <p className="text-sm text-slate-500">
                  オペレーターがアポを獲得した際に通知
                </p>
              </div>
              <Switch
                checked={settings.notifyAppointment}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyAppointment: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">日次レポート</p>
                <p className="text-sm text-slate-500">
                  毎日18時に実績サマリーを送信
                </p>
              </div>
              <Switch
                checked={settings.notifyDailyReport}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyDailyReport: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">週次レポート</p>
                <p className="text-sm text-slate-500">
                  毎週金曜日に週間サマリーを送信
                </p>
              </div>
              <Switch
                checked={settings.notifyWeeklyReport}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyWeeklyReport: checked })
                }
              />
            </div>
          </div>
        </Card>

        {/* Call Settings */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            架電設定
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AIスコアリング自動実行</p>
                <p className="text-sm text-slate-500">
                  CSVアップロード時に自動でAIスコアリングを実行
                </p>
              </div>
              <Switch
                checked={settings.autoScoring}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, autoScoring: checked })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultCallTarget">デフォルト架電目標</Label>
                <Input
                  id="defaultCallTarget"
                  type="number"
                  value={settings.defaultCallTarget}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultCallTarget: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workStartTime">業務開始時間</Label>
                <Input
                  id="workStartTime"
                  type="time"
                  value={settings.workStartTime}
                  onChange={(e) =>
                    setSettings({ ...settings, workStartTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workEndTime">業務終了時間</Label>
                <Input
                  id="workEndTime"
                  type="time"
                  value={settings.workEndTime}
                  onChange={(e) =>
                    setSettings({ ...settings, workEndTime: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Appearance Settings */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" />
            表示設定
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme">テーマ</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) => setSettings({ ...settings, theme: value })}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">システム設定に従う</SelectItem>
                  <SelectItem value="light">ライト</SelectItem>
                  <SelectItem value="dark">ダーク</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">言語</Label>
              <Select
                value={settings.language}
                onValueChange={(value) => setSettings({ ...settings, language: value })}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* API Settings */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            API連携
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">OpenAI API</p>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  接続済み
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                AIスコアリング・トークスクリプト生成に使用
              </p>
            </div>

            {/* Zoom Phone API */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-blue-500" />
                  <p className="font-medium">Zoom Phone API</p>
                </div>
                {zoomStatus.checking ? (
                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    確認中...
                  </Badge>
                ) : zoomStatus.configured ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    接続済み
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    未接続
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-3">
                Zoom Phoneを使用した自動架電機能
              </p>

              {zoomStatus.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {zoomStatus.error}
                  </p>
                </div>
              )}

              {zoomStatus.configured && (
                <div className="space-y-3">
                  {/* Zoom Users */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Phoneユーザー一覧
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadZoomUsers}
                        disabled={loadingZoomUsers}
                      >
                        <RefreshCw className={`h-4 w-4 ${loadingZoomUsers ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    {loadingZoomUsers ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : zoomUsers.length > 0 ? (
                      <div className="space-y-2">
                        {zoomUsers.map((zoomUser) => (
                          <div
                            key={zoomUser.id}
                            className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {zoomUser.display_name || zoomUser.email}
                              </p>
                              <p className="text-xs text-slate-500">
                                {zoomUser.phone_numbers?.[0]?.number || 'No phone number'}
                              </p>
                            </div>
                            <Badge
                              className={
                                zoomUser.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            >
                              {zoomUser.status === 'active' ? 'アクティブ' : zoomUser.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Phoneユーザーが見つかりません
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleTestZoomConnection}
                disabled={zoomStatus.checking}
              >
                {zoomStatus.checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    接続テスト中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    接続テスト
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <h3 className="font-bold text-lg mb-4 text-red-700 dark:text-red-400">
            危険な操作
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  全データをエクスポート
                </p>
                <p className="text-sm text-red-600/70 dark:text-red-400/70">
                  すべてのデータをCSV形式でエクスポート
                </p>
              </div>
              <Button variant="outline" className="border-red-300 text-red-700">
                エクスポート
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
