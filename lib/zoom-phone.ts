/**
 * Zoom Phone Integration Utility
 * Handles OAuth2 flow and Zoom Phone API operations
 */

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET

const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize'
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token'
const ZOOM_API_BASE = 'https://api.zoom.us/v2'

// Scopes needed for Zoom Phone operations
const SCOPES = [
  'phone:write:admin',
  'phone:read:admin',
  'phone:write:user',
  'phone:read:user',
]

export interface ZoomPhoneConfig {
  accountId: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export interface CallInitiationParams {
  phoneNumber: string
  userId: string
}

export interface CallSession {
  call_id: string
  user_id: string
  phone_number: string
  status: 'initiated' | 'ringing' | 'active' | 'ended'
  started_at: string
  duration_seconds?: number
}

export interface CallRecording {
  recording_id: string
  call_id: string
  duration: number
  download_url: string
  created_at: string
}

export interface CallHistory {
  call_id: string
  user_id: string
  phone_number: string
  duration: number
  direction: 'inbound' | 'outbound'
  status: 'completed' | 'missed' | 'failed'
  created_at: string
}

/**
 * Get Zoom Phone configuration from environment variables
 */
function getZoomConfig(): ZoomPhoneConfig {
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    console.warn(
      'Zoom Phone is not properly configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET environment variables.'
    )
  }

  return {
    accountId: ZOOM_ACCOUNT_ID || '',
    clientId: ZOOM_CLIENT_ID || '',
    clientSecret: ZOOM_CLIENT_SECRET || '',
    redirectUri: process.env.ZOOM_REDIRECT_URI || 'http://localhost:3000/api/zoom/callback',
  }
}

/**
 * Check if Zoom Phone is properly configured
 */
export function isZoomPhoneConfigured(): boolean {
  return !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET)
}

/**
 * Generate Zoom OAuth URL for user authorization
 */
export function getZoomAuthURL(): string {
  const config = getZoomConfig()

  if (!config.clientId) {
    console.warn('ZOOM_CLIENT_ID not set')
    return ''
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: SCOPES.join(' '),
  })

  return `${ZOOM_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const config = getZoomConfig()

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Missing Zoom OAuth configuration')
  }

  try {
    const response = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to exchange code: ${error.reason || error.error}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    }
  } catch (error) {
    console.error('Error exchanging code for tokens:', error)
    throw error
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = getZoomConfig()

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Missing Zoom OAuth configuration')
  }

  try {
    const response = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to refresh token: ${error.reason || error.error}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    throw error
  }
}

/**
 * Initiate a Zoom Phone call
 * When Zoom Phone is not configured, returns mock data with a warning
 */
export async function initiateCall(
  accessToken: string,
  params: CallInitiationParams
): Promise<CallSession> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Returning mock call session.')
    return {
      call_id: `mock-call-${Date.now()}`,
      user_id: params.userId,
      phone_number: params.phoneNumber,
      status: 'initiated',
      started_at: new Date().toISOString(),
    }
  }

  try {
    const response = await fetch(`${ZOOM_API_BASE}/users/${params.userId}/phone/calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: params.phoneNumber,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to initiate call: ${error.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return {
      call_id: data.id,
      user_id: params.userId,
      phone_number: params.phoneNumber,
      status: data.status,
      started_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error initiating call:', error)
    throw error
  }
}

/**
 * Get call recording
 * When Zoom Phone is not configured, returns mock data
 */
export async function getCallRecording(
  accessToken: string,
  callId: string,
  userId: string
): Promise<CallRecording> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Returning mock recording.')
    return {
      recording_id: `mock-recording-${Date.now()}`,
      call_id: callId,
      duration: 300,
      download_url: '#',
      created_at: new Date().toISOString(),
    }
  }

  try {
    const response = await fetch(
      `${ZOOM_API_BASE}/users/${userId}/phone/calls/${callId}/recordings`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get call recording: ${error.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return {
      recording_id: data.id,
      call_id: callId,
      duration: data.duration,
      download_url: data.download_url,
      created_at: data.created_at,
    }
  } catch (error) {
    console.error('Error getting call recording:', error)
    throw error
  }
}

/**
 * Get call history
 * When Zoom Phone is not configured, returns mock data
 */
export async function getCallHistory(
  accessToken: string,
  userId: string,
  options?: {
    limit?: number
    page?: number
  }
): Promise<CallHistory[]> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Returning mock call history.')
    return [
      {
        call_id: 'mock-call-1',
        user_id: userId,
        phone_number: '09012345678',
        duration: 300,
        direction: 'outbound',
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ]
  }

  try {
    const params = new URLSearchParams()
    if (options?.limit) params.append('page_size', String(options.limit))
    if (options?.page) params.append('page_number', String(options.page))

    const response = await fetch(
      `${ZOOM_API_BASE}/users/${userId}/phone/call_logs?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get call history: ${error.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return (data.call_logs || []).map((log: any) => ({
      call_id: log.id,
      user_id: userId,
      phone_number: log.phone_number,
      duration: log.duration,
      direction: log.direction,
      status: log.status,
      created_at: log.created_at,
    }))
  } catch (error) {
    console.error('Error getting call history:', error)
    throw error
  }
}

/**
 * Disconnect a Zoom Phone call
 */
export async function disconnectCall(
  accessToken: string,
  userId: string,
  callId: string
): Promise<void> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Skipping disconnect.')
    return
  }

  try {
    const response = await fetch(`${ZOOM_API_BASE}/users/${userId}/phone/calls/${callId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok && response.status !== 204) {
      const error = await response.json()
      throw new Error(`Failed to disconnect call: ${error.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error disconnecting call:', error)
    throw error
  }
}

/**
 * Hold a Zoom Phone call
 */
export async function holdCall(
  accessToken: string,
  userId: string,
  callId: string
): Promise<void> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Skipping hold.')
    return
  }

  try {
    const response = await fetch(`${ZOOM_API_BASE}/users/${userId}/phone/calls/${callId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'hold',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to hold call: ${error.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error holding call:', error)
    throw error
  }
}

/**
 * Resume a held Zoom Phone call
 */
export async function resumeCall(
  accessToken: string,
  userId: string,
  callId: string
): Promise<void> {
  if (!isZoomPhoneConfigured()) {
    console.warn('Zoom Phone is not configured. Skipping resume.')
    return
  }

  try {
    const response = await fetch(`${ZOOM_API_BASE}/users/${userId}/phone/calls/${callId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'resume',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to resume call: ${error.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error resuming call:', error)
    throw error
  }
}
