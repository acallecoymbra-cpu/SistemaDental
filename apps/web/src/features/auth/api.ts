import type {
  AuthUserResponse,
  ChangePasswordRequest,
  LoginRequest,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas de la feature «auth». Cada feature tiene su propio api.ts. */
export const authApi = {
  login: (body: LoginRequest) =>
    apiFetch<AuthUserResponse>('/auth/login', { method: 'POST', body }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  me: () => apiFetch<AuthUserResponse>('/auth/me'),
  changePassword: (body: ChangePasswordRequest) =>
    apiFetch<void>('/auth/change-password', { method: 'POST', body }),
};
