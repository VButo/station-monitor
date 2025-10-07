'use client'
import './globals.css'
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import Image from 'next/image'
import { fetchCurrentUser, logoutUser } from '@/utils/authHelpers';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Suppress external script errors that don't affect functionality
    const handleError = (e: ErrorEvent) => {
      if (e.message && (
        e.message.includes('enabledFeatures') || 
        e.message.includes('args.site') ||
        e.message.includes('isFeatureBroken')
      )) {
        e.preventDefault();
        // Silently ignore these external script errors
        return false;
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      try {
        const fetchedUser = await fetchCurrentUser();
        setUser(fetchedUser as unknown as User | null);
      } catch (error) {
        console.warn('Layout: Failed to fetch user, clearing session:', error);
        setUser(null);
        
        // If we're on a protected route and user fetch fails, redirect to login
        const protectedRoutes = ['/simple', '/overview', '/advanced', '/station', '/report'];
        const isProtectedRoute = protectedRoutes.some(route => 
          pathname.startsWith(route)
        );
        
        // Only redirect if we're on a protected route AND not already on login page
        if (isProtectedRoute && pathname !== '/login') {
          console.warn('Layout: User not authenticated on protected route, redirecting');
          setTimeout(() => {
            router.push('/login');
          }, 100); // Small delay to prevent race conditions
        }
      }
      setLoading(false);
    };
    getUser();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setDropdownOpen(false);
      setUser(null);
      console.log('Logging out, redirecting to /login');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setDropdownOpen(false);
      setUser(null);
      router.push('/login');
    }
  };

  const isFullPage = pathname==='/advanced' || pathname === '/station' || pathname === '/login' || pathname === '/simple';

  if (loading) {
    return (
      <html lang="en">
        <body className="bg-gray-50 flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en" className="h-full min-h-screen">
      <body className="bg-gray-50 h-full min-h-screen">
          <div className={`min-h-screen flex flex-col ${isFullPage ? 'h-full' : ''}`}>
          {user && (
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 relative z-40">
              <div className="flex items-center justify-between mx-auto">
                <div className="flex items-center gap-8">
                  <Link href="/overview" className="flex items-center gap-2">
                    <Image src="/metmonic_logo.svg" alt="Metmonic Logo" width={270} height={50} priority style={{ height: 'auto'}}/>
                  </Link>

                  {/* Desktop Menu */}
                  <nav className="hidden md:flex gap-6">
                    <MenuLinks pathname={pathname} />
                  </nav>
                </div>

                {/* Hamburger menu for mobile */}
                <button
                  className="md:hidden flex flex-col gap-1 cursor-pointer"
                  aria-label="Toggle Menu"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <span className="block w-6 h-0.5 bg-gray-800"></span>
                  <span className="block w-6 h-0.5 bg-gray-800"></span>
                  <span className="block w-6 h-0.5 bg-gray-800"></span>
                </button>

                {/* User Dropdown - desktop only */}
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <span className="text-white text-sm font-medium">{user.email?.charAt(0).toUpperCase()}</span>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-55 bg-white rounded-md shadow-lg border border-gray-200 z-55">
                      <div className="py-1">
                        <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                          <div className="font-medium">Signed in as</div>
                          <div className="text-gray-500 truncate">{user.email}</div>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Menu */}
              {mobileMenuOpen && (
                <div className="md:hidden mt-4 bg-white rounded-md shadow-lg border border-gray-200 z-100 p-4 space-y-4">
                  <MenuLinks pathname={pathname} mobile onClickLink={() => setMobileMenuOpen(false)} />

                  {/* User info block inside mobile menu */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="text-sm text-gray-700 mb-2">Signed in as</div>
                    <div className="font-semibold truncate mb-4">{user.email}</div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 rounded"
                      aria-label="Logout"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}

              {/* Click outside closing overlays */}
              {(mobileMenuOpen || dropdownOpen) && (
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-transparent p-0 m-0 border-none"
                  aria-label="Close menu overlays"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setDropdownOpen(false);
                  }}
                  style={{
                    outline: 'none',
                    width: '100%',
                    height: '100%',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                  tabIndex={0}
                />
              )}
            </nav>
          )}

          {/* Main Content */}
          <main className="flex-1 min-h-0">{children}</main>

          {/* Footer */}
          <footer className="bg-blue-900 text-white py-4 w-full flex-shrink-0 mt-auto">
            <div className="max-w-7xl mx-auto px-6 text-center">
              <p className="text-sm">Delta Tech © 2025</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

function MenuLinks({
  pathname,
  onClickLink,
}: Readonly<{
  pathname: string;
  onClickLink?: () => void;
  mobile?: boolean;
}>) {
  const baseClass = 'transition-colors block px-3 py-2 rounded-md';
  const activeClass = 'text-blue-600 font-medium';
  const inactiveClass = 'text-gray-600 hover:text-gray-900';

  const linkClass = (path: string, isBasePath = false) => {
    const isActive = isBasePath
      ? pathname === path || pathname.startsWith(`${path}/`) 
      : pathname === path;
  
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  return (
    <>
      <Link href="/overview" className={linkClass('/overview')} onClick={onClickLink}>
        Overview
      </Link>
      <Link href="/simple" className={linkClass('/simple')} onClick={onClickLink}>
        Simple
      </Link>
      <Link href="/station/1" className={linkClass('/station', true)} onClick={onClickLink}>
        Station
      </Link>
      <Link href="/advanced" className={linkClass('/advanced')} onClick={onClickLink}>
        Advanced
      </Link>
      <Link href="/report" className={linkClass('/report')} onClick={onClickLink}>
        Report
      </Link>
    </>
  );
}
