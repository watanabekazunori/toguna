import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../_helpers'

export const dynamic = 'force-dynamic'

const EQ_KEYS = ['list_id', 'prefecture', 'city', 'call_restriction', 'call_state', 'assigned_user_id', 'main_business', 'listing_status', 'company_grade', 'homes_usage', 'attack_target']
const NUM_RANGES: Array<[string, string, string]> = [
  ['priority_min', 'priority_max', 'score_priority'],
  ['capital_min', 'capital_max', 'capital'],
  ['revenue_min', 'revenue_max', 'revenue'],
  ['employees_min', 'employees_max', 'employees'],
  ['call_count_min', 'call_count_max', 'call_count'],
]

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase()
  const sp = req.nextUrl.searchParams

  const page = Number(sp.get('page') ?? 1)
  const pageSize = Math.min(Number(sp.get('page_size') ?? 50), 200)
  const orderBy = sp.get('order_by') ?? 'last_call_at'
  const orderDir = sp.get('order_dir') === 'desc' ? false : true
  const q = sp.get('q')

  let query = supabase.from('homes_companies').select('*', { count: 'exact' })

  for (const key of EQ_KEYS) {
    const v = sp.get(key)
    if (v) query = query.eq(key, v)
  }
  for (const [minKey, maxKey, col] of NUM_RANGES) {
    const min = sp.get(minKey)
    const max = sp.get(maxKey)
    if (min) query = query.gte(col, Number(min))
    if (max) query = query.lte(col, Number(max))
  }
  const ymin = sp.get('established_year_min')
  const ymax = sp.get('established_year_max')
  if (ymin) query = query.gte('established_at', `${ymin}-01-01`)
  if (ymax) query = query.lte('established_at', `${ymax}-12-31`)
  if (sp.get('last_call_is_null') === '1') query = query.is('last_call_at', null)
  else {
    const cf = sp.get('last_call_from')
    const ct = sp.get('last_call_to')
    if (cf) query = query.gte('last_call_at', cf)
    if (ct) query = query.lte('last_call_at', ct)
  }
  const hasTakken = sp.get('has_takken')
  if (hasTakken === '1') query = query.not('takken_license_no', 'is', null)
  if (hasTakken === '0') query = query.is('takken_license_no', null)
  if (sp.get('unassigned') === '1') query = query.is('assigned_user_id', null)

  const restrictions = sp.getAll('call_restrictions[]')
  if (restrictions.length) query = query.in('call_restriction', restrictions)
  const states = sp.getAll('call_states[]')
  if (states.length) query = query.in('call_state', states)

  if (q) {
    const safe = q.replace(/[%_,()]/g, '')
    query = query.or(`company_name.ilike.%${safe}%,phone.ilike.%${safe}%,address.ilike.%${safe}%`)
  }
  const qEmail = sp.get('q_email')
  if (qEmail) {
    const safe = qEmail.replace(/[%_,()]/g, '')
    query = query.or(`representative_email.ilike.%${safe}%,contact_person_email.ilike.%${safe}%,staff_email.ilike.%${safe}%`)
  }
  const qRep = sp.get('q_representative')
  if (qRep) {
    const safe = qRep.replace(/[%_,()]/g, '')
    query = query.or(`representative_name.ilike.%${safe}%,contact_person_name.ilike.%${safe}%`)
  }

  query = query
    .order(orderBy, { ascending: orderDir, nullsFirst: orderDir })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  if (error) return jsonError(error.message, 500)
  return ok({ data: data ?? [], total: count ?? 0, page, page_size: pageSize })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.from('homes_companies').insert(body).select().single()
  if (error) return jsonError(error.message, 500)
  return ok(data, 201)
}
