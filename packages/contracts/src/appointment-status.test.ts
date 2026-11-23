import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_STATUSES,
  TERMINAL_APPOINTMENT_STATUSES,
  canTransition,
  isAppointmentStatus,
} from './appointment-status';

describe('estados de consulta', () => {
  it('tiene exactamente los cinco estados aprobados, sin pago_en_revision', () => {
    expect(APPOINTMENT_STATUSES).toEqual([
      'por_pagar',
      'confirmada',
      'completada',
      'cancelada',
      'no_asistio',
    ]);
    expect(isAppointmentStatus('pago_en_revision')).toBe(false);
  });

  it('los estados terminales no tienen transiciones', () => {
    for (const status of TERMINAL_APPOINTMENT_STATUSES) {
      for (const target of APPOINTMENT_STATUSES) {
        expect(canTransition(status, target)).toBe(false);
      }
    }
  });

  it('no_asistio solo se alcanza desde confirmada', () => {
    expect(canTransition('confirmada', 'no_asistio')).toBe(true);
    expect(canTransition('por_pagar', 'no_asistio')).toBe(false);
  });

  it('por_pagar no puede completarse sin confirmar', () => {
    expect(canTransition('por_pagar', 'completada')).toBe(false);
  });
});
