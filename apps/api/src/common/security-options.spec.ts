import { parseOrigins } from './security-options';

describe('parseOrigins', () => {
  it('separa por coma, quita espacios y barras finales', () => {
    expect(parseOrigins(' http://localhost:3000/ , https://renovandosonrisas.example ')).toEqual([
      'http://localhost:3000',
      'https://renovandosonrisas.example',
    ]);
  });

  it('ignora entradas vacías', () => {
    expect(parseOrigins('http://a.example,,')).toEqual(['http://a.example']);
  });
});
