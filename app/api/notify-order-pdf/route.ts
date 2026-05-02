// Next.js API proxy to notify-order-pdf Edge Function
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const order_id = body?.order_id
    if (!order_id) {
      return NextResponse.json({ ok: false, error: 'order_id required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    const auth = req.headers.get('authorization') ?? `Bearer ${anonKey}`

    const resp = await fetch(`${baseUrl}/functions/v1/notify-order-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'apikey': anonKey,
      },
      body: JSON.stringify({ order_id }),
    })

    const json = await resp.json().catch(() => ({}))
    return NextResponse.json(json, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
