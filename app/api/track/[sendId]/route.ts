import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

/**
 * トラッキングピクセル/開封検知 API
 * GET /api/track/[sendId]?redirect=<url>&type=<pixel|redirect>
 *
 * パラメータ:
 * - sendId: ドキュメント送付ID (URLパスから取得)
 * - redirect: リダイレクト先URL (type=redirect の場合)
 * - type: ピクセル返却 (pixel) またはリダイレクト (redirect) (デフォルト: pixel)
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sendId: string }> }
) {
  try {
    const { sendId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const redirectUrl = searchParams.get('redirect')
    const trackingType = searchParams.get('type') || 'pixel'

    // パラメータ検証
    if (!sendId) {
      return new NextResponse('Invalid request', { status: 400 })
    }

    // トラッキングイベントを記録
    const supabase = createSupabaseClient()

    // ドキュメント送付の存在確認
    const { data: send, error: fetchError } = await supabase
      .from('document_sends')
      .select('id, company_id')
      .eq('id', sendId)
      .single()

    if (fetchError || !send) {
      console.error('Document send not found:', fetchError)
      // エラーでも追跡ピクセルやリダイレクトは実行
    }

    // トラッキングイベントを記録
    const { error: trackError } = await supabase
      .from('document_tracking')
      .insert({
        document_send_id: sendId,
        event_type: 'open',
        tracked_at: new Date().toISOString(),
      })

    if (trackError) {
      console.error('Failed to record tracking event:', trackError)
      // エラーログを記録するが、レスポンスは返す
    }

    // エンゲージメントスコアを更新
    if (send?.company_id) {
      try {
        // company_idからproject_idを取得
        const { data: company } = await supabase
          .from('companies')
          .select('project_id')
          .eq('id', send.company_id)
          .single()

        if (company?.project_id) {
          // スコア更新（既存エンゲージメントスコアをチェック）
          const { data: existing } = await supabase
            .from('engagement_scores')
            .select('*')
            .eq('company_id', send.company_id)
            .eq('project_id', company.project_id)
            .single()

          if (existing) {
            const newDocScore = (existing.document_score || 0) + 15
            const newTotal = (existing.total_score || 0) + 15

            await supabase
              .from('engagement_scores')
              .update({
                document_score: newDocScore,
                total_score: newTotal,
                last_activity_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          }
        }
      } catch (err) {
        console.error('Failed to update engagement score:', err)
      }
    }

    // レスポンスタイプを判定
    if (trackingType === 'redirect' && redirectUrl) {
      // リダイレクトモード
      return NextResponse.redirect(redirectUrl, { status: 302 })
    } else {
      // ピクセルモード（1x1透明GIF）
      // GIF89a の最小ピクセル（1x1透明）
      const gifPixel = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
        0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, // Logical screen descriptor
        0xff, 0xff, 0xff, 0x00, 0x00, 0x00, // Color table (white, transparent)
        0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, // Graphics control extension
        0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // Image descriptor
        0x02, 0x02, 0x44, 0x01, 0x00, 0x3b, // Image data & trailer
      ])

      return new NextResponse(gifPixel, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Content-Length': gifPixel.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    }
  } catch (error) {
    console.error('Tracking API error:', error)

    // エラー時も追跡ピクセルを返す（トラッキングの失敗が分からないようにする）
    const gifPixel = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
    ])

    return new NextResponse(gifPixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }
}
