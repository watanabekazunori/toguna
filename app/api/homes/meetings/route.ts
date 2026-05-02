import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok, getCurrentUserId } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const supabase = await getServerSupabase()
  let q = supabase
    .from('homes_meetings')
    .select('*, homes_deals!inner(*, homes_companies(*))')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(Number(sp.get('limit') ?? 500))

  for (const k of ['deal_id', 'closer_user_id', 'status', 'yomi']) {
    const v = sp.get(k)
    if (v) q = q.eq(k, v)
  }
  const today = sp.get('today')
  if (today === '1') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    q = q.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString())
  }
  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  if (!body.created_by) {
    const uid = await getCurrentUserId()
    if (uid) body.created_by = uid
  }
  // meeting_seq の自動採番
  if (body.deal_id && !body.meeting_seq) {
    const { count } = await supabase
      .from('homes_meetings')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', body.deal_id)
    body.meeting_seq = (count ?? 0) + 1
  }
  const { data, error } = await supabase.from('homes_meetings').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data, 201)
}
