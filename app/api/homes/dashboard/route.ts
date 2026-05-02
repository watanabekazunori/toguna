import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase()
  const sp = req.nextUrl.searchParams
  const date = sp.get('date') ?? new Date().toISOString().slice(0, 10)
  const next = new Date(date)
  next.setDate(next.getDate() + 1)

  const [
    { data: kuru },
    { data: today },
    { data: yomi },
    { data: teams },
    { data: monthly },
    todayActivities,
    todayMeetings,
    pendingCollections,
  ] = await Promise.all([
    supabase
      .from('homes_v_kuru_stats')
      .select('*')
      .gte('work_date', date)
      .lt('work_date', next.toISOString().slice(0, 10)),
    supabase.from('homes_v_today_personal').select('*'),
    supabase.from('homes_v_yomi_forecast').select('*'),
    supabase.from('homes_v_team_stats').select('*'),
    supabase.from('homes_v_monthly_summary').select('*').order('month', { ascending: false }).limit(6),
    supabase
      .from('homes_activities')
      .select('id, result_primary, result_secondary', { count: 'exact', head: true })
      .gte('call_started_at', date)
      .lt('call_started_at', next.toISOString().slice(0, 10)),
    supabase
      .from('homes_meetings')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', date)
      .lt('scheduled_at', next.toISOString().slice(0, 10)),
    supabase
      .from('homes_collections')
      .select('id', { count: 'exact', head: true })
      .eq('ba_remind_date', date),
  ])

  return ok({
    date,
    kuru_stats: kuru ?? [],
    today_personal: today ?? [],
    yomi_forecast: yomi ?? [],
    team_stats: teams ?? [],
    monthly_summary: monthly ?? [],
    today_call_count: todayActivities.count ?? 0,
    today_meeting_count: todayMeetings.count ?? 0,
    today_remind_count: pendingCollections.count ?? 0,
  })
}
