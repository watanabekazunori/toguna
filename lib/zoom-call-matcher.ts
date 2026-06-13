/**
 * Zoom 通話 → lifull_activities 3 段フォールバックマッチング
 *
 * phone.call_log_completed イベント受信時に、Zoom 通話ログと
 * lifull_activities レコードを以下の優先順位で突合する:
 *
 *   Step 1: zoom_call_id 完全一致 (最優先・確実)
 *   Step 2: zoom_meeting_id + callee_number 複合一致
 *   Step 3: caller_id + started_at ± 60s ファジーマッチ (監査 warning 必須)
 *
 * 全 Step は純粋関数で実装し、DB 依存なしで単体テスト可能にする。
 * I-07 対策: ログに recording_url を含めない。correlation_id を必須付与。
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Step 3 ファジーマッチの許容時刻差 (秒) */
const FUZZY_MATCH_WINDOW_SEC = 60

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** lifull_activities の軽量プロジェクション (マッチングに必要な列のみ) */
export const ActivityProjectionSchema = z.object({
  activity_id: z.string().uuid(),
  zoom_call_id: z.string().nullable().optional(),
  zoom_meeting_id: z.string().nullable().optional(),
  callee_number: z.string().nullable().optional(),
  caller_id: z.string().nullable().optional(),
  call_started_at: z.string().datetime(),
  tenant_id: z.string().min(1),
})

export type ActivityProjection = z.infer<typeof ActivityProjectionSchema>

/** Zoom phone.call_log_completed ペイロード (マッチングに必要な部分) */
export const ZoomCallLogPayloadSchema = z.object({
  call_id: z.string().min(1),
  meeting_id: z.string().nullable().optional(),
  callee_number: z.string().nullable().optional(),
  caller_number: z.string().nullable().optional(),
  start_time: z.string().datetime(),
})

export type ZoomCallLogPayload = z.infer<typeof ZoomCallLogPayloadSchema>

// ---------------------------------------------------------------------------
// Match result types
// ---------------------------------------------------------------------------

export type MatchStep = 'step1_call_id' | 'step2_meeting_callee' | 'step3_fuzzy_time'

export interface MatchSuccess {
  matched: true
  activityId: string
  step: MatchStep
  /** Step 3 の場合は必ず warning を audit log に記録すること */
  requiresAuditWarning: boolean
  /** デバッグ用メタデータ (PII/URL は含めない) */
  matchDetail: Record<string, string | number | boolean>
}

export interface MatchFailure {
  matched: false
  reason: 'no_match'
  triedSteps: MatchStep[]
}

export type MatchResult = MatchSuccess | MatchFailure

// ---------------------------------------------------------------------------
// Step 1: zoom_call_id 完全一致
// ---------------------------------------------------------------------------

/**
 * Step 1: zoom_call_id で完全一致検索する。
 * @param activities マッチング候補 (テナント・時刻で事前フィルタ済みを推奨)
 * @param callId Zoom 通話ログの call_id
 */
export function matchByCallId(
  activities: ActivityProjection[],
  callId: string
): MatchSuccess | null {
  const found = activities.find(
    (a) => a.zoom_call_id !== null && a.zoom_call_id !== undefined && a.zoom_call_id === callId
  )
  if (!found) return null

  return {
    matched: true,
    activityId: found.activity_id,
    step: 'step1_call_id',
    requiresAuditWarning: false,
    matchDetail: { call_id: callId },
  }
}

// ---------------------------------------------------------------------------
// Step 2: zoom_meeting_id + callee_number 複合一致
// ---------------------------------------------------------------------------

/**
 * Step 2: zoom_meeting_id と callee_number の複合一致で検索する。
 * meeting_id または callee_number が未設定のレコードはスキップ。
 *
 * @param activities マッチング候補
 * @param payload Zoom コールログペイロード
 */
export function matchByMeetingCallee(
  activities: ActivityProjection[],
  payload: ZoomCallLogPayload
): MatchSuccess | null {
  if (!payload.meeting_id || !payload.callee_number) return null

  const found = activities.find(
    (a) =>
      a.zoom_meeting_id !== null &&
      a.zoom_meeting_id !== undefined &&
      a.zoom_meeting_id === payload.meeting_id &&
      a.callee_number !== null &&
      a.callee_number !== undefined &&
      normalizePhoneNumber(a.callee_number) === normalizePhoneNumber(payload.callee_number!)
  )
  if (!found) return null

  return {
    matched: true,
    activityId: found.activity_id,
    step: 'step2_meeting_callee',
    requiresAuditWarning: false,
    matchDetail: {
      meeting_id: payload.meeting_id,
      // 電話番号の末尾4桁のみ記録 (PII 配慮)
      callee_last4: payload.callee_number.slice(-4),
    },
  }
}

// ---------------------------------------------------------------------------
// Step 3: caller_id + started_at ± 60s ファジーマッチ
// ---------------------------------------------------------------------------

/**
 * Step 3: caller_id と通話開始時刻 ±60秒 でファジーマッチする。
 * マッチ成功時は必ず requiresAuditWarning = true を返す。
 *
 * 複数候補がある場合は時刻差が最小のものを選択する。
 *
 * @param activities マッチング候補
 * @param payload Zoom コールログペイロード
 */
export function matchByCallerAndTime(
  activities: ActivityProjection[],
  payload: ZoomCallLogPayload
): MatchSuccess | null {
  if (!payload.caller_number) return null

  const payloadStartMs = new Date(payload.start_time).getTime()
  const windowMs = FUZZY_MATCH_WINDOW_SEC * 1000

  // 候補を絞り込み
  const candidates = activities.filter((a) => {
    if (!a.caller_id) return false
    if (normalizePhoneNumber(a.caller_id) !== normalizePhoneNumber(payload.caller_number!)) return false

    const activityStartMs = new Date(a.call_started_at).getTime()
    return Math.abs(activityStartMs - payloadStartMs) <= windowMs
  })

  if (candidates.length === 0) return null

  // 時刻差が最小のものを選択
  let best = candidates[0]
  let bestDiffMs = Math.abs(new Date(best.call_started_at).getTime() - payloadStartMs)

  for (const candidate of candidates.slice(1)) {
    const diff = Math.abs(new Date(candidate.call_started_at).getTime() - payloadStartMs)
    if (diff < bestDiffMs) {
      best = candidate
      bestDiffMs = diff
    }
  }

  return {
    matched: true,
    activityId: best.activity_id,
    step: 'step3_fuzzy_time',
    requiresAuditWarning: true, // 必ず監査ログに warning を残す
    matchDetail: {
      diff_ms: bestDiffMs,
      candidates_count: candidates.length,
      // 電話番号の末尾4桁のみ記録
      caller_last4: payload.caller_number.slice(-4),
    },
  }
}

// ---------------------------------------------------------------------------
// Orchestrator: 3 段フォールバック
// ---------------------------------------------------------------------------

/**
 * 3 段フォールバックマッチングを実行する。
 *
 * Step 1 → Step 2 → Step 3 の順に試み、最初に成功した結果を返す。
 * 全 Step が失敗した場合は MatchFailure を返す。
 *
 * @param activities テナント隔離済みの candidates
 * @param payload Zoom phone.call_log_completed ペイロード
 */
export function matchZoomCallToActivity(
  activities: ActivityProjection[],
  payload: ZoomCallLogPayload
): MatchResult {
  const triedSteps: MatchStep[] = []

  // Step 1
  triedSteps.push('step1_call_id')
  const step1 = matchByCallId(activities, payload.call_id)
  if (step1) return step1

  // Step 2
  triedSteps.push('step2_meeting_callee')
  const step2 = matchByMeetingCallee(activities, payload)
  if (step2) return step2

  // Step 3
  triedSteps.push('step3_fuzzy_time')
  const step3 = matchByCallerAndTime(activities, payload)
  if (step3) return step3

  return { matched: false, reason: 'no_match', triedSteps }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * 電話番号を正規化する (スペース・ハイフン・括弧を除去し +81 / 0 を統一)。
 * マッチング精度向上のため、比較前に両辺に適用する。
 */
export function normalizePhoneNumber(phone: string): string {
  // スペース・ハイフン・括弧を除去
  const cleaned = phone.replace(/[\s\-()]/g, '')
  // +81 を 0 に変換
  if (cleaned.startsWith('+81')) {
    return '0' + cleaned.slice(3)
  }
  return cleaned
}

// END_OF_FILE
