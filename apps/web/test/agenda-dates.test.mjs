// Pruebas de las fechas de la agenda (T-10): semanas de lunes a domingo, saltos y hora de La Paz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  formatDayTitle,
  formatShortDate,
  formatTime,
  localDate,
  patientWhatsappLink,
  rangeFor,
  shiftDate,
  weekRange,
} from '../src/features/agenda/dates.ts';

test('la semana va de lunes a domingo', () => {
  // 2033-03-09 es miércoles
  assert.deepEqual(weekRange('2033-03-09'), { from: '2033-03-07', to: '2033-03-13' });
  assert.deepEqual(weekRange('2033-03-07'), { from: '2033-03-07', to: '2033-03-13' }); // lunes
  assert.deepEqual(weekRange('2033-03-13'), { from: '2033-03-07', to: '2033-03-13' }); // domingo
});

test('la semana cruza meses y años', () => {
  assert.deepEqual(weekRange('2033-01-01'), { from: '2032-12-27', to: '2033-01-02' });
  assert.deepEqual(weekRange('2032-02-29'), { from: '2032-02-23', to: '2032-02-29' });
});

test('sumar días respeta fines de mes y años bisiestos', () => {
  assert.equal(addDays('2032-02-28', 1), '2032-02-29');
  assert.equal(addDays('2033-02-28', 1), '2033-03-01');
  assert.equal(addDays('2033-12-31', 1), '2034-01-01');
  assert.equal(addDays('2033-03-01', -1), '2033-02-28');
});

test('rangeFor y shiftDate según la vista', () => {
  assert.deepEqual(rangeFor('dia', '2033-03-09'), { from: '2033-03-09', to: '2033-03-09' });
  assert.deepEqual(rangeFor('semana', '2033-03-09'), { from: '2033-03-07', to: '2033-03-13' });
  assert.equal(shiftDate('dia', '2033-03-09', 1), '2033-03-10');
  assert.equal(shiftDate('semana', '2033-03-09', -1), '2033-03-02');
});

test('la hora y el día se muestran en La Paz, no en UTC', () => {
  assert.equal(formatTime('2033-03-07T12:00:00Z'), '08:00');
  assert.equal(formatTime('2033-03-08T03:15:00Z'), '23:15'); // 23:15 del lunes en La Paz
  assert.equal(localDate('2033-03-08T03:15:00Z'), '2033-03-07');
  assert.equal(localDate('2033-03-08T04:00:00Z'), '2033-03-08');
});

test('formatos de pantalla', () => {
  assert.equal(formatShortDate('2033-03-07'), '07/03/2033');
  assert.match(formatDayTitle('2033-03-07'), /lunes,? 7 de marzo de 2033/);
});

test('el WhatsApp del paciente usa su código de país', () => {
  const link = patientWhatsappLink(
    {
      fullName: 'Juan Paz',
      phone: '91123456789',
      phoneCountryCode: '54',
      guardianPhone: null,
      guardianPhoneCountryCode: null,
    },
    'Hola',
  );
  assert.equal(link, 'https://wa.me/5491123456789?text=Hola');
});

test('el WhatsApp de un menor va al celular de su apoderado, con su país', () => {
  const link = patientWhatsappLink(
    {
      fullName: 'Tomás Vaca',
      phone: '70000001',
      phoneCountryCode: '591',
      guardianPhone: '981000000',
      guardianPhoneCountryCode: '595',
    },
    'Hola',
  );
  assert.equal(link, 'https://wa.me/595981000000?text=Hola');
});
