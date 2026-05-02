// GAP-P: auto-disable recheck flag for collections older than 2 months
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

  try {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 2)
    const cutoffIso = cutoff.toISOString()
    const nowIso = new Date().toISOString()

    const { data: targets, error: selErr } = await supabase
      .from('homes_collections')
      .select('id')
      .eq('recheck_required', true)
      .lt('audit_request_date', cutoffIso)
    if (selErr) throw selErr

    const ids = (targets ?? []).map((t: { id: string }) => t.id)
    let updated = 0

    if (ids.length > 0) {
      const { error: updErr } = await supabase
        .from('homes_collections')
        .update({ recheck_required: false, recheck_auto_off_at: nowIso })
        .in('id', ids)
      if (updErr) throw updErr
      updated = ids.length
    }

    await supabase.from('homes_audit_sync_log').insert({
      synced_at: nowIso,
      source: 'recheck_cron',
      sheet_url: null,
      rows_processed: updated,
      rows_updated: updated,
      rows_skipped: 0,
      status: 'done',
      error: null,
      details: { cutoff: cutoffIso },
    })

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = (e as Error).message
    await supabase.from('homes_audit_sync_log').insert({
      synced_at: new Date().toISOString(),
      source: 'recheck_cron',
      sheet_url: null,
      rows_processed: 0,
      rows_updated: 0,
      rows_skipped: 0,
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
