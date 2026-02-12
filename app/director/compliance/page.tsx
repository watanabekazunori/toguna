'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  getSubsidyReports,
  generateSubsidyReport,
  getComplianceDocuments,
  uploadComplianceDocument,
  getAuditLogs,
  type SubsidyReport,
  type ComplianceDocument,
  type AuditLog,
} from '@/lib/management-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  FileText,
  Plus,
  ArrowLeft,
  Loader2,
  LogOut,
  Bell,
  Lock,
  Download,
  Eye,
  ChevronDown,
  FileCheck,
  BarChart3,
  Shield,
} from 'lucide-react'

export default function CompliancePage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // 補助金レポート関連
  const [subsidyReports, setSubsidyReports] = useState<SubsidyReport[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // コンプライアンス文書関連
  const [complianceDocuments, setComplianceDocuments] = useState<ComplianceDocument[]>([])
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('')
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)

  // 監査ログ関連
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('week')
  const [searchAction, setSearchAction] = useState<string>('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // 共通状態
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const projectsData = await getProjects()
        setProjects(projectsData)
        if (projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id)
          setSelectedClientId(projectsData[0].client_id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchInitialData()
    }
  }, [isDirector])

  // 補助金レポート取得
  useEffect(() => {
    const fetchSubsidyReports = async () => {
      if (!selectedClientId) return
      try {
        const data = await getSubsidyReports(selectedClientId)
        setSubsidyReports(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'レポートの取得に失敗しました')
      }
    }

    fetchSubsidyReports()
  }, [selectedClientId])

  // コンプライアンス文書取得
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await getComplianceDocuments({
          client_id: selectedClientId || undefined,
          document_type: documentTypeFilter || undefined,
        })
        setComplianceDocuments(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '文書の取得に失敗しました')
      }
    }

    if (selectedClientId) {
      fetchDocuments()
    }
  }, [documentTypeFilter, selectedClientId])

  // 監査ログ取得
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const now = new Date()
        let startDate = new Date()

        switch (timeFilter) {
          case 'today':
            startDate.setDate(now.getDate() - 1)
            break
          case 'week':
            startDate.setDate(now.getDate() - 7)
            break
          case 'month':
            startDate.setDate(now.getDate() - 30)
            break
        }

        const data = await getAuditLogs({
          start_date: startDate.toISOString(),
          search_action: searchAction || undefined,
        })
        setAuditLogs(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ログの取得に失敗しました')
      }
    }

    fetchAuditLogs()
  }, [timeFilter, searchAction])

  const handleGenerateReport = async () => {
    if (!selectedProjectId || !selectedClientId) {
      setError('プロジェクトを選択してください')
      return
    }

    setIsGeneratingReport(true)
    try {
      const today = new Date()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

      const result = await generateSubsidyReport({
        client_id: selectedClientId,
        report_type: 'performance',
        period_start: monthStart.toISOString().split('T')[0],
        period_end: monthEnd.toISOString().split('T')[0],
      })

      if (result) {
        setSubsidyReports([result, ...subsidyReports])
        setError(null)
      } else {
        setError('レポートの生成に失敗しました')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleUploadDocument = async () => {
    if (!selectedClientId) {
      setError('クライアントを選択してください')
      return
    }

    setIsUploadingDocument(true)
    try {
      const result = await uploadComplianceDocument({
        client_id: selectedClientId,
        project_id: selectedProjectId || undefined,
        document_type: 'other',
        title: 'サンプル文書',
        description: 'アップロードされたコンプライアンス文書',
        file_url: 'https://example.com/document.pdf',
      })

      if (result) {
        setComplianceDocuments([result, ...complianceDocuments])
        setError(null)
      } else {
        setError('文書のアップロードに失敗しました')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsUploadingDocument(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
      draft: { label: '下書き', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
      generated: { label: '生成済み', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
      reviewed: { label: 'レビュー済み', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
      submitted: { label: '提出済み', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
      accepted: { label: '承認済み', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
      approved: { label: '承認済み', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
      rejected: { label: '却下', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
    }

    const config = statusConfig[status] || statusConfig.draft
    return (
      <Badge className={`${config.bg} ${config.text} border-0`}>
        {config.label}
      </Badge>
    )
  }

  const getDocumentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; bg: string; icon: string }> = {
      contract: { label: '契約書', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: '📋' },
      order: { label: '発注書', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: '📄' },
      delivery: { label: '納品書', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: '📦' },
      invoice: { label: '請求書', bg: 'bg-green-100 dark:bg-green-900/30', icon: '💵' },
      daily_report: { label: '日報', bg: 'bg-cyan-100 dark:bg-cyan-900/30', icon: '📝' },
      other: { label: 'その他', bg: 'bg-slate-100 dark:bg-slate-800', icon: '📄' },
    }

    const config = typeConfig[type] || typeConfig.other
    return (
      <Badge className={`${config.bg} border-0`}>
        {config.icon} {config.label}
      </Badge>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
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

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-shield via-indigo-500 to-blue-500 rounded-lg shadow-lg shadow-indigo-500/20">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  コンプライアンス・補助金管理
                </h2>
                <p className="text-sm text-slate-500">
                  レポート、文書、監査ログの一元管理
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Tabs Container */}
        <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-0 shadow-lg">
          <Tabs defaultValue="reports" className="w-full">
            <TabsList className="w-full border-b border-slate-200 dark:border-slate-800 rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger
                value="reports"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/20 py-4 px-6"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                補助金レポート
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/20 py-4 px-6"
              >
                <FileText className="h-4 w-4 mr-2" />
                コンプライアンス文書
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/20 py-4 px-6"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                監査ログ
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: 補助金レポート */}
            <TabsContent value="reports" className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <Select
                    value={selectedProjectId}
                    onValueChange={(value) => {
                      setSelectedProjectId(value)
                      const project = projects.find(p => p.id === value)
                      if (project) {
                        setSelectedClientId(project.client_id)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="プロジェクトを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport || !selectedProjectId}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      レポート生成
                    </>
                  )}
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : subsidyReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <BarChart3 className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">レポートがありません</p>
                  <p className="text-sm">新規レポートを生成してください</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead className="font-bold">期間</TableHead>
                        <TableHead className="font-bold">種別</TableHead>
                        <TableHead className="font-bold">期間</TableHead>
                        <TableHead className="font-bold">提出期限</TableHead>
                        <TableHead className="font-bold">ステータス</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subsidyReports.map((report) => {
                        const reportTypeLabels: Record<string, string> = {
                          performance: '実績報告',
                          effect: '効果報告',
                          productivity: '生産性向上報告',
                          wage_increase: '賃上げ報告',
                        }
                        return (
                        <TableRow key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="font-medium">
                            <Badge variant="outline">{reportTypeLabels[report.report_type] || report.report_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.report_period_start ? new Date(report.report_period_start).toLocaleDateString('ja-JP') : '-'} ~{' '}
                            {report.report_period_end ? new Date(report.report_period_end).toLocaleDateString('ja-JP') : '-'}
                          </TableCell>
                          <TableCell>
                            {report.submission_deadline
                              ? new Date(report.submission_deadline).toLocaleDateString('ja-JP')
                              : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-50 dark:hover:bg-green-900/20">
                                <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: コンプライアンス文書 */}
            <TabsContent value="documents" className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="文書タイプで絞込" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">すべて</SelectItem>
                      <SelectItem value="contract">契約書</SelectItem>
                      <SelectItem value="order">発注書</SelectItem>
                      <SelectItem value="delivery">納品書</SelectItem>
                      <SelectItem value="invoice">請求書</SelectItem>
                      <SelectItem value="daily_report">日報</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleUploadDocument}
                  disabled={isUploadingDocument}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                >
                  {isUploadingDocument ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      文書をアップロード
                    </>
                  )}
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : complianceDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <FileText className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">文書がありません</p>
                  <p className="text-sm">コンプライアンス文書をアップロードしてください</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead className="font-bold">タイトル</TableHead>
                        <TableHead className="font-bold">タイプ</TableHead>
                        <TableHead className="font-bold">保存期限</TableHead>
                        <TableHead className="font-bold">イミュータブル</TableHead>
                        <TableHead className="font-bold">作成日</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complianceDocuments.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>{getDocumentTypeBadge(doc.document_type)}</TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(doc.retention_end).toLocaleDateString('ja-JP')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {doc.is_immutable ? (
                                <>
                                  <Lock className="h-4 w-4 text-amber-500" />
                                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    イミュータブル
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-slate-500">通常</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              {doc.file_url && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-50 dark:hover:bg-green-900/20">
                                  <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: 監査ログ */}
            <TabsContent value="logs" className="p-6 space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-full md:w-auto">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      期間
                    </label>
                    <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as any)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">本日</SelectItem>
                        <SelectItem value="week">1週間以内</SelectItem>
                        <SelectItem value="month">1ヶ月以内</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      アクション検索
                    </label>
                    <input
                      type="text"
                      placeholder="検索..."
                      value={searchAction}
                      onChange={(e) => setSearchAction(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <FileCheck className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">ログがありません</p>
                  <p className="text-sm">この期間の監査ログはありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <button
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.action}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.entity_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <span>{log.performed_by}</span>
                            <span className="text-xs">
                              {new Date(log.performed_at).toLocaleString('ja-JP')}
                            </span>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-slate-400 transition-transform ${
                            expandedLogId === log.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {expandedLogId === log.id && (
                        <div className="px-4 pb-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20">
                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                                詳細情報
                              </p>
                              <div className="bg-white dark:bg-slate-900 rounded p-3 font-mono text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
                                <pre>{JSON.stringify(log.details, null, 2)}</pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  )
}
