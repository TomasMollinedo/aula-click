import { z } from 'zod'

// Formato nada más: quién puede entrar lo decide la API.

/** Con `@` se ingresa por email; sin `@`, por usuario (el del alumno, HU-28). */
export function esEmail(identificador: string): boolean {
  return identificador.includes('@')
}

export const loginSchema = z.object({
  identificador: z
    .string()
    .trim()
    .min(1, 'Ingresá tu email o usuario')
    // Un email se valida como hasta ahora; el usuario lo valida la API (formato y largo).
    .refine((valor) => !esEmail(valor) || z.email().safeParse(valor).success, {
      message: 'Ingresá un email válido',
    }),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})

export type LoginInput = z.infer<typeof loginSchema>
