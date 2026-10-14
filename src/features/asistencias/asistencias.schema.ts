import { z } from 'zod'

import { MAX_OBSERVACION, MAX_TEXTO_PRESENTE } from './formato-asistencias'

// Formulario de una fila de la pantalla "Asistencia". Replica solo el formato del contrato
// (largos y que se elija un estado): lo que se puede registrar lo decide la API.

const MENSAJE_ESTADO = 'Elegí Presente o Ausente'

const texto = (max: number) =>
  z.string().max(max, { error: `No puede superar los ${max} caracteres` })

const estado = z.enum(['PRESENTE', 'AUSENTE']).nullable()

export const filaAsistenciaSchema = z
  .object({
    estado,
    trabajado: texto(MAX_TEXTO_PRESENTE),
    indicaciones: texto(MAX_TEXTO_PRESENTE),
    observacion: texto(MAX_OBSERVACION),
    /** "Ajustar por hora": un estado por hora en lugar de uno para toda la fila. */
    ajustarPorHora: z.boolean(),
    porHora: z.array(z.object({ estado, observacion: texto(MAX_OBSERVACION) })),
  })
  .superRefine((valores, ctx) => {
    if (!valores.ajustarPorHora) {
      if (valores.estado === null) {
        ctx.addIssue({ code: 'custom', path: ['estado'], message: MENSAJE_ESTADO })
      }
      return
    }
    valores.porHora.forEach((hora, i) => {
      if (hora.estado === null) {
        ctx.addIssue({ code: 'custom', path: ['porHora', i, 'estado'], message: MENSAJE_ESTADO })
      }
    })
  })

export type FilaAsistenciaForm = z.infer<typeof filaAsistenciaSchema>
