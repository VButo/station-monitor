"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchCurrentUser, loginUser } from '@/utils/authHelpers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in - but only if we have a cookie
    const checkUser = async () => {
      // Check if there's a cookie first to avoid unnecessary API calls
      const hasCookie = document.cookie.includes('supabase-token=');
      if (!hasCookie) {
        console.log('No auth cookie found, skipping user check');
        return;
      }
      
      try {
        const user = await fetchCurrentUser();
        console.log('checkUser fetched:', user);
        if (user) {
          console.log('User found, redirecting to /network');
          router.push('/network');
        }
      } catch (error) {
        // User not logged in or session expired, stay on login page
        console.log('User check failed (expected on login page):', error);
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('attempting login');
      const response = await loginUser(email, password);
      console.log('login done',  response);
      router.push('/network');
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message);
        console.log('Login error:', error);
      } else if (typeof error === 'object' && error !== null && 'response' in error) {
        // Axios error typing
        const axiosError = error as { response?: { data?: { error?: string } } };
        alert(axiosError.response?.data?.error || 'Login failed');
        console.log('Axios error:', axiosError);
      } else {
        alert('Login failed');
        console.log('Unknown login error:', error);
      }
    } finally {
      console.log('finally');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between">
      {/* Main content: Centered card */}
      <div className="flex-grow flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg px-10 py-8 w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <Image 
              priority={false}
              src="/metmonic_logo.svg"
              alt="Metmonic monitoring logo"
              width={300}
              height={50}
              className="mb-4"
            />
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 p-2 w-full rounded-md text-gray-600 border-gray-300 shadow-sm focus:border-blue-600 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 p-2 w-full rounded-md text-gray-600 border-gray-300 shadow-sm focus:border-blue-600 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                      <Image src="/eye-open.png" alt="Hide password" width={20} height={20} />
                    ) : (
                      <Image src="/eye-closed.png" alt="Show password" width={20} height={20} />
                    )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
