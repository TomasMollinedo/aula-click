import { z } from '@hono/zod-openapi'
import { metaPaginacionSchema, paginacionQuerySchema } from '@/server/shared/paginacion'
import { fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de params, query y respuestas de cuentas (HU-16, T-53). Son la fuente del OpenAPI.
// Sin reglas de negocio: qué se adeuda, qué es próximo, qué parte del período le toca a cada
// sección y los importes los deciden `cuentas.condiciones.ts` y `cuentas.reglas.ts`.

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

export const MENSAJE_RANGO_INVERTIDO = '`hasta` no puede ser anterior a `desde`'

/**
 * Filtros comunes de los tres endpoints: período (cada extremo opcional, sin tope de días),
 * materia y profesor. Una materia o un profesor que no existen dan una respuesta vacía, sin 404.
 */
const filtroCuenta = {
  desde: fechaISO.optional().openapi({
    param: { name: 'desde', in: 'query' },
    description:
      'Primer día del período, incluido (YYYY-MM-DD). Cada sección muestra la parte del período que le toca',
    example: '2026-09-01',
  }),
  hasta: fechaISO.optional().openapi({
    param: { name: 'hasta', in: 'query' },
    description: 'Último día del período, incluido (YYYY-MM-DD). No puede ser anterior a `desde`',
    example: '2026-09-30',
  }),
  materiaId: idPositivoQuery('Sólo las ocurrencias de esta materia', 2)
    .optional()
    .openapi({ param: { name: 'materiaId', in: 'query' } }),
  profesorId: idPositivoQuery('Sólo las ocurrencias de este profesor (el del bloque)', 3)
    .optional()
    .openapi({ param: { name: 'profesorId', in: 'query' } }),
}

/**
 * `hasta` no puede ser anterior a `desde` (si vienen los dos). Se aplica con `.superRefine(...)`
 * al schema **final** de cada query, después de los `.extend(...)`.
 */
function periodoEnOrden(datos: { desde?: string; hasta?: string }, ctx: z.RefinementCtx) {
  if (datos.desde !== undefined && datos.hasta !== undefined && datos.hasta < datos.desde) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_RANGO_INVERTIDO, path: ['hasta'] })
  }
}

/** Query de `GET /cuentas/alumnos/{alumnoId}`: los filtros comunes. */
export const filtroCuentaQuerySchema = z.object(filtroCuenta).superRefine(periodoEnOrden)

export type FiltroCuentaQuery = z.infer<typeof filtroCuentaQuerySchema>

/**
 * Query de `GET /cuentas/adeudados` y `GET /cuentas/proximos`: paginación, alumno opcional y los
 * filtros comunes.
 */
export const listadoCuentaQuerySchema = paginacionQuerySchema
  .extend({
    alumnoId: idPositivoQuery('Sólo las ocurrencias de este alumno', 12)
      .optional()
      .openapi({ param: { name: 'alumnoId', in: 'query' } }),
    ...filtroCuenta,
  })
  .superRefine(periodoEnOrden)

export type ListadoCuentaQuery = z.infer<typeof listadoCuentaQuerySchema>

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

const limiteCobro = fechaISO.openapi({
  description:
    'Última fecha que se puede cobrar por adelantado (hoy + 56 días, el tope de `POST /pagos`). Los próximos nunca pasan de acá, aunque el período pedido siga',
  example: '2026-11-26',
})

/** Respuesta de `GET /cuentas/alumnos/{alumnoId}`. */
export const cuentaDelAlumnoSchema = z
  .object({
    totalAdeudado: z.number().openapi({
      description:
        'Suma de los importes de `adeudados` con todos los filtros (los `null` no suman). Los próximos nunca suman: 0 si `adeudados` es `null`',
      example: 16000,
    }),
    adeudados: z.array(ocurrenciaDeCuentaSchema).nullable().openapi({
      description:
        'Anteriores a hoy, sin registrar e impagas, de la parte del período anterior a hoy; del más antiguo al más reciente. **`null` si la sección no aplica** (el período es sólo futuro: `desde` es hoy o posterior); `[]` si aplica y no hay ninguna',
    }),
    proximos: z.array(ocurrenciaDeCuentaSchema).nullable().openapi({
      description:
        'Agendadas e impagas de la parte del período entre hoy y `limiteCobro`, ascendentes. No suman a la deuda. **`null` si la sección no aplica** (el período es sólo pasado: `hasta` es anterior a hoy); `[]` si aplica y no hay ninguna, por ejemplo si el período empieza después de `limiteCobro`',
    }),
    limiteCobro,
  })
  .openapi('CuentaDelAlumno')

export type CuentaDelAlumno = z.infer<typeof cuentaDelAlumnoSchema>

/** Una fila de las vistas globales (adeudados y próximos): la ocurrencia con su alumno. */
export const ocurrenciaDeCuentaGlobalSchema = ocurrenciaDeCuentaSchema
  .extend({ alumno: persona.extend({ dni: z.string() }) })
  .openapi('OcurrenciaDeCuentaGlobal')

export type OcurrenciaDeCuentaGlobal = z.infer<typeof ocurrenciaDeCuentaGlobalSchema>

const aplica = (seccion: string, cuandoNo: string) =>
  z.boolean().openapi({
    description: `\`false\` si la sección no aplica al período (${cuandoNo}): ${seccion}. \`true\` con \`data: []\` significa que aplica y no hay ninguna`,
  })

/**
 * Respuesta de `GET /cuentas/adeudados`: la página, su `meta` y `totalAdeudado` de **todos** los
 * adeudados del filtro, junto a `data` y `meta` (no dentro de `meta`).
 */
export const adeudadosGlobalSchema = z
  .object({
    data: z.array(ocurrenciaDeCuentaGlobalSchema),
    meta: metaPaginacionSchema,
    totalAdeudado: z.number().openapi({
      description:
        'Suma de los importes de todos los adeudados del filtro (alumno, período, materia y profesor), no sólo de la página',
      example: 48000.5,
    }),
    aplica: aplica(
      '`data` va vacío, `meta.total` en 0 y `totalAdeudado` en 0',
      'es sólo futuro: `desde` es hoy o posterior',
    ),
  })
  .openapi('AdeudadosGlobal')

export type AdeudadosGlobal = z.infer<typeof adeudadosGlobalSchema>

/** Respuesta de `GET /cuentas/proximos`: la página y su `meta`. Los próximos no tienen total. */
export const proximosGlobalSchema = z
  .object({
    data: z.array(ocurrenciaDeCuentaGlobalSchema),
    meta: metaPaginacionSchema,
    aplica: aplica(
      '`data` va vacío y `meta.total` en 0',
      'es sólo pasado: `hasta` es anterior a hoy',
    ),
    limiteCobro,
  })
  .openapi('ProximosGlobal')

export type ProximosGlobal = z.infer<typeof proximosGlobalSchema>
