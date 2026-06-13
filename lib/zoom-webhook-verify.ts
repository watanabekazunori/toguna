/**
 * Zoom Webhook 署名検証 + Challenge Response
 *
 * S-01 偽 Webhook 対策:
 *   - x-zm-signature (v0=<HMAC-SHA256>) の検証
 *   - x-zm-request-timestamp で 5 分以内リプレイ攻撃対策
 *   - endpoint.url_validation イベントの encryptedToken 生成
 *
 * I-07 録音 URL redact: このモジュール内では URL をログに出さない。
 * 全関数は純粋関数 or 副作用最小化で unit test 可能にする。
 */

import crypto from 'crypto'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** リプレイ攻撃対策: タイムスタンプ許容ウィンドウ (5分) */
const REPLAY_WINDOW_MS = 5 * 60 * 1000

/** Zoom 署名の prefix */
const ZOOM_SIGNATURE_VERSION = 'v0'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Webhook 共通ヘッダ */
const WebhookHeadersSchema = z.object({
  'x-zm-signature': z.string().startsWith('v0='),
  'x-zm-request-timestamp': z.string().regex(/^\d+$/, 'timestamp must be numeric'),
})

/** endpoint.url_validation ペイロード */
const UrlValidationPayloadSchema = z.object({
  event: z.literal('endpoint.url_validation'),
  payload: z.object({
    plainToken: z.string().min(1),
  }),
})

/** Challenge Response レスポンス形式 */
export const ChallengeResponseSchema = z.object({
  plainToken: z.string(),
  encryptedToken: z.string(),
})

export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Zoom Webhook の署名検証を行う。
 *
 * 署名算出式: HMAC-SHA256(secret_token, "v0:{timestamp}:{body}")
 * 仕様: https://developers.zoom.us/docs/api/rest/webhook-reference/#verify-webhook-events
 *
 * @param secretToken ZOOM_WEBHOOK_SECRET_TOKEN
 * @param signature x-zm-signature ヘッダ値 (v0=<hex>)
 * @param timestamp x-zm-request-timestamp ヘッダ値
 * @param rawBody リクエスト生ボディ文字列 (JSON.stringify 前の raw)
 * @param nowMs 現在時刻 (ms)。テスト時に注入可能
 * @returns 検証結果
 */
export function verifyZoomSignature(
  secretToken: string,
  signature: string,
  timestamp: string,
  rawBody: string,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string } {
  // 1. タイムスタンプ形式検証
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) {
    return { valid: false, reason: 'invalid_timestamp_format' }
  }

  // 2. リプレイ攻撃対策: 5分以内チェック
  const timestampMs = ts * 1000
  if (Math.abs(nowMs - timestampMs) > REPLAY_WINDOW_MS) {
    return { valid: false, reason: 'timestamp_out_of_window' }
  }

  // 3. 期待署名の計算
  const message = `${ZOOM_SIGNATURE_VERSION}:${timestamp}:${rawBody}`
  const expected = `v0=${crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex')}`

  // 4. タイミングセーフな比較 (timing attack 防止)
  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(signature, 'utf8')

  if (expectedBuf.length !== actualBuf.length) {
    return { valid: false, reason: 'signature_mismatch' }
  }

  const isEqual = crypto.timingSafeEqual(expectedBuf, actualBuf)
  if (!isEqual) {
    return { valid: false, reason: 'signature_mismatch' }
  }

  return { valid: true }
}

/**
 * リクエストヘッダを zod で検証し、署名検証に必要な値を抽出する。
 * パース失敗時は null を返す (呼び出し元で 400 を返すこと)。
 *
 * @param headers 生ヘッダオブジェクト (toLowerCase 済みを期待)
 */
export function parseWebhookHeaders(
  headers: Record<string, string | string[] | undefined>
): { signature: string; timestamp: string } | null {
  const normalized = {
    'x-zm-signature': Array.isArray(headers['x-zm-signature'])
      ? headers['x-zm-signature'][0]
      : headers['x-zm-signature'],
    'x-zm-request-timestamp': Array.isArray(headers['x-zm-request-timestamp'])
      ? headers['x-zm-request-timestamp'][0]
      : headers['x-zm-request-timestamp'],
  }

  const result = WebhookHeadersSchema.safeParse(normalized)
  if (!result.success) return null

  return {
    signature: result.data['x-zm-signature'],
    timestamp: result.data['x-zm-request-timestamp'],
  }
}

// ---------------------------------------------------------------------------
// Challenge Response
// ---------------------------------------------------------------------------

/**
 * endpoint.url_validation イベントの Challenge Response を生成する。
 *
 * Zoom は登録時に plainToken を送信し、HMAC-SHA256(secret_token, plainToken) を
 * encryptedToken として返すことを要求する。
 * 仕様: https://developers.zoom.us/docs/api/rest/webhook-reference/#validate-your-webhook-endpoint
 *
 * @param secretToken ZOOM_WEBHOOK_SECRET_TOKEN
 * @param plainToken ペイロード内の plainToken
 * @returns { plainToken, encryptedToken }
 */
export function buildChallengeResponse(
  secretToken: string,
  plainToken: string
): ChallengeResponse {
  const encryptedToken = crypto
    .createHmac('sha256', secretToken)
    .update(plainToken)
    .digest('hex')

  return { plainToken, encryptedToken }
}

/**
 * リクエストボディが endpoint.url_validation イベントかどうかを判定し、
 * 該当する場合は Challenge Response を返す。
 * それ以外のイベントや無効なペイロードは null を返す。
 *
 * @param secretToken ZOOM_WEBHOOK_SECRET_TOKEN
 * @param body パース済みリクエストボディ
 */
export function handleUrlValidation(
  secretToken: string,
  body: unknown
): ChallengeResponse | null {
  const parsed = UrlValidationPayloadSchema.safeParse(body)
  if (!parsed.success) return null

  return buildChallengeResponse(secretToken, parsed.data.payload.plainToken)
}

// ---------------------------------------------------------------------------
// Env helper
// ---------------------------------------------------------------------------

/**
 * ZOOM_WEBHOOK_SECRET_TOKEN を環境変数から取得する。
 * 未設定時は起動を止めるためにスローする。
 */
export function getWebhookSecretToken(): string {
  const token = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!token) {
    throw new Error('[zoom-webhook-verify] ZOOM_WEBHOOK_SECRET_TOKEN is not set')
  }
  return token
}

// END_OF_FILE
