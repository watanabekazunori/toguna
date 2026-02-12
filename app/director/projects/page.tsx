'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProjects, getMultiProjectStats, type Project, type ProjectStats, updateProject, deleteProject } from '@/lib/projects-api'
import { getClients, type Client } from '@/lib/supabase-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorAlert } from '@/components/error-alert'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FolderKanban, Plus, ArrowRight, Phone, Target,
  Users, TrendingUp, Pause, Play, Archive, AlertTriangle, MoreVertical, Trash2, Edit
} from 'lucide-react'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  active: { label: '稼働中', variant: 'default', icon: <Play className="w-3 h-3" /> },
  paused: { label: '一時停止', variant: 'secondary', icon: <Pause className="w-3 h-3" /> },
  draft: { label: '下書き', variant: 'outline', icon: <FolderKanban className="w-3 h-3" /> },
  completed: { label: '完了', variant: 'secondary', icon: <Archive className="w-3 h-3" /> },
  archived: { label: 'アーカイブ', variant: 'outline', icon: <Archive className="w-3 h-3" /> },
}

type EditingProject = Omit<Project, 'created_at' | 'updated_at'>

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<Record<string, ProjectStats>>({})
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<EditingProject | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, clientsData] = await Promise.all([
        getProjects(),
        getClients(),
      ])
      setProjects(projectsData)
      setClients(clientsData)

      if (projectsData.length > 0) {
        const statsData = await getMultiProjectStats(projectsData.map(p => p.id))
        setStats(statsData)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('データの取得に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (project: Project) => {
    setEditingProject({
      id: project.id,
      client_id: project.client_id,
      product_id: project.product_id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      daily_call_target: project.daily_call_target,
      weekly_appointment_target: project.weekly_appointment_target,
      monthly_appointment_target: project.monthly_appointment_target,
      min_appointment_rate: project.min_appointment_rate,
      withdrawal_threshold_days: project.withdrawal_threshold_days,
      start_date: project.start_date,
      end_date: project.end_date,
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingProject) return

    setIsSaving(true)
    try {
      const updated = await updateProject(editingProject.id, editingProject)
      if (updated) {
        setProjects(projects.map(p => p.id === updated.id ? updated : p))
        setEditDialogOpen(false)
        setEditingProject(null)
        toast({
          title: 'プロジェクトを更新しました',
          description: `${updated.name}を更新しました。`,
        })
        await loadData()
      } else {
        toast({
          title: 'エラー',
          description: 'プロジェクトの更新に失敗しました。',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Failed to update project:', err)
      toast({
        title: 'エラー',
        description: 'プロジェクトの更新に失敗しました。',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return

    setIsDeleting(true)
    try {
      const success = await deleteProject(projectToDelete.id)
      if (success) {
        setProjects(projects.filter(p => p.id !== projectToDelete.id))
        setDeleteDialogOpen(false)
        setProjectToDelete(null)
        toast({
          title: 'プロジェクトを削除しました',
          description: `${projectToDelete.name}を削除しました。`,
        })
        await loadData()
      } else {
        toast({
          title: 'エラー',
          description: 'プロジェクトの削除に失敗しました。',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      toast({
        title: 'エラー',
        description: 'プロジェクトの削除に失敗しました。',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredProjects = filter === 'all'
    ? projects
    : projects.filter(p => p.status === filter)

  const activeCount = projects.filter(p => p.status === 'active').length
  const totalAppointments = Object.values(stats).reduce((sum, s) => sum + s.total_appointments, 0)
  const totalCalls = Object.values(stats).reduce((sum, s) => sum + s.total_calls, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* エラー表示 */}
        {error && (
          <ErrorAlert
            message={error}
            onRetry={() => loadData()}
          />
        )}

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FolderKanban className="w-7 h-7 text-blue-600" />
              プロジェクト管理
            </h1>
            <p className="text-gray-500 mt-1">
              {activeCount}件稼働中 / 全{projects.length}件
            </p>
          </div>
          <Link href="/director/projects/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新規プロジェクト
            </Button>
          </Link>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">稼働プロジェクト</p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
                <FolderKanban className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">本日の架電数</p>
                  <p className="text-2xl font-bold">
                    {Object.values(stats).reduce((sum, s) => sum + s.today_calls, 0)}
                  </p>
                </div>
                <Phone className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">累計アポ獲得</p>
                  <p className="text-2xl font-bold">{totalAppointments}</p>
                </div>
                <Target className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">平均アポ率</p>
                  <p className="text-2xl font-bold">
                    {totalCalls > 0 ? ((totalAppointments / totalCalls) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* フィルター */}
        <div className="flex gap-2">
          {['all', 'active', 'paused', 'draft', 'completed'].map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'すべて' : statusConfig[status]?.label || status}
              {status !== 'all' && (
                <span className="ml-1 text-xs">
                  ({projects.filter(p => p.status === status).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* プロジェクト一覧 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">プロジェクトがありません</p>
              <Link href="/director/projects/new">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  最初のプロジェクトを作成
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => {
              const projectStats = stats[project.id]
              const statusConf = statusConfig[project.status] || statusConfig.draft
              const appointmentRate = projectStats
                ? projectStats.total_calls > 0
                  ? ((projectStats.total_appointments / projectStats.total_calls) * 100).toFixed(1)
                  : '0'
                : '0'
              const isLowRate = parseFloat(appointmentRate) < (project.min_appointment_rate || 0.5) && (projectStats?.total_calls || 0) > 50

              return (
                <Card key={project.id} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {(project.client as { name: string } | undefined)?.name || 'クライアント未設定'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusConf.variant} className="flex items-center gap-1 shrink-0">
                          {statusConf.icon}
                          {statusConf.label}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(project)}>
                              <Edit className="w-4 h-4 mr-2" />
                              編集
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(project)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                      {/* メトリクス */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-xs text-blue-600">架電数</p>
                          <p className="text-lg font-bold text-blue-700">
                            {projectStats?.total_calls || 0}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2">
                          <p className="text-xs text-green-600">アポ</p>
                          <p className="text-lg font-bold text-green-700">
                            {projectStats?.total_appointments || 0}
                          </p>
                        </div>
                        <div className={`rounded-lg p-2 ${isLowRate ? 'bg-red-50' : 'bg-purple-50'}`}>
                          <p className={`text-xs ${isLowRate ? 'text-red-600' : 'text-purple-600'}`}>アポ率</p>
                          <p className={`text-lg font-bold ${isLowRate ? 'text-red-700' : 'text-purple-700'}`}>
                            {appointmentRate}%
                          </p>
                        </div>
                      </div>

                      {/* 低アポ率警告 */}
                      {isLowRate && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          撤退ライン以下 - ピボット検討を推奨
                        </div>
                      )}
                    </div>

                    {/* 詳細情報 */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {projectStats?.active_operators || 0}名
                      </div>
                      <div>残{projectStats?.remaining_companies || 0}社</div>
                      <Link href={`/director/projects/${project.id}`}>
                        <div className="flex items-center gap-1 text-blue-600 hover:text-blue-700 cursor-pointer">
                          詳細 <ArrowRight className="w-3 h-3" />
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>プロジェクトを編集</DialogTitle>
            <DialogDescription>
              プロジェクトの情報を更新してください
            </DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">プロジェクト名</Label>
                <Input
                  id="edit-name"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  placeholder="プロジェクト名"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">説明</Label>
                <Textarea
                  id="edit-description"
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  placeholder="プロジェクトの説明"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">ステータス</Label>
                <Select value={editingProject.status} onValueChange={(value) => setEditingProject({ ...editingProject, status: value as Project['status'] })}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="active">稼働中</SelectItem>
                    <SelectItem value="paused">一時停止</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="archived">アーカイブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-daily-target">日次架電目標</Label>
                <Input
                  id="edit-daily-target"
                  type="number"
                  value={editingProject.daily_call_target}
                  onChange={(e) => setEditingProject({ ...editingProject, daily_call_target: parseInt(e.target.value) || 0 })}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="edit-weekly-target">週次アポ目標</Label>
                <Input
                  id="edit-weekly-target"
                  type="number"
                  value={editingProject.weekly_appointment_target}
                  onChange={(e) => setEditingProject({ ...editingProject, weekly_appointment_target: parseInt(e.target.value) || 0 })}
                  placeholder="3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>プロジェクトを削除しますか？</DialogTitle>
            <DialogDescription>
              プロジェクト「{projectToDelete?.name}」を削除しますか？関連データも削除されます。この操作は取り消すことができません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '削除中...' : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
