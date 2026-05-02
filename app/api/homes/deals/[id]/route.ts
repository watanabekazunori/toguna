import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('homes_deals')
    .select(`*, homes_companies(*), homes_lists(*),
             appointer:homes_users!appointer_user_id(id,name,role),
             closer:homes_users!closer_user_id(id,name,role),
             homes_meetings(*)`)
    .eq('id', id)
    .single()
  if (error) return jsonError(error.message, 404)
  return ok(data)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const patch = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.from('homes_deals').update(patch).eq('id', id).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data)
}
