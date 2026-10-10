import { z } from 'zod';

const requiredName = (label: string) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(100, `${label} no puede superar 100 caracteres`);

// Mirrors the backend password policy.
const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/[a-z]/, 'Debe incluir una minúscula')
  .regex(/\d/, 'Debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'El correo es obligatorio').email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const newAccountSchema = z.object({
  email: z.string().trim().min(1, 'El correo es obligatorio').email('Correo inválido').max(254),
  password: passwordSchema,
  firstName: requiredName('El nombre'),
  lastName: requiredName('El apellido'),
});

export const editUserSchema = newAccountSchema.pick({ firstName: true, lastName: true });

export type LoginValues = z.infer<typeof loginSchema>;
export type NewAccountValues = z.infer<typeof newAccountSchema>;
export type EditUserValues = z.infer<typeof editUserSchema>;
