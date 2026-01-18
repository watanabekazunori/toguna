'use server'

import {
  getZoomClient,
  isZoomConfigured,
  formatPhoneNumberE164,
  type ZoomCallSession,
  type ZoomUser,
  type CallHistoryItem,
} from '@/lib/zoom'

// Zoom設定状態を確認
export async function checkZoomConfiguration(): Promise<{
  configured: boolean
  error?: string
}> {
  try {
    if (!isZoomConfigured()) {
      return {
        configured: false,
        error: 'Zoom API認証情報が設定されていません',
      }
    }

    // アクセストークン取得をテスト
    const client = getZoomClient()
    await client.getAccessToken()

    return { configured: true }
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Zoom接続エラー',
    }
  }
}

// Phone対応ユーザー一覧を取得
export async function getZoomPhoneUsers(): Promise<{
  success: boolean
  users?: ZoomUser[]
  error?: string
}> {
  try {
    const client = getZoomClient()
    const result = await client.getPhoneUsers()

    return {
      success: true,
      users: result.users,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ユーザー取得エラー',
    }
  }
}

// 発信を実行
export async function initiateZoomCall(params: {
  userId: string
  phoneNumber: string
  callerNumber?: string
}): Promise<{
  success: boolean
  callSession?: ZoomCallSession
  error?: string
}> {
  try {
    const client = getZoomClient()

    // 電話番号をE.164形式に変換
    const calleeNumber = formatPhoneNumberE164(params.phoneNumber)

    const callSession = await client.makeCall({
      userId: params.userId,
      calleeNumber,
      callerNumber: params.callerNumber,
    })

    return {
      success: true,
      callSession,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '発信エラー',
    }
  }
}

// 通話を終了
export async function endZoomCall(params: {
  userId: string
  callId: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const client = getZoomClient()
    await client.endCall(params.userId, params.callId)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '通話終了エラー',
    }
  }
}

// 通話ステータスを取得
export async function getZoomCallStatus(params: {
  userId: string
  callId: string
}): Promise<{
  success: boolean
  callSession?: ZoomCallSession
  error?: string
}> {
  try {
    const client = getZoomClient()
    const callSession = await client.getCallStatus(params.userId, params.callId)

    return {
      success: true,
      callSession,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ステータス取得エラー',
    }
  }
}

// 通話履歴を取得
export async function getZoomCallHistory(params: {
  userId: string
  from?: string
  to?: string
  type?: 'all' | 'missed' | 'voicemail'
  pageSize?: number
}): Promise<{
  success: boolean
  callLogs?: CallHistoryItem[]
  error?: string
}> {
  try {
    const client = getZoomClient()
    const result = await client.getCallHistory({
      userId: params.userId,
      from: params.from,
      to: params.to,
      type: params.type,
      page_size: params.pageSize,
    })

    return {
      success: true,
      callLogs: result.call_logs,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴取得エラー',
    }
  }
}
