import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizePhoneInput } from '../src/lib/phone-input.ts';

test('quita letras y símbolos', () => {
  assert.equal(sanitizePhoneInput('7a0b0c0-0000'), '7000-0000');
  assert.equal(sanitizePhoneInput('(70) 000.000'), '70 000000');
});
test('conserva un solo + al inicio', () => {
  assert.equal(sanitizePhoneInput('+591 7000-0000'), '+591 7000-0000');
  assert.equal(sanitizePhoneInput('70+00'), '7000');
  assert.equal(sanitizePhoneInput('++591'), '+591');
});
test('texto vacío o sin números queda vacío', () => {
  assert.equal(sanitizePhoneInput('abc'), '');
  assert.equal(sanitizePhoneInput(''), '');
});
