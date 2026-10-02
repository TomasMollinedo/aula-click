import { z } from '@hono/zod-openapi'
import { fechaISO } from '@/server/shared/zod'
import {
  MAX_DIAS_TABLERO,
  MAX_MATERIAS_TABLERO,
  MAX_PROFESORES_TABLERO,
  problemaDelPeriodo,
} from './tablero.reglas'

// Schemas Zod del query y de la respuesta del tablero del gerente (HU-21, T-61). Son la fuente del
// OpenAPI. Sin reglas de negocio: qué cuenta cada indicador lo deciden `tablero.reglas.ts`, el
// motor de ocurrencias y las condiciones de `cuentas` y `pagos`. Estados en código y números sin
// formato (ni pesos ni `%`): los textos los pone la UI.

/**
 * Query de `GET /tablero`: el período es **obligatorio** (la UI siempre traduce "Hoy", "Esta
 * semana", "Este mes" o un rango). `hasta` no puede ser anterior a `desde` ni el período superar
 * `MAX_DIAS_TABLERO` días: 400 con `details` sobre `hasta`. Se valida acá y no en el service porque
 * ningún extremo tiene un default que dependa de hoy.
 */
export const tableroQuerySchema = z
  .object({
    desde: fechaISO.openapi({
      param: { name: 'desde', in: 'query' },
      description: 'Primer día del período, incluido (YYYY-MM-DD)',
      example: '2026-09-28',
    }),
    hasta: fechaISO.openapi({
      param: { name: 'hasta', in: 'query' },
      description: `Último día del período, incluido (YYYY-MM-DD). No puede ser anterior a \`desde\` ni quedar a más de ${MAX_DIAS_TABLERO} días (extremos incluidos)`,
      example: '2026-10-04',
    }),
  })
  .superRefine((datos, ctx) => {
    // Si alguna fecha ya es inválida, la reporta `fechaISO` en su campo.
    if (!fechaISO.safeParse(datos.desde).success || !fechaISO.safeParse(datos.hasta).success) return
    const problema = problemaDelPeriodo(datos.desde, datos.hasta)
    if (problema !== null) ctx.addIssue({ code: 'custom', message: problema, path: ['hasta'] })
  })

export type TableroQuery = z.infer<typeof tableroQuerySchema>

/**
 * Indicador que depende de la asistencia (HU-22, próximo sprint; definición F de las PO): no se
 * calcula ni se reemplaza por otro número. Es exactamente `{ disponible: false }`, sin `valor`.
 */
export const indicadorNoDisponibleSchema = z
  .object({ disponible: z.literal(false) })
  .strict()
  .openapi('IndicadorNoDisponible', {
    description:
      'Indicador que depende de la asistencia (HU-22, próximo sprint): no está disponible y no trae valor. La UI muestra "Disponible cuando se registre la asistencia"',
  })

const PORCENTAJE =
  'número de 0 a 100 redondeado a un decimal; 0 si la base es 0. Los porcentajes no se ajustan para que sumen 100'

const conteoSchema = z
  .object({
    cantidad: z.number().int().min(0),
    porcentaje: z.number().openapi({
      description: `Sobre \`turnos.total\`: ${PORCENTAJE}`,
      example: 33.3,
    }),
  })
  .openapi('TableroConteo')

/** Respuesta de `GET /tablero`: sólo agregados del período, nunca datos de un alumno o un pago. */
export const tableroSchema = z
  .object({
    periodo: z.object({ desde: fechaISO, hasta: fechaISO }).openapi({
      description: 'El período pedido, extremos incluidos',
    }),
    hoy: fechaISO.openapi({
      description:
        'Fecha de hoy en la zona del negocio: la fecha a la que corresponde `pagos.totalAdeudado` y la que separa "sin registrar" de "agendados"',
      example: '2026-10-02',
    }),
    turnos: z.object({
      total: z.number().int().min(0).openapi({
        description: 'Ocurrencias del período, incluidas las canceladas',
      }),
      cancelados: conteoSchema,
      sinRegistrar: conteoSchema.openapi({
        description: 'Pasados y no cancelados (la asistencia todavía no se registra)',
      }),
      agendados: conteoSchema.nullable().openapi({
        description:
          'No cancelados de hoy en adelante. **`null` si el período no incluye fechas futuras** (`hasta` anterior a `hoy`); si las incluye, viene con su cantidad, que puede ser 0',
      }),
      asistio: indicadorNoDisponibleSchema,
      noAsistio: indicadorNoDisponibleSchema,
    }),
    ocupacion: z.object({
      turnos: z.number().int().min(0).openapi({
        description: 'Ocurrencias no canceladas del período',
      }),
      capacidad: z.number().int().min(0).openapi({
        description:
          'Suma de la capacidad efectiva (`min(profesor.capacidad, aula.capacidad)`, leída al consultar) de cada clase: una hora de un bloque en una fecha con al menos un turno no cancelado. Las horas sin turnos no cuentan',
      }),
      porcentaje: z.number().openapi({
        description: `\`turnos\` sobre \`capacidad\`: ${PORCENTAJE}. **No se recorta a 100**`,
        example: 62.5,
      }),
    }),
    alumnos: z.object({
      nuevos: z.number().int().min(0).openapi({
        description:
          'Alumnos dados de alta en el período (en hora de Salta), aunque después se hayan dado de baja',
      }),
      atendidos: indicadorNoDisponibleSchema,
    }),
    materiasConMasDemanda: z
      .array(
        z.object({
          materia: z.object({ id: z.number().int(), nombre: z.string() }),
          cantidad: z.number().int().min(1),
        }),
      )
      .max(MAX_MATERIAS_TABLERO)
      .openapi({
        description: `Hasta ${MAX_MATERIAS_TABLERO} materias por cantidad de turnos no cancelados del período (descendente; en empate, por nombre). Vacío si no hay ninguno`,
      }),
    profesoresConMasTurnos: z
      .array(
        z.object({
          profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
          cantidad: z.number().int().min(1),
        }),
      )
      .max(MAX_PROFESORES_TABLERO)
      .openapi({
        description: `Hasta ${MAX_PROFESORES_TABLERO} profesores por cantidad de turnos no cancelados del período, es decir, por alumnos con turno en sus horas (descendente; en empate, por apellido y nombre). Vacío si no hay ninguno`,
      }),
    pagos: z.object({
      totalCobrado: z.number().openapi({
        description:
          'Suma de los pagos vigentes con fecha de pago dentro del período, en pesos (número JSON)',
        example: 96000,
      }),
      totalAdeudado: z.number().openapi({
        description:
          'Total adeudado **a la fecha (`hoy`), no del período**: el mismo número que `totalAdeudado` de `GET /cuentas/adeudados` sin filtros',
        example: 296000.5,
      }),
    }),
  })
  .openapi('Tablero')

export type Tablero = z.infer<typeof tableroSchema>
