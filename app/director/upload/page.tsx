'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  uploadCompaniesCSV,
  getCSVTemplateURL,
  runFullAnalysis,
  type Company,
  type AIScoreResult,
  type FullAnalysisResult,
} from '@/lib/api'
import { getClients, type Client } from '@/lib/supabase-api'
import { CompanyAnalysisModal } from '@/components/company-analysis-modal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Loader2,
  LogOut,
  Bell,
  AlertCircle,
  CheckCircle2,
  Brain,
  Sparkles,
  Building2,
  X,
  Search,
  Flame,
  ThermometerSun,
  Snowflake,
  Eye,
} from 'lucide-react'

type UploadedCompany = {
  id: string
  name: string
  industry: string
  employees: number
  location: string
  phone: string
  website: string
  scoreResult?: AIScoreResult
  fullAnalysis?: FullAnalysisResult
  isScoring?: boolean
  isAnalyzing?: boolean
}

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'scoring' | 'completed'

export default function UploadPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    imported: number
    errors: string[]
    skipped?: number
    duplicates?: Array<{ name: string; phone: string }>
  } | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [companies, setCompanies] = useState<UploadedCompany[]>([])
  const [scoringProgress, setScoringProgress] = useState(0)
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [selectedCompanyForAnalysis, setSelectedCompanyForAnalysis] = useState<UploadedCompany | null>(null)
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false)
  const [useFullAnalysis, setUseFullAnalysis] = useState(true) // フル分析モード
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  // クライアント一覧を取得
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients()
        setClients(data)
      } catch (error) {
        console.error('Failed to fetch clients:', error)
      } finally {
        setClientsLoading(false)
      }
    }
    fetchClients()
  }, [])

  // ファイルがCSVまたはExcel形式かチェック
  const isValidFileType = (fileName: string): boolean => {
    const name = fileName.toLowerCase()
    return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!isValidFileType(selectedFile.name)) {
        setError('CSV または Excel (.xlsx, .xls, .xlsm) ファイルを選択してください')
        return
      }
      setFile(selectedFile)
      setError(null)
      setUploadResult(null)
      setCompanies([])
      setUploadState('idle')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      if (!isValidFileType(droppedFile.name)) {
        setError('CSV または Excel (.xlsx, .xls, .xlsm) ファイルを選択してください')
        return
      }
      setFile(droppedFile)
      setError(null)
      setUploadResult(null)
      setCompanies([])
      setUploadState('idle')
    }
  }

  const handleUpload = async (skipDuplicates: boolean = false) => {
    if (!file) {
      setError('ファイルを選択してください')
      return
    }
    if (!selectedClientId) {
      setError('クライアントを選択してください')
      return
    }

    setUploadState('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('client_id', selectedClientId)
      if (skipDuplicates) {
        formData.append('skip_duplicates', 'true')
      }

      const result = await uploadCompaniesCSV(formData)

      // 重複があり、スキップしていない場合は警告を表示
      if (
        result.duplicates &&
        result.duplicates.length > 0 &&
        !skipDuplicates
      ) {
        setUploadResult({
          success: false,
          imported: result.imported,
          errors: result.errors,
          skipped: result.skipped,
          duplicates: result.duplicates,
        })
        setPendingFormData(formData)
        setShowDuplicateWarning(true)
        setUploadState('idle')
        return
      }

      setUploadResult({
        success: result.success,
        imported: result.imported,
        errors: result.errors,
        skipped: result.skipped,
        duplicates: result.duplicates,
      })

      if (result.imported > 0 && result.companies) {
        // アップロード成功 - 実際の企業データを使用
        const uploadedCompanies: UploadedCompany[] = result.companies.map((c) => ({
          id: c.id,
          name: c.name,
          industry: c.industry,
          employees: c.employees,
          location: c.location || '',
          phone: c.phone || '',
          website: c.website || '',
          scoreResult: {
            rank: c.rank,
            score: c.rank === 'S' ? 85 : c.rank === 'A' ? 70 : c.rank === 'B' ? 55 : 40,
            reasons: [],
          },
        }))
        setCompanies(uploadedCompanies)
        setUploadState('completed') // 既にスコアリング済み
        setShowDuplicateWarning(false)
      } else {
        setUploadState('idle')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
      setUploadState('idle')
    }
  }

  const handleStartScoring = async () => {
    setUploadState('scoring')
    setScoringProgress(0)

    const updatedCompanies = [...companies]
    const total = updatedCompanies.length

    for (let i = 0; i < total; i++) {
      const company = updatedCompanies[i]

      // スコアリング中の状態を設定
      updatedCompanies[i] = { ...company, isScoring: true }
      setCompanies([...updatedCompanies])

      try {
        if (useFullAnalysis) {
          // フル分析（インテント + 企業分析 + スコアリング）
          const fullAnalysis = await runFullAnalysis({
            name: company.name,
            industry: company.industry,
            employees: company.employees,
            location: company.location,
          })

          updatedCompanies[i] = {
            ...company,
            isScoring: false,
            scoreResult: fullAnalysis.score,
            fullAnalysis,
          }
        } else {
          // シンプルスコアリングのみ（デモ用モックデータ）
          const mockScore: AIScoreResult = {
            rank: ['S', 'A', 'B', 'C'][Math.floor(Math.random() * 4)] as 'S' | 'A' | 'B' | 'C',
            score: Math.floor(Math.random() * 100),
            reasons: ['デモ用スコアリング結果'],
          }
          updatedCompanies[i] = {
            ...company,
            isScoring: false,
            scoreResult: mockScore,
          }
        }
      } catch (err) {
        // エラー時はデフォルトのスコアを設定
        updatedCompanies[i] = {
          ...company,
          isScoring: false,
          scoreResult: {
            rank: 'C',
            score: 0,
            reasons: ['スコアリングに失敗しました'],
          },
        }
      }

      setCompanies([...updatedCompanies])
      setScoringProgress(((i + 1) / total) * 100)

      // レート制限対策で少し待機
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    setUploadState('completed')
  }

  // 個別企業のフル分析を実行
  const handleRunAnalysis = async (company: UploadedCompany) => {
    setSelectedCompanyForAnalysis(company)
    setAnalysisModalOpen(true)
    setIsRunningAnalysis(true)

    try {
      const fullAnalysis = await runFullAnalysis({
        name: company.name,
        industry: company.industry,
        employees: company.employees,
        location: company.location,
      })

      // 企業リストを更新
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === company.id
            ? { ...c, fullAnalysis, scoreResult: fullAnalysis.score }
            : c
        )
      )
      setSelectedCompanyForAnalysis({ ...company, fullAnalysis, scoreResult: fullAnalysis.score })
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setIsRunningAnalysis(false)
    }
  }

  // インテントレベルのアイコンを取得
  const getIntentIcon = (level?: 'hot' | 'warm' | 'cold') => {
    switch (level) {
      case 'hot':
        return <Flame className="h-4 w-4 text-red-500" />
      case 'warm':
        return <ThermometerSun className="h-4 w-4 text-orange-500" />
      case 'cold':
        return <Snowflake className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case 'S':
        return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
      case 'A':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
      case 'B':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
      default:
        return 'bg-slate-400 text-white'
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
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  企業リストアップロード
                </h2>
                <p className="text-sm text-slate-500">
                  企業リストをアップロードしてAIスコアリング
                </p>
              </div>
            </div>
          </div>

          <a href={getCSVTemplateURL()} download>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              テンプレートをダウンロード
            </Button>
          </a>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Card */}
          <Card className="lg:col-span-2 p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="space-y-6">
              {/* Client Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">クライアント選択</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="クライアントを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  file
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-300 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {file ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="h-12 w-12 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {file.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFile(null)
                          setUploadState('idle')
                          setCompanies([])
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-slate-400" />
                    <div>
                      <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                        CSV/Excelファイルをドラッグ＆ドロップ
                      </p>
                      <p className="text-sm text-slate-500">
                        .csv, .xlsx, .xls, .xlsm 対応
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      ファイルを選択
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.xlsm"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </div>

              {/* Upload Button */}
              {file && uploadState === 'idle' && (
                <Button
                  onClick={() => handleUpload(false)}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  アップロード
                </Button>
              )}

              {/* Uploading State */}
              {uploadState === 'uploading' && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-slate-600">アップロード中...</span>
                </div>
              )}

              {/* Upload Result */}
              {uploadResult && (
                <Alert
                  className={
                    uploadResult.success
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  }
                >
                  {uploadResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    {uploadResult.success
                      ? `${uploadResult.imported}件の企業をインポートしました`
                      : 'インポートに失敗しました'}
                    {uploadResult.errors.length > 0 && (
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {uploadResult.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* AI Scoring Button */}
              {uploadState === 'uploaded' && companies.length > 0 && (
                <Button
                  onClick={handleStartScoring}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/30"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  <Sparkles className="mr-2 h-4 w-4" />
                  AIスコアリングを開始
                </Button>
              )}

              {/* Scoring Progress */}
              {uploadState === 'scoring' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">スコアリング中...</span>
                    <span className="font-medium">{Math.round(scoringProgress)}%</span>
                  </div>
                  <Progress value={scoringProgress} className="h-2" />
                </div>
              )}

              {/* Completed */}
              {uploadState === 'completed' && (
                <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    すべての企業のスコアリングが完了しました
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4">アップロード手順</h3>
            <ol className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>クライアントを選択</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>CSVファイルをアップロード</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>AIスコアリングを実行</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>S/A/Bランクの優先順に架電開始</span>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>ヒント:</strong> S判定の企業は成功率75%！優先的に架電しましょう。
              </p>
            </div>
          </Card>
        </div>

        {/* Duplicate Warning Dialog */}
        {showDuplicateWarning && uploadResult?.duplicates && uploadResult.duplicates.length > 0 && (
          <Card className="p-6 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-amber-900 dark:text-amber-100 mb-2">
                    {uploadResult.duplicates.length}件の重複企業が見つかりました
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                    以下の企業は既にデータベースに存在しています。スキップして続行しますか？
                  </p>
                  <div className="max-h-40 overflow-y-auto mb-4 bg-white/50 dark:bg-slate-900/50 rounded p-3">
                    <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                      {uploadResult.duplicates.slice(0, 10).map((dup, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                          {dup.name}
                          {dup.phone && <span className="text-amber-600">({dup.phone})</span>}
                        </li>
                      ))}
                      {uploadResult.duplicates.length > 10 && (
                        <li className="text-amber-600">他 {uploadResult.duplicates.length - 10}件</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDuplicateWarning(false)
                    setUploadResult(null)
                    setPendingFormData(null)
                  }}
                  className="flex-1"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={() => {
                    setShowDuplicateWarning(false)
                    if (pendingFormData) {
                      setUploadState('uploading')
                      uploadCompaniesCSV(pendingFormData).then((result) => {
                        setUploadResult({
                          success: result.success,
                          imported: result.imported,
                          errors: result.errors,
                          skipped: result.skipped,
                          duplicates: result.duplicates,
                        })

                        if (result.imported > 0 && result.companies) {
                          const uploadedCompanies: UploadedCompany[] = result.companies.map((c) => ({
                            id: c.id,
                            name: c.name,
                            industry: c.industry,
                            employees: c.employees,
                            location: c.location || '',
                            phone: c.phone || '',
                            website: c.website || '',
                            scoreResult: {
                              rank: c.rank,
                              score: c.rank === 'S' ? 85 : c.rank === 'A' ? 70 : c.rank === 'B' ? 55 : 40,
                              reasons: [],
                            },
                          }))
                          setCompanies(uploadedCompanies)
                          setUploadState('completed')
                        } else {
                          setUploadState('idle')
                        }
                        setPendingFormData(null)
                      })
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 text-white"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  重複をスキップして続行
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Results Table */}
        {companies.length > 0 && (
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                アップロードされた企業 ({companies.length}件)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>企業名</TableHead>
                  <TableHead>業種</TableHead>
                  <TableHead>従業員数</TableHead>
                  <TableHead>所在地</TableHead>
                  <TableHead>AIランク</TableHead>
                  <TableHead>インテント</TableHead>
                  <TableHead>スコア理由</TableHead>
                  <TableHead>詳細分析</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.industry}</TableCell>
                    <TableCell>{company.employees}名</TableCell>
                    <TableCell>{company.location}</TableCell>
                    <TableCell>
                      {company.isScoring ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : company.scoreResult ? (
                        <Badge className={getRankBadgeColor(company.scoreResult.rank)}>
                          {company.scoreResult.rank}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.fullAnalysis?.intent ? (
                        <div className="flex items-center gap-2">
                          {getIntentIcon(company.fullAnalysis.intent.level)}
                          <span className="text-sm font-medium">
                            {company.fullAnalysis.intent.score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {company.scoreResult?.reasons?.[0] && (
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate block">
                          {company.scoreResult.reasons[0]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (company.fullAnalysis) {
                            setSelectedCompanyForAnalysis(company)
                            setAnalysisModalOpen(true)
                          } else {
                            handleRunAnalysis(company)
                          }
                        }}
                        disabled={company.isScoring}
                      >
                        {company.fullAnalysis ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            詳細
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3 mr-1" />
                            分析
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Analysis Modal */}
        <CompanyAnalysisModal
          open={analysisModalOpen}
          onOpenChange={setAnalysisModalOpen}
          company={selectedCompanyForAnalysis}
          analysisResult={selectedCompanyForAnalysis?.fullAnalysis || null}
          isLoading={isRunningAnalysis}
          onRunAnalysis={() => {
            if (selectedCompanyForAnalysis) {
              handleRunAnalysis(selectedCompanyForAnalysis)
            }
          }}
        />
      </main>
    </div>
  )
}
