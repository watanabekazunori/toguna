import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const supabase = await getServerSupabase()
  let q = supabase
    .from('homes_deals')
    .select(`*, homes_companies(*), homes_lists(*),
             appointer:homes_users!appointer_user_id(id,name,role),
             closer:homes_users!closer_user_id(id,name,role)`)
    .order('appointed_at', { ascending: false })
    .limit(Number(sp.get('limit') ?? 500))

  for (const k of ['status', 'closer_user_id', 'appointer_user_id', 'list_id']) {
    const v = sp.get(k)
    if (v) q = q.eq(k, v)
  }
  const yomi = sp.get('latest_yomi')
  if (yomi) q = q.eq('latest_yomi', yomi)

  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}
