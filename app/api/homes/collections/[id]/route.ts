import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('homes_collections')
    .select(`*, homes_deals(*, homes_companies(*)), collector:homes_users!collector_user_id(*)`)
    .eq('id', id)
    .single()
  if (error) return jsonError(error.message, 404)
  return ok(data)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const patch = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('homes_collections')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return jsonError(error.message, 500)
  return ok(data)
}
