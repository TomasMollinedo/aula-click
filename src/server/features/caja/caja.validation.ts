import { z } from '@hono/zod-openapi'
import { fechaISO, mesISO } from '@/server/shared/zod'
import { FORMAS_PAGO, MOTIVOS_ANULACION, TIPOS_MOVIMIENTO } from './caja.reglas'

// Schemas Zod del query y de la respuesta de la caja diaria (HU-46, T-127). Son la fuente del
// OpenAPI. Sin reglas de negocio: el orden de los movimientos y el resumen los deciden
// `caja.reglas.ts`; que la fecha no sea futura, el service (el default depende de "hoy"). Importes
// como número JSON en pesos; los textos ("No hubo movimientos de caja el 15/10") los pone la UI.

/** `fecha` es opcional: sin ella, el día de hoy en la zona del negocio. */
const fechaCajaShape = {
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description:
      'Día de la caja (YYYY-MM-DD). Sin `fecha`, el de hoy en la zona del negocio. Una fecha futura responde 400',
    example: '2026-10-15',
  }),
}

/** Query de `GET /caja`: la fecha y los filtros de la lista de movimientos (no del resumen). */
export const cajaQuerySchema = z.object({
  ...fechaCajaShape,
  tipo: z
    .enum(TIPOS_MOVIMIENTO, {
      error: 'El tipo tiene que ser COBRO, ANULACION o PAGO_PROFESOR',
    })
    .optional()
    .openapi({
      param: { name: 'tipo', in: 'query' },
      description: 'Sólo los movimientos de este tipo. No cambia el resumen',
      example: 'COBRO',
    }),
  formaPago: z
    .enum(FORMAS_PAGO, { error: 'La forma de pago tiene que ser EFECTIVO, TRANSFERENCIA o DEBITO' })
    .optional()
    .openapi({
      param: { name: 'formaPago', in: 'query' },
      description:
        'Sólo los movimientos de esta forma de pago, por su código. Un pago a un profesor es una transferencia. No cambia el resumen',
      example: 'EFECTIVO',
    }),
})

export type CajaQuery = z.infer<typeof cajaQuerySchema>

/** Query de `GET /caja/pdf`: sólo la fecha; el PDF lleva siempre la lista completa. */
export const cajaPdfQuerySchema = z.object(fechaCajaShape)

export type CajaPdfQuery = z.infer<typeof cajaPdfQuerySchema>

const persona = z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })

const formaPagoSalida = z
  .object({ codigo: z.enum(FORMAS_PAGO), nombre: z.string() })
  .openapi({ description: 'La forma de pago: su código fijo y su nombre para mostrar' })

const registradoEl = z.iso.datetime().openapi({
  description:
    'Instante en que se registró el movimiento, ISO 8601 en UTC. Si el día en la hora del negocio no es el de la caja (un pago cargado con fecha hacia atrás), la UI lo muestra con su fecha: "registrado el 16/10 09:12"',
  example: '2026-10-15T14:30:00.000Z',
})

const importeDelMovimiento = z.number().openapi({
  description: 'Importe en pesos, siempre positivo: el signo lo da el `tipo`',
  example: 8000,
})

const numeroComprobante = z.number().int().openapi({ example: 1024 })

export const movimientoCobroSchema = z
  .object({
    tipo: z.literal('COBRO').openapi({ description: 'Entra dinero (+)' }),
    registradoEl,
    pagoId: z.number().int().openapi({ description: 'Para abrir el detalle del pago (HU-36)' }),
    numeroComprobante,
    alumno: persona,
    formaPago: formaPagoSalida,
    importe: importeDelMovimiento,
    estado: z.enum(['VIGENTE', 'ANULADO']).openapi({
      description:
        '`ANULADO` si el pago se anuló (ese día o después): el cobro igual figura, porque ese día fue un cobro',
    }),
  })
  .openapi('MovimientoCajaCobro')

export const movimientoAnulacionSchema = z
  .object({
    tipo: z
      .literal('ANULACION')
      .openapi({ description: 'Sale dinero (−): figura el día en que se anuló el pago' }),
    registradoEl,
    pagoId: z.number().int().openapi({ description: 'El pago anulado, para abrir su detalle' }),
    numeroComprobante,
    alumno: persona,
    formaPago: formaPagoSalida,
    importe: importeDelMovimiento,
    motivo: z.enum(MOTIVOS_ANULACION),
    detalle: z.string().nullable().openapi({ description: 'Detalle libre; `null` si no se cargó' }),
  })
  .openapi('MovimientoCajaAnulacion')

export const movimientoPagoProfesorSchema = z
  .object({
    tipo: z
      .literal('PAGO_PROFESOR')
      .openapi({ description: 'Sale dinero (−): figura el día de la fecha de la transferencia' }),
    registradoEl,
    profesor: persona,
    mes: mesISO.openapi({ description: 'Mes liquidado (YYYY-MM)' }),
    numeroOperacion: z.string().nullable().openapi({
      description: 'Número de operación de la transferencia',
      example: '0048213',
    }),
    formaPago: formaPagoSalida.openapi({ description: 'Siempre `TRANSFERENCIA`' }),
    importe: importeDelMovimiento,
    liquidacion: z
      .object({ profesorId: z.number().int(), mes: mesISO })
      .openapi({ description: 'Identifica la liquidación para abrirla (HU-44)' }),
  })
  .openapi('MovimientoCajaPagoProfesor')

const movimientoSchema = z
  .discriminatedUnion('tipo', [
    movimientoCobroSchema,
    movimientoAnulacionSchema,
    movimientoPagoProfesorSchema,
  ])
  .openapi('MovimientoCaja')

const importeResumen = (description: string, example: number) =>
  z.number().openapi({ description, example })

const resumenSchema = z
  .object({
    ingresos: z.object({
      porForma: z
        .object({
          EFECTIVO: importeResumen('Efectivo cobrado menos anulado', 40000),
          TRANSFERENCIA: importeResumen('Transferencias cobradas menos anuladas', 38000),
          DEBITO: importeResumen('Tarjeta de débito cobrada menos anulada', 18000),
        })
        .openapi({
          description:
            'Cobros menos anulaciones del día, por forma de pago (por su código, nunca por el nombre), en pesos. Puede ser negativo: una anulación de un cobro de otro día',
        }),
      total: importeResumen('Suma de `porForma`, en pesos', 96000),
      parteCentro: importeResumen(
        'De `total`, la parte del centro, con el porcentaje guardado en cada cobro',
        14400,
      ),
      parteProfesores: importeResumen(
        'De `total`, la parte de los profesores. `parteCentro + parteProfesores = total`',
        81600,
      ),
    }),
    egresos: importeResumen('Lo pagado a profesores en el día, en pesos', 81600),
    saldo: importeResumen('`ingresos.total − egresos`, en pesos', 14400),
  })
  .openapi('ResumenCaja')

/** Respuesta de `GET /caja`. */
export const cajaSchema = z
  .object({
    fecha: fechaISO.openapi({ description: 'El día de la caja' }),
    movimientos: z.array(movimientoSchema).openapi({
      description:
        'Los movimientos del día por hora de registro, ya filtrados por `tipo` y `formaPago`. Vacía si no hubo ninguno',
    }),
    resumen: resumenSchema.openapi({
      description: 'Del día completo, sin los filtros. Todo en 0 si no hubo movimientos',
    }),
  })
  .openapi('Caja')

export type Caja = z.infer<typeof cajaSchema>
