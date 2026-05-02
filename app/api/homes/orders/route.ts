import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const supabase = await getServerSupabase()
  let q = supabase
    .from('homes_orders')
    .select(`*, homes_companies(*), homes_deals(*),
             closer:homes_users!closer_user_id(id,name),
             collector:homes_users!collector_user_id(id,name)`)
    .order('ordered_at', { ascending: false })
    .limit(Number(sp.get('limit') ?? 500))
  const since = sp.get('since')
  if (since) q = q.gte('ordered_at', since)
  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.from('homes_orders').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  // Collection 受注確定状態に
  if (body.collection_id) {
    await supabase.from('homes_collections').update({ status: 'won' }).eq('id', body.collection_id)
    await supabase.from('homes_deals').update({ status: 'won' }).eq('id', body.deal_id)
  }
  return ok(data, 201)
}
