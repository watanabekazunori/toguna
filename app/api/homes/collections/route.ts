import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const supabase = await getServerSupabase()
  let q = supabase
    .from('homes_collections')
    .select(`*, homes_deals!inner(*, homes_companies(*)),
             collector:homes_users!collector_user_id(id,name,role)`)
    .order('ba_remind_date', { ascending: true, nullsFirst: false })
    .limit(Number(sp.get('limit') ?? 500))

  for (const k of ['collector_user_id', 'status']) {
    const v = sp.get(k)
    if (v) q = q.eq(k, v)
  }
  if (sp.get('remind_today') === '1') {
    const today = new Date().toISOString().slice(0, 10)
    q = q.eq('ba_remind_date', today)
  }
  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}
