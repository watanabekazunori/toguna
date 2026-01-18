import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type NotificationType = 'appointment' | 'call_complete' | 'new_company' | 'system'

export type Notification = {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  created_at: string
}

export type AppointmentPayload = {
  id: string
  company_id: string
  operator_id: string
  result: string
  duration: number
  notes: string | null
  called_at: string
  // Joined data
  company_name?: string
  operator_name?: string
}

type SubscriptionCallback = (notification: Notification) => void

class RealtimeService {
  private channel: RealtimeChannel | null = null
  private callbacks: Set<SubscriptionCallback> = new Set()

  /**
   * アポ獲得通知を購読
   */
  subscribeToAppointments(callback: SubscriptionCallback): () => void {
    const supabase = createClient()

    // コールバックを登録
    this.callbacks.add(callback)

    // 既存のチャンネルがなければ作成
    if (!this.channel) {
      this.channel = supabase
        .channel('call_logs_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_logs',
            filter: 'result=eq.アポ獲得',
          },
          async (payload) => {
            const newLog = payload.new as AppointmentPayload

            // 追加情報を取得（会社名、オペレーター名）
            const [companyRes, operatorRes] = await Promise.all([
              supabase
                .from('companies')
                .select('name')
                .eq('id', newLog.company_id)
                .single(),
              supabase
                .from('operators')
                .select('name')
                .eq('id', newLog.operator_id)
                .single(),
            ])

            const notification: Notification = {
              id: `appt-${newLog.id}`,
              type: 'appointment',
              title: '🎉 アポ獲得！',
              message: `${operatorRes.data?.name || 'オペレーター'}が${companyRes.data?.name || '企業'}からアポを獲得しました`,
              data: {
                call_log_id: newLog.id,
                company_id: newLog.company_id,
                operator_id: newLog.operator_id,
                company_name: companyRes.data?.name,
                operator_name: operatorRes.data?.name,
                duration: newLog.duration,
              },
              read: false,
              created_at: new Date().toISOString(),
            }

            // 全コールバックに通知
            this.callbacks.forEach((cb) => cb(notification))
          }
        )
        .subscribe()
    }

    // クリーンアップ関数を返す
    return () => {
      this.callbacks.delete(callback)
      if (this.callbacks.size === 0 && this.channel) {
        supabase.removeChannel(this.channel)
        this.channel = null
      }
    }
  }

  /**
   * 全架電完了を購読（ディレクター向け）
   */
  subscribeToAllCalls(callback: (log: AppointmentPayload) => void): () => void {
    const supabase = createClient()

    const channel = supabase
      .channel('all_call_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
        },
        (payload) => {
          callback(payload.new as AppointmentPayload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * 新規企業追加を購読
   */
  subscribeToNewCompanies(callback: (company: any) => void): () => void {
    const supabase = createClient()

    const channel = supabase
      .channel('new_companies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'companies',
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}

// シングルトンインスタンス
export const realtimeService = new RealtimeService()

/**
 * 通知音を再生
 */
export function playNotificationSound() {
  if (typeof window !== 'undefined') {
    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // 自動再生がブロックされた場合は無視
      })
    } catch {
      // オーディオ再生エラーは無視
    }
  }
}

/**
 * ブラウザ通知を表示
 */
export async function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (typeof window === 'undefined') return

  // 通知許可を確認
  if (Notification.permission === 'granted') {
    new Notification(title, options)
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, options)
    }
  }
}
