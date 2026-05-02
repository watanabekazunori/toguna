import { createClient } from '@/lib/supabase/client'

const APPLICATION_BUCKET = 'homes-application-forms'

/**
 * G-10: 申込書 PDF を Supabase Storage に保存し、署名付き URL を返す。
 * file-upload-storage パターン準拠。
 */
export async function uploadApplicationForm(collectionId: string, file: File): Promise<string> {
  const supabase = createClient()
  const stamp = Date.now()
  const safeName = file.name.replace(/[^\w.-]/g, '_')
  const path = `${collectionId}/${stamp}_${safeName}`

  const { error: upErr } = await supabase.storage
    .from(APPLICATION_BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (upErr) throw upErr

  const { data, error: signErr } = await supabase.storage
    .from(APPLICATION_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30)
  if (signErr) throw signErr

  return data.signedUrl
}
