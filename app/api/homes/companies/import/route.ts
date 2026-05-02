import { NextRequest } from 'next/server'
import { getServerSupabase, jsonError, ok } from '../../_helpers'

export const dynamic = 'force-dynamic'

// Body: { rows: HomesCompanyInsert[], list_id?: string }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const rows: Record<string, unknown>[] = body.rows ?? []
  if (!Array.isArray(rows) || rows.length === 0) return jsonError('rows required', 400)

  const supabase = await getServerSupabase()
  if (body.list_id) rows.forEach((r) => (r.list_id = body.list_id))

  // 重複は phone または takken_license_no で判定 → upsert はキー必須なので分割
  const phones = rows.map((r) => r.phone).filter(Boolean) as string[]
  const { data: existing } = await supabase
    .from('homes_companies')
    .select('id, phone, takken_license_no')
    .in('phone', phones)
  const existingByPhone = new Map((existing ?? []).map((r) => [r.phone, r.id]))

  const inserts: Record<string, unknown>[] = []
  const updates: { id: string; patch: Record<string, unknown> }[] = []
  for (const r of rows) {
    const id = existingByPhone.get(r.phone as string)
    if (id) updates.push({ id, patch: r })
    else inserts.push(r)
  }

  let inserted: unknown[] = []
  if (inserts.length) {
    const { data, error } = await supabase.from('homes_companies').insert(inserts).select('id')
    if (error) return jsonError(error.message, 500)
    inserted = data ?? []
  }

  for (const u of updates) {
    await supabase.from('homes_companies').update(u.patch).eq('id', u.id)
  }

  if (body.list_id && inserted.length) {
    await supabase
      .from('homes_lists')
      .update({ total_count: rows.length, imported_at: new Date().toISOString() })
      .eq('id', body.list_id)
  }

  return ok({
    inserted: inserted.length,
    updated: updates.length,
    total: rows.length,
  })
}
