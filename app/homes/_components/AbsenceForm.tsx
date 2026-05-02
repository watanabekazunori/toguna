'use client'

import { useState } from 'react'
import { validateAbsence } from '@/lib/homes/types'

interface Props {
  onClose: () => void
  onSubmit: (input: { responder_name: string; recall_date: string; recall_time: string | null; memo?: string }) => Promise<void> | void
}

export function AbsenceForm({ onClose, onSubmit }: Props) {
  const [responderName, setResponderName] = useState('')
  const [recallDate, setRecallDate] = useState('')
  const [recallTime, setRecallTime] = useState('')
  const [memo, setMemo] = useState('')
  const [errors, setErrors] = useState<{ responder_name?: string; callback_at?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateAbsence({ responder_name: responderName, recall_date: recallDate })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await onSubmit({
        responder_name: responderName.trim(),
        recall_date: recallDate,
        recall_time: recallTime || null,
        memo: memo.trim() || undefined,
      })
      onClose()
    } catch (err) {
      alert((err as Error).message ?? '保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = responderName.trim().length > 0 && recallDate.length > 0

  return (
    <div className="ink-modal-backdrop" onClick={onClose}>
      <div
        className="ink-modal"
        style={{ maxWidth: 480, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="stack">
          <div className="between">
            <h3 style={{ margin: 0 }}>不在情報の入力</h3>
            <button type="button" className="ink-btn xs" onClick={onClose}>
              ×
            </button>
          </div>
          <p className="caption muted">先方氏名と折返し日は必須です。</p>

          <div className="col-tight">
            <label className="caption">先方氏名 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              className="ink-input"
              value={responderName}
              onChange={(e) => setResponderName(e.target.value)}
              placeholder="例: 山田 様"
              autoFocus
            />
            {errors.responder_name && (
              <span className="caption" style={{ color: 'var(--danger)' }}>{errors.responder_name}</span>
            )}
          </div>

          <div className="col-tight">
            <label className="caption">折返し日 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="date"
              className="ink-input"
              value={recallDate}
              onChange={(e) => setRecallDate(e.target.value)}
            />
            {errors.callback_at && (
              <span className="caption" style={{ color: 'var(--danger)' }}>{errors.callback_at}</span>
            )}
          </div>

          <div className="col-tight">
            <label className="caption">折返し時間 (任意)</label>
            <input
              type="time"
              className="ink-input"
              value={recallTime}
              onChange={(e) => setRecallTime(e.target.value)}
            />
            <span className="caption muted">時間帯指定不可のお客様は空欄でOK</span>
          </div>

          <div className="col-tight">
            <label className="caption">メモ (任意)</label>
            <textarea
              className="ink-textarea"
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="補足情報があれば入力"
            />
          </div>

          <div className="between" style={{ marginTop: 12 }}>
            <button type="button" className="ink-btn outline" onClick={onClose} disabled={submitting}>
              キャンセル
            </button>
            <button
              type="submit"
              className={`ink-btn ${isValid ? 'primary' : ''}`}
              disabled={!isValid || submitting}
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AbsenceForm
