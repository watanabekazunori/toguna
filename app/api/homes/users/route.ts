import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase()
  const role = req.nextUrl.searchParams.get('role')
  let q = supabase
    .from('homes_users')
    .select('*, homes_teams(*)')
    .eq('is_active', true)
    .order('name')
  if (role) q = q.eq('role', role)
  const { data, error } = await q
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.from('homes_users').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data, 201)
}
