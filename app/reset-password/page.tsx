'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Phone, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          setIsAuthenticated(true)
        } else {
          // onAuthStateChangeでサインイン時を待つ
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              setIsAuthenticated(true)
              setCheckingAuth(false)
            }
          })

          // 30秒のタイムアウト
          const timeout = setTimeout(() => {
            setCheckingAuth(false)
            setError('パスワードリセットリンクが無効です。メールのリンクから再度お試しください。')
          }, 30000)

          return () => {
            clearTimeout(timeout)
            subscription?.unsubscribe()
          }
        }

        setCheckingAuth(false)
      } catch (err) {
        console.error('Auth check error:', err)
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [supabase])

  const validateForm = (): string | null => {
    if (!newPassword) {
      return '新しいパスワードを入力してください'
    }
    if (newPassword.length < 8) {
      return 'パスワードは8文字以上である必要があります'
    }
    if (!confirmPassword) {
      return '確認用パスワードを入力してください'
    }
    if (newPassword !== confirmPassword) {
      return 'パスワードが一致しません'
    }
    return null
  }

  const handleResetPassword = async (e: React.FormEvent) => {
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(updateError.message)
        setIsLoading(false)
        return
      }

      setSuccess(true)

      // 2秒後にログインページへリダイレクト
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      console.error('Password reset error:', err)
      setError('パスワードの更新中にエラーが発生しました')
      setIsLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border-0 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">確認中...</p>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border-0 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              リンクが無効です
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              パスワードリセットのリンクが無効または期限切れです。
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              もう一度パスワードリセットを申請してください。
            </p>
          </div>

          <Link href="/forgot-password">
            <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-300">
              パスワードリセットを申請
            </Button>
          </Link>

          <Link href="/login">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              ログインに戻る
            </Button>
          </Link>

          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            <p>© 2026 TOGUNA. All rights reserved.</p>
          </div>
        </Card>
      </div>
    )
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
              パスワード更新完了
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              パスワードが正常に更新されました。
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

        {/* Back Button */}
        <Link href="/login">
          <Button variant="ghost" className="w-full flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            ログインに戻る
          </Button>
        </Link>

        {/* Reset Form */}
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2 text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              新しいパスワードを設定
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              8文字以上の新しいパスワードを入力してください
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">
              新しいパスワード
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              パスワード（確認）
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中...
              </>
            ) : (
              'パスワードを更新'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 TOGUNA. All rights reserved.</p>
        </div>
      </Card>
    </div>
  )
}
