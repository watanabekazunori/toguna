import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok, getCurrentUserId } from '../../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase()
  const userIdParam = req.nextUrl.searchParams.get('user_id')
  const userId = userIdParam ?? (await getCurrentUserId())
  if (!userId) return jsonError('user_id required', 400)
  const minHours = Number(req.nextUrl.searchParams.get('min_hours') ?? 24)
  const { data, error } = await supabase.rpc('homes_next_dial_target', {
    p_user_id: userId,
    p_min_interval_hours: minHours,
  })
  if (error) return jsonError(error.message, 500)
  return ok((data?.[0] ?? null))
}
