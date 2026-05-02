// GAP-O: notify on application PDF upload via Slack + in-app notification
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

  try {
    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(JSON.stringify({ ok: false, error: 'order_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const slackWebhook = Deno.env.get('SLACK_WEBHOOK_URL') ?? ''

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: order, error: orderErr } = await supabase
      .from('homes_orders')
      .select('id, deal_id, company_id, ordered_at, closer_user_id, monthly_fee, initial_fee, application_pdf_url, application_pdf_uploaded_at, application_pdf_uploaded_by')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ ok: false, error: orderErr?.message ?? 'order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: closer } = await supabase
      .from('homes_users')
      .select('id, name, email')
      .eq('id', order.closer_user_id)
      .maybeSingle()

    const { data: company } = await supabase
      .from('homes_companies')
      .select('id, company_name')
      .eq('id', order.company_id)
      .maybeSingle()

    const companyName = company?.company_name ?? '(unknown)'
    const closerName = closer?.name ?? '(unknown)'
    const pdfUrl = order.application_pdf_url ?? ''

    if (slackWebhook) {
      const text = `*申込書アップロード* :rocket:\n会社: ${companyName}\nクローザー: ${closerName}\nPDF: ${pdfUrl}`
      try {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
      } catch (e) {
        console.error('Slack webhook failed', e)
      }
    }

    if (order.closer_user_id) {
      await supabase.from('homes_notifications').insert({
        user_id: order.closer_user_id,
        kind: 'order_pdf_uploaded',
        title: '申込書アップロード完了',
        body: `${companyName} の申込書がアップロードされました`,
        payload: { order_id: order.id },
        fired_at: new Date().toISOString(),
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
