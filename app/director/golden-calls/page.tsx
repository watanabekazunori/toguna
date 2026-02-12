'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import {
  markAsGoldenCall,
  getCallQualityScores,
  type CallQualityScore,
  type GoldenCall,
} from '@/lib/management-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { getOperators, type Operator } from '@/lib/supabase-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  Award,
  Plus,
  ArrowLeft,
  LogOut,
  Play,
  Star,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  ChevronRight,
  Filter,
  Search,
  TrendingUp,
  Zap,
  Volume2,
} from 'lucide-react'
import Link from 'next/link'
import { NotificationDropdown } from '@/components/notification-dropdown'

interface ExtendedGoldenCall extends GoldenCall {
  call_logs?: any
  call_quality_scores?: CallQualityScore
  operators?: Operator
  companies?: any
  projects?: Project
}

export default function GoldenCallsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // State management
  const [goldenCalls, setGoldenCalls] = useState<ExtendedGoldenCall[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterOperator, setFilterOperator] = useState<string>('')
  const [filterMinScore, setFilterMinScore] = useState<number>(0)
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [searchReason, setSearchReason] = useState<string>('')

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null)
  const [selectionReason, setSelectionReason] = useState<string>('')
  const [isClientVisible, setIsClientVisible] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ExtendedGoldenCall | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Auth check
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      if (!isDirector) return

      try {
        setIsLoading(true)

        // Fetch projects
        const projectsData = await getProjects()
        setProjects(projectsData)

        // Fetch operators
        const operatorsData = await getOperators()
        setOperators(operatorsData)

        // Fetch all golden calls with related data
        const { data: allGoldenCalls, error: gcError } = await supabase
          .from('golden_calls')
          .select(`
            *,
            call_logs(
              id,
              project_id,
              operator_id,
              company_id,
              called_at,
              duration,
              result
            ),
            call_quality_scores(*),
            operators(id, name),
            companies(id, name),
            projects(id, name)
          `)
          .order('selected_at', { ascending: false })

        if (gcError) {
          console.error('Error fetching golden calls:', gcError)
          setError('ゴールデンコールの取得に失敗しました')
        } else {
          setGoldenCalls(allGoldenCalls || [])
        }

        // Fetch high-scoring calls (quality score >= 80) as candidates
        const qualityScores = await getCallQualityScores({ min_score: 80 })

        // Get the call logs for candidates
        const candidateIds = qualityScores.map((qs) => qs.call_log_id)
        if (candidateIds.length > 0) {
          const { data: candidateData } = await supabase
            .from('call_logs')
            .select(`
              *,
              operators(id, name),
              companies(id, name),
              projects(id, name),
              call_quality_scores(*)
            `)
            .in('id', candidateIds)
            .order('called_at', { ascending: false })
            .limit(50)

          setCandidates(candidateData || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isDirector, supabase])

  // Filter golden calls
  const filteredCalls = goldenCalls.filter((call) => {
    if (filterProject && call.project_id !== filterProject) return false
    if (
      filterOperator &&
      call.call_logs?.operator_id !== filterOperator
    )
      return false
    if (
      filterMinScore &&
      (!call.call_quality_scores || call.call_quality_scores.total_score < filterMinScore)
    )
      return false
    if (
      filterStartDate &&
      call.call_logs &&
      new Date(call.call_logs.called_at) < new Date(filterStartDate)
    )
      return false
    if (
      filterEndDate &&
      call.call_logs &&
      new Date(call.call_logs.called_at) > new Date(filterEndDate)
    )
      return false
    if (
      searchReason &&
      (!call.selection_reason ||
        !call.selection_reason
          .toLowerCase()
          .includes(searchReason.toLowerCase()))
    )
      return false

    return true
  })

  // Calculate summary statistics
  const totalCount = goldenCalls.length
  const avgScore =
    goldenCalls.length > 0
      ? Math.round(
          goldenCalls.reduce(
            (sum, call) => sum + (call.call_quality_scores?.total_score || 0),
            0
          ) / goldenCalls.length
        )
      : 0

  const projectCounts: Record<string, number> = {}
  goldenCalls.forEach((call) => {
    const projectName = call.projects?.name || '不明'
    projectCounts[projectName] = (projectCounts[projectName] || 0) + 1
  })
  const mostRepresentedProject =
    Object.entries(projectCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'

  const thisWeekStart = new Date()
  thisWeekStart.setDate(thisWeekStart.getDate() - 7)
  const thisWeekCount = goldenCalls.filter(
    (call) =>
      call.call_logs && new Date(call.call_logs.called_at) >= thisWeekStart
  ).length

  // Handle adding golden call
  const handleAddGoldenCall = async () => {
    if (!selectedCandidate) {
      setError('候補を選択してください')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await markAsGoldenCall({
        call_log_id: selectedCandidate.id,
        project_id: selectedCandidate.project_id,
        selection_reason: selectionReason || undefined,
        quality_score: selectedCandidate.call_quality_scores?.[0]?.total_score,
      })

      if (result) {
        // Fetch updated list
        const { data: updatedCalls } = await supabase
          .from('golden_calls')
          .select(`
            *,
            call_logs(*),
            call_quality_scores(*),
            operators(id, name),
            companies(id, name),
            projects(id, name)
          `)
          .eq('id', result.id)
          .single()

        if (updatedCalls) {
          setGoldenCalls([updatedCalls, ...goldenCalls])
        }

        setIsAddDialogOpen(false)
        setSelectedCandidate(null)
        setSelectionReason('')
        setIsClientVisible(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ゴールデンコールの追加に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('golden_calls')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) {
        setError('削除に失敗しました')
      } else {
        setGoldenCalls(goldenCalls.filter((c) => c.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle toggle client visibility
  const handleToggleVisibility = async (call: ExtendedGoldenCall) => {
    try {
      const { error } = await supabase
        .from('golden_calls')
        .update({ is_client_visible: !call.is_client_visible })
        .eq('id', call.id)

      if (error) {
        setError('表示設定の変更に失敗しました')
      } else {
        setGoldenCalls(
          goldenCalls.map((c) =>
            c.id === call.id
              ? { ...c, is_client_visible: !c.is_client_visible }
              : c
          )
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '表示設定の変更に失敗しました')
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
          <div className="flex items-center gap-4">
            <Link href="/director">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                <Award className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ゴールデンコール
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name || 'ディレクター'}</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
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

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-8">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            サマリー
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Count */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    全ゴールデンコール
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {isLoading ? '-' : totalCount}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                  <Award className="h-5 w-5" />
                </div>
              </div>
            </Card>

            {/* Average Quality Score */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    平均品質スコア
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {isLoading ? '-' : `${avgScore}点`}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Star className="h-5 w-5" />
                </div>
              </div>
            </Card>

            {/* Most Represented Project */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    最多プロジェクト
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {isLoading ? '-' : mostRepresentedProject}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </Card>

            {/* This Week's Additions */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 border-2 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    今週の新規
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {isLoading ? '-' : thisWeekCount}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
                  <Zap className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Filters and Add Button */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              ゴールデンコール一覧
            </h2>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Plus className="h-4 w-4" />
                  新規追加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>ゴールデンコール を追加</DialogTitle>
                  <DialogDescription>
                    高品質（スコア80以上）の通話から選択して追加します
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Candidate Selection */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      通話候補を選択
                    </label>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {candidates.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          高品質な通話が見つかりません
                        </p>
                      ) : (
                        candidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            onClick={() => setSelectedCandidate(candidate)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedCandidate?.id === candidate.id
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {candidate.companies?.name || 'N/A'}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {candidate.operators?.name || 'N/A'} •{' '}
                                  {candidate.projects?.name || 'N/A'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(
                                    candidate.called_at
                                  ).toLocaleDateString('ja-JP')}
                                </p>
                              </div>
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {candidate.call_quality_scores?.[0]
                                  ?.total_score || '?'}
                                点
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Selection Reason */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      選定理由
                    </label>
                    <textarea
                      value={selectionReason}
                      onChange={(e) => setSelectionReason(e.target.value)}
                      placeholder="なぜこの通話をゴールデンコールに選んだのか記入してください"
                      className="mt-2 w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>

                  {/* Client Visibility */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="clientVisible"
                      checked={isClientVisible}
                      onChange={(e) => setIsClientVisible(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <label
                      htmlFor="clientVisible"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      クライアントに公開
                    </label>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleAddGoldenCall}
                    disabled={!selectedCandidate || isSubmitting}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    追加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Project Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                プロジェクト
              </label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="">全プロジェクト</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                オペレーター
              </label>
              <select
                value={filterOperator}
                onChange={(e) => setFilterOperator(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="">全オペレーター</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Score Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                最小スコア
              </label>
              <input
                type="number"
                value={filterMinScore}
                onChange={(e) => setFilterMinScore(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                開始日
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                終了日
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Search Reason */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              選定理由で検索
            </label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchReason}
                onChange={(e) => setSearchReason(e.target.value)}
                placeholder="選定理由で検索..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* Golden Calls List */}
        <section className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
          ) : filteredCalls.length === 0 ? (
            <Card className="p-12 text-center bg-white/50 dark:bg-slate-900/50">
              <p className="text-slate-600 dark:text-slate-400">
                ゴールデンコールが見つかりません
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCalls.map((call) => (
                <Card
                  key={call.id}
                  className="p-6 hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50"
                >
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {call.companies?.name || 'N/A'}
                          </h3>
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {call.call_quality_scores?.total_score || '?'}点
                          </Badge>
                          {call.is_client_visible && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              クライアント公開
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {call.operators?.name || 'N/A'} •{' '}
                          {call.projects?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleVisibility(call)
                          }
                          className="text-slate-600 hover:text-slate-900"
                        >
                          {call.is_client_visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(call)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Selection Reason */}
                    {call.selection_reason && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          選定理由
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {call.selection_reason}
                        </p>
                      </div>
                    )}

                    {/* Audio Player */}
                    {call.call_logs && (
                      <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-blue-600 hover:text-blue-900"
                        >
                          <Play className="h-5 w-5 fill-current" />
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {call.call_logs.duration
                                ? `${Math.floor(
                                    call.call_logs.duration / 60
                                  )}:${String(
                                    call.call_logs.duration % 60
                                  ).padStart(2, '0')}`
                                : '--:--'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quality Score Breakdown */}
                    {call.call_quality_scores && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                          {
                            label: '挨拶',
                            value: call.call_quality_scores.greeting_score,
                          },
                          {
                            label: 'ヒアリング',
                            value: call.call_quality_scores.hearing_score,
                          },
                          {
                            label: '提案',
                            value: call.call_quality_scores.proposal_score,
                          },
                          {
                            label: 'クロージング',
                            value: call.call_quality_scores.closing_score,
                          },
                          {
                            label: '話速',
                            value: call.call_quality_scores.speech_pace_score,
                          },
                          {
                            label: 'トーン',
                            value: call.call_quality_scores.tone_score,
                          },
                        ].map((kpi) => (
                          <div
                            key={kpi.label}
                            className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                          >
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              {kpi.label}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                                  style={{
                                    width: `${Math.min(
                                      kpi.value || 0,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 w-8 text-right">
                                {kpi.value || '-'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta Information */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {new Date(call.selected_at).toLocaleDateString(
                          'ja-JP'
                        )}
                      </span>
                      <span>{call.call_logs?.result || 'N/A'}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ゴールデンコール を削除</AlertDialogTitle>
            <AlertDialogDescription>
              このゴールデンコール（{deleteTarget?.companies?.name}
              ）を削除してもよろしいですか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
