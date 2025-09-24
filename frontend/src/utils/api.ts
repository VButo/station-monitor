// Axios instance for frontend API calls to backend
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true, // Send cookies with requests
});

// Response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if we're not already on the login page
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.warn('API: Authentication failed, redirecting to login');
        window.location.href = '/login';
      } else if (typeof window !== 'undefined') {
        console.warn('API: Authentication failed on login page, ignoring redirect');
      }
    }
    // Ensure the rejection reason is always an Error
    let rejectionReason: Error;
    if (error instanceof Error) {
      rejectionReason = error;
    } else if (typeof error === 'string') {
      rejectionReason = new Error(error);
    } else {
      rejectionReason = new Error(JSON.stringify(error));
    }
    return Promise.reject(rejectionReason);
  }
);

export default api;

// Test Variable API functions
export const getTestVariable = async (): Promise<string> => {
  const response = await api.get<{ testVariable: string }>('/test-variable');
  return response.data.testVariable;
};

export const updateTestVariable = async (value: string): Promise<string> => {
  const response = await api.put<{ testVariable: string }>('/test-variable', { testVariable: value });
  return response.data.testVariable;
};
