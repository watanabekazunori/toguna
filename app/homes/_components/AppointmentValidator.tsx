'use client'

import { useMemo, useState } from 'react'

/**
 * G-02: アポ成立 4 点バリデーションモーダル
 *
 * 議事録 00:07:09 — アポ成立は以下 4 点が全て揃って初めて成立:
 * 1. 商談日時確定
 * 2. 担当者名
 * 3. メールアドレス
 * 4. 決済者かどうか (決済者 / 担当者 / 不明)
 *
 * 1 つでも欠けている間は「アポ獲得確定」ボタンが無効化される。
 */

export interface AppointmentDraft {
  scheduledAt: string             // ISO8601 datetime-local
  contactName: string
  contactEmail: string
  decisionMakerStatus: 'decision_maker' | 'contact_person' | 'unknown' | ''
  notes?: string
}

interface Props {
  initial?: Partial<AppointmentDraft>
  onClose: () => void
  onConfirm: (data: AppointmentDraft) => Promise<void> | void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AppointmentValidator({ initial, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<AppointmentDraft>({
    scheduledAt: initial?.scheduledAt ?? '',
    contactName: initial?.contactName ?? '',
    contactEmail: initial?.contactEmail ?? '',
    decisionMakerStatus: (initial?.decisionMakerStatus ?? '') as AppointmentDraft['decisionMakerStatus'],
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const checks = useMemo(() => ({
    datetime: !!draft.scheduledAt && new Date(draft.scheduledAt) > new Date(),
    name: draft.contactName.trim().length >= 1,
    email: EMAIL_RE.test(draft.contactEmail),
    decision: draft.decisionMakerStatus !== '',
  }), [draft])

  const allValid = checks.datetime && checks.name && checks.email && checks.decision
  const passedCount = Object.values(checks).filter(Boolean).length

  async function submit() {
    if (!allValid) return
    setSaving(true)
    try {
      await onConfirm(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ink-modal-backdrop" onClick={onClose}>
      <div className="ink-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <header className="between" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>アポ獲得確定</h2>
            <p className="caption muted" style={{ margin: 0 }}>
              4 点全て揃って初めて成立 ({passedCount}/4)
            </p>
          </div>
          <button className="ink-btn" onClick={onClose}>×</button>
        </header>

        <div className="stack">
          <CheckLine ok={checks.datetime} label="① 商談日時 (未来日時)" />
          <input
            className="ink-input mono"
            type="datetime-local"
            value={draft.scheduledAt}
            onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
          />

          <CheckLine ok={checks.name} label="② 担当者名" />
          <input
            className="ink-input"
            placeholder="例: 田中 一郎"
            value={draft.contactName}
            onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
          />

          <CheckLine ok={checks.email} label="③ メールアドレス" />
          <input
            className="ink-input"
            type="email"
            placeholder="contact@example.com"
            value={draft.contactEmail}
            onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
          />

          <CheckLine ok={checks.decision} label="④ 決済者かどうか" />
          <div className="row-tight" style={{ flexWrap: 'wrap' }}>
            {([
              ['decision_maker', '決済者'],
              ['contact_person', '担当者'],
              ['unknown', '不明'],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={`ink-btn ${draft.decisionMakerStatus === k ? 'primary' : ''}`}
                onClick={() => setDraft({ ...draft, decisionMakerStatus: k })}
              >{l}</button>
            ))}
          </div>

          <label>
            <span className="caption muted">備考(任意)</span>
            <textarea
              className="ink-textarea"
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>

          <div className="row-tight" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="ink-btn" onClick={onClose}>キャンセル</button>
            <button
              className="ink-btn primary"
              disabled={!allValid || saving}
              onClick={submit}
            >
              {saving ? '保存中...' : `アポ確定 (${passedCount}/4)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="row-tight" style={{ alignItems: 'center', gap: 8 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 9999,
        background: ok ? 'var(--success)' : 'var(--text-tertiary)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
      }}>{ok ? '✓' : ''}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  )
}
