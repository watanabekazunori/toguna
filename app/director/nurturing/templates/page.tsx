'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import {
  getDocumentTemplates,
  createDocumentTemplate,
  type DocumentTemplate,
} from '@/lib/nurturing-api'
import { getProjects, type Project } from '@/lib/projects-api'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Trash2,
  Eye,
  Edit2,
  Mail,
  MessageSquare,
  FileIcon,
} from 'lucide-react'
import { toast } from 'sonner'

const TEMPLATE_VARIABLES = ['{{company_name}}', '{{contact_person}}', '{{product_name}}', '{{date}}']

const templateTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  email: { label: 'メール', icon: <Mail className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
  dm: {
    label: 'DM',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'bg-green-100 text-green-800',
  },
  letter: { label: '手紙', icon: <FileIcon className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
}

export default function DocumentTemplatesPage() {
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // 状態管理
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // フォーム状態
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'email' as 'email' | 'dm' | 'letter',
    subject: '',
    body_template: '',
  })

  // 認証確認
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.replace('/')
    }
  }, [authLoading, isDirector, router])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!isDirector) return

      setIsLoading(true)
      try {
        const [projectsData] = await Promise.all([getProjects()])
        setProjects(projectsData)

        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].id)
          const templatesData = await getDocumentTemplates(projectsData[0].id)
          setTemplates(templatesData)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('データの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    if (isDirector) {
      fetchData()
    }
  }, [isDirector])

  // プロジェクト変更時にテンプレートを取得
  useEffect(() => {
    const fetchTemplates = async () => {
      if (selectedProject === 'all' || !isDirector) return

      try {
        const templatesData = await getDocumentTemplates(selectedProject)
        setTemplates(templatesData)
      } catch (error) {
        console.error('Failed to fetch templates:', error)
        toast.error('テンプレートの読み込みに失敗しました')
      }
    }

    if (selectedProject !== 'all') {
      fetchTemplates()
    }
  }, [selectedProject, isDirector])

  // テンプレート作成/更新
  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.body_template || selectedProject === 'all') {
      toast.error('必須項目を入力してください')
      return
    }

    setIsCreating(true)
    try {
      if (editingId) {
        // 更新処理
        const { error } = await supabase
          .from('document_templates')
          .update({
            name: formData.name,
            template_type: formData.template_type,
            subject: formData.subject,
            body_template: formData.body_template,
          })
          .eq('id', editingId)

        if (error) throw error

        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  name: formData.name,
                  template_type: formData.template_type,
                  subject: formData.subject,
                  body_template: formData.body_template,
                }
              : t
          )
        )

        toast.success('テンプレートを更新しました')
      } else {
        // 作成処理
        const newTemplate = await createDocumentTemplate({
          project_id: selectedProject,
          name: formData.name,
          template_type: formData.template_type,
          subject: formData.subject,
          body_template: formData.body_template,
          is_active: true,
          attachment_urls: [],
        })

        if (newTemplate) {
          setTemplates((prev) => [newTemplate, ...prev])
          toast.success('テンプレートを作成しました')
        }
      }

      setFormData({
        name: '',
        template_type: 'email',
        subject: '',
        body_template: '',
      })
      setShowForm(false)
      setEditingId(null)
    } catch (error) {
      console.error('Failed to create/update template:', error)
      toast.error('テンプレートの保存に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  // テンプレート削除
  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const { error } = await supabase.from('document_templates').delete().eq('id', deleteTarget.id)

      if (error) throw error

      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('テンプレートを削除しました')
    } catch (error) {
      console.error('Failed to delete template:', error)
      toast.error('テンプレートの削除に失敗しました')
    }
  }

  // テンプレートのアクティブ/非アクティブ切り替え
  const handleToggleActive = async (template: DocumentTemplate) => {
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id)

      if (error) throw error

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? {
                ...t,
                is_active: !t.is_active,
              }
            : t
        )
      )

      const status = !template.is_active ? '有効' : '無効'
      toast.success(`テンプレートを${status}にしました`)
    } catch (error) {
      console.error('Failed to toggle template status:', error)
      toast.error('テンプレートの更新に失敗しました')
    }
  }

  // テンプレート編集開始
  const handleEditTemplate = (template: DocumentTemplate) => {
    setFormData({
      name: template.name,
      template_type: template.template_type,
      subject: template.subject || '',
      body_template: template.body_template,
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  // フォームキャンセル
  const handleCancelForm = () => {
    setFormData({
      name: '',
      template_type: 'email',
      subject: '',
      body_template: '',
    })
    setShowForm(false)
    setEditingId(null)
  }

  // プレビュー表示（サンプルデータ付き）
  const renderPreview = (template: DocumentTemplate) => {
    let preview = template.body_template

    // サンプルデータに置き換え
    TEMPLATE_VARIABLES.forEach((variable) => {
      const sampleData: Record<string, string> = {
        '{{company_name}}': 'サンプル会社',
        '{{contact_person}}': '山田太郎',
        '{{product_name}}': 'サンプル製品',
        '{{date}}': new Date().toLocaleDateString('ja-JP'),
      }
      preview = preview.replace(new RegExp(variable, 'g'), sampleData[variable] || variable)
    })

    return preview
  }

  // フィルター処理
  const filteredTemplates = templates.filter((template) => {
    if (selectedType !== 'all' && template.template_type !== selectedType) {
      return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-8 h-8 text-blue-600" />
                テンプレート管理
              </h1>
              <p className="text-gray-500 mt-1">ナーチャリング自動化用のテンプレート</p>
            </div>
          </div>

          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新規テンプレート
          </Button>
        </div>

        {/* プロジェクト選択とフィルター */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">プロジェクト</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">テンプレートタイプ</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="email">メール</SelectItem>
                    <SelectItem value="dm">DM</SelectItem>
                    <SelectItem value="letter">手紙</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedType('all')
                  }}
                >
                  リセット
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 新規作成/編集フォーム */}
        {showForm && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingId ? 'テンプレートを編集' : '新規テンプレート作成'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* テンプレート名 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">テンプレート名</label>
                <Input
                  placeholder="例：新規顧客向けウェルカムメール"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              {/* タイプ選択 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    テンプレートタイプ
                  </label>
                  <Select
                    value={formData.template_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        template_type: value as 'email' | 'dm' | 'letter',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">メール</SelectItem>
                      <SelectItem value="dm">DM</SelectItem>
                      <SelectItem value="letter">手紙</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 件名（メール専用） */}
                {formData.template_type === 'email' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">件名</label>
                    <Input
                      placeholder="メールの件名"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* テンプレート本文 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">本文</label>
                  <div className="flex gap-1">
                    {TEMPLATE_VARIABLES.map((variable) => (
                      <button
                        key={variable}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            body_template: prev.body_template + variable,
                          }))
                        }
                        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder="テンプレート本文を入力してください。テンプレート変数を使用できます。"
                  value={formData.body_template}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      body_template: e.target.value,
                    }))
                  }
                  rows={8}
                />
              </div>

              {/* プレビュー */}
              {formData.body_template && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">プレビュー</label>
                  <div className="bg-white border border-gray-300 rounded-md p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {renderPreview({
                      id: '',
                      project_id: '',
                      name: formData.name,
                      subject: formData.subject,
                      body_template: formData.body_template,
                      template_type: formData.template_type,
                      is_active: true,
                      attachment_urls: [],
                      created_at: new Date().toISOString(),
                    })}
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleCancelForm}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleCreateOrUpdate}
                  disabled={isCreating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      {editingId ? '更新' : '作成'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* テンプレート一覧 */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">テンプレートがありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
              const typeConfig = templateTypeConfig[template.template_type]
              return (
                <Card
                  key={template.id}
                  className={`hover:shadow-md transition-shadow ${
                    !template.is_active ? 'bg-gray-50 opacity-60' : ''
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* テンプレート情報 */}
                      <div className="md:col-span-5 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <Badge
                            className={`${typeConfig.color} border-0 flex items-center gap-1`}
                          >
                            {typeConfig.icon}
                            {typeConfig.label}
                          </Badge>
                        </div>
                        {template.subject && (
                          <p className="text-sm text-gray-600">件名: {template.subject}</p>
                        )}
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {template.body_template}
                        </p>
                      </div>

                      {/* ステータス */}
                      <div className="md:col-span-2">
                        <Badge
                          variant="outline"
                          className={
                            template.is_active
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-gray-100 text-gray-800 border-gray-300'
                          }
                        >
                          {template.is_active ? '有効' : '無効'}
                        </Badge>
                      </div>

                      {/* 日付 */}
                      <div className="md:col-span-2 text-right">
                        <p className="text-xs text-gray-500">
                          {new Date(template.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>

                      {/* アクション */}
                      <div className="md:col-span-3 flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowPreview(template.id)}
                          title="プレビュー"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditTemplate(template)}
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={template.is_active ? 'outline' : 'default'}
                          onClick={() => handleToggleActive(template)}
                          title={template.is_active ? '無効にする' : '有効にする'}
                        >
                          {template.is_active ? '無効' : '有効'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(template)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* プレビューダイアログ */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {filteredTemplates.find((t) => t.id === showPreview)?.name} - プレビュー
                  </CardTitle>
                  <button
                    onClick={() => setShowPreview(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredTemplates.find((t) => t.id === showPreview) && (
                  <>
                    {filteredTemplates.find((t) => t.id === showPreview)?.subject && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">件名:</p>
                        <p className="text-sm text-gray-900 font-medium">
                          {renderPreview(filteredTemplates.find((t) => t.id === showPreview)!)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">本文:</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {renderPreview(filteredTemplates.find((t) => t.id === showPreview)!)}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowPreview(null)}>
                    閉じる
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 削除確認ダイアログ */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>テンプレートを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{deleteTarget?.name}」を削除します。この操作は戻せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
