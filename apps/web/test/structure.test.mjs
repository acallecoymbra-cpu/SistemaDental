// Pruebas de estructura de la web (node:test, según el brief).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('existe el layout raíz del App Router', () => {
  assert.ok(existsSync(new URL('../src/app/layout.tsx', import.meta.url)));
});

test('el documento declara idioma español', () => {
  assert.match(read('src/app/layout.tsx'), /<html lang="es">/);
});

test('existe la página de inicio', () => {
  assert.ok(existsSync(new URL('../src/app/page.tsx', import.meta.url)));
});
