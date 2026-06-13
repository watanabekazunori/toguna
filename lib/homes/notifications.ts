import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationKind =
  | 'next_action_5min'
  | 'order_pdf_uploaded'
  | 'collection_remind'
  | 'handoff_assigned'
  | 'audit_recheck_warning'
  | 'dispatch_failed'

export interface NotificationInsert {
  user_id: string
  kind: NotificationKind | string
  title: string
  body?: string | null
  payload?: Record<string, unknown> | null
}

export async function pushNotification(
  sb: SupabaseClient,
  n: NotificationInsert
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from('homes_notifications').insert({
    user_id: n.user_id,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    payload: n.payload ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function bulkPushNotifications(
  sb: SupabaseClient,
  rows: NotificationInsert[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (rows.length === 0) return { ok: true, count: 0 }
  const { error } = await sb.from('homes_notifications').insert(
    rows.map((n) => ({
      user_id: n.user_id,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      payload: n.payload ?? null,
    }))
  )
  if (error) return { ok: false, count: 0, error: error.message }
  return { ok: true, count: rows.length }
}
