import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function getServerSupabase() {
  return createClient()
}

export function jsonError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, detail: extra ?? null }, { status })
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: hu } = await supabase
    .from('homes_users')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .maybeSingle()
  return hu?.id ?? null
}
