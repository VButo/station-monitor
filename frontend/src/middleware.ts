import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check for our custom supabase-token cookie
  const token = request.cookies.get('supabase-token')?.value
  
  // List of protected routes that require authentication
  const protectedRoutes = ['/network', '/overview', '/station', '/report']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  
  // If no token and accessing protected route, redirect to login
  if (!token && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // If no token and accessing root, redirect to login
  if (!token && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // If no token, allow through (login page, etc.)
  if (!token) {
    return NextResponse.next()
  }
  
  // Token exists - validate it before making routing decisions
  let isValidToken = false
  try {
    // Use internal API URL when running inside Docker/containers so the middleware
    // can reach the backend service over the Compose network. Fallbacks:
    // - NEXT_PUBLIC_API_URL (dev override)
    // - same-origin relative '/api' (when fronted by a reverse proxy)
    const apiUrl = process.env.INTERNAL_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || new URL('/api', request.url).toString()
    const controller = new AbortController()
    // 2500ms timeout to avoid hanging the edge request
    const timeout = setTimeout(() => controller.abort(), 2500)

    const response = await fetch(`${apiUrl}/users/me`, {
      headers: {
        'Cookie': `supabase-token=${token}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    isValidToken = response.ok && response.status !== 401
  } catch (error) {
    console.warn('Middleware: Unable to validate token (timeout or network error):', error)
    isValidToken = false
  }
  
  // If token is invalid, clear it and redirect to login
  if (!isValidToken) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.cookies.delete('supabase-token')
    return redirectResponse
  }
  
  // Token is valid - handle routing for authenticated users
  // If trying to access login page with valid token, redirect to network
  if (request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/network'
    return NextResponse.redirect(url)
  }
  
  // If accessing root with valid token, redirect to network
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/network'
    return NextResponse.redirect(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}