'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createOperator } from '@/lib/supabase-api'

type OperatorRole = 'operator' | 'director'

export default function NewOperatorPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<OperatorRole>('operator')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // バリデーション
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return 'オペレーター名を入力してください'
    }
    if (!email.trim()) {
      return 'メールアドレスを入力してください'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'メールアドレスの形式が正しくありません'
    }
    if (!role) {
      return 'ロールを選択してください'
    }
    return null
  }

  const handleCreateOperator = async (e: React.FormEvent) => {
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
      // Operatorレコードを作成
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

      // 2秒後にオペレーター管理ページへリダイレクト
      setTimeout(() => {
        router.push('/director/operators')
      }, 2000)
    } catch (err) {
      console.error('Create operator error:', err)
      setError('オペレーター作成中にエラーが発生しました')
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
            <Link href="/director">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
          </div>
        </header>

        <main className="max-w-[1920px] mx-auto px-8 py-8 flex items-center justify-center min-h-[calc(100vh-64px)]">
          <Card className="w-full max-w-md p-8 space-y-6 text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                登録完了
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                新しいオペレーターが登録されました。
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                {email}には、サインアップページから登録するよう案内してください。
              </p>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/director">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              TOGUNA
            </h1>
          </Link>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/director/operators">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            新規オペレーター追加
          </h2>
        </div>

        {/* Form Card */}
        <Card className="w-full max-w-2xl p-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-6">
          <form onSubmit={handleCreateOperator} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  オペレーター名
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="山田太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="operator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
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
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium">
                  ロール
                </Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as OperatorRole)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">オペレーター</SelectItem>
                    <SelectItem value="director">ディレクター</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                登録後、オペレーターに対して /signup ページからのアカウント作成を案内してください。メールアドレスを同じものを使用して登録する必要があります。
              </AlertDescription>
            </Alert>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    追加中...
                  </>
                ) : (
                  'オペレーターを追加'
                )}
              </Button>
              <Link href="/director/operators" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </main>
    </div>
  )
}
