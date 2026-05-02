// GAP-K: morning auto-dispatch of untouched companies to APPOINTERS by rules
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface DispatchRule {
  id: string
  name: string
  priority: number
  is_active: boolean
  conditions: Record<string, unknown> | null
  target_team_id: string | null
  target_role: string | null
  weight: number | null
}

interface CompanyRow {
  id: string
  prefecture: string | null
  main_business: string | null
  total_score: number | null
  notes?: string | null
}

interface AppointerRow {
  id: string
  team_id: string | null
  role: string
  is_active: boolean
}

function matchesRule(c: CompanyRow, rule: DispatchRule): boolean {
  const cond = rule.conditions ?? {}
  const pref = (cond as { prefecture?: string }).prefecture
  if (pref && c.prefecture !== pref) return false
  const biz = (cond as { business_type?: string }).business_type
  if (biz && c.main_business !== biz) return false
  const minScore = (cond as { score_min?: number }).score_min
  if (typeof minScore === 'number' && (c.total_score ?? 0) < minScore) return false
  return true
}

function weightedRandom<T extends { id: string }>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let totalCompanies = 0
  let assignedCount = 0
  let skippedCount = 0

  try {
    const { data: rules, error: rulesErr } = await supabase
      .from('homes_dispatch_rules')
      .select('id, name, priority, is_active, conditions, target_team_id, target_role, weight')
      .eq('is_active', true)
      .order('priority', { ascending: false })
    if (rulesErr) throw rulesErr

    const { data: companies, error: compErr } = await supabase
      .from('homes_companies')
      .select('id, prefecture, main_business, total_score')
      .eq('call_state', 'untouched')
      .is('assigned_user_id', null)
      .limit(1000)
    if (compErr) throw compErr

    totalCompanies = companies?.length ?? 0

    const { data: appointers, error: apErr } = await supabase
      .from('homes_users')
      .select('id, team_id, role, is_active')
      .eq('role', 'APPOINTER')
      .eq('is_active', true)
    if (apErr) throw apErr

    const appointersByTeam = new Map<string, AppointerRow[]>()
    for (const a of (appointers ?? []) as AppointerRow[]) {
      const key = a.team_id ?? '__none__'
      if (!appointersByTeam.has(key)) appointersByTeam.set(key, [])
      appointersByTeam.get(key)!.push(a)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

    for (const c of (companies ?? []) as CompanyRow[]) {
      // TODO: when ANTHROPIC_API_KEY is set and conditions reference free-text
      // (e.g. company.notes), call Claude Haiku to classify. Stub for now.
      void anthropicKey

      let matchedRule: DispatchRule | null = null
      for (const r of (rules ?? []) as DispatchRule[]) {
        if (matchesRule(c, r)) {
          matchedRule = r
          break
        }
      }

      if (!matchedRule || !matchedRule.target_team_id) {
        skippedCount++
        continue
      }

      const pool = appointersByTeam.get(matchedRule.target_team_id) ?? []
      if (pool.length === 0) {
        skippedCount++
        continue
      }

      const weights = pool.map(() => matchedRule!.weight ?? 1)
      const picked = weightedRandom(pool, weights)
      if (!picked) {
        skippedCount++
        continue
      }

      const { error: updErr } = await supabase
        .from('homes_companies')
        .update({ assigned_user_id: picked.id })
        .eq('id', c.id)
      if (updErr) {
        skippedCount++
        continue
      }
      assignedCount++
    }

    await supabase.from('homes_dispatch_runs').insert({
      run_at: new Date().toISOString(),
      total_companies: totalCompanies,
      assigned_count: assignedCount,
      skipped_count: skippedCount,
      status: 'done',
      error: null,
      details: null,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        total_companies: totalCompanies,
        assigned_count: assignedCount,
        skipped_count: skippedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = (e as Error).message
    await supabase.from('homes_dispatch_runs').insert({
      run_at: new Date().toISOString(),
      total_companies: totalCompanies,
      assigned_count: assignedCount,
      skipped_count: skippedCount,
      status: 'failed',
      error: msg,
      details: null,
    })
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
