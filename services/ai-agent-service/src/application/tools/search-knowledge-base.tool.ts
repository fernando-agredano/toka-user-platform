import { hasPermission } from '../dtos/session-user';
import type { Retriever } from '../services/retriever';
import type { AgentTool } from './agent-tool';

export function createSearchKnowledgeBaseTool(retriever: Retriever): AgentTool {
  return {
    declaration: {
      name: 'search_knowledge_base',
      description:
        'Busca en la documentación oficial de la plataforma (políticas de roles y permisos, contraseñas y seguridad, guía de uso y FAQ de soporte). Úsala si el contexto recuperado no responde la pregunta, con una consulta reformulada y específica.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta en español, específica, sin datos personales.', maxLength: 300 },
          topK: { type: 'integer', minimum: 1, maximum: 6, description: 'Número de fragmentos. Por defecto 4.' },
        },
        required: ['query'],
      },
    },
    isAvailableFor: (user) => hasPermission(user, 'ai:use'),
    async execute(args) {
      const { chunks } = await retriever.retrieve(args.query as string, args.topK as number | undefined);
      return { kind: 'chunks', chunks };
    },
  };
}
