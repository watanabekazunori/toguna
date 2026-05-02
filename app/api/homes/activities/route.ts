import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok, getCurrentUserId } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const supabase = await getServerSupabase()
  let q = supabase
    .from('homes_activities')
    .select('*, homes_companies(company_name, phone)')
    .order('call_started_at', { ascending: false })
    .limit(Number(sp.get('limit') ?? 200))
  for (const k of ['company_id', 'user_id', 'result_primary', 'result_secondary']) {
    const v = sp.get(k)
    if (v) q = q.eq(k, v)
  }
  const since = sp.get('since')
  if (since) q = q.gte('call_started_at', since)
  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  if (!body.user_id) {
    const uid = await getCurrentUserId()
    if (uid) body.user_id = uid
  }
  const { data, error } = await supabase.from('homes_activities').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data, 201)
}
