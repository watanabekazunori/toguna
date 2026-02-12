import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = [
    /^\/login$/,
    /^\/signup$/,
    /^\/forgot-password$/,
    /^\/reset-password$/,
    /^\/portal\/.*/,
    /^\/_next\/.*/,
    /^\/api\/.*/,
    /^\/sounds\/.*/,
    /^\/favicon\.ico$/,
  ]

  // Protected routes that require authentication
  const protectedRoutes = [
    /^\/director\/.*/,
    /^\/call\/.*/,
    /^\/call-list\/.*/,
    /^\/operator\/.*/,
  ]

  // Check if route is public
  const isPublicRoute = publicRoutes.some(pattern => pattern.test(pathname))
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(pattern => pattern.test(pathname))

  let response = NextResponse.next()
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Get the current user's session
  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes: redirect to /login if no user
  if (isProtectedRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // If user is authenticated and tries to access /login, redirect to /
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // For all other routes, return the response with updated cookies
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
