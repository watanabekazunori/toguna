'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { addClient, type CreateClientInput } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  LogOut,
  Bell,
  AlertCircle,
  CheckCircle2,
  User,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'

export default function NewClientPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState<CreateClientInput>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('クライアント名を入力してください')
      return false
    }
    if (!formData.contact_person?.trim()) {
      setError('担当者名を入力してください')
      return false
    }
    if (!formData.email?.trim()) {
      setError('メールアドレスを入力してください')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || '')) {
      setError('有効なメールアドレスを入力してください')
      return false
    }
    if (!formData.phone?.trim()) {
      setError('電話番号を入力してください')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setError(null)

    try {
      await addClient(formData)
      setSuccess(true)

      // 成功後、少し待ってから一覧画面へ遷移
      setTimeout(() => {
        router.replace('/director/clients')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

      <main className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link href="/director/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                新規クライアント登録
              </h2>
              <p className="text-sm text-slate-500">
                クライアント情報を入力してください
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              クライアントを登録しました。一覧画面に移動します...
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                クライアント名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="例: 株式会社ABC"
                disabled={isSubmitting || success}
                className="h-12"
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-2">
              <Label htmlFor="contact_person" className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                担当者名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact_person"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                placeholder="例: 山田 太郎"
                disabled={isSubmitting || success}
                className="h-12"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="例: yamada@example.com"
                disabled={isSubmitting || success}
                className="h-12"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-500" />
                電話番号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="例: 03-1234-5678"
                disabled={isSubmitting || success}
                className="h-12"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                住所
              </Label>
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="例: 東京都渋谷区..."
                disabled={isSubmitting || success}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link href="/director/clients" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  disabled={isSubmitting || success}
                >
                  キャンセル
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting || success}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    保存する
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  )
}
