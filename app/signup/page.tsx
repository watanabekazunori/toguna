'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Phone, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createOperator } from '@/lib/supabase-api'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // バリデーション
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return '名前を入力してください'
    }
    if (!email.trim()) {
      return 'メールアドレスを入力してください'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'メールアドレスの形式が正しくありません'
    }
    if (!password) {
      return 'パスワードを入力してください'
    }
    if (password.length < 8) {
      return 'パスワードは8文字以上である必要があります'
    }
    return null
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // バリデーション
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Supabase Authでユーザーを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('このメールアドレスは既に登録されています')
        } else {
          setError(authError.message)
        }
        setIsLoading(false)
        return
      }

      // Step 2: Operatorレコードを作成
      // 管理者トークンを確認してロールを決定
      const adminSetupToken = process.env.NEXT_PUBLIC_ADMIN_SETUP_TOKEN || 'toguna-admin-setup-2026'
      const role = adminToken === adminSetupToken ? 'director' : 'operator'

      const operatorResult = await createOperator({
        name,
        email,
        phone: phone || undefined,
        status: 'active',
        role,
      })

      if (!operatorResult) {
        setError('オペレーター情報の登録に失敗しました')
        setIsLoading(false)
        return
      }

      setSuccess(true)

      // 3秒後にログインページへリダイレクト
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err) {
      console.error('Signup error:', err)
      setError('サインアップ中にエラーが発生しました')
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border-0 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              サインアップ完了
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              アカウントが作成されました。
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              ログインページにリダイレクトしています...
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border-0">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl shadow-lg shadow-blue-500/30">
              <Phone className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
            TOGUNA
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            営業支援プラットフォーム
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              お名前
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="山田太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              電話番号（オプション）
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="09012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              8文字以上で設定してください
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminToken" className="text-sm font-medium">
              管理者トークン（オプション）
            </Label>
            <Input
              id="adminToken"
              type="password"
              placeholder="管理者の場合のみ入力"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              管理者として登録する場合のみ入力してください
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                サインアップ中...
              </>
            ) : (
              'サインアップ'
            )}
          </Button>
        </form>

        {/* Links */}
        <div className="text-center text-sm border-t border-slate-200 dark:border-slate-700 pt-4">
          <span className="text-slate-500 dark:text-slate-400">既にアカウントをお持ちの方は</span>
          <br />
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            こちらからログイン
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 TOGUNA. All rights reserved.</p>
        </div>
      </Card>
    </div>
  )
}
