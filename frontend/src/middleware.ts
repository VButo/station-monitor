import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check for our custom supabase-token cookie
  const token = request.cookies.get('supabase-token')?.value
  
  // List of protected routes that require authentication
  const protectedRoutes = ['/simple', '/overview', '/advanced', '/station']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  
  // Skip validation for login page and public routes
  if (request.nextUrl.pathname === '/login' || 
      request.nextUrl.pathname === '/' || 
      !isProtectedRoute) {
    
    // If logged in and trying to access login page, redirect to simple
    if (token && request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/simple'
      return NextResponse.redirect(url)
    }
    
    // If accessing root and logged in, redirect to simple
    if (token && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/simple'
      return NextResponse.redirect(url)
    }
    
    // If accessing root and not logged in, redirect to login
    if (!token && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }
  
  // For protected routes, validate the token
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // Validate token by making API call
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
    const response = await fetch(`${apiUrl}/users/me`, {
      headers: {
        'Cookie': `supabase-token=${token}`,
      },
    })
    
    if (!response.ok || response.status === 401) {
      // Token is invalid/expired, clear it and redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.cookies.delete('supabase-token')
      return redirectResponse
    }
  } catch (error) {
    // Network error or API down, allow through but let client handle
    console.warn('Middleware: Unable to validate token, allowing request through:', error)
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