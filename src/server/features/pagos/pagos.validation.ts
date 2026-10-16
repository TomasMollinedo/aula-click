import { z } from '@hono/zod-openapi'
import { usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { qBusqueda } from '@/server/shared/busqueda'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import {
  fechaISO,
  horaHHmm,
  importe,
  opcional,
  textoOpcional,
  textoRequerido,
} from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params de pagos (HU-15, T-51; formas de pago, HU-23, T-96). Son
// la fuente del OpenAPI. Sin reglas de negocio: qué ocurrencias se pueden cobrar, el total, el tope
// de `montoRecibido` y el vuelto los decide el service con `pagos.reglas.ts`. Acá sí se valida qué
// datos lleva cada forma de pago (un pago, un medio): es la forma del body, no una regla del cobro.

/** Las formas de pago, por su código fijo (`TipoFormaPago` del modelo; nunca por el nombre). */
export const FORMAS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const
export type CodigoFormaPago = (typeof FORMAS_PAGO)[number]

/** Redes de una tarjeta de débito (`RedDebito` del modelo). */
export const REDES_DEBITO = [
  'VISA_DEBITO',
  'MASTERCARD_DEBITO',
  'MAESTRO',
  'CABAL_DEBITO',
  'OTRA',
] as const
export type RedDebito = (typeof REDES_DEBITO)[number]

/** Motivos de la anulación de un pago (`MotivoAnulacion` del modelo, HU-42). */
export const MOTIVOS_ANULACION = ['ERROR_CARGA', 'FORMA_PAGO_EQUIVOCADA', 'OTRO'] as const
export type MotivoAnulacion = (typeof MOTIVOS_ANULACION)[number]

/** Los mensajes de los datos de cada medio (un 400 en el campo que sobra o falta). */
export const MENSAJES_FORMA_PAGO = {
  formaPagoObligatoria: 'La forma de pago es obligatoria',
  montoObligatorio: 'El monto recibido es obligatorio',
  montoSoloEfectivo: 'El monto recibido sólo va en un pago en efectivo',
  transferenciaObligatoria: 'Faltan los datos de la transferencia',
  transferenciaSoloTransferencia:
    'Los datos de la transferencia sólo van en un pago por transferencia',
  debitoObligatorio: 'Faltan los datos del débito',
  debitoSoloDebito: 'Los datos del débito sólo van en un pago con débito',
  adjuntoObligatorio: 'El comprobante es obligatorio con transferencia',
  adjuntoEnEfectivo: 'Un pago en efectivo no lleva comprobante adjunto',
} as const

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
 * `Decimal(10,2)` (`importe` de `shared/zod`). Sólo en efectivo (`medioCompleto`).
 */
const montoRecibidoEntrada = importe('El monto recibido').nullish().openapi({
  description:
    'Monto que entregó el alumno, en pesos: **obligatorio con `EFECTIVO`** y sólo con efectivo; mayor a 0, con hasta dos decimales y >= al total (lo valida la API con el precio vigente)',
  example: 35000,
})

/** Datos de una transferencia (HU-23). No se compara el importe ni se impide repetir la operación. */
export const datosTransferenciaSchema = z
  .object({
    operacion: textoRequerido(50).openapi({
      description: 'Número de operación, hasta 50 caracteres',
      example: '0004829137',
    }),
    banco: textoRequerido(100).openapi({
      description: 'Banco de origen, hasta 100 caracteres',
      example: 'Banco Macro',
    }),
    titular: textoOpcional(
      100,
      'Titular de la cuenta de origen, hasta 100 caracteres',
      'Marta López',
    ),
  })
  .openapi('DatosTransferencia')

export type DatosTransferencia = z.infer<typeof datosTransferenciaSchema>

/**
 * Datos de un pago con débito (HU-23). Nunca se pide ni se guarda el número completo de la
 * tarjeta: a lo sumo sus últimos 4 números.
 */
export const datosDebitoSchema = z
  .object({
    red: z
      .enum(REDES_DEBITO, {
        error: (issue) =>
          issue.input == null ? 'La red de la tarjeta es obligatoria' : 'Elegí una red de la lista',
      })
      .openapi({ description: 'Red de la tarjeta', example: 'VISA_DEBITO' }),
    cupon: textoRequerido(20)
      .regex(/^\d+$/, { error: 'El cupón sólo puede tener números' })
      .openapi({ description: 'Número de cupón: sólo números, hasta 20', example: '000123' }),
    ultimos4: opcional(
      z.string().regex(/^\d{4}$/, { error: 'Tienen que ser exactamente 4 números' }),
      {
        description: 'Últimos 4 números de la tarjeta (opcional): exactamente 4 números',
        example: '1234',
      },
    ),
  })
  .openapi('DatosDebito')

export type DatosDebito = z.infer<typeof datosDebitoSchema>

/**
 * Un pago, un medio (HU-23): cada forma de pago pide sus datos y rechaza los de las otras, con un
 * 400 en el campo que falta o sobra. Corre con el resto del body ya válido.
 */
function medioCompleto(
  datos: {
    formaPago: CodigoFormaPago
    montoRecibido?: number | null
    transferencia?: DatosTransferencia | null
    debito?: DatosDebito | null
    comprobanteAdjuntoId?: number | null
  },
  ctx: z.RefinementCtx,
) {
  const error = (campo: string, mensaje: string) =>
    ctx.addIssue({ code: 'custom', path: [campo], message: mensaje })
  const { formaPago } = datos
  const hay = (valor: unknown) => valor != null

  if (formaPago === 'EFECTIVO' && !hay(datos.montoRecibido)) {
    error('montoRecibido', MENSAJES_FORMA_PAGO.montoObligatorio)
  }
  if (formaPago !== 'EFECTIVO' && hay(datos.montoRecibido)) {
    error('montoRecibido', MENSAJES_FORMA_PAGO.montoSoloEfectivo)
  }
  if (formaPago === 'TRANSFERENCIA' && !hay(datos.transferencia)) {
    error('transferencia', MENSAJES_FORMA_PAGO.transferenciaObligatoria)
  }
  if (formaPago !== 'TRANSFERENCIA' && hay(datos.transferencia)) {
    error('transferencia', MENSAJES_FORMA_PAGO.transferenciaSoloTransferencia)
  }
  if (formaPago === 'DEBITO' && !hay(datos.debito)) {
    error('debito', MENSAJES_FORMA_PAGO.debitoObligatorio)
  }
  if (formaPago !== 'DEBITO' && hay(datos.debito)) {
    error('debito', MENSAJES_FORMA_PAGO.debitoSoloDebito)
  }
  if (formaPago === 'TRANSFERENCIA' && !hay(datos.comprobanteAdjuntoId)) {
    error('comprobanteAdjuntoId', MENSAJES_FORMA_PAGO.adjuntoObligatorio)
  }
  if (formaPago === 'EFECTIVO' && hay(datos.comprobanteAdjuntoId)) {
    error('comprobanteAdjuntoId', MENSAJES_FORMA_PAGO.adjuntoEnEfectivo)
  }
}

/** Una ocurrencia a cobrar: `(turnoId, fecha)` (definición B). */
export const ocurrenciaPedidaSchema = z
  .object({
    turnoId: idPositivo('Id del turno (o tramo)', 41),
    fecha: fechaISO.openapi({ description: 'Fecha de la ocurrencia', example: '2026-10-05' }),
  })
  .openapi('OcurrenciaACobrar')

export type OcurrenciaPedida = z.infer<typeof ocurrenciaPedidaSchema>

/**
 * Body de `POST /pagos`. `formaPago` es obligatoria y sin valor por defecto, y cada una lleva sólo
 * sus datos (`medioCompleto`): efectivo, `montoRecibido`; transferencia, `transferencia` y
 * `comprobanteAdjuntoId`; débito, `debito` y, si se quiere, `comprobanteAdjuntoId`.
 */
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
    formaPago: z
      .enum(FORMAS_PAGO, {
        error: (issue) =>
          issue.input == null
            ? MENSAJES_FORMA_PAGO.formaPagoObligatoria
            : 'La forma de pago tiene que ser EFECTIVO, TRANSFERENCIA o DEBITO',
      })
      .openapi({
        description: 'Forma de pago, obligatoria y sin valor por defecto',
        example: 'EFECTIVO',
      }),
    montoRecibido: montoRecibidoEntrada,
    transferencia: datosTransferenciaSchema.nullish().openapi({
      description: '**Obligatorio con `TRANSFERENCIA`** y sólo con transferencia',
    }),
    debito: datosDebitoSchema.nullish().openapi({
      description: '**Obligatorio con `DEBITO`** y sólo con débito',
    }),
    comprobanteAdjuntoId: idPositivo(
      'Id del comprobante subido con `POST /adjuntos`: **obligatorio con `TRANSFERENCIA`**, opcional con `DEBITO` y no va con `EFECTIVO`. Se vincula al pago al registrarlo',
      18,
    ).nullish(),
    observaciones: textoOpcional(
      OBSERVACIONES_MAX,
      'Observaciones del pago, hasta 500 caracteres',
      'Paga el mes de octubre',
    ),
  })
  .superRefine(medioCompleto)
  .openapi('RegistrarPago')

export type RegistrarPago = z.infer<typeof registrarPagoSchema>

/** Respuesta 201 de `POST /pagos`. Los importes los calcula la API; el cliente sólo los muestra. */
export const pagoRegistradoSchema = z
  .object({
    pagoId: z.number().int().openapi({ example: 31 }),
    numeroComprobante: z.number().int().openapi({ example: 1024 }),
    cantidad: z.number().int().openapi({ description: 'Ocurrencias pagadas', example: 4 }),
    total: z.number().openapi({ description: 'Importe total en pesos', example: 32000 }),
    formaPago: z.enum(FORMAS_PAGO).openapi({ description: 'La forma de pago con la que se cobró' }),
    montoRecibido: z.number().nullable().openapi({
      description: 'Monto recibido en pesos; `null` fuera del efectivo',
      example: 35000,
    }),
    vuelto: z.number().nullable().openapi({
      description: '`montoRecibido - total`, no se guarda; `null` fuera del efectivo',
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

/** Los datos de la transferencia de un pago, como se guardaron. */
const transferenciaComprobanteSchema = z
  .object({ operacion: z.string(), banco: z.string(), titular: z.string().nullable() })
  .openapi('TransferenciaComprobante')

/** Los datos del débito de un pago: nunca el número completo de la tarjeta. */
const debitoComprobanteSchema = z
  .object({
    red: z.enum(REDES_DEBITO),
    cupon: z.string(),
    ultimos4: z.string().nullable().openapi({ description: '`null` si no se cargaron' }),
  })
  .openapi('DebitoComprobante')

/** La anulación de un pago (HU-42): se lee junto con el pago, de sólo lectura (decisión T-120). */
const anulacionComprobanteSchema = z
  .object({
    motivo: z.enum(MOTIVOS_ANULACION),
    detalle: z.string().nullable(),
    anuladoPor: usuarioAuditoriaSchema,
    anuladoEl: z.iso.datetime().openapi({
      description: 'Instante de la anulación, ISO 8601 en UTC',
      example: '2026-10-06T12:00:00.000Z',
    }),
  })
  .openapi('AnulacionComprobante')

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
      description:
        'Sólo en efectivo; `null` con transferencia o débito, o en un pago anterior a que el monto recibido fuera obligatorio',
    }),
    vuelto: z.number().nullable().openapi({
      description:
        'Recalculado (`montoRecibido - total`), nunca leído de la base; `null` sin monto recibido',
    }),
    formaPago: z
      .object({ codigo: z.enum(FORMAS_PAGO), nombre: z.string() })
      .openapi({ description: 'La forma de pago: su código fijo y su nombre para mostrar' }),
    transferencia: transferenciaComprobanteSchema.nullable().openapi({
      description: 'Los datos de la transferencia; `null` si el pago es de otra forma',
    }),
    debito: debitoComprobanteSchema.nullable().openapi({
      description: 'Los datos del débito; `null` si el pago es de otra forma',
    }),
    estado: z.enum(['VIGENTE', 'ANULADO']),
    anulacion: anulacionComprobanteSchema.nullable().openapi({
      description:
        'Motivo, detalle, quién y cuándo, si el pago está anulado; `null` si está vigente',
    }),
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

/**
 * El último comprobante adjunto **activo** del pago (HU-24), sin la clave del archivo ni la URL:
 * la URL prefirmada la da `GET /adjuntos/pagos/{pagoId}`.
 */
export const adjuntoDelPagoSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string().openapi({ description: 'Nombre del archivo subido', example: 'macro.pdf' }),
    tipo: z.string().openapi({
      description: 'Tipo MIME del archivo: `image/jpeg`, `image/png` o `application/pdf`',
      example: 'application/pdf',
    }),
    bytes: z.number().int().openapi({ description: 'Tamaño en bytes', example: 184320 }),
    adjuntadoPor: usuarioAuditoriaSchema,
    adjuntadoEl: z.iso.datetime().openapi({
      description: 'Instante en que se adjuntó, ISO 8601 en UTC',
      example: '2026-10-05T14:28:00.000Z',
    }),
  })
  .openapi('AdjuntoDelPago')

export type AdjuntoDelPago = z.infer<typeof adjuntoDelPagoSchema>

/**
 * Qué puede hacer quien pide el detalle sobre el pago (`PagoParaAcciones` del frontend): lo decide
 * la API con `accionesDelPago`, según el rol, el estado, la forma de pago y si tiene adjunto.
 */
export const accionesPagoSchema = z
  .object({
    anular: z.boolean(),
    reemplazarAdjunto: z.boolean().openapi({
      description: 'Reemplazar el comprobante adjunto o, en un débito sin adjunto, adjuntar uno',
    }),
    quitarAdjunto: z.boolean(),
  })
  .openapi('AccionesPago')

export type AccionesPago = z.infer<typeof accionesPagoSchema>

/**
 * Respuesta de `GET /pagos/{id}`: el comprobante, la cantidad de turnos, el último adjunto activo
 * y las acciones (HU-36).
 */
export const detallePagoSchema = comprobanteSchema
  .extend({
    cantidad: z.number().int().openapi({ description: 'Turnos que incluye', example: 2 }),
    adjunto: adjuntoDelPagoSchema.nullable().openapi({
      description: 'El último comprobante adjunto activo; `null` si no tiene',
    }),
    acciones: accionesPagoSchema,
  })
  .openapi('DetallePago')

export type DetallePago = z.infer<typeof detallePagoSchema>

// --- Pagos realizados (HU-36) y mis pagos (HU-37) ---

export const MENSAJE_RANGO_INVERTIDO = 'La fecha hasta no puede ser anterior a la fecha desde'

/** Id entero positivo de un filtro del query (`?alumnoId=12`). */
const idQuery = (nombre: string, description: string, example: number) =>
  z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({ param: { name: nombre, in: 'query' }, description, example })

/** `hasta` no puede ser anterior a `desde`: 400 en `hasta`, como en Cuentas. */
function periodoEnOrden(datos: { desde: string; hasta: string }, ctx: z.RefinementCtx) {
  if (datos.hasta < datos.desde) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_RANGO_INVERTIDO, path: ['hasta'] })
  }
}

/**
 * Query de `GET /pagos`: período por fecha de pago (obligatorio, sin tope de días), filtros
 * opcionales y paginación. Un alumno, una materia o un profesor que no existen dan una lista vacía,
 * sin 404.
 */
export const listarPagosQuerySchema = paginacionQuerySchema
  .extend({
    desde: fechaISO.openapi({
      param: { name: 'desde', in: 'query' },
      description: 'Primer día del período, por fecha de pago, incluido (YYYY-MM-DD)',
      example: '2026-10-01',
    }),
    hasta: fechaISO.openapi({
      param: { name: 'hasta', in: 'query' },
      description:
        'Último día del período, por fecha de pago, incluido (YYYY-MM-DD). No puede ser anterior a `desde`',
      example: '2026-10-31',
    }),
    alumnoId: idQuery('alumnoId', 'Sólo los pagos de este alumno', 12),
    materiaId: idQuery('materiaId', 'Sólo los pagos con algún turno de esta materia', 2),
    profesorId: idQuery(
      'profesorId',
      'Sólo los pagos con algún turno de este profesor (con `materiaId`, el mismo turno)',
      3,
    ),
    formaPago: z
      .enum(FORMAS_PAGO, {
        error: 'La forma de pago tiene que ser EFECTIVO, TRANSFERENCIA o DEBITO',
      })
      .optional()
      .openapi({
        param: { name: 'formaPago', in: 'query' },
        description: 'Sólo los pagos de esta forma de pago, por su código',
        example: 'TRANSFERENCIA',
      }),
  })
  .superRefine(periodoEnOrden)

export type ListarPagosQuery = z.infer<typeof listarPagosQuerySchema>

/** Query de `GET /pagos/mis-pagos`: sólo la paginación (el alumno sale de la sesión). */
export const misPagosQuerySchema = paginacionQuerySchema

export type MisPagosQuery = z.infer<typeof misPagosQuerySchema>

const formaPagoSalida = z
  .object({ codigo: z.enum(FORMAS_PAGO), nombre: z.string() })
  .openapi({ description: 'La forma de pago: su código fijo y su nombre para mostrar' })

const materiasDelPago = z.array(referencia).openapi({
  description: 'Las materias distintas de sus turnos, por nombre',
})

/** Un pago del listado de pagos realizados (HU-36): vigente o anulado, marcado con su estado. */
export const pagoRealizadoSchema = z
  .object({
    id: z.number().int(),
    numeroComprobante: z.number().int(),
    fechaPago: fechaISO,
    alumno: persona,
    materias: materiasDelPago,
    cantidad: z.number().int().openapi({ description: 'Turnos que incluye', example: 2 }),
    total: z.number(),
    formaPago: formaPagoSalida,
    registradoPor: usuarioAuditoriaSchema,
    estado: z.enum(['VIGENTE', 'ANULADO']),
    anulacion: z
      .object({ motivo: z.enum(MOTIVOS_ANULACION), detalle: z.string().nullable() })
      .nullable()
      .openapi({ description: 'Motivo y detalle si el pago está anulado; `null` si está vigente' }),
  })
  .openapi('PagoRealizado')

export type PagoRealizado = z.infer<typeof pagoRealizadoSchema>

/** Lo cobrado por cada forma de pago, en pesos. */
const porFormaSchema = z
  .object({ EFECTIVO: z.number(), TRANSFERENCIA: z.number(), DEBITO: z.number() })
  .openapi('CobradoPorForma')

/**
 * Totales de **todo** el filtro, no de la página, y sólo de los pagos vigentes: un anulado se
 * lista pero no suma. `cobrado` es la suma de las tres formas.
 */
export const totalesPagosSchema = z
  .object({ cobrado: z.number(), porForma: porFormaSchema })
  .openapi('TotalesPagos')

export type TotalesPagos = z.infer<typeof totalesPagosSchema>

/** Respuesta de `GET /pagos`: el listado paginado más `totales`, junto a `data` y `meta`. */
export const listadoPagosSchema = paginatedSchema(pagoRealizadoSchema).extend({
  totales: totalesPagosSchema,
})

export type ListadoPagos = z.infer<typeof listadoPagosSchema>

/**
 * Un pago del alumno de la sesión (HU-37). Sin quién lo registró, el adjunto, el alumno, las
 * observaciones ni el motivo de la anulación.
 */
export const miPagoSchema = z
  .object({
    id: z.number().int(),
    numeroComprobante: z.number().int(),
    fechaPago: fechaISO,
    materias: materiasDelPago,
    cantidad: z.number().int(),
    total: z.number(),
    formaPago: formaPagoSalida,
    estado: z.enum(['VIGENTE', 'ANULADO']),
  })
  .openapi('MiPago')

export type MiPago = z.infer<typeof miPagoSchema>

/** Respuesta de `GET /pagos/mis-pagos`. */
export const misPagosSchema = paginatedSchema(miPagoSchema)

export type MisPagos = z.infer<typeof misPagosSchema>

// --- Buscadores de los filtros de pagos realizados (HU-36, T-100) ---

/**
 * Query de `GET /pagos/alumnos` y `GET /pagos/profesores`: la búsqueda por palabras (`q`) y, para
 * mostrar el nombre del filtro que viene en la URL, una sola opción por su `id`. Los dos juntos se
 * combinan.
 */
export const buscadorPagosQuerySchema = z.object({
  q: qBusqueda,
  id: idQuery('id', 'Sólo esta opción, si tiene pagos (para mostrar el filtro elegido)', 12),
})

export type BuscadorPagosQuery = z.infer<typeof buscadorPagosQuerySchema>

/**
 * Una opción de un buscador de pagos: sólo el id, el nombre y el apellido. Nunca el DNI, la foto,
 * el estado ni la auditoría: el gerente no ve la ficha del alumno (HU-36).
 */
const personaDePagos = z.object({
  id: z.number().int(),
  nombre: z.string(),
  apellido: z.string(),
})

export const alumnoDePagosSchema = personaDePagos.openapi('AlumnoDePagos')
export const alumnosDePagosSchema = z.array(alumnoDePagosSchema)
export type AlumnoDePagos = z.infer<typeof alumnoDePagosSchema>

export const profesorDePagosSchema = personaDePagos.openapi('ProfesorDePagos')
export const profesoresDePagosSchema = z.array(profesorDePagosSchema)
export type ProfesorDePagos = z.infer<typeof profesorDePagosSchema>

/** Lo que el service le pasa al repository de un buscador: `q` ya partido en términos. */
export type BusquedaDePagos = { terminos: string[]; id: number | undefined }

/** El medio de un pago, ya validado: cada forma de pago con sus datos y sólo con ellos (HU-23). */
export type MedioPago =
  | { formaPago: 'EFECTIVO'; montoRecibido: number }
  | { formaPago: 'TRANSFERENCIA'; transferencia: DatosTransferencia; comprobanteAdjuntoId: number }
  | { formaPago: 'DEBITO'; debito: DatosDebito; comprobanteAdjuntoId: number | null }

/** Lo que el service le pasa al repository para registrar un pago (ya validado). */
export type EntradaPago = {
  alumnoId: number
  ocurrencias: OcurrenciaPedida[]
  fechaPago: string
  medio: MedioPago
  observaciones: string | null
}
