'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  nextDialTarget,
  createActivity,
  listActivitiesByCompany,
  listUsers,
} from '@/lib/homes/api'
import {
  CALL_RESTRICTION_LABEL,
  PRIMARY_LABEL,
  SECONDARY_LABEL,
  NG_REASONS,
  APPOINTMENT_KINDS,
  MAIN_BUSINESSES,
  validateAppointment,
  validateAbsence,
  type HomesCompany,
  type HomesActivity,
  type HomesUser,
  type ResultPrimary,
  type ResultSecondary,
} from '@/lib/homes/types'
import { createClient } from '@/lib/supabase/client'
import { CallWindowGuard } from '@/app/homes/_components/CallWindowGuard'
import { CloserPicker } from '@/app/homes/_components/CloserPicker'

type Step = 'idle' | 'ringing' | 'primary' | 'responder' | 'secondary' | 'detail' | 'saving'

// JST ISO string helper (議事録 GAP F-01/F-02 timezone fix)
function jstIso(d: Date = new Date()): string {
  const tzOffset = 9 * 60 // JST = UTC+9
  const local = new Date(d.getTime() + tzOffset * 60 * 1000)
  return local.toISOString().replace('Z', '+09:00')
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function CallPage() {
  const [me, setMe] = useState<HomesUser | null>(null)
  const [meError, setMeError] = useState<string | null>(null)
  const [users, setUsers] = useState<HomesUser[]>([])
  const [target, setTarget] = useState<HomesCompany | null>(null)
  const [history, setHistory] = useState<HomesActivity[]>([])
  const [step, setStep] = useState<Step>('idle')
  const [primary, setPrimary] = useState<ResultPrimary | null>(null)
  const [secondary, setSecondary] = useState<ResultSecondary | null>(null)
  const [responder, setResponder] = useState<'representative' | 'decision_maker' | 'contact_person' | null>(null)
  const [responderName, setResponderName] = useState('')
  const [operatorLog, setOperatorLog] = useState('')
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null)
  const [todayStats, setTodayStats] = useState({ calls: 0, contacts: 0, appointments: 0 })

  // フォーム
  const [appointment, setAppointment] = useState({
    date: '',
    time: '',
    type: 'phone' as 'phone' | 'web',
    closer_user_id: '',
    appointment_kind: '',
    handover_memo: '',
    status: 'confirmed' as 'pending' | 'confirmed',
    // GAP-H: アポ4点
    contact_name: '',
    contact_email: '',
    is_decision_maker: null as boolean | null,
    // GAP-M: 業態必須化
    main_business: '',
  })
  const [recall, setRecall] = useState({ date: '', time: '', keep_assignee: true })
  const [ngReason, setNgReason] = useState('')
  const [docTarget, setDocTarget] = useState('')

  // GAP-E: 不在モーダル
  const [absenceForm, setAbsenceForm] = useState({ responder_name: '', recall_date: '', recall_time: '', memo: '' })

  // AP-09: prefetch next target in background
  const nextTargetRef = useRef<HomesCompany | null>(null)

  // AP-12: 当日統計をDBから読み込み
  async function loadTodayStats(uid: string) {
    try {
      const supabase = createClient()
      const t = todayJst()
      const { data } = await supabase
        .from('homes_activities')
        .select('result_primary, result_secondary, call_started_at')
        .eq('user_id', uid)
        .gte('call_started_at', `${t}T00:00:00+09:00`)
      if (data) {
        const calls = data.length
        const contacts = data.filter((a: { result_primary?: string }) => a.result_primary === 'contact').length
        const appts = data.filter((a: { result_secondary?: string }) => a.result_secondary === 'appointment').length
        setTodayStats({ calls, contacts, appointments: appts })
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient()
        const { data: auth, error: authErr } = await supabase.auth.getUser()
        if (authErr) {
          setMeError('認証エラー: ' + authErr.message)
          return
        }
        if (auth.user) {
          const { data, error } = await supabase
            .from('homes_users')
            .select('*')
            .eq('auth_user_id', auth.user.id)
            .maybeSingle()
          if (error) {
            setMeError('ユーザー情報取得エラー: ' + error.message)
          } else if (data) {
            setMe(data as HomesUser)
            void loadTodayStats((data as HomesUser).id)
          } else {
            setMeError('homes_users にあなたのレコードがありません。管理者に連絡してください。')
          }
        }
        const us = await listUsers({ role: 'CLOSER' })
        setUsers(us as HomesUser[])
      } catch (e) {
        setMeError('初期化失敗: ' + (e as Error).message)
      }
    })()
  }, [])

  const closers = useMemo(() => users.filter((u) => u.role === 'CLOSER'), [users])

  async function pickNext() {
    if (!me) {
      alert(meError ?? 'homes_users にあなたのレコードがありません')
      return
    }
    // AP-09: use prefetched if available
    let c = nextTargetRef.current
    if (!c) {
      c = await nextDialTarget(me.id)
    } else {
      nextTargetRef.current = null
    }
    if (!c) {
      alert('架電候補がありません')
      return
    }
    setTarget(c)
    const h = await listActivitiesByCompany(c.id)
    setHistory(h)
    setStep('idle')
    resetResult()
    // background prefetch next-next
    void (async () => {
      try {
        const next = await nextDialTarget(me.id)
        if (next && next.id !== c?.id) nextTargetRef.current = next
      } catch {
        // silent
      }
    })()
  }

  function resetResult() {
    setPrimary(null)
    setSecondary(null)
    setResponder(null)
    setResponderName('')
    setOperatorLog('')
    setNgReason('')
    setDocTarget('')
    setAppointment({
      date: '', time: '', type: 'phone', closer_user_id: '', appointment_kind: '',
      handover_memo: '', status: 'confirmed',
      contact_name: '', contact_email: '', is_decision_maker: null, main_business: '',
    })
    setRecall({ date: '', time: '', keep_assignee: true })
    setAbsenceForm({ responder_name: '', recall_date: '', recall_time: '', memo: '' })
  }

  function startCall() {
    if (!target) return
    setCallStartedAt(jstIso())
    setStep('primary')
  }

  function pickPrimary(r: ResultPrimary) {
    setPrimary(r)
    if (r === 'contact') setStep('responder')
    else setStep('detail')
  }

  function pickResponder(role: 'representative' | 'decision_maker' | 'contact_person') {
    setResponder(role)
    setStep('secondary')
  }

  function pickSecondary(s: ResultSecondary) {
    setSecondary(s)
    setStep('detail')
  }

  // GAP-H/G-03: アポ4点バリデーション
  const apptValidation = useMemo(() => {
    if (secondary !== 'appointment') return { ok: true, errors: {} }
    return validateAppointment({
      date: appointment.date,
      time: appointment.time,
      contact_name: appointment.contact_name,
      contact_email: appointment.contact_email,
      is_decision_maker: appointment.is_decision_maker,
    })
  }, [secondary, appointment])

  // GAP-E/AP-07: 不在時バリデーション
  const absenceValidation = useMemo(() => {
    if (primary !== 'absent') return { ok: true, errors: {} }
    return validateAbsence({
      responder_name: absenceForm.responder_name,
      recall_date: absenceForm.recall_date,
    })
  }, [primary, absenceForm])

  // 保存可能判定
  const canSave = useMemo(() => {
    if (!primary) return false
    if (primary === 'absent' && !absenceValidation.ok) return false
    if (secondary === 'appointment') {
      if (!apptValidation.ok) return false
      // GAP-M: 業態必須
      if (!appointment.main_business) return false
      if (!appointment.closer_user_id) return false
    }
    if (secondary === 'recall') {
      if (!recall.date) return false
    }
    if (secondary === 'ng') {
      if (!ngReason) return false // AP-06
    }
    return true
  }, [primary, secondary, absenceValidation, apptValidation, appointment, recall, ngReason])

  async function save() {
    if (!target || !me || !primary) {
      alert('保存に必要な情報が不足しています (法人・ユーザー・第1段階)')
      return
    }
    if (!canSave) {
      alert('入力に不備があります。赤色のフィールドをご確認ください。')
      return
    }
    setStep('saving')
    try {
      const payload: Partial<HomesActivity> = {
        company_id: target.id,
        user_id: me.id,
        call_started_at: callStartedAt ?? jstIso(),
        call_ended_at: jstIso(),
        result_primary: primary,
        responder_role: responder ?? null,
        responder_name: (primary === 'absent' ? absenceForm.responder_name : responderName) || null,
        result_secondary: primary === 'contact' ? secondary : null,
        operator_log: operatorLog || null,
      }
      if (primary === 'absent') {
        Object.assign(payload, {
          recall_date: absenceForm.recall_date || null,
          recall_time: absenceForm.recall_time || null,
          handover_memo: absenceForm.memo || null,
        })
      }
      if (secondary === 'appointment') {
        Object.assign(payload, {
          appointment_date: appointment.date || null,
          appointment_time: appointment.time || null,
          appointment_type: appointment.type,
          closer_user_id: appointment.closer_user_id || null,
          appointment_kind: appointment.appointment_kind || null,
          handover_memo: appointment.handover_memo || null,
          appointment_status: appointment.status,
        })
        // 法人の業態を更新 (GAP-M)
        if (appointment.main_business) {
          try {
            const supabase = createClient()
            await supabase
              .from('homes_companies')
              .update({ main_business: appointment.main_business })
              .eq('id', target.id)
          } catch {
            // silent: 主活動は通す
          }
        }
        // GAP-H 4点情報を deals 側にもセットすべきだがここは activity のみ
        // metadata に潜ませて trigger 側で deals 化
        Object.assign(payload, {
          metadata: {
            contact_name: appointment.contact_name,
            contact_email: appointment.contact_email,
            is_decision_maker: appointment.is_decision_maker,
            main_business: appointment.main_business,
          },
        })
      }
      if (secondary === 'recall') {
        Object.assign(payload, {
          recall_date: recall.date || null,
          recall_time: recall.time || null,
          keep_assignee: recall.keep_assignee,
        })
      }
      if (secondary === 'ng') {
        Object.assign(payload, { ng_reason: ngReason })
      }
      if (secondary === 'document_send') {
        Object.assign(payload, { document_send_target: docTarget || null })
      }
      await createActivity(payload)
      setTodayStats((s) => ({
        calls: s.calls + 1,
        contacts: s.contacts + (primary === 'contact' ? 1 : 0),
        appointments: s.appointments + (secondary === 'appointment' ? 1 : 0),
      }))
      await pickNext()
    } catch (e) {
      alert('保存失敗: ' + (e as Error).message)
      // AP-03: エラー時は detail に戻し state 保持 (resetResult 呼ばない)
      setStep('detail')
    }
  }

  // AP-10: keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        void pickNext()
      } else if (e.key === 'c' && step === 'idle') {
        e.preventDefault()
        startCall()
      } else if (e.key === 's' && step === 'detail' && canSave) {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canSave, me, target])

  if (meError) {
    return (
      <div className="ink-card" style={{ textAlign: 'center', padding: 32 }}>
        <h2>エラー</h2>
        <p className="caption muted">{meError}</p>
      </div>
    )
  }

  const today = todayJst()

  return (
    <CallWindowGuard>
      <div className="stack">
        <header className="between">
          <div>
            <h1>コール画面</h1>
            <p className="caption muted">S-02 / 1日180コール想定 / ショートカット: n=次架電 c=発信 s=保存</p>
          </div>
          <div className="row">
            <span className="caption">本日</span>
            <span className="kpi-num" style={{ fontSize: 22 }}>{todayStats.calls}</span>
            <span className="caption">コール</span>
            <span className="kpi-num" style={{ fontSize: 22 }}>{todayStats.contacts}</span>
            <span className="caption">コンタ</span>
            <span className="kpi-num" style={{ fontSize: 22 }}>{todayStats.appointments}</span>
            <span className="caption">アポ</span>
            <button className="ink-btn primary" onClick={pickNext} aria-label="次架電先取得">次架電先取得 (n)</button>
          </div>
        </header>

        {!target ? (
          <div className="ink-card" style={{ textAlign: 'center', padding: 48 }}>
            <p className="muted">「次架電先取得」を押してください (キーボード: n)</p>
          </div>
        ) : (
          <div className="grid-12">
            {/* 法人情報パネル */}
            <section className="ink-card col-span-5">
              <div className="between" style={{ marginBottom: 8 }}>
                <h2>{target.company_name}</h2>
                <span className={`ink-badge ${target.score_priority && target.score_priority <= 2 ? 'ink-badge-hot' : ''}`}>
                  優先度 {target.score_priority ?? '-'}
                </span>
              </div>
              <p className="mono" style={{ fontSize: 18, color: 'var(--accent)' }}>{target.phone}</p>

              <div className="divider" />

              <details open>
                <summary style={{ cursor: 'pointer', fontWeight: 500 }}>法人情報</summary>
                <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', fontSize: 12, marginTop: 8 }}>
                  <dt className="muted">FC</dt><dd>{target.fc_name ?? '-'}</dd>
                  <dt className="muted">エリア</dt><dd>{[target.prefecture, target.city, target.address].filter(Boolean).join(' ') || '-'}</dd>
                  <dt className="muted">業態</dt><dd>{target.main_business ?? '-'}</dd>
                  <dt className="muted">資本金</dt><dd>{target.capital ? target.capital.toLocaleString() + '円' : '-'}</dd>
                  <dt className="muted">従業員</dt><dd>{target.employees ?? '-'}人</dd>
                  <dt className="muted">設立</dt><dd>{target.established_at ?? '-'}</dd>
                  <dt className="muted">宅建免許</dt><dd className="mono">{target.takken_license_no ?? '-'}</dd>
                  <dt className="muted">HP</dt><dd className="mono" style={{ fontSize: 11 }}>{target.homepage ?? '-'}</dd>
                  <dt className="muted">定休日</dt><dd>{target.closed_days ?? '-'}</dd>
                  <dt className="muted">発信規制</dt><dd>{CALL_RESTRICTION_LABEL[target.call_restriction]}</dd>
                  <dt className="muted">最終発信</dt><dd className="mono">{target.last_call_at ?? '-'}</dd>
                  <dt className="muted">発信回数</dt><dd>{target.call_count}</dd>
                  <dt className="muted">無応答数</dt><dd>{(target as HomesCompany).no_answer_count ?? 0} 回 {((target as HomesCompany).no_answer_count ?? 0) >= 10 && <span className="ink-badge ink-badge-warn">低優先</span>}</dd>
                </dl>
              </details>

              <div className="divider" />

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 500 }}>担当者情報</summary>
                <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', fontSize: 12, marginTop: 8 }}>
                  <dt className="muted">代表者</dt><dd>{target.representative_name ?? '-'}</dd>
                  <dt className="muted">代表TEL</dt><dd className="mono">{target.representative_phone ?? '-'}</dd>
                  <dt className="muted">代表Mail</dt><dd className="mono">{target.representative_email ?? '-'}</dd>
                  <dt className="muted">担当者</dt><dd>{target.contact_person_name ?? '-'}</dd>
                  <dt className="muted">担当TEL</dt><dd className="mono">{target.contact_person_phone ?? '-'}</dd>
                  <dt className="muted">担当Mail</dt><dd className="mono">{target.contact_person_email ?? '-'}</dd>
                </dl>
              </details>

              <div className="divider" />

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 500 }}>媒体利用状況</summary>
                <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 12px', fontSize: 12, marginTop: 8 }}>
                  <dt className="muted">HOMES利用</dt><dd>{target.homes_usage ?? '-'}</dd>
                  <dt className="muted">athome 賃貸/売買</dt><dd className="mono">{target.athome_rent_count} / {target.athome_sale_count}</dd>
                  <dt className="muted">SUUMO 賃貸/売買</dt><dd className="mono">{target.suumo_rent_count} / {target.suumo_sale_count}</dd>
                  <dt className="muted">他媒体</dt><dd>{target.other_media ?? '-'}</dd>
                  <dt className="muted">一括査定</dt><dd>{target.bulk_quote_media ?? '-'}</dd>
                </dl>
              </details>
            </section>

            {/* 中: 発信ボタン + 履歴 */}
            <section className="ink-card col-span-3">
              <h3 style={{ marginBottom: 12 }}>発信</h3>
              {step === 'idle' && (
                <button className="ink-btn primary" style={{ width: '100%', padding: 16, fontSize: 16 }} onClick={startCall} aria-label="発信開始">
                  ▶ 発信開始 (c)
                </button>
              )}
              {step !== 'idle' && (
                <div className="ink-card ink-elevated" style={{ background: 'var(--accent)', color: '#fff', textAlign: 'center', padding: 20 }}>
                  <p style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.08em' }}>CALL IN PROGRESS</p>
                  <p className="mono" style={{ fontSize: 22, marginTop: 8 }}>{target.phone}</p>
                </div>
              )}

              <div className="divider" />

              <h3 style={{ marginBottom: 8, fontSize: 14 }}>過去アクティビティ</h3>
              <div className="col-tight" style={{ maxHeight: 260, overflow: 'auto' }}>
                {history.length === 0 ? (
                  <p className="muted caption">履歴なし</p>
                ) : history.map((h) => (
                  <div key={h.id} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                    <div className="between">
                      <span className="mono caption">{h.call_started_at.slice(0, 16).replace('T', ' ')}</span>
                      <span className={`ink-badge ${h.result_secondary === 'appointment' ? 'ink-badge-ok' : h.result_secondary === 'ng' ? 'ink-badge-ng' : ''}`}>
                        {PRIMARY_LABEL[h.result_primary]}
                        {h.result_secondary && ` / ${SECONDARY_LABEL[h.result_secondary]}`}
                      </span>
                    </div>
                    {h.recording_url && (
                      <a href={h.recording_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--primary)' }}>▶ 録音再生</a>
                    )}
                    {h.operator_log && <p style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{h.operator_log}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* 右: 結果記録 */}
            <section className="ink-card col-span-4">
              <h3 style={{ marginBottom: 12 }}>結果記録</h3>

              {step === 'idle' && <p className="muted">発信開始してください (c キー)</p>}

              {step === 'primary' && (
                <div className="col-tight">
                  <p className="caption">第1段階: コール結果</p>
                  {(['no_answer', 'absent', 'reception_ng', 'contact'] as ResultPrimary[]).map((r) => (
                    <button key={r} className="ink-btn" onClick={() => pickPrimary(r)} style={{ justifyContent: 'flex-start' }}>
                      {PRIMARY_LABEL[r]}
                    </button>
                  ))}
                </div>
              )}

              {step === 'responder' && (
                <div className="col-tight">
                  <p className="caption">応対者 (必須)</p>
                  {([
                    ['representative', '代表'],
                    ['decision_maker', '決裁者'],
                    ['contact_person', '担当者'],
                  ] as const).map(([k, l]) => (
                    <button key={k} className="ink-btn" onClick={() => pickResponder(k)} style={{ justifyContent: 'flex-start' }}>
                      {l}
                    </button>
                  ))}
                  <label className="ink-label" style={{ marginTop: 8 }}>架電先人物名</label>
                  <input className="ink-input" value={responderName} onChange={(e) => setResponderName(e.target.value)} />
                </div>
              )}

              {step === 'secondary' && (
                <div className="col-tight">
                  <p className="caption">第3段階: コンタクト後分岐</p>
                  {(['appointment', 'lead', 'recall', 'document_send', 'ng'] as ResultSecondary[]).map((s) => (
                    <button key={s} className="ink-btn" onClick={() => pickSecondary(s)} style={{ justifyContent: 'flex-start' }}>
                      {SECONDARY_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}

              {step === 'detail' && primary && (
                <div className="col-tight">
                  <div className="row-tight" style={{ marginBottom: 8 }}>
                    <span className="ink-badge">{PRIMARY_LABEL[primary]}</span>
                    {secondary && <span className="ink-badge ink-badge-accent">{SECONDARY_LABEL[secondary]}</span>}
                    <button className="ink-btn" style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11 }} onClick={() => setStep(primary === 'contact' ? 'secondary' : 'primary')}>戻る</button>
                  </div>

                  {/* GAP-E/AP-07: 不在時必須入力 */}
                  {primary === 'absent' && (
                    <div className="col-tight" style={{ background: 'var(--bg-tint)', padding: 12, borderRadius: 8 }}>
                      <p className="caption" style={{ fontWeight: 600 }}>不在情報 (議事録G-05必須)</p>
                      <label className="ink-label">先方氏名 <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input className="ink-input" value={absenceForm.responder_name} onChange={(e) => setAbsenceForm({ ...absenceForm, responder_name: e.target.value })} placeholder="例: 山田 様" />
                      {absenceValidation.errors.responder_name && (
                        <span className="caption" style={{ color: 'var(--danger)' }}>{absenceValidation.errors.responder_name}</span>
                      )}
                      <label className="ink-label">折返し日 <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input type="date" className="ink-input" value={absenceForm.recall_date} min={today} onChange={(e) => setAbsenceForm({ ...absenceForm, recall_date: e.target.value })} />
                      {absenceValidation.errors.callback_at && (
                        <span className="caption" style={{ color: 'var(--danger)' }}>{absenceValidation.errors.callback_at}</span>
                      )}
                      <label className="ink-label">折返し時間 (任意・時間帯指定NG)</label>
                      <input type="time" className="ink-input" value={absenceForm.recall_time} onChange={(e) => setAbsenceForm({ ...absenceForm, recall_time: e.target.value })} />
                      <label className="ink-label">メモ</label>
                      <textarea className="ink-textarea" rows={2} value={absenceForm.memo} onChange={(e) => setAbsenceForm({ ...absenceForm, memo: e.target.value })} />
                    </div>
                  )}

                  {secondary === 'appointment' && (
                    <>
                      <div style={{ background: 'var(--bg-tint)', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                        アポ4点 必須: 日時 / 担当者名 / メール / 決裁者種別 (議事録 GAP-H)
                      </div>

                      <label className="ink-label">商談日 * <span style={{ color: apptValidation.errors.datetime ? 'var(--danger)' : 'var(--text-muted)' }}>{apptValidation.errors.datetime ?? ''}</span></label>
                      <input type="date" className="ink-input" value={appointment.date} min={today} onChange={(e) => setAppointment({ ...appointment, date: e.target.value })} />
                      <label className="ink-label">時間 * (営業時間 09:30-18:30)</label>
                      <input type="time" className="ink-input" value={appointment.time} min="09:30" max="18:30" onChange={(e) => setAppointment({ ...appointment, time: e.target.value })} />

                      <label className="ink-label">担当者名 * <span style={{ color: apptValidation.errors.contact_name ? 'var(--danger)' : 'var(--text-muted)' }}>{apptValidation.errors.contact_name ?? ''}</span></label>
                      <input className="ink-input" value={appointment.contact_name} onChange={(e) => setAppointment({ ...appointment, contact_name: e.target.value })} placeholder="例: 田中 一郎" />

                      <label className="ink-label">メール * <span style={{ color: apptValidation.errors.contact_email ? 'var(--danger)' : 'var(--text-muted)' }}>{apptValidation.errors.contact_email ?? ''}</span></label>
                      <input type="email" className="ink-input" value={appointment.contact_email} onChange={(e) => setAppointment({ ...appointment, contact_email: e.target.value })} placeholder="contact@example.com" />

                      <label className="ink-label">決裁者種別 * <span style={{ color: apptValidation.errors.is_decision_maker ? 'var(--danger)' : 'var(--text-muted)' }}>{apptValidation.errors.is_decision_maker ?? ''}</span></label>
                      <div className="row-tight" style={{ flexWrap: 'wrap' }}>
                        {([
                          [true, '決裁者'],
                          [false, '担当者'],
                        ] as Array<[boolean, string]>).map(([v, l]) => (
                          <button key={String(v)} type="button"
                            className={`ink-btn ${appointment.is_decision_maker === v ? 'primary' : ''}`}
                            onClick={() => setAppointment({ ...appointment, is_decision_maker: v })}>{l}</button>
                        ))}
                      </div>

                      <label className="ink-label">業態 * (GAP-M必須)</label>
                      <select className="ink-select" value={appointment.main_business} onChange={(e) => setAppointment({ ...appointment, main_business: e.target.value })}>
                        <option value="">選択</option>
                        {MAIN_BUSINESSES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>

                      <label className="ink-label">商談種別</label>
                      <select className="ink-select" value={appointment.type} onChange={(e) => setAppointment({ ...appointment, type: e.target.value as 'phone' | 'web' })}>
                        <option value="phone">電話</option>
                        <option value="web">WEB</option>
                      </select>
                      <label className="ink-label">アポ種類</label>
                      <select className="ink-select" value={appointment.appointment_kind} onChange={(e) => setAppointment({ ...appointment, appointment_kind: e.target.value })}>
                        <option value="">選択</option>
                        {APPOINTMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>

                      <label className="ink-label">クローザー指名 * (空き状況確認)</label>
                      {appointment.date ? (
                        <CloserPicker
                          date={appointment.date}
                          selectedId={appointment.closer_user_id}
                          onPick={(id) => setAppointment({ ...appointment, closer_user_id: id })}
                        />
                      ) : (
                        <select className="ink-select" value={appointment.closer_user_id} onChange={(e) => setAppointment({ ...appointment, closer_user_id: e.target.value })}>
                          <option value="">先に商談日を選択してください</option>
                          {closers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}

                      <label className="ink-label">アポステータス</label>
                      <select className="ink-select" value={appointment.status} onChange={(e) => setAppointment({ ...appointment, status: e.target.value as 'pending' | 'confirmed' })}>
                        <option value="confirmed">確定アポ</option>
                        <option value="pending">アポ調</option>
                      </select>
                      <label className="ink-label">引継メモ</label>
                      <textarea className="ink-textarea" rows={3} value={appointment.handover_memo} onChange={(e) => setAppointment({ ...appointment, handover_memo: e.target.value })} />
                    </>
                  )}

                  {secondary === 'recall' && (
                    <>
                      <label className="ink-label">再コール日 *</label>
                      <input type="date" className="ink-input" value={recall.date} min={today} onChange={(e) => setRecall({ ...recall, date: e.target.value })} />
                      <label className="ink-label">再コール時間 (5分前通知用、任意)</label>
                      <input type="time" className="ink-input" value={recall.time} onChange={(e) => setRecall({ ...recall, time: e.target.value })} />
                      <label className="ink-label row-tight">
                        <input type="checkbox" checked={recall.keep_assignee} onChange={(e) => setRecall({ ...recall, keep_assignee: e.target.checked })} />
                        担当者継続
                      </label>
                    </>
                  )}

                  {secondary === 'ng' && (
                    <>
                      <label className="ink-label">NG理由 *</label>
                      <select className="ink-select" value={ngReason} onChange={(e) => setNgReason(e.target.value)}>
                        <option value="">選択 (必須)</option>
                        {NG_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </>
                  )}

                  {secondary === 'document_send' && (
                    <>
                      <label className="ink-label">送付先メール</label>
                      <input type="email" className="ink-input" value={docTarget} onChange={(e) => setDocTarget(e.target.value)} />
                    </>
                  )}

                  <label className="ink-label">オペレーターログ (発言録/印象/決裁感)</label>
                  <textarea className="ink-textarea" rows={4} value={operatorLog} onChange={(e) => setOperatorLog(e.target.value)} />

                  <button className="ink-btn primary"
                    onClick={save}
                    disabled={!canSave}
                    style={{ marginTop: 8 }}
                    aria-label="記録して次架電へ">
                    {canSave ? '記録して次架電へ (s)' : '入力不備あり'}
                  </button>
                </div>
              )}

              {step === 'saving' && <p className="muted">保存中...</p>}
            </section>
          </div>
        )}
      </div>
    </CallWindowGuard>
  )
}
