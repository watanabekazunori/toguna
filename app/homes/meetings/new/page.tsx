'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  createMeeting,
  getDeal,
  getCurrentHomesUser,
  listApprovals,
  listUsers,
  listMeetingsByDeal,
  updateDeal,
} from '@/lib/homes/api'
import {
  APPRAISAL_TYPES,
  MEETING_NG_REASONS,
  PROPOSAL_PLANS,
  YOMI_LABEL,
  YOMI_RATE,
  type HomesApproval,
  type HomesUser,
  type Yomi,
} from '@/lib/homes/types'

type MeetingStatus = 'done' | 'rescheduled' | 'disappeared'

function MeetingNewInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const dealId = sp.get('deal_id') ?? ''

  const [me, setMe] = useState<HomesUser | null>(null)
  const [closers, setClosers] = useState<HomesUser[]>([])
  const [approvals, setApprovals] = useState<HomesApproval[]>([])
  const [companyName, setCompanyName] = useState('')
  const [nextSeq, setNextSeq] = useState(1)
  const [saving, setSaving] = useState(false)

  const [status, setStatus] = useState<MeetingStatus>('done')
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [meetingType, setMeetingType] = useState<'phone' | 'web'>('web')
  const [contactPersonName, setContactPersonName] = useState('')
  const [contactPersonRole, setContactPersonRole] = useState('')
  const [meetingResult, setMeetingResult] = useState<'positive' | 'ng' | ''>('')
  const [ngReason, setNgReason] = useState('')
  const [meetingContent, setMeetingContent] = useState('')
  const [proposalPlan, setProposalPlan] = useState<string>('')
  const [saleSlot, setSaleSlot] = useState<number | ''>('')
  const [rentSlot, setRentSlot] = useState<number | ''>('')
  const [optionsStr, setOptionsStr] = useState('')
  const [appraisalMax, setAppraisalMax] = useState<number | ''>('')
  const [appraisalTypes, setAppraisalTypes] = useState<string[]>([])
  const [initialFee, setInitialFee] = useState<number | ''>('')
  const [runningFee, setRunningFee] = useState<number | ''>('')
  const [discountPeriod, setDiscountPeriod] = useState<number | ''>('')
  const [yomi, setYomi] = useState<Yomi | ''>('')
  const [issueAgreement, setIssueAgreement] = useState('')
  const [meetingPeriod, setMeetingPeriod] = useState('')
  const [auditDate, setAuditDate] = useState('')
  const [bYomiDate, setBYomiDate] = useState('')
  const [aYomiDate, setAYomiDate] = useState('')
  const [wonDate, setWonDate] = useState('')
  const [lostDate, setLostDate] = useState('')
  const [approvalId, setApprovalId] = useState('')
  const [nextContent, setNextContent] = useState('')
  const [nextDate, setNextDate] = useState('')

  const [rescheduleReason, setRescheduleReason] = useState('')
  const [disappearReason, setDisappearReason] = useState('')

  useEffect(() => {
    void (async () => {
      if (!dealId) return
      const [u, allUsers, apps, deal, prevMtgs] = await Promise.all([
        getCurrentHomesUser(),
        listUsers({ role: 'CLOSER' }),
        listApprovals(),
        getDeal(dealId),
        listMeetingsByDeal(dealId),
      ])
      setMe(u)
      setClosers(allUsers as HomesUser[])
      setApprovals(apps)
      const d = deal as { homes_companies?: { company_name: string } } | null
      setCompanyName(d?.homes_companies?.company_name ?? '')
      setNextSeq(prevMtgs.length + 1)
      setScheduledAt(new Date().toISOString().slice(0, 16))
    })()
  }, [dealId])

  function toggleAppraisalType(t: string) {
    setAppraisalTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )
  }

  async function submit() {
    if (!dealId) return alert('deal_id 不正')
    setSaving(true)
    try {
      const base = {
        deal_id: dealId,
        closer_user_id: me?.id ?? null,
        meeting_seq: nextSeq,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        meeting_type: meetingType,
        status,
        contact_person_name: contactPersonName || null,
        contact_person_role: contactPersonRole || null,
        meeting_content: meetingContent || null,
        created_by: me?.id ?? null,
      }

      if (status === 'rescheduled') {
        await createMeeting({ ...base, ng_reason: rescheduleReason || null })
        await updateDeal(dealId, {
          status: 'rescheduled',
          reschedule_reason: rescheduleReason || null,
        })
      } else if (status === 'disappeared') {
        await createMeeting({ ...base, ng_reason: disappearReason || null })
        await updateDeal(dealId, {
          status: 'disappeared',
          disappear_reason: disappearReason || null,
        })
      } else {
        const yomiVal = (yomi || null) as Yomi | null
        const detail = {
          meeting_result: meetingResult || null,
          ng_reason: meetingResult === 'ng' ? ngReason || null : null,
          proposal_plan: proposalPlan || null,
          sale_slot_count: saleSlot === '' ? null : Number(saleSlot),
          rent_slot_count: rentSlot === '' ? null : Number(rentSlot),
          options: optionsStr ? optionsStr.split(/[,、\s]+/).filter(Boolean) : null,
          appraisal_max_count: appraisalMax === '' ? null : Number(appraisalMax),
          appraisal_types: appraisalTypes.length ? appraisalTypes : null,
          initial_fee: initialFee === '' ? null : Number(initialFee),
          running_fee: runningFee === '' ? null : Number(runningFee),
          running_discount_period_months: discountPeriod === '' ? null : Number(discountPeriod),
          yomi: yomiVal,
          yomi_rate: yomiVal ? YOMI_RATE[yomiVal] : null,
          issue_agreement: issueAgreement || null,
          meeting_period: meetingPeriod || null,
          audit_date: auditDate || null,
          b_yomi_date: bYomiDate || null,
          a_yomi_date: aYomiDate || null,
          won_date: wonDate || null,
          lost_date: lostDate || null,
          approval_id: approvalId || null,
          next_content: nextContent || null,
          next_date: nextDate || null,
        }
        await createMeeting({ ...base, ...detail })
      }

      router.push(`/homes/deals/${dealId}`)
    } catch (e) {
      alert(`保存エラー: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!dealId) {
    return (
      <div className="ink-card">
        <p className="muted">deal_id が指定されていません。</p>
        <Link href="/homes/deals" className="ink-btn" style={{ marginTop: 12 }}>案件管理表に戻る</Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <header className="between">
        <div>
          <Link href={`/homes/deals/${dealId}`} className="caption" style={{ color: 'var(--accent-sub)' }}>← {companyName || '案件詳細'}</Link>
          <h1>商談記録 ({nextSeq}回目)</h1>
          <p className="caption muted">F-4 / クローザー商談実施フォーム</p>
        </div>
      </header>

      <section className="ink-card">
        <h3>商談化判定</h3>
        <div className="row-tight" style={{ marginTop: 8 }}>
          {(['done', 'rescheduled', 'disappeared'] as MeetingStatus[]).map((s) => (
            <button
              key={s}
              className={`ink-btn ${status === s ? 'primary' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'done' ? '商談実施' : s === 'rescheduled' ? 'リスケ' : '消滅'}
            </button>
          ))}
        </div>
      </section>

      <section className="ink-card">
        <h3>共通項目</h3>
        <div className="grid-12" style={{ marginTop: 12 }}>
          <label className="col-span-3">
            <span className="caption muted">商談日時</span>
            <input
              className="ink-input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label className="col-span-3">
            <span className="caption muted">商談種別</span>
            <select className="ink-select" value={meetingType} onChange={(e) => setMeetingType(e.target.value as 'phone' | 'web')}>
              <option value="web">WEB</option>
              <option value="phone">電話</option>
            </select>
          </label>
          <label className="col-span-3">
            <span className="caption muted">先方氏名</span>
            <input className="ink-input" value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} />
          </label>
          <label className="col-span-3">
            <span className="caption muted">役職</span>
            <input className="ink-input" value={contactPersonRole} onChange={(e) => setContactPersonRole(e.target.value)} />
          </label>
          <label className="col-span-12">
            <span className="caption muted">商談内容メモ</span>
            <textarea className="ink-textarea" rows={3} value={meetingContent} onChange={(e) => setMeetingContent(e.target.value)} />
          </label>
        </div>
      </section>

      {status === 'done' && (
        <>
          <section className="ink-card">
            <h3>商談結果</h3>
            <div className="row-tight" style={{ marginTop: 8 }}>
              <button className={`ink-btn ${meetingResult === 'positive' ? 'success' : ''}`} onClick={() => setMeetingResult('positive')}>進行中/受注</button>
              <button className={`ink-btn ${meetingResult === 'ng' ? 'danger' : ''}`} onClick={() => setMeetingResult('ng')}>NG</button>
            </div>
            {meetingResult === 'ng' && (
              <label style={{ display: 'block', marginTop: 12 }}>
                <span className="caption muted">NG理由</span>
                <select className="ink-select" value={ngReason} onChange={(e) => setNgReason(e.target.value)}>
                  <option value="">選択</option>
                  {MEETING_NG_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            )}
          </section>

          <section className="ink-card">
            <h3>提案プラン (E〜Q列)</h3>
            <div className="grid-12" style={{ marginTop: 12 }}>
              <label className="col-span-4">
                <span className="caption muted">提案プラン</span>
                <select className="ink-select" value={proposalPlan} onChange={(e) => setProposalPlan(e.target.value)}>
                  <option value="">選択</option>
                  {PROPOSAL_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="col-span-2">
                <span className="caption muted">売買枠数</span>
                <input className="ink-input" type="number" min={0} value={saleSlot} onChange={(e) => setSaleSlot(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="col-span-2">
                <span className="caption muted">賃貸枠数</span>
                <input className="ink-input" type="number" min={0} value={rentSlot} onChange={(e) => setRentSlot(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="col-span-4">
                <span className="caption muted">オプション (カンマ区切)</span>
                <input className="ink-input" value={optionsStr} onChange={(e) => setOptionsStr(e.target.value)} />
              </label>
              <label className="col-span-3">
                <span className="caption muted">査定設定上限</span>
                <input className="ink-input" type="number" min={0} value={appraisalMax} onChange={(e) => setAppraisalMax(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <div className="col-span-9">
                <span className="caption muted">査定種別 (複数可)</span>
                <div className="row-tight" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  {APPRAISAL_TYPES.map((t) => (
                    <label key={t} className={`ink-badge ${appraisalTypes.includes(t) ? 'ink-badge-accent' : ''}`} style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={appraisalTypes.includes(t)} onChange={() => toggleAppraisalType(t)} style={{ marginRight: 4 }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <label className="col-span-4">
                <span className="caption muted">イニシャル金額 (円)</span>
                <input className="ink-input mono" type="number" min={0} value={initialFee} onChange={(e) => setInitialFee(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="col-span-4">
                <span className="caption muted">ランニング金額 (円)</span>
                <input className="ink-input mono" type="number" min={0} value={runningFee} onChange={(e) => setRunningFee(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="col-span-4">
                <span className="caption muted">値引き期間 (月)</span>
                <input className="ink-input mono" type="number" min={0} value={discountPeriod} onChange={(e) => setDiscountPeriod(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
            </div>
          </section>

          <section className="ink-card">
            <h3>ヨミ判定</h3>
            <div className="row-tight" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {(Object.keys(YOMI_LABEL) as Yomi[]).map((y) => (
                <button
                  key={y}
                  className={`ink-btn ${yomi === y ? 'primary' : ''}`}
                  onClick={() => setYomi(y)}
                >
                  {YOMI_LABEL[y]}<span className="caption mono" style={{ marginLeft: 4 }}>{(YOMI_RATE[y] * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
            <div className="grid-12" style={{ marginTop: 12 }}>
              <label className="col-span-6">
                <span className="caption muted">課題合意</span>
                <input className="ink-input" value={issueAgreement} onChange={(e) => setIssueAgreement(e.target.value)} placeholder="例: 売却査定の課題合意" />
              </label>
              <label className="col-span-6">
                <span className="caption muted">商談時期</span>
                <input className="ink-input" value={meetingPeriod} onChange={(e) => setMeetingPeriod(e.target.value)} placeholder="例: 5月中旬" />
              </label>
              <label className="col-span-3">
                <span className="caption muted">監査日</span>
                <input className="ink-input mono" type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
              </label>
              <label className="col-span-3">
                <span className="caption muted">Bヨミ日</span>
                <input className="ink-input mono" type="date" value={bYomiDate} onChange={(e) => setBYomiDate(e.target.value)} />
              </label>
              <label className="col-span-3">
                <span className="caption muted">Aヨミ日</span>
                <input className="ink-input mono" type="date" value={aYomiDate} onChange={(e) => setAYomiDate(e.target.value)} />
              </label>
              <label className="col-span-3">
                <span className="caption muted">受注日</span>
                <input className="ink-input mono" type="date" value={wonDate} onChange={(e) => setWonDate(e.target.value)} />
              </label>
              <label className="col-span-6">
                <span className="caption muted">失注日</span>
                <input className="ink-input mono" type="date" value={lostDate} onChange={(e) => setLostDate(e.target.value)} />
              </label>
              <label className="col-span-6">
                <span className="caption muted">稟議番号</span>
                <select className="ink-select" value={approvalId} onChange={(e) => setApprovalId(e.target.value)}>
                  <option value="">選択しない</option>
                  {approvals.map((a) => <option key={a.id} value={a.id}>{a.approval_no} {a.title ?? ''}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="ink-card">
            <h3>NEXT</h3>
            <div className="grid-12" style={{ marginTop: 12 }}>
              <label className="col-span-8">
                <span className="caption muted">次回内容</span>
                <input className="ink-input" value={nextContent} onChange={(e) => setNextContent(e.target.value)} />
              </label>
              <label className="col-span-4">
                <span className="caption muted">次回日付</span>
                <input className="ink-input mono" type="date" min={new Date().toISOString().slice(0, 10)} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </label>
            </div>
          </section>
        </>
      )}

      {status === 'rescheduled' && (
        <section className="ink-card">
          <h3>リスケ理由</h3>
          <textarea className="ink-textarea" rows={4} value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} placeholder="自由記載" />
        </section>
      )}

      {status === 'disappeared' && (
        <section className="ink-card">
          <h3>消滅理由</h3>
          <textarea className="ink-textarea" rows={4} value={disappearReason} onChange={(e) => setDisappearReason(e.target.value)} placeholder="自由記載" />
        </section>
      )}

      <div className="row-tight" style={{ justifyContent: 'flex-end' }}>
        <Link href={`/homes/deals/${dealId}`} className="ink-btn">キャンセル</Link>
        <button className="ink-btn primary" disabled={saving} onClick={submit}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

export default function MeetingNewPage() {
  return (
    <Suspense fallback={<p className="muted">読込中...</p>}>
      <MeetingNewInner />
    </Suspense>
  )
}
