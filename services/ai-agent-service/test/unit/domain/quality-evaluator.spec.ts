import { type QualityInput, evaluateQuality } from '../../../src/domain/services/quality-evaluator';

const evidence = [
  {
    label: 'S1',
    text: 'Política de contraseñas Bloqueo por intentos fallidos Tras 5 intentos fallidos de inicio de sesión en 15 minutos, la cuenta se bloquea temporalmente.',
  },
  { label: 'D1', text: 'Usuarios encontrados: 1 en total. Laura Gómez (laura@toka.local) estado INACTIVE' },
];

const base = (answer: string, overrides: Partial<QualityInput> = {}): QualityInput => ({
  answer,
  evidence,
  allowedEntities: ['ana@toka.local'],
  detailRequested: false,
  degraded: false,
  ...overrides,
});

describe('evaluateQuality', () => {
  it('scores a grounded, cited answer at the maximum', () => {
    const report = evaluateQuality(base('La cuenta se bloquea tras 5 intentos fallidos de inicio de sesión en 15 minutos [S1].'));
    expect(report.score).toBe(1);
    expect(report.checks).toEqual({ grounded: 1, citationsValid: true, noPii: true, format: true, length: true, degraded: false });
  });

  it('penalises a claim whose number is not in the cited source', () => {
    const report = evaluateQuality(base('La cuenta se bloquea tras 10 intentos fallidos de inicio de sesión en 15 minutos [S1].'));
    expect(report.checks.grounded).toBe(0);
    expect(report.score).toBeLessThan(0.6);
  });

  it('penalises a claim with no citation when evidence was available', () => {
    const report = evaluateQuality(base('La cuenta se bloquea tras 5 intentos fallidos de inicio de sesión en 15 minutos.'));
    expect(report.checks.grounded).toBe(0);
    expect(report.checks.citationsValid).toBe(false);
  });

  it('penalises an answer unrelated to the cited source', () => {
    const report = evaluateQuality(base('Los administradores pueden crear roles personalizados desde la sección correspondiente [S1].'));
    expect(report.checks.grounded).toBe(0);
  });

  it('does not penalise refusals or redirections to support', () => {
    const report = evaluateQuality(
      base('No puedo darte esa información porque requiere un permiso. Pide a tu responsable que solicite el rol a un administrador.'),
    );
    expect(report.checks.grounded).toBe(1);
    expect(report.checks.citationsValid).toBe(true);
  });

  it('checks bulleted and tabular content sentence by sentence', () => {
    const report = evaluateQuality(
      base('- Laura Gómez (laura@toka.local) con estado INACTIVE [D1]\n- Tras 5 intentos fallidos la cuenta se bloquea temporalmente [S1]'),
    );
    expect(report.checks.grounded).toBe(1);
  });

  it('strips citations to labels that were never offered', () => {
    const report = evaluateQuality(base('La cuenta se bloquea tras 5 intentos fallidos de inicio de sesión [S1] [S7].'));
    expect(report.checks.citationsValid).toBe(false);
    expect(report.answer).not.toContain('[S7]');
    expect(report.answer).toContain('[S1]');
  });

  it('redacts invented emails and caps the score', () => {
    const report = evaluateQuality(base('Escribe a root@evil.example para desbloquear tu cuenta de forma inmediata hoy mismo [S1].'));
    expect(report.checks.noPii).toBe(false);
    expect(report.answer).toContain('[REDACTADO]');
    expect(report.answer).not.toContain('root@evil.example');
    expect(report.score).toBeLessThanOrEqual(0.3);
  });

  it('allows emails that come from the evidence and the caller’s own identity', () => {
    const report = evaluateQuality(base('Laura Gómez (laura@toka.local) está INACTIVE [D1] y tú eres ana@toka.local.'));
    expect(report.checks.noPii).toBe(true);
  });

  it.each([
    ['a JWT', 'Tu token es eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop ahora mismo [S1].'],
    ['an API key', 'Usa la llave AIzaSyA1234567890abcdefghijklmnopqrstuv para entrar [S1].'],
    ['a card number', 'El número 4539 1488 0343 6467 aparece en el registro de la cuenta [S1].'],
    ['a password assignment', 'Configura password: Sup3rSecret! para el acceso de la cuenta [S1].'],
  ])('flags %s as a secret', (_name, answer) => {
    expect(evaluateQuality(base(answer)).checks.noPii).toBe(false);
  });

  it('does not mistake an ordinary long number for a card', () => {
    expect(evaluateQuality(base('El identificador 1234567890123 no es una tarjeta de pago real [S1].')).checks.noPii).toBe(true);
  });

  it.each([
    ['code fences', 'Usa este código:\n```\nSELECT 1\n```'],
    ['html', 'Pulsa <b>Entrar</b> para continuar con el inicio de sesión de la cuenta.'],
    ['a json blob', '{"error": "FORBIDDEN"}'],
    ['internal markers', 'Según <contexto_recuperado> la cuenta se bloquea tras varios intentos.'],
    ['an oversized list', Array.from({ length: 13 }, (_, index) => `- elemento ${index}`).join('\n')],
  ])('rejects the format when the answer contains %s', (_name, answer) => {
    expect(evaluateQuality(base(answer, { evidence: [] })).checks.format).toBe(false);
  });

  it('allows a table with ten data rows', () => {
    const rows = Array.from({ length: 10 }, (_, index) => `| fila ${index} | dato ${index} |`);
    const table = ['| Nombre | Valor |', '|---|---|', ...rows].join('\n');
    expect(evaluateQuality(base(table, { evidence: [] })).checks.format).toBe(true);
  });

  it('enforces the length limit unless more detail was requested', () => {
    const long = `${Array.from({ length: 250 }, () => 'palabra').join(' ')} [S1]`;
    expect(evaluateQuality(base(long)).checks.length).toBe(false);
    expect(evaluateQuality(base(long, { detailRequested: true })).checks.length).toBe(true);
    expect(evaluateQuality(base('')).checks.length).toBe(false);
  });

  it('treats a degraded answer as grounded by construction', () => {
    const report = evaluateQuality(base('Estos fragmentos parecen relevantes:\n- **Política** [S1]: texto literal de la fuente', { degraded: true }));
    expect(report.checks).toMatchObject({ grounded: 1, degraded: true });
  });
});
