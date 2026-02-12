'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { generateSubsidyReportHTML } from '@/lib/report-generator'
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
  ArrowLeft,
  Loader2,
  LogOut,
  Bell,
  FileText,
  Printer,
  Calendar,
  User,
  Package,
} from 'lucide-react'

interface SubsidyReport {
  id: string
  client_id: string
  client_name: string
  report_type: string
  period_start: string
  period_end: string
  metrics: Record<string, any>
  productivity_data: Record<string, any>
  wage_data: Record<string, any>
  status: string
  created_at: string
  updated_at: string
}

export default function ReportViewerPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [report, setReport] = useState<SubsidyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  const clientId = searchParams.get('client_id')
  const reportId = searchParams.get('report_id')

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchReport = async () => {
      if (!clientId || !reportId) {
        setError('クライアントIDとレポートIDが必要です')
        setIsLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase
          .from('subsidy_reports')
          .select('*')
          .eq('id', reportId)
          .eq('client_id', clientId)
          .single()

        if (fetchError) throw fetchError
        if (!data) throw new Error('レポートが見つかりません')

        setReport(data as SubsidyReport)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'レポートの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchReport()
    }
  }, [isDirector, clientId, reportId])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handlePrintPDF = () => {
    window.print()
  }

  const handleGoBack = () => {
    router.back()
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-600">レポートを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
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

        <main className="max-w-[1920px] mx-auto px-8 py-8">
          <Card className="p-8 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 font-medium">{error || 'レポートが見つかりません'}</p>
            <Button onClick={handleGoBack} className="mt-4">
              戻る
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  const reportHTML = generateSubsidyReportHTML({
    client_name: report.client_name,
    report_type: report.report_type,
    period_start: report.period_start,
    period_end: report.period_end,
    metrics: report.metrics || {},
    productivity_data: report.productivity_data || {},
    wage_data: report.wage_data || {},
  })

  const statusColor = {
    draft: 'bg-gray-100 text-gray-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }[report.status] || 'bg-gray-100 text-gray-800'

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
            <Button variant="ghost" size="icon" onClick={handleGoBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  補助金レポート
                </h2>
                <p className="text-sm text-slate-500">
                  {report.client_name} - {report.report_type}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePrintPDF}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
          >
            <Printer className="h-4 w-4 mr-2" />
            印刷 / PDF保存
          </Button>
        </div>

        {/* Report Metadata */}
        <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-2">クライアント</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium">{report.client_name}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-2">レポートタイプ</p>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="font-medium">{report.report_type}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-2">期間</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">
                {report.period_start} ～ {report.period_end}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-2">ステータス</p>
            <Badge className={statusColor}>
              {
                {
                  draft: '下書き',
                  under_review: '審査中',
                  approved: '承認済み',
                  rejected: '却下',
                }[report.status] || report.status
              }
            </Badge>
          </div>
        </Card>

        {/* Report Content */}
        <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
          <div className="bg-white dark:bg-slate-900">
            <iframe
              key={iframeKey}
              srcDoc={reportHTML}
              className="w-full border-0"
              style={{ height: '800px' }}
              title="Subsidy Report"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleGoBack}>
            戻る
          </Button>
          <Button
            onClick={handlePrintPDF}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
          >
            <Printer className="h-4 w-4 mr-2" />
            印刷 / PDF保存
          </Button>
        </div>
      </main>
    </div>
  )
}
