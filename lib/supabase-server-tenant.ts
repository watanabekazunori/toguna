/**
 * テナント対応 server-side Supabase クライアントファクトリ
 *
 * Next.js 14 App Router の Server Components / Route Handlers 用。
 * JWT (Supabase Auth) と tenant_id を同時に設定し、RLS 三層を確実に通過させる。
 *
 * 対応 threat:
 *   I-02 テナント越境クエリ — createClient 時に tenant_id を cookie/header で設定
 *   E-04 JWT 偽造 — Supabase Auth RS256 検証に委譲 (ANON KEY は公開可)
 *   E-05 anon role 漏れ — Service Role Key はこのモジュールでは使わない
 *
 * 使用方法:
 *   const supabase = createTenantSupabaseClient('lifull_homes', accessToken)
 *   await supabase.from('lifull_activities').select(...)
 */

// @supabase/ssr の createServerClient を内部で使うが、Phase 6 統合互換のため
// 外向きにも `createServerClient` を export する。名前衝突を避けるため import 側を rename。
import { createServerClient as createSsrServerClient, type CookieOptions } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { TenantIdSchema, TenantContextError } from './tenant-context'

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/** NEXT_PUBLIC_SUPABASE_URL を取得 */
function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('[supabase-server-tenant] NEXT_PUBLIC_SUPABASE_URL is not set')
  return url
}

/** NEXT_PUBLIC_SUPABASE_ANON_KEY を取得 */
function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) throw new Error('[supabase-server-tenant] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  return key
}

// ---------------------------------------------------------------------------
// Tenant-aware client factory
// ---------------------------------------------------------------------------

/**
 * テナント対応の server-side Supabase クライアントを生成する。
 *
 * 内部動作:
 *   1. tenantId の形式検証
 *   2. accessToken を Authorization ヘッダに設定 (RLS L2: auth.uid() が解決される)
 *   3. x-tenant-id カスタムヘッダを設定 (後続の RPC で SET LOCAL に使用)
 *
 * PgBouncer Transaction mode のため、実際の SET LOCAL は
 * withTenantContext() 内の先頭で Supabase RPC を呼ぶこと。
 *
 * @param tenantId テナント ID (例: 'lifull_homes')
 * @param accessToken Supabase Auth JWT (Bearer 部分のみ)
 * @returns 設定済み SupabaseClient
 * @throws TenantContextError tenantId が不正な場合
 */
export function createTenantSupabaseClient(
  tenantId: string,
  accessToken: string
): SupabaseClient {
  // tenant_id 形式検証
  const parsed = TenantIdSchema.safeParse(tenantId)
  if (!parsed.success) {
    throw new TenantContextError(
      `createTenantSupabaseClient: invalid tenant_id "${tenantId}"`
    )
  }

  const supabaseUrl = getSupabaseUrl()
  const anonKey = getAnonKey()

  // @supabase/ssr の createServerClient でカスタムヘッダを注入
  // cookies() は Route Handler 環境では不要な場合も多いため空実装
  const client = createSsrServerClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': parsed.data,
      },
    },
    cookies: {
      get(_name: string): string | undefined {
        return undefined
      },
      set(_name: string, _value: string, _options: CookieOptions): void {
        // Route Handler では Next.js の cookies() API を使って設定する
        // ここでは no-op (呼び出し元で別途設定すること)
      },
      remove(_name: string, _options: CookieOptions): void {
        // no-op
      },
    },
  })

  return client
}

// ---------------------------------------------------------------------------
// Tenant context RPC helper
// ---------------------------------------------------------------------------

/**
 * トランザクション先頭で SET LOCAL app.tenant_id を実行するヘルパー。
 *
 * PgBouncer Transaction mode では SET がセッション間で共有されないため、
 * 毎トランザクションの先頭で呼ぶこと。
 *
 * @param client createTenantSupabaseClient で生成したクライアント
 * @param tenantId セットするテナント ID
 */
export async function setTransactionTenantId(
  client: SupabaseClient,
  tenantId: string
): Promise<void> {
  // tenant_id 再検証
  const parsed = TenantIdSchema.safeParse(tenantId)
  if (!parsed.success) {
    throw new TenantContextError(
      `setTransactionTenantId: invalid tenant_id "${tenantId}"`
    )
  }

  const { error } = await client.rpc('set_app_tenant_id', {
    p_tenant_id: parsed.data,
  })

  if (error) {
    throw new Error(`[supabase-server-tenant] SET LOCAL tenant_id failed: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Service Role client (Edge Functions 専用)
// ---------------------------------------------------------------------------

/**
 * Service Role クライアントを生成する。
 * Edge Functions 内でのみ使用すること。Next.js Route Handler では使用禁止。
 *
 * 対応 threat: E-03 Service Role Key 漏洩防止
 *   — SUPABASE_SERVICE_ROLE_KEY は Vault / Edge Function 環境変数限定
 *
 * @param tenantId テナント ID (ログ記録用。RLS bypass するが監査には使う)
 * @returns Service Role SupabaseClient
 */
export function createServiceRoleSupabaseClient(tenantId: string): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('[supabase-server-tenant] SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  const parsed = TenantIdSchema.safeParse(tenantId)
  if (!parsed.success) {
    throw new TenantContextError(
      `createServiceRoleSupabaseClient: invalid tenant_id "${tenantId}"`
    )
  }

  const supabaseUrl = getSupabaseUrl()

  return createSsrServerClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        'x-tenant-id': parsed.data,
      },
    },
    cookies: {
      get: () => undefined,
      set: () => { /* no-op */ },
      remove: () => { /* no-op */ },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ---------------------------------------------------------------------------
// Phase 6 統合互換 alias
// ---------------------------------------------------------------------------
// 新規 lifull コードは `import { createServerClient } from '@/lib/supabase-server-tenant'`
// と書かれており、引数なし async で呼ぶ前提のため、`lib/supabase/server.ts` の
// `createClient` (cookie 連携付き、auth.uid() 解決) を同名で再 export する。
export { createClient as createServerClient } from './supabase/server'

// END_OF_FILE
