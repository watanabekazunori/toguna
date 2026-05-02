'use client'

import { useRef, useState } from 'react'
import { uploadApplicationPdf } from '@/lib/homes/api'

interface Props {
  orderId: string
  uploadedBy: string
  currentUrl?: string | null
  onUploaded?: (url: string) => void
}

const MAX_BYTES = 10 * 1024 * 1024

export function PdfUploader({ orderId, uploadedBy, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const validate = (file: File): string | null => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'PDFファイルを選択してください'
    }
    if (file.size > MAX_BYTES) {
      return `ファイルサイズは10MB以下にしてください (現在 ${(file.size / 1024 / 1024).toFixed(1)}MB)`
    }
    return null
  }

  const handleFile = async (file: File) => {
    setError(null)
    setDone(false)
    const err = validate(file)
    if (err) {
      setError(err)
      return
    }
    setUploading(true)
    try {
      const result = await uploadApplicationPdf(orderId, file, uploadedBy)
      const url = (result as { url?: string })?.url ?? ''
      setDone(true)
      onUploaded?.(url)
    } catch (e) {
      const msg = (e as Error).message ?? 'アップロードに失敗しました'
      setError(msg)
      alert(msg)
    } finally {
      setUploading(false)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  return (
    <div className="stack">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onChange}
        style={{ display: 'none' }}
      />

      {currentUrl && !done && (
        <div className="ink-card" style={{ padding: 12 }}>
          <div className="between">
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline' }}
            >
              現在の申込書を表示
            </a>
            <button
              className="ink-btn outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              再アップロード
            </button>
          </div>
        </div>
      )}

      {!currentUrl || done ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className="ink-card"
          style={{
            padding: 24,
            textAlign: 'center',
            border: dragOver ? '2px dashed var(--primary)' : '2px dashed var(--border)',
            background: dragOver ? 'var(--bg-tint)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <div className="caption muted" style={{ marginBottom: 12 }}>
            PDFファイルをドラッグ&ドロップ または
          </div>
          <button
            className="ink-btn primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'アップロード中...' : 'ファイルを選択'}
          </button>
          <div className="caption muted" style={{ marginTop: 8 }}>
            最大10MB / PDF形式のみ
          </div>
        </div>
      ) : null}

      {done && (
        <div
          className="ink-badge ink-badge-ok"
          style={{ alignSelf: 'flex-start', padding: '6px 10px' }}
        >
          ✓ アップ完了 + クローザー通知済
        </div>
      )}

      {error && (
        <div className="caption" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default PdfUploader
