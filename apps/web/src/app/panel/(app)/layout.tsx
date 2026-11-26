'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from '@/features/auth/session-context';

/**
 * Layout de las páginas protegidas del panel. La carpeta «(app)» es un grupo de
 * rutas de Next: no aparece en la URL (/panel/tratamientos), solo agrupa páginas
 * que comparten este layout. Para agregar una sección nueva: crear su carpeta aquí
 * y sumar el enlace en el menú.
 */
function PanelShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  return (
    <>
      <header className="panel-header">
        <div className="container">
          <strong>Renovando Sonrisas</strong>
          <nav className="panel-nav" aria-label="Menú del panel">
            <Link href="/panel/agenda">Agenda</Link>
            <Link href="/panel/pacientes">Pacientes</Link>
            <Link href="/panel/tratamientos">Tratamientos</Link>
            <Link href="/panel/horarios">Horarios</Link>
            <Link href="/panel/configuracion">Configuración</Link>
            <Link href="/panel/cambiar-clave">Cambiar contraseña</Link>
            <span className="muted">{user.fullName}</span>
            <button className="btn btn-secondary" type="button" onClick={() => void logout()}>
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>
      <main className="container panel-main">{children}</main>
    </>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PanelShell>{children}</PanelShell>
    </SessionProvider>
  );
}
