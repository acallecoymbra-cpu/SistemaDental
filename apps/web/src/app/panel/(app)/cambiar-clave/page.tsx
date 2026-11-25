'use client';

import { PASSWORD_MIN_LENGTH } from '@sistema-dental/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';
import { ApiError } from '@/lib/api-client';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== String(form.get('confirm') ?? '')) {
      setError(new ApiError(400, ['La confirmación no coincide con la nueva contraseña.']));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await authApi.changePassword({
        currentPassword: String(form.get('currentPassword') ?? ''),
        newPassword,
      });
      formElement.reset();
      setDone(true);
      await refresh();
      router.replace('/panel');
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="auth-box">
      <h1>Cambiar contraseña</h1>
      {user.mustChangePassword ? (
        <p className="alert alert-error">
          Está usando una contraseña temporal. Debe cambiarla para continuar.
        </p>
      ) : null}
      <form className="form" onSubmit={onSubmit} noValidate>
        <ErrorAlert error={error} />
        {done ? <p className="alert alert-success">Contraseña actualizada.</p> : null}
        <div className="field">
          <label htmlFor="currentPassword">Contraseña actual</label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">Nueva contraseña</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <span className="hint">Mínimo {PASSWORD_MIN_LENGTH} caracteres.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">Repetir nueva contraseña</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
        <button className="btn" type="submit" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </section>
  );
}
