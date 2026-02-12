'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  FileText,
  FileJson,
  FileSpreadsheet,
  File,
  Upload,
  Trash2,
  ArrowLeft,
  Loader,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UploadedDocument {
  id: string
  project_id: string
  file_name: string
  file_type: string
  file_url: string
  storage_path: string
  uploaded_by: string
  description: string
  is_strategy_source: boolean
  extracted_text: string | null
  created_at: string
}

interface UploadFormState {
  fileName: string
  description: string
  isStrategySource: boolean
  isLoading: boolean
  error: string | null
}

export default function DocumentsPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const projectId = params.id as string

  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    fileName: '',
    description: '',
    isStrategySource: false,
    isLoading: false,
    error: null,
  })

  const supabase = createClient()

  // Auth check
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.push('/director/login')
    }
  }, [authLoading, isDirector, router])

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (queryError) {
        setError(`ドキュメント取得エラー: ${queryError.message}`)
        return
      }

      setDocuments(data || [])
    } catch (err) {
      setError('ドキュメントの取得に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, supabase])

  useEffect(() => {
    if (projectId) {
      fetchDocuments()
    }
  }, [projectId, fetchDocuments])

  // Delete document
  const handleDelete = useCallback(
    async (documentId: string) => {
      if (!projectId) return

      try {
        setIsDeleting(true)
        const { error: deleteError } = await supabase
          .from('uploaded_documents')
          .delete()
          .eq('id', documentId)
          .eq('project_id', projectId)

        if (deleteError) {
          setError(`削除エラー: ${deleteError.message}`)
          return
        }

        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
        setDeleteConfirm(null)
      } catch (err) {
        setError('ドキュメントの削除に失敗しました')
        console.error(err)
      } finally {
        setIsDeleting(false)
      }
    },
    [projectId, supabase]
  )

  // Handle file upload (mock - in real implementation would upload to storage)
  const handleUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!projectId || !user) return

      try {
        setUploadForm((prev) => ({ ...prev, isLoading: true, error: null }))

        // In a real implementation, you would:
        // 1. Upload file to storage bucket
        // 2. Get file_url from storage
        // 3. Extract text if needed
        // 4. Insert record into database

        const newDocument: UploadedDocument = {
          id: `doc_${Date.now()}`,
          project_id: projectId,
          file_name: uploadForm.fileName,
          file_type: 'application/pdf', // Would be determined by actual file
          file_url: `https://storage.example.com/${uploadForm.fileName}`,
          storage_path: `projects/${projectId}/${uploadForm.fileName}`,
          uploaded_by: user.id || 'unknown',
          description: uploadForm.description,
          is_strategy_source: uploadForm.isStrategySource,
          extracted_text: null,
          created_at: new Date().toISOString(),
        }

        const { error: insertError } = await supabase
          .from('uploaded_documents')
          .insert([newDocument])

        if (insertError) {
          setUploadForm((prev) => ({
            ...prev,
            error: `アップロードエラー: ${insertError.message}`,
          }))
          return
        }

        setDocuments((prev) => [newDocument, ...prev])
        setUploadForm({
          fileName: '',
          description: '',
          isStrategySource: false,
          isLoading: false,
          error: null,
        })
        setShowUploadForm(false)
      } catch (err) {
        setUploadForm((prev) => ({
          ...prev,
          error: 'ファイルのアップロードに失敗しました',
        }))
        console.error(err)
      }
    },
    [projectId, user, supabase, uploadForm.fileName, uploadForm.description, uploadForm.isStrategySource]
  )

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
    if (fileType.includes('sheet') || fileType.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />
    if (fileType.includes('json')) return <FileJson className="w-5 h-5 text-blue-500" />
    return <File className="w-5 h-5 text-gray-500" />
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isDirector) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/director/projects/${projectId}`}
                className="inline-flex items-center gap-2 text-white hover:text-purple-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <h1 className="text-2xl font-bold text-white">TOGUNA</h1>
            </div>
            <Badge className="bg-purple-600/80 text-white border-purple-400/50">
              Director
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">プロジェクトドキュメント</h2>
          <p className="text-gray-300">プロジェクトにアップロードされたドキュメントを管理します</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 bg-red-500/10 border-red-500/30 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-200 text-xs mt-1 underline"
              >
                閉じる
              </button>
            </div>
          </Card>
        )}

        {/* Upload Form */}
        {showUploadForm && (
          <Card className="mb-6 bg-white/5 border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">新しいドキュメントをアップロード</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ファイル名
                </label>
                <Input
                  type="text"
                  placeholder="ファイル名を入力"
                  value={uploadForm.fileName}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, fileName: e.target.value }))
                  }
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  説明
                </label>
                <Input
                  type="text"
                  placeholder="ドキュメントの説明を入力"
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="strategySource"
                  checked={uploadForm.isStrategySource}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      isStrategySource: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="strategySource" className="text-sm text-gray-300 cursor-pointer">
                  戦略ソースとして使用
                </label>
              </div>

              {uploadForm.error && (
                <p className="text-red-400 text-sm">{uploadForm.error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={uploadForm.isLoading || !uploadForm.fileName}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {uploadForm.isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      アップロード
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Upload Button */}
        {!showUploadForm && (
          <div className="mb-6">
            <Button
              onClick={() => setShowUploadForm(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              ドキュメントをアップロード
            </Button>
          </div>
        )}

        {/* Documents List */}
        {isLoading ? (
          <Card className="bg-white/5 border-white/10 p-8 text-center">
            <Loader className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-400">ドキュメントを読み込み中...</p>
          </Card>
        ) : documents.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-50" />
            <p className="text-gray-400">アップロードされたドキュメントはありません</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="bg-white/5 border-white/10 p-6 hover:bg-white/10 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getFileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">
                          {doc.file_name}
                        </h3>
                        {doc.is_strategy_source && (
                          <Badge className="bg-amber-600/80 text-white border-amber-400/50">
                            戦略ソース
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{doc.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>アップロード日: {new Date(doc.created_at).toLocaleDateString('ja-JP')}</span>
                        <span>ファイル形式: {doc.file_type}</span>
                        {doc.extracted_text && (
                          <Badge className="bg-green-600/20 text-green-300 border-green-400/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            テキスト抽出済
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                      onClick={() => {
                        if (doc.file_url) window.open(doc.file_url, '_blank')
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {deleteConfirm === doc.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => handleDelete(doc.id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {isDeleting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            '削除'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDeleteConfirm(null)}
                          className="bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setDeleteConfirm(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
