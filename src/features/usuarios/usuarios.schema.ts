import { z } from 'zod'

// Formulario de "Configuración" (cambiar la contraseña, HU-28). Sólo pide los tres campos: las
// reglas (coinciden, largo, distinta de la actual y del DNI, actual correcta) las valida la API, y
// cada error suyo se muestra en su campo.

export const MENSAJE_OBLIGATORIA = 'Es obligatoria'

export const CAMPOS_CONTRASENA = ['actual', 'nueva', 'repeticion'] as const
export type CampoContrasena = (typeof CAMPOS_CONTRASENA)[number]

export const cambiarContrasenaSchema = z.object({
  actual: z.string().min(1, MENSAJE_OBLIGATORIA),
  nueva: z.string().min(1, MENSAJE_OBLIGATORIA),
  repeticion: z.string().min(1, MENSAJE_OBLIGATORIA),
})

export type CambiarContrasenaForm = z.infer<typeof cambiarContrasenaSchema>

export const VALORES_VACIOS: CambiarContrasenaForm = { actual: '', nueva: '', repeticion: '' }
