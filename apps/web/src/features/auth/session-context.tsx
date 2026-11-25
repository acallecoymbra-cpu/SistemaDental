'use client';

import type { AuthUserResponse } from '@sistema-dental/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { authApi } from './api';

interface SessionValue {
  user: AuthUserResponse;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const LOGIN_PATH = '/panel/login';
export const CHANGE_PASSWORD_PATH = '/panel/cambiar-clave';

/**
 * Protege las páginas del panel en el navegador:
 * - sin sesión (401) → lleva al login;
 * - con contraseña temporal → lleva a «Cambiar contraseña».
 * La seguridad real está en la API (guard global); esto solo guía al usuario.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setFailed(true);
    }
  }, [router, pathname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [user, pathname, router]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    router.replace(LOGIN_PATH);
  }, [router]);

  if (failed) {
    return (
      <div className="container auth-box">
        <p className="alert alert-error" role="alert">
          No se pudo verificar la sesión. Recargue la página.
        </p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container auth-box">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  return (
    <SessionContext.Provider value={{ user, refresh, logout }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession debe usarse dentro de <SessionProvider>');
  }
  return value;
}
