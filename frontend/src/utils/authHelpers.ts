import api from './api';

interface LoginResponse {
  message: string;
}

interface User {
  id: string;
  email: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
}

interface MeResponse {
  user: User | null;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('users/login', { email, password });
  return response.data;
}

export async function logoutUser(): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('users/logout');
  return response.data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const response = await api.get<MeResponse>('users/me');
  return response.data.user;
}
