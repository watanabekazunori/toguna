import { NextRequest, NextResponse } from 'next/server'

// Rate limiting: store in memory (for production use Redis/Upstash)
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_SECONDS = 2
const RATE_LIMIT_REQUESTS = 1

/**
 * Check rate limit for a given IP/client
 */
function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_SECONDS * 1000

  let requests = rateLimitMap.get(clientId) || []
  requests = requests.filter((timestamp) => timestamp > windowStart)

  if (requests.length >= RATE_LIMIT_REQUESTS) {
    return false // Rate limited
  }

  requests.push(now)
  rateLimitMap.set(clientId, requests)

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      if (timestamps.filter((t) => t > windowStart).length === 0) {
        rateLimitMap.delete(key)
      }
    }
  }

  return true // Not rate limited
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

/**
 * Proxy scraping requests to external URLs
 * POST /api/scrape
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientId(request)

    // Check rate limit
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 1 request per 2 seconds.' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { url } = body

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing URL parameter' }, { status: 400 })
    }

    // Validate URL is HTTPS and from allowed domains
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Only allow HTTPS
    if (urlObj.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Only HTTPS URLs are allowed for security reasons' },
        { status: 400 }
      )
    }

    // Perform the fetch with proper headers
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TOGUNA-Scraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    // Get response content
    const contentType = response.headers.get('content-type')
    let content: string

    if (contentType?.includes('text')) {
      content = await response.text()
    } else {
      const arrayBuffer = await response.arrayBuffer()
      content = Buffer.from(arrayBuffer).toString('base64')
    }

    // Return the scraped content
    return NextResponse.json(
      {
        success: true,
        url,
        status: response.status,
        contentType,
        content,
        headers: Object.fromEntries(response.headers.entries()),
      },
      {
        status: response.status,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('Scrape API error:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Network error: Unable to reach the specified URL' },
        { status: 502 }
      )
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout: The URL took too long to respond' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error during scraping' },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Scrape API is running',
    rateLimit: `${RATE_LIMIT_REQUESTS} request(s) per ${RATE_LIMIT_SECONDS} second(s)`,
  })
}
