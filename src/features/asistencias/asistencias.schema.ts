import { z } from 'zod'

import { MAX_OBSERVACION, MAX_TEXTO_PRESENTE } from './formato-asistencias'

// Formulario de una fila (un alumno en una hora) de la pantalla "Asistencia". Replica solo el
// formato del contrato (largos y que se elija un estado): lo que se puede registrar lo decide la API.

const texto = (max: number) =>
  z.string().max(max, { error: `No puede superar los ${max} caracteres` })

export const filaAsistenciaSchema = z
  .object({
    estado: z.enum(['PRESENTE', 'AUSENTE']).nullable(),
    trabajado: texto(MAX_TEXTO_PRESENTE),
    indicaciones: texto(MAX_TEXTO_PRESENTE),
    observacion: texto(MAX_OBSERVACION),
    /** "Aplicar también a…": los `turnoId` de las otras horas (sin registrar) tildadas. */
    otrasHoras: z.array(z.number()),
  })
  .refine((valores) => valores.estado !== null, {
    path: ['estado'],
    error: 'Elegí Presente o Ausente',
  })

export type FilaAsistenciaForm = z.infer<typeof filaAsistenciaSchema>
