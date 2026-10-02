import { z } from '@hono/zod-openapi'
import { usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { fechaISO, horaHHmm, importe, textoOpcional } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params de pagos (HU-15, T-51). Son la fuente del OpenAPI. Sin
// reglas de negocio: qué ocurrencias se pueden cobrar, el total, el tope de `montoRecibido` y el
// vuelto los decide el service con `pagos.reglas.ts`. `montoRecibido` es obligatorio porque todo
// pago es en efectivo (única forma de pago): el día que haya otra, pasa a depender de la forma.

/** Máximo de ocurrencias en un pago (decisión T-64). */
export const MAX_OCURRENCIAS_POR_PAGO = 200
const OBSERVACIONES_MAX = 500
const idPositivo = (description: string, example: number) =>
  z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

/**
 * Importe recibido en pesos: número JSON mayor a 0, con hasta dos decimales, que entre en
 * `Decimal(10,2)` (`importe` de `shared/zod`).
 */
const montoRecibidoEntrada = importe('El monto recibido').openapi({
  description:
    'Monto que entregó el alumno, en pesos: obligatorio (el pago es en efectivo), mayor a 0, con hasta dos decimales y >= al total (lo valida la API con el precio vigente)',
  example: 35000,
})

/** Una ocurrencia a cobrar: `(turnoId, fecha)` (definición B). */
export const ocurrenciaPedidaSchema = z
  .object({
    turnoId: idPositivo('Id del turno (o tramo)', 41),
    fecha: fechaISO.openapi({ description: 'Fecha de la ocurrencia', example: '2026-10-05' }),
  })
  .openapi('OcurrenciaACobrar')

export type OcurrenciaPedida = z.infer<typeof ocurrenciaPedidaSchema>

/** Body de `POST /pagos`. La forma de pago no viaja: es "Efectivo" (única en este sprint). */
export const registrarPagoSchema = z
  .object({
    alumnoId: idPositivo('Id del alumno que paga', 12),
    ocurrencias: z
      .array(ocurrenciaPedidaSchema, { error: 'Debe ser una lista de ocurrencias' })
      .min(1, { error: 'Elegí al menos un turno' })
      .max(MAX_OCURRENCIAS_POR_PAGO, {
        error: `No se pueden cobrar más de ${MAX_OCURRENCIAS_POR_PAGO} turnos en un pago`,
      })
      .superRefine((ocurrencias, ctx) => {
        const vistas = new Set<string>()
        ocurrencias.forEach(({ turnoId, fecha }, i) => {
          const clave = `${turnoId}|${fecha}`
          if (vistas.has(clave)) {
            ctx.addIssue({
              code: 'custom',
              path: [i],
              message: 'La ocurrencia está repetida en el pedido',
            })
          }
          vistas.add(clave)
        })
      })
      .openapi({
        description: `Ocurrencias a cobrar, de 1 a ${MAX_OCURRENCIAS_POR_PAGO}, sin repetir \`(turnoId, fecha)\`. Todas del alumno`,
      }),
    fechaPago: fechaISO.openapi({
      description: 'Fecha del pago (AAAA-MM-DD): hoy o anterior',
      example: '2026-10-05',
    }),
    montoRecibido: montoRecibidoEntrada,
    observaciones: textoOpcional(
      OBSERVACIONES_MAX,
      'Observaciones del pago, hasta 500 caracteres',
      'Paga el mes de octubre',
    ),
  })
  .openapi('RegistrarPago')

export type RegistrarPago = z.infer<typeof registrarPagoSchema>

/** Respuesta 201 de `POST /pagos`. Los importes los calcula la API; el cliente sólo los muestra. */
export const pagoRegistradoSchema = z
  .object({
    pagoId: z.number().int().openapi({ example: 31 }),
    numeroComprobante: z.number().int().openapi({ example: 1024 }),
    cantidad: z.number().int().openapi({ description: 'Ocurrencias pagadas', example: 4 }),
    total: z.number().openapi({ description: 'Importe total en pesos', example: 32000 }),
    montoRecibido: z.number().openapi({ description: 'Monto recibido en pesos', example: 35000 }),
    vuelto: z.number().openapi({
      description: '`montoRecibido - total`. No se guarda',
      example: 3000,
    }),
  })
  .openapi('PagoRegistrado')

export type PagoRegistrado = z.infer<typeof pagoRegistradoSchema>

/** `id` del path de `GET /pagos/{id}`. */
export const pagoIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id del pago', example: 31 }),
})

const referencia = z.object({ id: z.number().int(), nombre: z.string() })
const persona = z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })

/** Una ocurrencia pagada, con los datos **actuales** de su turno y el importe cobrado. */
export const turnoComprobanteSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    materia: referencia,
    profesor: persona,
    importe: z.number().openapi({
      description: 'Importe aplicado al pagar (no cambia si después cambia el precio)',
      example: 8000,
    }),
  })
  .openapi('TurnoComprobante')

/** Respuesta de `GET /pagos/{id}`: los datos del comprobante. */
export const comprobanteSchema = z
  .object({
    id: z.number().int(),
    numeroComprobante: z.number().int(),
    fechaPago: fechaISO,
    alumno: persona.extend({ dni: z.string() }),
    turnos: z.array(turnoComprobanteSchema).openapi({
      description: 'Ordenados por fecha, hora de inicio y turno',
    }),
    total: z.number(),
    montoRecibido: z.number().nullable().openapi({
      description: '`null` sólo en un pago anterior a que el monto recibido fuera obligatorio',
    }),
    vuelto: z.number().nullable().openapi({
      description:
        'Recalculado (`montoRecibido - total`), nunca leído de la base; `null` sin monto recibido',
    }),
    formaPago: referencia,
    observaciones: z.string().nullable(),
    registradoPor: usuarioAuditoriaSchema,
    registradoEl: z.iso.datetime().openapi({
      description: 'Instante del registro, ISO 8601 en UTC',
      example: '2026-10-05T14:30:00.000Z',
    }),
  })
  .openapi('Comprobante')

export type Comprobante = z.infer<typeof comprobanteSchema>
/** Lo que devuelve el repository: el comprobante sin el vuelto (lo calcula el service). */
export type ComprobanteGuardado = Omit<Comprobante, 'vuelto'>

/** Lo que el service le pasa al repository para registrar un pago (ya validado). */
export type EntradaPago = {
  alumnoId: number
  ocurrencias: OcurrenciaPedida[]
  fechaPago: string
  montoRecibido: number
  observaciones: string | null
}
