// GAP-P: sync audit results from Google Sheets into homes_collections
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface SheetRow {
  audit_request_no?: string
  status?: string
  audit_date?: string
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
    const { sheet_url, sheet_id, range } = await req.json().catch(() => ({}))
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY') ?? ''

    if (!apiKey) {
      await supabase.from('homes_audit_sync_log').insert({
        synced_at: new Date().toISOString(),
        source: 'google_sheets_mock',
        sheet_url: sheet_url ?? null,
        rows_processed: 0,
        rows_updated: 0,
        rows_skipped: 0,
        status: 'mock',
        error: null,
        details: { mock: true },
      })
      return new Response(JSON.stringify({ ok: true, mock: true, rows_processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const id = sheet_id ?? extractSheetId(sheet_url)
    const r = range ?? 'A:Z'
    const rows: SheetRow[] = []
    let processed = 0
    let updated = 0
    let skipped = 0

    if (id) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(r)}?key=${apiKey}`
      const resp = await fetch(url)
      const json = await resp.json() as { values?: string[][] }
      const values = json.values ?? []
      if (values.length > 0) {
        const header = values[0].map((h) => h.trim().toLowerCase())
        const idxNo = header.indexOf('audit_request_no')
        const idxStatus = header.indexOf('status')
        const idxDate = header.indexOf('audit_date')
        for (let i = 1; i < values.length; i++) {
          const row = values[i]
          rows.push({
            audit_request_no: idxNo >= 0 ? row[idxNo] : undefined,
            status: idxStatus >= 0 ? row[idxStatus] : undefined,
            audit_date: idxDate >= 0 ? row[idxDate] : undefined,
          })
        }
      }
    }

    for (const row of rows) {
      processed++
      if (!row.audit_request_no) {
        skipped++
        continue
      }
      const { error: updErr } = await supabase
        .from('homes_collections')
        .update({
          audit_request_date: row.audit_date ?? null,
          audit_result: row.status ?? null,
        })
        .eq('audit_request_no', row.audit_request_no)
      if (updErr) {
        skipped++
        continue
      }
      updated++
    }

    await supabase.from('homes_audit_sync_log').insert({
      synced_at: new Date().toISOString(),
      source: 'google_sheets',
      sheet_url: sheet_url ?? null,
      rows_processed: processed,
      rows_updated: updated,
      rows_skipped: skipped,
      status: 'done',
      error: null,
      details: null,
    })

    return new Response(JSON.stringify({ ok: true, rows_processed: processed, rows_updated: updated, rows_skipped: skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = (e as Error).message
    await supabase.from('homes_audit_sync_log').insert({
      synced_at: new Date().toISOString(),
      source: 'google_sheets',
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

function extractSheetId(url?: string): string | null {
  if (!url) return null
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}
