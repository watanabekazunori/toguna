/**
 * Zoom Server-to-Server OAuth クライアント
 *
 * account_credentials grant type を使用した S2S OAuth 実装。
 * グローバルシングルトンでトークンをキャッシュし、1時間期限切れ前に自動更新。
 * 10名同時発信でも token を共有するため競合を防ぐ mutex ロック付き。
 *
 * 対応 threat: S-01 偽 Webhook (HMAC検証の前提となる正規 token 管理)
 * E-03 Service Role Key 漏洩対策として env var のみ参照、ログ出力禁止
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Environment variable validation (起動時にフェイルファスト)
// ---------------------------------------------------------------------------

/** S2S OAuth に必要な 3 変数を zod で厳密検証 */
const EnvSchema = z.object({
  ZOOM_S2S_ACCOUNT_ID: z.string().min(1, 'ZOOM_S2S_ACCOUNT_ID is required'),
  ZOOM_S2S_CLIENT_ID: z.string().min(1, 'ZOOM_S2S_CLIENT_ID is required'),
  ZOOM_S2S_CLIENT_SECRET: z.string().min(1, 'ZOOM_S2S_CLIENT_SECRET is required'),
})

type Env = z.infer<typeof EnvSchema>

/** Zoom Token API レスポンス型 */
const ZoomTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('bearer'),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
})

type ZoomTokenResponse = z.infer<typeof ZoomTokenResponseSchema>

// ---------------------------------------------------------------------------
// Token cache (module-level singleton)
// ---------------------------------------------------------------------------

interface CachedToken {
  /** Bearer トークン本体 */
  accessToken: string
  /** Unix epoch ms で有効期限を保持 */
  expiresAt: number
}

/** グローバルトークンキャッシュ。10名同時発信でも共有する */
let tokenCache: CachedToken | null = null

/** 同時リフレッシュ要求を防ぐための Promise ロック */
let refreshPromise: Promise<string> | null = null

/** トークン有効期限の余裕時間 (5分前に更新) */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * 環境変数を検証して S2S 設定を取得する。
 * 起動時に一度だけ実行し、失敗時は明示エラーをスローする。
 */
function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `[zoom-s2s] Missing required env vars: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`
    )
  }
  return result.data
}

/**
 * Zoom S2S OAuth トークンエンドポイントを呼び出して新トークンを取得する。
 * Basic Auth ヘッダに clientId:clientSecret を base64 エンコードして送信。
 * 仕様: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
async function fetchNewToken(env: Env): Promise<CachedToken> {
  const credentials = Buffer.from(`${env.ZOOM_S2S_CLIENT_ID}:${env.ZOOM_S2S_CLIENT_SECRET}`).toString('base64')

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_S2S_ACCOUNT_ID)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    // レスポンス本文はログに残さない (client_secret 含む可能性)
    throw new Error(`[zoom-s2s] Token fetch failed: HTTP ${response.status}`)
  }

  const raw: unknown = await response.json()
  const parsed = ZoomTokenResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`[zoom-s2s] Unexpected token response shape: ${parsed.error.message}`)
  }

  const data: ZoomTokenResponse = parsed.data
  const expiresAt = Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS

  return { accessToken: data.access_token, expiresAt }
}

/**
 * キャッシュされたトークンが有効かどうかを確認する。
 */
function isCacheValid(cache: CachedToken | null): cache is CachedToken {
  return cache !== null && Date.now() < cache.expiresAt
}

/**
 * Zoom S2S OAuth アクセストークンを返す。
 *
 * - キャッシュが有効な場合はキャッシュを返す (同時 10 呼び出し OK)
 * - キャッシュが失効している場合は 1 回だけリフレッシュし全待機者に結果を返す
 *
 * @returns Bearer トークン文字列
 * @throws 環境変数未設定 / Zoom API エラー時
 */
export async function getZoomS2SToken(): Promise<string> {
  // Fast path: キャッシュ有効
  if (isCacheValid(tokenCache)) {
    return tokenCache.accessToken
  }

  // Slow path: リフレッシュが既に進行中なら待機 (同時リクエスト競合防止)
  if (refreshPromise !== null) {
    return refreshPromise
  }

  const env = loadEnv()

  refreshPromise = fetchNewToken(env)
    .then((cached) => {
      tokenCache = cached
      return cached.accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

/**
 * キャッシュを強制クリアする (テスト・障害時のリセット用)。
 */
export function clearTokenCache(): void {
  tokenCache = null
  refreshPromise = null
}

/**
 * 現在のキャッシュ状態を返す (デバッグ用。secret は含まない)。
 */
export function getTokenCacheStatus(): { cached: boolean; expiresAt: number | null } {
  return {
    cached: isCacheValid(tokenCache),
    expiresAt: tokenCache?.expiresAt ?? null,
  }
}

// END_OF_FILE
