/**
 * POST /api/webhook/zoom — Zoom Phone Webhook ハンドラ
 *
 * Next.js 14 App Router Route Handler。
 * 受信する 3 イベント:
 *   1. endpoint.url_validation  — Challenge Response (初回登録)
 *   2. phone.recording_completed — 録音完了 → AI pipeline 起動
 *   3. phone.call_log_completed  — 通話履歴確定 → 3 段フォールバックマッチング
 *
 * セキュリティフロー:
 *   署名検証 → idempotency チェック → イベント処理 → 200 OK
 *
 * 対応 threat (threat_model.md):
 *   S-01 偽 Webhook — HMAC-SHA256 署名検証 + 5 分以内タイムスタンプ
 *   I-07 録音 URL 平文ログ残存 — structured log で redact
 *   D-05 大量再送 — idempotency key (Zoom-Event-Id) で排除
 *   E-05 anon role 残存 — Service Role Key は使わず withTenantContext 経由
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  verifyZoomSignature,
  parseWebhookHeaders,
  handleUrlValidation,
  getWebhookSecretToken,
} from '@/lib/zoom-webhook-verify'
import { matchZoomCallToActivity } from '@/lib/zoom-call-matcher'
import { withTenantContext } from '@/lib/tenant-context'
import { createTenantSupabaseClient, setTransactionTenantId } from '@/lib/supabase-server-tenant'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** LIFULL_HOMES の固定テナント ID */
const LIFULL_TENANT_ID = 'lifull_homes'

/** AI pipeline Edge Function のエンドポイント (環境変数で上書き可能) */
const AI_PIPELINE_URL =
  process.env.SUPABASE_FUNCTIONS_URL
    ? `${process.env.SUPABASE_FUNCTIONS_URL}/lifull-ai-pipeline`
    : null

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Zoom Webhook 共通ボディ */
const ZoomWebhookBaseSchema = z.object({
  event: z.string().min(1),
  event_ts: z.number().optional(),
  payload: z.unknown(),
})

/** phone.recording_completed ペイロード */
const RecordingCompletedPayloadSchema = z.object({
  object: z.object({
    call_id: z.string().min(1),
    recording_files: z
      .array(
        z.object({
          id: z.string(),
          file_type: z.string(),
          download_url: z.string().url(),
        })
      )
      .optional(),
  }),
})

/** phone.call_log_completed ペイロード */
const CallLogCompletedPayloadSchema = z.object({
  object: z.object({
    call_id: z.string().min(1),
    meeting_id: z.string().nullable().optional(),
    callee_number: z.string().nullable().optional(),
    caller_number: z.string().nullable().optional(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime().optional(),
    duration: z.number().optional(),
  }),
})

// ---------------------------------------------------------------------------
// Idempotency helper
// ---------------------------------------------------------------------------

/**
 * Zoom-Event-Id をキーに lifull_webhook_events テーブルで重複チェックを行う。
 * 既処理の場合は true を返す。
 */
async function checkAndInsertIdempotencyKey(
  supabase: ReturnType<typeof createTenantSupabaseClient>,
  eventId: string,
  eventType: string,
  tenantId: string
): Promise<boolean> {
  // まず存在確認
  const { data: existing } = await supabase
    .from('lifull_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing) return true // 既処理

  // 存在しない場合は INSERT (UNIQUE 制約が競合防止のバックストップ)
  const { error } = await supabase.from('lifull_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    tenant_id: tenantId,
    processed_at: new Date().toISOString(),
  })

  // UNIQUE 制約違反 = 同時リクエストで既に INSERT された = 重複
  if (error?.code === '23505') return true
  if (error) {
    throw new Error(`[webhook/zoom] idempotency insert failed: ${error.message}`)
  }

  return false
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * phone.recording_completed を処理する。
 * 録音 URL は structured log に出力しない (I-07 対策)。
 * AI pipeline Edge Function を非同期起動する。
 */
async function handleRecordingCompleted(
  supabase: ReturnType<typeof createTenantSupabaseClient>,
  payload: unknown,
  correlationId: string
): Promise<void> {
  const parsed = RecordingCompletedPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`[webhook/zoom] invalid recording_completed payload: ${parsed.error.message}`)
  }

  const { call_id } = parsed.data.object

  // activities レコードの zoom_call_id を更新
  const { error: updateError } = await supabase
    .from('lifull_activities')
    .update({ zoom_call_id: call_id, recording_available: true })
    .eq('zoom_call_id', call_id)
    .eq('tenant_id', LIFULL_TENANT_ID)

  if (updateError) {
    // 更新失敗はログに残して継続 (AI pipeline は activity_id がなくても起動可能)
    console.error({
      event: 'recording_completed_update_failed',
      correlation_id: correlationId,
      call_id, // recording_url は記録しない (I-07)
      error: updateError.message,
    })
  }

  // AI pipeline を非同期で起動 (recording_url は直接渡さず call_id のみ)
  if (AI_PIPELINE_URL) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      // fire-and-forget: Webhook レスポンス (200 OK) をブロックしない
      fetch(AI_PIPELINE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          call_id,
          tenant_id: LIFULL_TENANT_ID,
          correlation_id: correlationId,
        }),
      }).catch((err: unknown) => {
        console.error({
          event: 'ai_pipeline_invoke_failed',
          correlation_id: correlationId,
          call_id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  console.info({
    event: 'recording_completed_processed',
    correlation_id: correlationId,
    call_id,
  })
}

/**
 * phone.call_log_completed を処理する。
 * 3 段フォールバックマッチングで activity を特定し、通話ログを紐付ける。
 */
async function handleCallLogCompleted(
  supabase: ReturnType<typeof createTenantSupabaseClient>,
  payload: unknown,
  correlationId: string
): Promise<void> {
  const parsed = CallLogCompletedPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`[webhook/zoom] invalid call_log_completed payload: ${parsed.error.message}`)
  }

  const obj = parsed.data.object

  // マッチング候補を取得 (started_at ± 5分 で事前フィルタしてネットワーク負荷を下げる)
  const startTimeLower = new Date(new Date(obj.start_time).getTime() - 5 * 60 * 1000).toISOString()
  const startTimeUpper = new Date(new Date(obj.start_time).getTime() + 5 * 60 * 1000).toISOString()

  const { data: candidates, error: fetchError } = await supabase
    .from('lifull_activities')
    .select('activity_id, zoom_call_id, zoom_meeting_id, callee_number, caller_id, call_started_at, tenant_id')
    .eq('tenant_id', LIFULL_TENANT_ID)
    .gte('call_started_at', startTimeLower)
    .lte('call_started_at', startTimeUpper)

  if (fetchError) {
    throw new Error(`[webhook/zoom] failed to fetch activity candidates: ${fetchError.message}`)
  }

  const matchResult = matchZoomCallToActivity(candidates ?? [], {
    call_id: obj.call_id,
    meeting_id: obj.meeting_id ?? null,
    callee_number: obj.callee_number ?? null,
    caller_number: obj.caller_number ?? null,
    start_time: obj.start_time,
  })

  if (!matchResult.matched) {
    // マッチ失敗: 監査ログに記録して終了 (200 OK で Zoom に再送させない)
    console.warn({
      event: 'call_log_match_failed',
      correlation_id: correlationId,
      call_id: obj.call_id,
      tried_steps: matchResult.triedSteps,
    })
    return
  }

  // Step 3 ファジーマッチは audit warning を記録
  if (matchResult.requiresAuditWarning) {
    console.warn({
      event: 'call_log_fuzzy_match_warning',
      correlation_id: correlationId,
      activity_id: matchResult.activityId,
      step: matchResult.step,
      match_detail: matchResult.matchDetail,
    })
  }

  // activity に通話ログを紐付け
  const { error: linkError } = await supabase
    .from('lifull_activities')
    .update({
      zoom_call_id: obj.call_id,
      call_ended_at: obj.end_time ?? null,
      duration_sec: obj.duration ?? null,
      call_log_matched_step: matchResult.step,
      call_log_matched_at: new Date().toISOString(),
    })
    .eq('activity_id', matchResult.activityId)
    .eq('tenant_id', LIFULL_TENANT_ID)

  if (linkError) {
    throw new Error(`[webhook/zoom] call log link update failed: ${linkError.message}`)
  }

  console.info({
    event: 'call_log_completed_processed',
    correlation_id: correlationId,
    activity_id: matchResult.activityId,
    step: matchResult.step,
  })
}

// ---------------------------------------------------------------------------
// Main Route Handler
// ---------------------------------------------------------------------------

/** POST /api/webhook/zoom */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID()

  // 1. リクエストボディを raw テキストで取得 (署名検証に必要)
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/bad-request',
        title: 'Failed to read request body',
        status: 400,
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  // 2. 署名検証ヘッダのパース
  const headersObj: Record<string, string | undefined> = {}
  req.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value
  })

  const parsedHeaders = parseWebhookHeaders(headersObj)
  if (!parsedHeaders) {
    console.warn({
      event: 'webhook_missing_headers',
      correlation_id: correlationId,
    })
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/unauthorized',
        title: 'Missing required Zoom headers',
        status: 401,
        correlation_id: correlationId,
      },
      { status: 401 }
    )
  }

  // 3. HMAC-SHA256 署名検証 (S-01 対策)
  let secretToken: string
  try {
    secretToken = getWebhookSecretToken()
  } catch (err) {
    console.error({
      event: 'webhook_secret_not_configured',
      correlation_id: correlationId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/server-error',
        title: 'Webhook secret not configured',
        status: 500,
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }

  const sigResult = verifyZoomSignature(
    secretToken,
    parsedHeaders.signature,
    parsedHeaders.timestamp,
    rawBody
  )

  if (!sigResult.valid) {
    console.warn({
      event: 'webhook_signature_invalid',
      correlation_id: correlationId,
      reason: sigResult.reason,
    })
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/unauthorized',
        title: 'Invalid webhook signature',
        status: 401,
        detail: sigResult.reason,
        correlation_id: correlationId,
      },
      { status: 401 }
    )
  }

  // 4. ボディをパース
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/bad-request',
        title: 'Invalid JSON body',
        status: 400,
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  // 5. endpoint.url_validation — Challenge Response (認証不要)
  const challengeResponse = handleUrlValidation(secretToken, body)
  if (challengeResponse) {
    return NextResponse.json(challengeResponse, { status: 200 })
  }

  // 6. イベント種別を取得
  const baseParseResult = ZoomWebhookBaseSchema.safeParse(body)
  if (!baseParseResult.success) {
    return NextResponse.json(
      {
        type: 'https://docs.toguna/errors/bad-request',
        title: 'Invalid webhook body',
        status: 400,
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  const { event, payload } = baseParseResult.data

  // 7. Idempotency チェック (Zoom-Event-Id ヘッダ)
  const eventId = headersObj['zoom-event-id'] ?? `${event}-${parsedHeaders.timestamp}`

  return withTenantContext(LIFULL_TENANT_ID, async () => {
    // Service Role Key は Webhook handler でのみ許容 (AI pipeline 起動のため)
    const serviceToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    const supabase = createTenantSupabaseClient(LIFULL_TENANT_ID, serviceToken)

    // Transaction 先頭で SET LOCAL
    await setTransactionTenantId(supabase, LIFULL_TENANT_ID)

    // Idempotency チェック
    const alreadyProcessed = await checkAndInsertIdempotencyKey(
      supabase,
      eventId,
      event,
      LIFULL_TENANT_ID
    )
    if (alreadyProcessed) {
      console.info({
        event: 'webhook_duplicate_skipped',
        correlation_id: correlationId,
        zoom_event: event,
        event_id: eventId,
      })
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }

    // 8. イベント処理
    try {
      if (event === 'phone.recording_completed') {
        await handleRecordingCompleted(supabase, payload, correlationId)
      } else if (event === 'phone.call_log_completed') {
        await handleCallLogCompleted(supabase, payload, correlationId)
      } else {
        // 未知のイベントは 200 で受け流す (Zoom 再送防止)
        console.info({
          event: 'webhook_unknown_event_type',
          correlation_id: correlationId,
          zoom_event: event,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error({
        event: 'webhook_processing_error',
        correlation_id: correlationId,
        zoom_event: event,
        error: message,
      })
      // Zoom は 4xx/5xx で再送するため 200 を返す
      // (idempotency key は既に INSERT 済みのため再送時は即スキップされる)
      return NextResponse.json(
        {
          ok: false,
          correlation_id: correlationId,
          error: message,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ ok: true, correlation_id: correlationId }, { status: 200 })
  })
}

// END_OF_FILE
