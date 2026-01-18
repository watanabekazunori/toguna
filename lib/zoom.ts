// Zoom Phone API連携
// https://developers.zoom.us/docs/phone/

type ZoomConfig = {
  accountId: string
  clientId: string
  clientSecret: string
}

type ZoomAccessToken = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export type CallStatus = 'ringing' | 'in_progress' | 'ended' | 'failed' | 'no_answer' | 'busy'

export type ZoomCallSession = {
  call_id: string
  caller_number: string
  callee_number: string
  status: CallStatus
  direction: 'outbound' | 'inbound'
  start_time: string
  duration?: number
  end_time?: string
  recording_url?: string
}

export type ZoomUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  display_name?: string
  phone_numbers?: {
    id: string
    number: string
    country: string
  }[]
  extension_number?: string
  status: string
}

export type CallHistoryItem = {
  id: string
  caller_number: string
  callee_number: string
  direction: 'outbound' | 'inbound'
  duration: number
  result: 'answered' | 'no_answer' | 'busy' | 'failed' | 'canceled'
  date_time: string
  recording_url?: string
}

// トークンキャッシュ
let cachedToken: { token: string; expiresAt: number } | null = null

// Server Action用のZoom APIクラス
class ZoomPhoneClient {
  private config: ZoomConfig

  constructor(config: ZoomConfig) {
    this.config = config
  }

  // OAuth2 Server-to-Server認証でアクセストークンを取得
  async getAccessToken(): Promise<string> {
    // キャッシュされたトークンがまだ有効かチェック
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
      return cachedToken.token
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64')

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: this.config.accountId,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Token request failed' }))
      throw new Error(`Zoom認証エラー: ${error.message || response.statusText}`)
    }

    const data: ZoomAccessToken = await response.json()

    // トークンをキャッシュ
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    return data.access_token
  }

  // APIリクエスト共通メソッド
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetch(`https://api.zoom.us/v2${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'API request failed' }))
      throw new Error(`Zoom APIエラー: ${error.message || response.statusText}`)
    }

    // 204 No Content の場合は空オブジェクトを返す
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ======= Phone Users =======

  // Phone対応ユーザー一覧を取得
  async getPhoneUsers(): Promise<{ users: ZoomUser[] }> {
    return this.request<{ users: ZoomUser[] }>('/phone/users')
  }

  // 特定ユーザーの情報を取得
  async getPhoneUser(userId: string): Promise<ZoomUser> {
    return this.request<ZoomUser>(`/phone/users/${userId}`)
  }

  // ======= Call Operations =======

  // 発信（Click-to-Call）
  async makeCall(params: {
    userId: string // 発信者のZoom User ID
    calleeNumber: string // 発信先電話番号
    callerNumber?: string // 発信元電話番号（オプション）
  }): Promise<ZoomCallSession> {
    return this.request<ZoomCallSession>('/phone/users/' + params.userId + '/phone_calls', {
      method: 'POST',
      body: JSON.stringify({
        callee_number: params.calleeNumber,
        caller_number: params.callerNumber,
      }),
    })
  }

  // 通話終了
  async endCall(userId: string, callId: string): Promise<void> {
    await this.request<void>(`/phone/users/${userId}/phone_calls/${callId}`, {
      method: 'DELETE',
    })
  }

  // 通話ステータス取得
  async getCallStatus(userId: string, callId: string): Promise<ZoomCallSession> {
    return this.request<ZoomCallSession>(`/phone/users/${userId}/phone_calls/${callId}`)
  }

  // ======= Call History =======

  // 通話履歴を取得
  async getCallHistory(params: {
    userId: string
    from?: string // YYYY-MM-DD形式
    to?: string
    type?: 'all' | 'missed' | 'voicemail'
    page_size?: number
  }): Promise<{ call_logs: CallHistoryItem[] }> {
    const searchParams = new URLSearchParams()
    if (params.from) searchParams.append('from', params.from)
    if (params.to) searchParams.append('to', params.to)
    if (params.type) searchParams.append('type', params.type)
    if (params.page_size) searchParams.append('page_size', params.page_size.toString())

    const query = searchParams.toString()
    return this.request<{ call_logs: CallHistoryItem[] }>(
      `/phone/users/${params.userId}/call_logs${query ? `?${query}` : ''}`
    )
  }

  // ======= Account Info =======

  // アカウントの通話統計を取得
  async getCallQueueStatistics(): Promise<{
    total_calls: number
    answered_calls: number
    missed_calls: number
    average_wait_time: number
  }> {
    return this.request('/phone/metrics/call_queues')
  }

  // ======= Webhook Events =======
  // Webhookで受け取るイベントタイプ
  static WEBHOOK_EVENTS = {
    CALL_STARTED: 'phone.callee_connected',
    CALL_ENDED: 'phone.call_ended',
    CALL_MISSED: 'phone.callee_missed',
    VOICEMAIL_RECEIVED: 'phone.voicemail_received',
  } as const
}

// シングルトンインスタンス
let zoomClient: ZoomPhoneClient | null = null

export function getZoomClient(): ZoomPhoneClient {
  if (!zoomClient) {
    const config: ZoomConfig = {
      accountId: process.env.ZOOM_ACCOUNT_ID || '',
      clientId: process.env.ZOOM_CLIENT_ID || '',
      clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
    }

    if (!config.accountId || !config.clientId || !config.clientSecret) {
      throw new Error('Zoom API認証情報が設定されていません')
    }

    zoomClient = new ZoomPhoneClient(config)
  }

  return zoomClient
}

// 設定が有効かチェック
export function isZoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  )
}

// ======= Utility Functions =======

// 電話番号を国際形式に変換（日本）
export function formatPhoneNumberE164(phoneNumber: string): string {
  // 既にE.164形式の場合はそのまま返す
  if (phoneNumber.startsWith('+')) {
    return phoneNumber
  }

  // 日本の電話番号を国際形式に変換
  let cleaned = phoneNumber.replace(/[-\s()]/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = '+81' + cleaned.slice(1)
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+81' + cleaned
  }

  return cleaned
}

// 通話時間をフォーマット
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export { ZoomPhoneClient }
