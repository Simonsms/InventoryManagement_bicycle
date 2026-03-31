import { request } from '@umijs/max';

export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    storeId: number | null;
    storeName: string | null;
  };
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
  storeId: number | null;
  storeName: string | null;
  avatar?: string;
}

export async function loginApi(params: LoginParams): Promise<LoginResult> {
  return request('/api/v1/auth/login', {
    method: 'POST',
    data: params,
    skipErrorHandler: true,
  });
}

export async function logoutApi(): Promise<void> {
  return request('/api/v1/auth/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request('/api/v1/auth/me', {
    method: 'GET',
    skipErrorHandler: true,
  });
}
