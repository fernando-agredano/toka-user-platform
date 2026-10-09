import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Escribe una pregunta').max(2000, 'Máximo 2000 caracteres'),
});

export type ChatValues = z.infer<typeof chatSchema>;
