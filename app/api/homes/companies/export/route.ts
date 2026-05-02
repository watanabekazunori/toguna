import { NextRequest } from 'next/server'
import { getServerSupabase } from '../../_helpers'

export const dynamic = 'force-dynamic'

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase()
  const sp = req.nextUrl.searchParams

  let q = supabase.from('homes_companies').select('*').limit(50000)
  for (const key of ['list_id', 'prefecture', 'call_restriction', 'call_state']) {
    const v = sp.get(key)
    if (v) q = q.eq(key, v)
  }
  const { data, error } = await q
  if (error) return new Response(error.message, { status: 500 })

  const rows = data ?? []
  if (rows.length === 0) return new Response('no data', { status: 204 })

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(',')),
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="homes_companies_${Date.now()}.csv"`,
    },
  })
}
