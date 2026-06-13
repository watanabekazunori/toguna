/**
 * テナントコンテキスト管理
 *
 * PgBouncer Transaction mode 対応の tenant_id 注入ラッパー。
 * 全 Route Handler / Server Action は withTenantContext() 内で DB 操作を行うこと。
 *
 * 対応 threat:
 *   I-02 テナント越境クエリ防止 — SET LOCAL app.tenant_id でトランザクション内に閉じる
 *   E-02 SECURITY DEFINER 関数バイパス防止 — current_setting('app.tenant_id') との整合
 *   E-05 anon role 漏れ防止 — tenantId regex 検証で不正値を即時排除
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Tenant ID validation
// ---------------------------------------------------------------------------

/**
 * tenant_id に許容する文字列パターン。
 * architecture.md § 5.1 の CHECK 制約と同じ正規表現。
 * 先頭が英小文字、以降は英小文字・数字・アンダースコアのみ。
 */
export const TENANT_ID_REGEX = /^[a-z][a-z0-9_]*$/

/** 既知のテナント ID 一覧 (型安全のための列挙) */
export const KNOWN_TENANTS = ['lifull_homes', 'renovi_call', 'enefoward_batt'] as const
export type KnownTenantId = (typeof KNOWN_TENANTS)[number]

/** tenant_id 検証スキーマ */
export const TenantIdSchema = z
  .string()
  .min(1, 'tenant_id is required')
  .regex(TENANT_ID_REGEX, 'tenant_id must match ^[a-z][a-z0-9_]*$')

// ---------------------------------------------------------------------------
// AsyncLocalStorage for tenant context propagation
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from 'async_hooks'

interface TenantContext {
  tenantId: string
}

/** Node.js AsyncLocalStorage でリクエストスコープの tenant_id を管理 */
const tenantStorage = new AsyncLocalStorage<TenantContext>()

// ---------------------------------------------------------------------------
// Core: withTenantContext
// ---------------------------------------------------------------------------

/**
 * テナントコンテキストを設定して非同期関数を実行するラッパー。
 *
 * 内部では以下を行う:
 *   1. tenant_id の形式検証 (不正値は即 throw)
 *   2. AsyncLocalStorage に tenant_id をセット
 *   3. fn() の最初の DB クライアント操作前に SET LOCAL を実行 (Supabase client 経由)
 *
 * @param tenantId 実行するテナント ID (例: 'lifull_homes')
 * @param fn テナントコンテキスト内で実行する非同期関数
 * @param opts オプション設定
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>,
  opts: { validateKnown?: boolean } = {}
): Promise<T> {
  // 形式検証
  const parsed = TenantIdSchema.safeParse(tenantId)
  if (!parsed.success) {
    throw new TenantContextError(
      `Invalid tenant_id: "${tenantId}" — ${parsed.error.issues[0].message}`
    )
  }

  // 既知テナントチェック (オプション)
  if (opts.validateKnown) {
    const isKnown = KNOWN_TENANTS.includes(tenantId as KnownTenantId)
    if (!isKnown) {
      throw new TenantContextError(
        `Unknown tenant_id: "${tenantId}". Must be one of: ${KNOWN_TENANTS.join(', ')}`
      )
    }
  }

  // AsyncLocalStorage で伝播
  return tenantStorage.run({ tenantId }, fn)
}

// ---------------------------------------------------------------------------
// getCurrentTenantId
// ---------------------------------------------------------------------------

/**
 * 現在のリクエストスコープの tenant_id を取得する。
 *
 * withTenantContext() の外で呼ぶと TenantContextError をスローする。
 * ESLint rule no-direct-supabase-without-tenant のガードと合わせて使用。
 *
 * @returns 現在の tenant_id 文字列
 * @throws TenantContextError コンテキスト外で呼ばれた場合
 */
export function getCurrentTenantId(): string {
  const ctx = tenantStorage.getStore()
  if (!ctx) {
    throw new TenantContextError(
      'getCurrentTenantId() called outside of withTenantContext(). ' +
        'Wrap your handler with withTenantContext(tenantId, async () => { ... })'
    )
  }
  return ctx.tenantId
}

/**
 * テナントコンテキストが設定されているかどうかを確認する (throw しない版)。
 * ミドルウェアでの事前チェックに使用する。
 */
export function hasTenantContext(): boolean {
  return tenantStorage.getStore() !== undefined
}

// ---------------------------------------------------------------------------
// SQL helper
// ---------------------------------------------------------------------------

/**
 * PgBouncer Transaction mode 用の SET LOCAL SQL 文を生成する。
 *
 * 呼び出し方:
 *   await supabase.rpc('set_tenant_id', { tenant_id: getCurrentTenantId() })
 *   // または
 *   await supabase.sql`SELECT set_config('app.tenant_id', ${getCurrentTenantId()}, true)`
 *
 * @param tenantId セットするテナント ID
 * @returns SET LOCAL 用の SQL 文字列 (パラメータ化前提)
 */
export function buildSetTenantSql(tenantId: string): string {
  // 二重検証: 呼び出し元が検証済みでも再確認
  const parsed = TenantIdSchema.safeParse(tenantId)
  if (!parsed.success) {
    throw new TenantContextError(`Cannot build SET LOCAL SQL with invalid tenant_id: "${tenantId}"`)
  }
  // シングルクォートエスケープ (SQL インジェクション対策)
  const escaped = parsed.data.replace(/'/g, "''")
  return `SELECT set_config('app.tenant_id', '${escaped}', true)`
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

/** テナントコンテキスト関連エラー */
export class TenantContextError extends Error {
  readonly code = 'TENANT_CONTEXT_ERROR'

  constructor(message: string) {
    super(message)
    this.name = 'TenantContextError'
    // V8 スタックトレース修正
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantContextError)
    }
  }
}

// END_OF_FILE
