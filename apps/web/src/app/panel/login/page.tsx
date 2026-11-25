'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { authApi } from '@/features/auth/api';

function safeNext(value: string | null): string {
  // Solo rutas internas del panel: evita redirecciones a otros sitios.
  return value && value.startsWith('/panel') && !value.startsWith('//') ? value : '/panel';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    try {
      const user = await authApi.login({
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      router.replace(
        user.mustChangePassword ? '/panel/cambiar-clave' : safeNext(params.get('next')),
      );
    } catch (err) {
      setError(err);
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <ErrorAlert error={error} />
      <div className="field">
        <label htmlFor="username">Usuario</label>
        <input id="username" name="username" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn" type="submit" disabled={sending}>
        {sending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="container auth-box">
      <h1>Panel del dentista</h1>
      <p className="muted">Renovando Sonrisas</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
