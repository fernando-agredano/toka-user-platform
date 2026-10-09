import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OUTPUT_PDF = join(ROOT, 'docs', 'Documentacion-Tecnica.pdf');

export const readSource = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');

export const META = {
  title: 'Plataforma de Gestión de Usuarios',
  subtitle: 'Prueba Técnica – Senior Full-Stack Engineer (IA)',
  author: 'Fernando Yael Agredano Parada',
  date: '9 de octubre de 2026',
  stack: ['NestJS', 'React', 'PostgreSQL', 'MongoDB', 'Redis', 'RabbitMQ', 'Qdrant', 'Gemini', 'Docker'],
};

// `charts` go right before the H2 whose text starts with `before`, or at the end of the section without it.
export const SECTIONS = [
  {
    key: 'arquitectura',
    title: 'Arquitectura',
    description: 'Visión general, diagrama, decisiones técnicas, DDD, seguridad y escalabilidad (Ejercicio 1).',
    file: 'docs/01-arquitectura.md',
  },
  {
    key: 'ddd',
    title: 'DDD y Clean Architecture',
    description: 'Cómo se aplican las capas y las invariantes de dominio, con ejemplos reales del código.',
    file: 'docs/02-ddd-clean-architecture.md',
  },
  {
    key: 'frontend',
    title: 'Frontend',
    description: 'SPA en React: pantallas, state management con RTK Query, integración con el gateway, UX y tests (Ejercicio 3).',
    file: 'docs/03-frontend.md',
  },
  {
    key: 'diagnostico',
    title: 'Diagnóstico de incidentes',
    description: 'Hipótesis priorizadas, plan de 30 minutos, consultas de logs y comunicación (Ejercicio 4).',
    file: 'docs/04-diagnostico.md',
  },
  {
    key: 'prompt-engineering',
    title: 'Prompt engineering y agente IA',
    description: 'System prompt, RAG, herramientas, límites de uso, métricas y evaluación (Ejercicio 5).',
    file: 'docs/05-prompt-engineering.md',
  },
  {
    key: 'integracion',
    title: 'Integración del agente IA',
    description: 'Cómo el agente consume los microservicios con los permisos del usuario y qué ocurre si algo cae.',
    file: 'docs/05-integracion.md',
  },
  {
    key: 'ejemplos',
    title: 'Ejemplos del agente IA',
    description: 'Respuestas reales del servicio a través del gateway, con las métricas que las respaldan.',
    file: 'docs/05-ejemplos.md',
    charts: [{ name: 'latency' }],
  },
  {
    key: 'mcp',
    title: 'Extra: servidor MCP',
    description: 'Módulo adicional, fuera de los requisitos: expone la plataforma a asistentes de IA con los permisos del usuario.',
    file: 'docs/06-mcp-server.md',
    extra: true,
  },
  {
    key: 'coverage',
    title: 'Cobertura de tests',
    description: 'Cobertura por paquete, distribución de tests y alcance realmente medido.',
    file: 'docs/coverage.md',
    charts: [
      { name: 'coverage', before: 'Alcance real de los servicios' },
      { name: 'tests', before: 'Alcance real de los servicios' },
    ],
  },
  {
    key: 'decisiones',
    title: 'Decisiones técnicas',
    description: 'ADRs cortos por fase, incluidos los desvíos respecto al contrato original.',
    file: 'docs/decisiones.md',
    keepNumbers: true,
  },
];

export const ANNEX = {
  key: 'anexo',
  label: 'A',
  title: 'Cómo ejecutar el sistema',
  description: 'Requisitos, configuración, arranque con Docker Compose y credenciales de prueba.',
  readmeHeadings: ['Requisitos', 'Configuración', 'Levantar el sistema', 'Credenciales y URLs'],
};

export function extractReadmeSections(headings) {
  const captured = [];
  let capturing = false;
  let insideFence = false;
  for (const line of readSource('README.md').split('\n')) {
    if (line.startsWith('```')) insideFence = !insideFence;
    const heading = insideFence ? null : line.match(/^## (.+)$/);
    if (heading) capturing = headings.includes(heading[1].trim());
    if (capturing) captured.push(line);
  }
  return captured.join('\n');
}
