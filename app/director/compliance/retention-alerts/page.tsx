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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Plus,
  ArrowLeft,
  Loader2,
  LogOut,
  Bell,
  Archive,
  RefreshCw,
} from 'lucide-react'

interface ComplianceDocument {
  id: string
  title: string
  document_type: string
  client_name: string
  retention_end: string
  status: string
  created_at: string
  updated_at: string
}

interface AlertGroup {
  urgency: 'expired' | '30days' | '60days' | '90days'
  documents: ComplianceDocument[]
  color: string
  label: string
  icon: React.ReactNode
}

export default function RetentionAlertsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [documents, setDocuments] = useState<ComplianceDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedAction, setSelectedAction] = useState<{ doc: ComplianceDocument; action: 'extend' | 'archive' } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  const fetchDocuments = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from('compliance_documents')
        .select('*')
        .order('retention_end', { ascending: true })

      if (fetchError) throw fetchError

      setDocuments((data || []) as ComplianceDocument[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ドキュメントの取得に失敗しました')
    } finally {
      if (isRefresh) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isDirector) {
      fetchDocuments()
    }
  }, [isDirector])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const calculateDaysRemaining = (retentionEnd: string): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(retentionEnd)
    endDate.setHours(0, 0, 0, 0)
    const diffTime = endDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const categorizeAlert = (doc: ComplianceDocument): 'expired' | '30days' | '60days' | '90days' => {
    const daysRemaining = calculateDaysRemaining(doc.retention_end)
    if (daysRemaining < 0) return 'expired'
    if (daysRemaining <= 30) return '30days'
    if (daysRemaining <= 60) return '60days'
    if (daysRemaining <= 90) return '90days'
    return '90days'
  }

  const groupedAlerts: AlertGroup[] = [
    {
      urgency: 'expired',
      documents: documents.filter((d) => categorizeAlert(d) === 'expired'),
      color: 'red',
      label: '期限切れ',
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
    },
    {
      urgency: '30days',
      documents: documents.filter((d) => categorizeAlert(d) === '30days'),
      color: 'yellow',
      label: '30日以内',
      icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    },
    {
      urgency: '60days',
      documents: documents.filter((d) => categorizeAlert(d) === '60days'),
      color: 'orange',
      label: '60日以内',
      icon: <Info className="h-5 w-5 text-orange-600" />,
    },
    {
      urgency: '90days',
      documents: documents.filter((d) => categorizeAlert(d) === '90days'),
      color: 'blue',
      label: '90日以内',
      icon: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
    },
  ]

  const totalDocuments = documents.length
  const expiringCount = groupedAlerts.slice(0, 3).reduce((sum, g) => sum + g.documents.length, 0)
  const expiredCount = groupedAlerts[0].documents.length

  const handleAction = async () => {
    if (!selectedAction) return

    setIsProcessing(true)
    try {
      const supabase = createClient()
      const { doc, action } = selectedAction

      if (action === 'extend') {
        const newRetentionDate = new Date(doc.retention_end)
        newRetentionDate.setFullYear(newRetentionDate.getFullYear() + 1)

        const { error: updateError } = await supabase
          .from('compliance_documents')
          .update({ retention_end: newRetentionDate.toISOString().split('T')[0] })
          .eq('id', doc.id)

        if (updateError) throw updateError
      } else if (action === 'archive') {
        const { error: updateError } = await supabase
          .from('compliance_documents')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', doc.id)

        if (updateError) throw updateError
      }

      setSelectedAction(null)
      await fetchDocuments(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アクションの実行に失敗しました')
    } finally {
      setIsProcessing(false)
    }
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

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director/compliance">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  保存期限アラート
                </h2>
                <p className="text-sm text-slate-500">
                  期限切れと期限が近づいているドキュメント
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => fetchDocuments(true)}
            disabled={isRefreshing}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
          >
            {isRefreshing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isRefreshing ? '更新中...' : '更新'}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6">
            <p className="text-sm text-slate-500 mb-2">全ドキュメント数</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totalDocuments}</p>
          </Card>

          <Card className="bg-red-50/50 dark:bg-red-950/30 backdrop-blur-sm p-6 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 mb-2">期限切れ</p>
            <p className="text-3xl font-bold text-red-700">{expiredCount}</p>
          </Card>

          <Card className="bg-yellow-50/50 dark:bg-yellow-950/30 backdrop-blur-sm p-6 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-600 mb-2">期限切れ間近</p>
            <p className="text-3xl font-bold text-yellow-700">{expiringCount}</p>
          </Card>

          <Card className="bg-blue-50/50 dark:bg-blue-950/30 backdrop-blur-sm p-6 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-600 mb-2">安全な期間内</p>
            <p className="text-3xl font-bold text-blue-700">
              {documents.length - expiringCount - expiredCount}
            </p>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Alerts by Urgency */}
        <div className="space-y-6">
          {groupedAlerts.map((group) => (
            group.documents.length > 0 && (
              <div key={group.urgency}>
                <div className="flex items-center gap-3 mb-4">
                  {group.icon}
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {group.label} ({group.documents.length}件)
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {group.documents.map((doc) => {
                    const daysRemaining = calculateDaysRemaining(doc.retention_end)
                    return (
                      <Card
                        key={doc.id}
                        className={`p-6 ${
                          group.urgency === 'expired'
                            ? 'bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                            : group.urgency === '30days'
                              ? 'bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
                              : group.urgency === '60days'
                                ? 'bg-orange-50/50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                                : 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                              {doc.title}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {doc.client_name} • {doc.document_type}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              daysRemaining < 0
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : daysRemaining <= 30
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                  : daysRemaining <= 60
                                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                                    : 'bg-blue-100 text-blue-800 border-blue-300'
                            }
                          >
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)}日経過`
                              : `${daysRemaining}日残り`}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm mb-4">
                          <span className="text-slate-600 dark:text-slate-400">
                            期限: {new Date(doc.retention_end).toLocaleDateString('ja-JP')}
                          </span>
                          <span className="text-xs text-slate-500">
                            ID: {doc.id.slice(0, 8)}...
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => setSelectedAction({ doc, action: 'extend' })}
                            className="bg-gradient-to-r from-green-600 to-green-500 text-white"
                          >
                            延長申請
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedAction({ doc, action: 'archive' })}
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            アーカイブ
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          ))}

          {documents.length === 0 && !isLoading && (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                アラートはありません
              </p>
              <p className="text-sm text-slate-500 mt-2">
                全てのドキュメントの保存期限が安全な状態です
              </p>
            </Card>
          )}

          {isLoading && (
            <Card className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </Card>
          )}
        </div>
      </main>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAction?.action === 'extend' ? '期限を延長しますか？' : 'アーカイブしますか？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAction?.action === 'extend'
                ? `「${selectedAction?.doc.title}」の保存期限を1年延長します。`
                : `「${selectedAction?.doc.title}」をアーカイブ済みとしてマークします。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={isProcessing}
              className={selectedAction?.action === 'extend' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                selectedAction?.action === 'extend'
                  ? '延長する'
                  : 'アーカイブする'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
