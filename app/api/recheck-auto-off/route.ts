// Next.js API proxy to recheck-auto-off Edge Function (GAP-P / G-13)
// 議事録: 申込承認日から2ヶ月経過で再審査チェック自動オフ
// pg_cron で日次起動するが、ADMIN/PM が手動で同期トリガーする UI 用にも提供
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    const auth = req.headers.get('authorization') ?? `Bearer ${anonKey}`

    const resp = await fetch(`${baseUrl}/functions/v1/recheck-auto-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'apikey': anonKey,
      },
      body: JSON.stringify(body),
    })

    const json = await resp.json().catch(() => ({}))
    return NextResponse.json(json, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
