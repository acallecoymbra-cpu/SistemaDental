import { describe, expect, it } from 'vitest';
import {
  isClinicalContentEmpty,
  normalizeClinicalContent,
  sameClinicalContent,
  type ClinicalContent,
} from './clinical-history';

const base: ClinicalContent = {
  anamnesis: 'Sin alergias conocidas.',
  dentalIndexType: 'CPO-D',
  dentalIndexValue: '3',
  diagnosis: 'Caries en 36',
};

describe('contenido clínico', () => {
  it('normaliza espacios y saltos de línea', () => {
    expect(normalizeClinicalContent({ ...base, anamnesis: '  a\r\nb  ' }).anamnesis).toBe('a\nb');
  });
  it('detecta contenido vacío', () => {
    expect(
      isClinicalContentEmpty(
        normalizeClinicalContent({
          anamnesis: ' ',
          dentalIndexType: '',
          dentalIndexValue: '',
          diagnosis: '\n',
        }),
      ),
    ).toBe(true);
    expect(isClinicalContentEmpty(base)).toBe(false);
  });
  it('dos contenidos son iguales si solo difieren en espacios', () => {
    expect(sameClinicalContent(base, { ...base, diagnosis: '  Caries en 36 ' })).toBe(true);
    expect(sameClinicalContent(base, { ...base, dentalIndexValue: '4' })).toBe(false);
  });
});
