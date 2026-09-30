import { z } from '@hono/zod-openapi'
import { metaPaginacionSchema, paginacionQuerySchema } from '@/server/shared/paginacion'
import { fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de params, query y respuestas de cuentas (HU-16, T-53). Son la fuente del OpenAPI.
// Sin reglas de negocio: qué se adeuda, qué es próximo y los importes los deciden
// `cuentas.condiciones.ts` y `cuentas.reglas.ts`.

const idPositivoQuery = (description: string, example: number) =>
  z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

/** `alumnoId` del path de `GET /cuentas/alumnos/{alumnoId}`. */
export const alumnoIdParamsSchema = z.object({
  alumnoId: idPositivoQuery('Id del alumno', 12).openapi({
    param: { name: 'alumnoId', in: 'path' },
  }),
})

/** Query de `GET /cuentas/adeudados`: paginación y alumno opcional. */
export const adeudadosQuerySchema = paginacionQuerySchema.extend({
  alumnoId: idPositivoQuery('Sólo los adeudados de este alumno', 12)
    .optional()
    .openapi({ param: { name: 'alumnoId', in: 'query' } }),
})

export type AdeudadosQuery = z.infer<typeof adeudadosQuerySchema>

const referencia = z.object({ id: z.number().int(), nombre: z.string() })
const persona = z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })

/**
 * Una ocurrencia de la cuenta. Tiene los mismos campos que `OcurrenciaACobrar` del frontend
 * (`src/types/pago.ts`) más `estado`: con esto la UI arma el pedido de `POST /pagos` sin
 * transformar nada.
 */
export const ocurrenciaDeCuentaSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    materia: referencia,
    profesor: persona,
    estado: z.enum(['SIN_REGISTRAR', 'AGENDADO']).openapi({
      description: '`SIN_REGISTRAR` en los adeudados y `AGENDADO` en los próximos',
    }),
    importe: z.number().nullable().openapi({
      description:
        'Precio por hora **vigente** de la materia, en pesos (lo calcula la API en cada consulta); `null` si la materia no tiene precio',
      example: 8000,
    }),
  })
  .openapi('OcurrenciaDeCuenta')

export type OcurrenciaDeCuenta = z.infer<typeof ocurrenciaDeCuentaSchema>

/** Un pago del historial del alumno. */
export const pagoDelHistorialSchema = z
  .object({
    pagoId: z.number().int(),
    numeroComprobante: z.number().int(),
    fechaPago: fechaISO,
    cantidad: z.number().int().openapi({ description: 'Ocurrencias pagadas', example: 4 }),
    total: z.number().openapi({ description: 'Importe total en pesos', example: 32000 }),
  })
  .openapi('PagoDelHistorial')

export type PagoDelHistorial = z.infer<typeof pagoDelHistorialSchema>

/** Respuesta de `GET /cuentas/alumnos/{alumnoId}`. */
export const cuentaDelAlumnoSchema = z
  .object({
    totalAdeudado: z.number().openapi({
      description: 'Suma de los importes de `adeudados` (los `null` no suman)',
      example: 16000,
    }),
    pagadoDelMes: z.number().openapi({
      description: 'Suma de los pagos con `fechaPago` entre el día 1 del mes de hoy y hoy',
      example: 32000,
    }),
    adeudados: z.array(ocurrenciaDeCuentaSchema).openapi({
      description: 'Anteriores a hoy, sin registrar e impagas; del más antiguo al más reciente',
    }),
    proximos: z.array(ocurrenciaDeCuentaSchema).openapi({
      description: 'Agendadas e impagas de hoy a hoy + 56 días, ascendentes. No suman a la deuda',
    }),
    pagos: z.array(pagoDelHistorialSchema).openapi({
      description: 'Todos los pagos del alumno, del más reciente al más antiguo',
    }),
  })
  .openapi('CuentaDelAlumno')

export type CuentaDelAlumno = z.infer<typeof cuentaDelAlumnoSchema>

/** Un adeudado de la vista global: la ocurrencia con su alumno. */
export const adeudadoGlobalSchema = ocurrenciaDeCuentaSchema
  .extend({ alumno: persona.extend({ dni: z.string() }) })
  .openapi('AdeudadoGlobal')

export type AdeudadoGlobal = z.infer<typeof adeudadoGlobalSchema>

/**
 * Respuesta de `GET /cuentas/adeudados`: la página, su `meta` y `totalAdeudado` de **todos** los
 * adeudados del filtro, junto a `data` y `meta` (no dentro de `meta`).
 */
export const adeudadosGlobalSchema = z
  .object({
    data: z.array(adeudadoGlobalSchema),
    meta: metaPaginacionSchema,
    totalAdeudado: z.number().openapi({
      description: 'Suma de los importes de todos los adeudados del filtro, no sólo de la página',
      example: 48000.5,
    }),
  })
  .openapi('AdeudadosGlobal')

export type AdeudadosGlobal = z.infer<typeof adeudadosGlobalSchema>
