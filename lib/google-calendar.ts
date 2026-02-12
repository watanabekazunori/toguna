/**
 * Google Calendar Integration Utility
 * Handles OAuth2 flow and calendar operations
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// Scopes needed for calendar operations
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
  conferenceData?: {
    createRequest: {
      requestId: string;
    };
  };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface AppointmentEventParams {
  companyName: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingType: string;
  meetingUrl?: string;
  salesRepEmail: string;
  notes?: string;
}

/**
 * Generate Google OAuth URL for user authorization
 */
export function getGoogleAuthURL(): string {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    console.warn(
      'GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI not set. Please configure these environment variables.'
    );
    return '';
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<TokenResponse> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      'Missing Google OAuth configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)'
    );
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_REDIRECT_URI,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to exchange code: ${error.error_description || error.error}`
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Missing Google OAuth configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)'
    );
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to refresh token: ${error.error_description || error.error}`
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<{ id: string; htmlLink: string }> {
  try {
    const response = await fetch(GOOGLE_CALENDAR_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to create calendar event: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

/**
 * Create appointment as calendar event
 */
export async function createAppointmentEvent(
  accessToken: string,
  appointment: AppointmentEventParams
): Promise<{ id: string; htmlLink: string }> {
  try {
    // Parse scheduled date
    const startDateTime = new Date(appointment.scheduledAt);
    const endDateTime = new Date(
      startDateTime.getTime() + appointment.durationMinutes * 60000
    );

    // Format dates for Google Calendar API (ISO 8601)
    const formatDate = (date: Date): string => {
      return date.toISOString();
    };

    // Build event summary
    const summary = `${appointment.meetingType} - ${appointment.companyName}`;

    // Build event description
    let description = `営業担当者: ${appointment.salesRepEmail}\n`;
    description += `会社: ${appointment.companyName}\n`;
    description += `会議タイプ: ${appointment.meetingType}\n`;
    if (appointment.notes) {
      description += `備考: ${appointment.notes}\n`;
    }
    if (appointment.meetingUrl) {
      description += `会議URL: ${appointment.meetingUrl}\n`;
    }

    const event: CalendarEvent = {
      summary,
      description,
      start: {
        dateTime: formatDate(startDateTime),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: formatDate(endDateTime),
        timeZone: 'Asia/Tokyo',
      },
      attendees: [
        {
          email: appointment.salesRepEmail,
          displayName: '営業担当者',
        },
      ],
      location: appointment.meetingUrl ? 'Online' : undefined,
    };

    // Add conference data if it's a video meeting
    if (appointment.meetingUrl || appointment.meetingType.toLowerCase().includes('zoom')) {
      event.conferenceData = {
        createRequest: {
          requestId: `toguna-${Date.now()}`,
        },
      };
    }

    return createCalendarEvent(accessToken, event);
  } catch (error) {
    console.error('Error creating appointment event:', error);
    throw error;
  }
}

/**
 * Get calendar event by ID
 */
export async function getCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<any> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/${eventId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to get calendar event: ${error.error?.message || 'Unknown error'}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting calendar event:', error);
    throw error;
  }
}

/**
 * Update calendar event
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Partial<CalendarEvent>
): Promise<{ id: string; htmlLink: string }> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to update calendar event: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete calendar event: ${error.error?.message || 'Unknown error'}`
      );
    }
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
}

/**
 * List calendar events
 */
export async function listCalendarEvents(
  accessToken: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (options?.timeMin) params.append('timeMin', options.timeMin);
    if (options?.timeMax) params.append('timeMax', options.timeMax);
    if (options?.maxResults) params.append('maxResults', String(options.maxResults));

    const url = `${GOOGLE_CALENDAR_API}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to list calendar events: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error listing calendar events:', error);
    throw error;
  }
}

/**
 * Check if Google Calendar is properly configured
 */
export function isGoogleCalendarConfigured(): boolean {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    console.warn(
      'Google Calendar is not properly configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.'
    );
    return false;
  }
  return true;
}
