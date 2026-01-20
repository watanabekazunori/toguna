'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Bell,
  Palette,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, signOut, isLoading, isDirector } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const settingsSections = [
    {
      title: 'アカウント情報',
      icon: <User className="h-5 w-5" />,
      description: '名前、メールアドレスの確認',
    },
    {
      title: '通知設定',
      icon: <Bell className="h-5 w-5" />,
      description: '通知の受信設定を管理',
    },
    {
      title: 'テーマ設定',
      icon: <Palette className="h-5 w-5" />,
      description: '表示テーマの変更',
    },
    {
      title: 'ヘルプ',
      icon: <HelpCircle className="h-5 w-5" />,
      description: 'よくある質問・サポート',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">設定</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8 space-y-8">
        {/* Profile Section */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className={`text-xl ${isDirector ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'} text-white`}>
                {user.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Shield className="h-4 w-4 text-slate-500" />
                <Badge variant={isDirector ? 'default' : 'secondary'}>
                  {isDirector ? 'ディレクター' : 'オペレーター'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Settings Sections */}
        <div className="space-y-4">
          {settingsSections.map((section, index) => (
            <Card
              key={index}
              className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-lg transition-all cursor-pointer"
              onClick={() => alert(`${section.title}は今後実装予定です`)}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  {section.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{section.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Sign Out */}
        <Card className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </Card>
      </main>
    </div>
  )
}
