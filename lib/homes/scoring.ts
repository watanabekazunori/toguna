// GAP-L: 2-axis scoring (existing publisher / new prospect) for homes_companies
import type { HomesCompany, HomesList } from './types'

export interface ScoreProfile {
  quality: number
  size: number
  potential: number
  priority: number
}

export const DEFAULT_PROFILES: { existing: ScoreProfile; new: ScoreProfile } = {
  existing: { quality: 1.0, size: 0.5, potential: 0.3, priority: 1.5 },
  new: { quality: 1.5, size: 1.0, potential: 1.5, priority: 0.5 },
}

export function calcTotalScore(c: HomesCompany, list?: HomesList | null): number {
  const profile = (list?.score_profile as { existing?: ScoreProfile; new?: ScoreProfile } | null)
    ?? DEFAULT_PROFILES
  const p = c.is_existing_publisher
    ? (profile.existing ?? DEFAULT_PROFILES.existing)
    : (profile.new ?? DEFAULT_PROFILES.new)
  const q = (c.score_quality ?? 0) * p.quality
  const s = (c.score_size ?? 0) * p.size
  const pt = (c.score_potential ?? 0) * p.potential
  const pr = (c.score_priority ?? 0) * p.priority
  return Math.round((q + s + pt + pr) * 100) / 100
}

export async function recalcAllScores(supabase: any) {
  let offset = 0
  const batch = 500
  let updated = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: companies, error } = await supabase
      .from('homes_companies')
      .select('*, homes_lists(score_profile)')
      .range(offset, offset + batch - 1)
    if (error) throw error
    if (!companies || companies.length === 0) break
    const updates = companies.map((c: any) => ({
      id: c.id,
      total_score: calcTotalScore(c, c.homes_lists),
      score_calculated_at: new Date().toISOString(),
    }))
    for (const u of updates) {
      await supabase
        .from('homes_companies')
        .update({ total_score: u.total_score, score_calculated_at: u.score_calculated_at })
        .eq('id', u.id)
    }
    updated += updates.length
    offset += batch
    if (companies.length < batch) break
  }
  return updated
}
