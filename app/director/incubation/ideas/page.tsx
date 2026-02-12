'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Lightbulb,
  Plus,
  ArrowLeft,
  Loader2,
  LogOut,
  Bell,
  Sparkles,
  Trash2,
  Edit,
  X,
  TrendingUp,
} from 'lucide-react'

interface ProductIdea {
  id: string
  source_project_id: string
  title: string
  description: string
  target_market: string
  estimated_demand: string
  pain_points_addressed: string[]
  status: 'draft' | 'evaluating' | 'approved' | 'in_development' | 'launched' | 'rejected'
  created_at: string
  updated_at: string
}

interface RejectionInsight {
  id: string
  project_id: string
  pain_point: string
  unmet_need: string
  category: string
}

interface Project {
  id: string
  name: string
}

export default function ProductIdeasPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ideas, setIdeas] = useState<ProductIdea[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [rejectionInsights, setRejectionInsights] = useState<RejectionInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('project_id') || '')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [isAddingIdea, setIsAddingIdea] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const [newIdea, setNewIdea] = useState({
    title: '',
    description: '',
    target_market: '',
    pain_points: [''],
  })

  const [selectedIdea, setSelectedIdea] = useState<ProductIdea | null>(null)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Fetch projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .limit(100)

        if (projectsError) throw projectsError
        setProjects((projectsData || []) as Project[])

        // Fetch product ideas
        const { data: ideasData, error: ideasError } = await supabase
          .from('product_ideas')
          .select('*')
          .order('created_at', { ascending: false })

        if (ideasError) throw ideasError
        setIdeas((ideasData || []) as ProductIdea[])

        // Fetch rejection insights
        const { data: insightsData, error: insightsError } = await supabase
          .from('rejection_insights')
          .select('*')

        if (insightsError) throw insightsError
        setRejectionInsights((insightsData || []) as RejectionInsight[])

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const generateAIIdea = async () => {
    if (!selectedProjectId) {
      setError('プロジェクトを選択してください')
      return
    }

    setIsGenerating(true)
    try {
      const supabase = createClient()

      // Get rejection insights for selected project
      const projectInsights = rejectionInsights.filter((ri) => ri.project_id === selectedProjectId)

      if (projectInsights.length === 0) {
        setError('このプロジェクトの却下データがありません')
        setIsGenerating(false)
        return
      }

      // Extract unique pain points and needs
      const painPoints = [...new Set(projectInsights.map((ri) => ri.pain_point))].slice(0, 5)
      const unmetNeeds = [...new Set(projectInsights.map((ri) => ri.unmet_need))].slice(0, 3)

      // Generate mock AI idea
      const generatedIdea = {
        source_project_id: selectedProjectId,
        title: `AI提案: ${unmetNeeds[0]?.substring(0, 20)}...ソリューション`,
        description: `顧客の主要な課題（${painPoints.slice(0, 2).join('、')}）に対応するソリューション。市場調査に基づいて生成されました。`,
        target_market: 'B2B企業、中小企業',
        estimated_demand: 'high',
        pain_points_addressed: painPoints,
        status: 'draft' as const,
      }

      const { data, error: insertError } = await supabase
        .from('product_ideas')
        .insert([generatedIdea])
        .select()

      if (insertError) throw insertError
      if (data) {
        setIdeas([data[0] as ProductIdea, ...ideas])
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アイデア生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateIdea = async () => {
    if (!selectedProjectId || !newIdea.title || !newIdea.description) {
      setError('必須項目を入力してください')
      return
    }

    setIsCreating(true)
    try {
      const supabase = createClient()

      const ideaData = {
        source_project_id: selectedProjectId,
        title: newIdea.title,
        description: newIdea.description,
        target_market: newIdea.target_market,
        estimated_demand: 'medium',
        pain_points_addressed: newIdea.pain_points.filter((p) => p.trim()),
        status: 'draft' as const,
      }

      const { data, error: insertError } = await supabase
        .from('product_ideas')
        .insert([ideaData])
        .select()

      if (insertError) throw insertError
      if (data) {
        setIdeas([data[0] as ProductIdea, ...ideas])
        setNewIdea({ title: '', description: '', target_market: '', pain_points: [''] })
        setIsAddingIdea(false)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アイデア作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  const handleStatusChange = async (idea: ProductIdea, newStatus: string) => {
    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from('product_ideas')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', idea.id)

      if (updateError) throw updateError

      setIdeas(
        ideas.map((i) =>
          i.id === idea.id ? { ...i, status: newStatus as ProductIdea['status'] } : i
        )
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステータス更新に失敗しました')
    }
  }

  const handleDeleteIdea = async () => {
    if (!selectedIdea) return

    try {
      const supabase = createClient()

      const { error: deleteError } = await supabase
        .from('product_ideas')
        .delete()
        .eq('id', selectedIdea.id)

      if (deleteError) throw deleteError

      setIdeas(ideas.filter((i) => i.id !== selectedIdea.id))
      setSelectedIdea(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const filteredIdeas = ideas.filter((idea) => {
    if (selectedProjectId && idea.source_project_id !== selectedProjectId) return false
    if (selectedStatus && idea.status !== selectedStatus) return false
    return true
  })

  const statusGroups = {
    draft: { label: '下書き', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' },
    evaluating: {
      label: '評価中',
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    },
    approved: { label: '承認済み', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' },
    in_development: {
      label: '開発中',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    },
    launched: {
      label: 'リリース済み',
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
    },
    rejected: { label: '却下', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' },
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
            <Link href="/director/incubation">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lightbulb className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  プロダクトアイデア生成
                </h2>
                <p className="text-sm text-slate-500">
                  {filteredIdeas.length}個のアイデア
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={generateAIIdea}
              disabled={isGenerating || !selectedProjectId}
              className="bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30"
            >
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" />
              AI生成
            </Button>

            <Dialog open={isAddingIdea} onOpenChange={setIsAddingIdea}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30">
                  <Plus className="h-4 w-4 mr-2" />
                  新規追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規アイデア追加</DialogTitle>
                  <DialogDescription>
                    新しいプロダクトアイデアを追加します
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">プロジェクト</label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">タイトル</label>
                    <Input
                      placeholder="アイデアのタイトル"
                      value={newIdea.title}
                      onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">説明</label>
                    <Textarea
                      placeholder="アイデアの説明"
                      value={newIdea.description}
                      onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                      className="h-24"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">ターゲット市場</label>
                    <Input
                      placeholder="例: B2B企業、スタートアップ"
                      value={newIdea.target_market}
                      onChange={(e) => setNewIdea({ ...newIdea, target_market: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">解決する課題</label>
                    {newIdea.pain_points.map((point, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <Input
                          placeholder="課題を入力"
                          value={point}
                          onChange={(e) => {
                            const updated = [...newIdea.pain_points]
                            updated[idx] = e.target.value
                            setNewIdea({ ...newIdea, pain_points: updated })
                          }}
                        />
                        {newIdea.pain_points.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const updated = newIdea.pain_points.filter((_, i) => i !== idx)
                              setNewIdea({ ...newIdea, pain_points: updated })
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewIdea({ ...newIdea, pain_points: [...newIdea.pain_points, ''] })}
                      className="mt-2"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      課題を追加
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingIdea(false)}>
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleCreateIdea}
                    disabled={isCreating}
                    className="bg-gradient-to-r from-blue-600 to-blue-500"
                  >
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    作成
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="プロジェクト絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべてのプロジェクト</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="ステータス絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべてのステータス</SelectItem>
              {Object.entries(statusGroups).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Kanban Columns */}
        {isLoading ? (
          <Card className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </Card>
        ) : filteredIdeas.length === 0 ? (
          <Card className="p-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
              アイデアがありません
            </p>
            <p className="text-sm text-slate-500 mt-2">
              新しいアイデアを追加するか、AIで生成してください
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(statusGroups).map(([statusKey, { label, color }]) => (
              <div key={statusKey} className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {label}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredIdeas.filter((i) => i.status === statusKey).length}
                  </Badge>
                </div>

                <div className="space-y-3 flex-1">
                  {filteredIdeas
                    .filter((i) => i.status === statusKey)
                    .map((idea) => (
                      <Card
                        key={idea.id}
                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setSelectedIdea(idea)}
                      >
                        <div className="space-y-2">
                          <h4 className="font-bold text-sm line-clamp-2">{idea.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {idea.description}
                          </p>

                          {idea.target_market && (
                            <Badge variant="outline" className="text-xs">
                              {idea.target_market}
                            </Badge>
                          )}

                          {idea.pain_points_addressed.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {idea.pain_points_addressed.slice(0, 2).map((point, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {point}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-slate-500 pt-2">
                            {idea.estimated_demand === 'high' && <TrendingUp className="h-3 w-3 text-green-600" />}
                            <span>{idea.estimated_demand}</span>
                          </div>

                          <Select
                            value={idea.status}
                            onValueChange={(newStatus) => handleStatusChange(idea, newStatus)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusGroups).map(([key, { label }]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Idea Detail Dialog */}
      <Dialog open={!!selectedIdea} onOpenChange={() => setSelectedIdea(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedIdea?.title}</DialogTitle>
            <DialogDescription>{selectedIdea?.target_market}</DialogDescription>
          </DialogHeader>

          {selectedIdea && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500">説明</p>
                <p className="text-sm">{selectedIdea.description}</p>
              </div>

              {selectedIdea.pain_points_addressed.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-2">解決する課題</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedIdea.pain_points_addressed.map((point, idx) => (
                      <Badge key={idx}>{point}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">需要予測:</span>
                <Badge>{selectedIdea.estimated_demand}</Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDeleteIdea}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              削除
            </Button>
            <Button variant="outline" onClick={() => setSelectedIdea(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
