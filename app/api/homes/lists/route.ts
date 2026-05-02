import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('homes_lists')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) return jsonError(error.message, 500)
  return ok(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.from('homes_lists').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data, 201)
}
