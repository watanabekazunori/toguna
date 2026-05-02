import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('homes_companies')
    .select('*, homes_lists(*), homes_users!assigned_user_id(*)')
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
    .from('homes_companies')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return jsonError(error.message, 500)
  return ok(data)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await getServerSupabase()
  const { error } = await supabase.from('homes_companies').delete().eq('id', id)
  if (error) return jsonError(error.message, 500)
  return ok({ ok: true })
}
