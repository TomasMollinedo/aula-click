import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { OcurrenciaACobrar } from '@/types/pago'

import type { CodigoFormaPago, MedioRegistrarPago, RedDebito, RegistrarPago } from './pagos.types'

// Schema del formulario de registrar un pago: solo formato y campos obligatorios
// (docs/arquitectura-frontend.md → Formularios). Que la fecha de pago no sea futura, que el monto
// recibido alcance el total y qué turnos se pueden cobrar los decide la API, y sus 400 se muestran
// en el campo. Las ocurrencias no son campos: llegan de quien abre el diálogo.
//
// Formas de pago (HU-23): un pago, un medio. Cada forma pide sus campos (`camposDelPago`) y el
// body lleva solo los suyos (`armarRegistrarPago`): los de otro medio no se mandan nunca, aunque
// hayan quedado escritos. Los límites son los de la API (`registrarPagoSchema`, T-96).

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/
const MAX_OBSERVACIONES = 500
const MAX_OPERACION = 50
const MAX_BANCO = 100
const MAX_TITULAR = 100
const MAX_CUPON = 20
const CAMPO_OBLIGATORIO = 'Campo obligatorio'

/** Las formas de pago y las redes de débito que se pueden elegir. */
export const FORMAS_PAGO = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEBITO',
] as const satisfies readonly CodigoFormaPago[]
export const REDES_DEBITO = [
  'VISA_DEBITO',
  'MASTERCARD_DEBITO',
  'MAESTRO',
  'CABAL_DEBITO',
  'OTRA',
] as const satisfies readonly RedDebito[]
// `parsearMonto`: los formatos que acepta. El primer grupo de miles no empieza con 0 y los
// centavos son uno o dos dígitos.
const SOLO_DIGITOS = /^\d+$/
const MILES_CON_PUNTO = /^[1-9]\d{0,2}(\.\d{3})+$/
const DECIMAL_CON_PUNTO = /^(\d+)\.(\d{1,2})$/
const DECIMAL_CON_COMA = /^(\d+|[1-9]\d{0,2}(?:\.\d{3})+),(\d{1,2})$/

/**
 * Lee el monto que escribe quien cobra. Devuelve el número, o `null` si el texto está vacío o no se
 * puede leer sin ambigüedad. Criterio:
 *
 * - Descarta todos los espacios y un `$` inicial (`'$ 32.000'`).
 * - Solo dígitos: entero (`'32000'`).
 * - La **coma** es siempre el separador decimal (`'32000,50'`), y la parte entera puede llevar
 *   puntos de miles (`'1.234.567,50'`).
 * - El **punto** es de miles solo si el texto completo sigue el patrón de grupos de 3 y no hay coma
 *   (`'32.000'` → 32000, `'1.234.567'` → 1234567). Si no, un único punto es decimal
 *   (`'32000.5'` → 32000.5).
 * - Los centavos son **uno o dos dígitos**: más decimales no son un importe en pesos, y una coma
 *   seguida de tres dígitos (`'32,000'`) es ambigua (¿miles al estilo inglés?). Así, "hasta dos
 *   decimales" ya lo cubre la lectura.
 * - Rechaza lo ambiguo o inválido: punto y coma al estilo inglés (`'1,234.56'`), más de una coma,
 *   puntos que no forman grupos de 3 (`'32.000.5'`), signos, letras, o un separador sin dígitos a
 *   algún lado (`'.5'`, `'5,'`).
 *
 * No valida el rango: `'0'` se lee 0. "Mayor a 0" lo marca el schema del formulario; el tope y
 * "mayor o igual al total", la API.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/\s+/g, '').replace(/^\$/, '')
  if (limpio === '') return null

  let normalizado: string | null = null
  if (SOLO_DIGITOS.test(limpio)) {
    normalizado = limpio
  } else if (MILES_CON_PUNTO.test(limpio)) {
    normalizado = limpio.replaceAll('.', '')
  } else {
    const conComa = DECIMAL_CON_COMA.exec(limpio)
    const conPunto = DECIMAL_CON_PUNTO.exec(limpio)
    if (conComa) normalizado = `${conComa[1].replaceAll('.', '')}.${conComa[2]}`
    else if (conPunto) normalizado = `${conPunto[1]}.${conPunto[2]}`
  }

  return normalizado === null ? null : Number(normalizado)
}

/**
 * Fecha `YYYY-MM-DD` obligatoria y válida (mismo criterio que `turnos.schema.ts`). Devuelve el
 * mensaje del error, o `null`. Se revisa en `camposDelPago` y no con un `pipe`: un `pipe` que falla
 * corta el objeto entero y el resto del formulario no se revisaría hasta corregir la fecha.
 */
function errorFechaPago(texto: string): string | null {
  if (texto === '') return CAMPO_OBLIGATORIO
  if (!FECHA_FORMATO.test(texto)) return 'Fecha inválida: debe tener formato AAAA-MM-DD'
  return isValid(parseISO(texto)) ? null : 'La fecha no es válida'
}

/**
 * El monto recibido, en efectivo: obligatorio, legible con `parsearMonto` (que ya exige hasta dos
 * decimales) y mayor a 0. No se compara con el total: ese 400 lo da la API en el campo. Devuelve
 * el mensaje del error, o `null` si está bien.
 */
function errorMontoRecibido(texto: string): string | null {
  if (texto.trim() === '') return CAMPO_OBLIGATORIO
  const monto = parsearMonto(texto)
  if (monto === null) {
    return 'Monto inválido: usá números con hasta dos decimales (por ejemplo 32.000 o 32000,50)'
  }
  return monto > 0 ? null : 'Debe ser mayor a 0'
}

const observacionesSchema = z
  .string()
  .max(MAX_OBSERVACIONES, { message: `No puede superar los ${MAX_OBSERVACIONES} caracteres` })
  .optional()
  .or(z.literal(''))

const textoLibre = z.string()

/**
 * La fecha de pago y los campos de cada medio (HU-23): los obligatorios del medio elegido y su
 * formato. Los de los otros medios no se miran (no viajan). Todo en un solo paso, así el
 * formulario muestra de una vez todo lo que falta.
 */
function camposDelPago(valores: PagoFormValues, ctx: z.RefinementCtx) {
  const error = (campo: CampoPagoForm, mensaje: string) =>
    ctx.addIssue({ code: 'custom', path: [campo], message: mensaje })
  const texto = (campo: keyof PagoFormValues) => String(valores[campo] ?? '').trim()

  const fecha = errorFechaPago(valores.fechaPago)
  if (fecha) error('fechaPago', fecha)

  switch (valores.formaPago) {
    case 'EFECTIVO': {
      const mensaje = errorMontoRecibido(String(valores.montoRecibido ?? ''))
      if (mensaje) error('montoRecibido', mensaje)
      return
    }
    case 'TRANSFERENCIA': {
      const operacion = texto('transferenciaOperacion')
      if (!operacion) error('transferenciaOperacion', CAMPO_OBLIGATORIO)
      else if (operacion.length > MAX_OPERACION) {
        error('transferenciaOperacion', `No puede superar los ${MAX_OPERACION} caracteres`)
      }
      const banco = texto('transferenciaBanco')
      if (!banco) error('transferenciaBanco', CAMPO_OBLIGATORIO)
      else if (banco.length > MAX_BANCO) {
        error('transferenciaBanco', `No puede superar los ${MAX_BANCO} caracteres`)
      }
      if (texto('transferenciaTitular').length > MAX_TITULAR) {
        error('transferenciaTitular', `No puede superar los ${MAX_TITULAR} caracteres`)
      }
      if (valores.comprobanteAdjuntoId == null) {
        error('comprobanteAdjuntoId', 'El comprobante es obligatorio con transferencia')
      }
      return
    }
    case 'DEBITO': {
      if (!valores.debitoRed) error('debitoRed', 'Elegí la red de la tarjeta')
      const cupon = texto('debitoCupon')
      if (!cupon) error('debitoCupon', CAMPO_OBLIGATORIO)
      else if (!/^\d+$/.test(cupon)) error('debitoCupon', 'El cupón sólo puede tener números')
      else if (cupon.length > MAX_CUPON) {
        error('debitoCupon', `No puede superar los ${MAX_CUPON} números`)
      }
      const ultimos4 = texto('debitoUltimos4')
      if (ultimos4 && !/^\d{4}$/.test(ultimos4)) {
        error('debitoUltimos4', 'Tienen que ser exactamente 4 números')
      }
      return
    }
    default:
      error('formaPago', 'Elegí la forma de pago')
  }
}

export const pagoFormSchema = z
  .object({
    /** Sin opción elegida al abrir (`''`): no hay una forma de pago por defecto. */
    formaPago: z.union([z.enum(FORMAS_PAGO), z.literal('')]),
    fechaPago: textoLibre,
    montoRecibido: textoLibre,
    transferenciaOperacion: textoLibre,
    transferenciaBanco: textoLibre,
    transferenciaTitular: textoLibre,
    debitoRed: z.union([z.enum(REDES_DEBITO), z.literal('')]),
    debitoCupon: textoLibre,
    debitoUltimos4: textoLibre,
    /** El comprobante ya subido (`POST /adjuntos`), o `null`: lo pone el campo "Comprobante". */
    comprobanteAdjuntoId: z.number().int().positive().nullable(),
    observaciones: observacionesSchema,
  })
  .superRefine(camposDelPago)

export type PagoFormValues = z.input<typeof pagoFormSchema>

/** Campos del formulario que un 400 de la API puede marcar. */
export const CAMPOS_PAGO_FORM = [
  'formaPago',
  'fechaPago',
  'montoRecibido',
  'transferenciaOperacion',
  'transferenciaBanco',
  'transferenciaTitular',
  'debitoRed',
  'debitoCupon',
  'debitoUltimos4',
  'comprobanteAdjuntoId',
  'observaciones',
] as const

/**
 * Los campos de cada medio: al cambiar de forma de pago, los del medio anterior se vacían (quedan
 * en `valoresInicialesPago`). La fecha y las observaciones no son de ningún medio.
 */
export const CAMPOS_DEL_MEDIO = [
  'montoRecibido',
  'transferenciaOperacion',
  'transferenciaBanco',
  'transferenciaTitular',
  'debitoRed',
  'debitoCupon',
  'debitoUltimos4',
  'comprobanteAdjuntoId',
] as const satisfies readonly CampoPagoForm[]

export type CampoPagoForm = (typeof CAMPOS_PAGO_FORM)[number]

/**
 * Valores iniciales: sin forma de pago elegida y la fecha de pago en `hoy` (la fecha local del
 * navegador, `YYYY-MM-DD`, que pasa quien monta el formulario). Qué es "hoy" para la regla lo
 * decide la API.
 */
export function valoresInicialesPago(hoy: string): PagoFormValues {
  return {
    formaPago: '',
    fechaPago: hoy,
    montoRecibido: '',
    transferenciaOperacion: '',
    transferenciaBanco: '',
    transferenciaTitular: '',
    debitoRed: '',
    debitoCupon: '',
    debitoUltimos4: '',
    comprobanteAdjuntoId: null,
    observaciones: '',
  }
}

/** Los datos del medio elegido, como van en el body (sin los de los otros medios). */
function medioDelFormulario(valores: PagoFormValues): MedioRegistrarPago {
  const opcional = (texto: string | undefined) => {
    const limpio = (texto ?? '').trim()
    return limpio ? limpio : undefined
  }
  switch (valores.formaPago) {
    case 'TRANSFERENCIA': {
      const titular = opcional(valores.transferenciaTitular)
      return {
        formaPago: 'TRANSFERENCIA',
        transferencia: {
          operacion: valores.transferenciaOperacion.trim(),
          banco: valores.transferenciaBanco.trim(),
          ...(titular ? { titular } : {}),
        },
        // Ya pasó por `pagoFormSchema`: hay comprobante. Si no, viaja 0 y la API da su 400.
        comprobanteAdjuntoId: valores.comprobanteAdjuntoId ?? 0,
      }
    }
    case 'DEBITO': {
      const ultimos4 = opcional(valores.debitoUltimos4)
      return {
        formaPago: 'DEBITO',
        debito: {
          red: valores.debitoRed as RedDebito,
          cupon: valores.debitoCupon.trim(),
          ...(ultimos4 ? { ultimos4 } : {}),
        },
        ...(valores.comprobanteAdjuntoId != null
          ? { comprobanteAdjuntoId: valores.comprobanteAdjuntoId }
          : {}),
      }
    }
    default:
      // Efectivo (la forma ya pasó por el schema). Un monto que no se pudiera leer viaja `0`: la
      // API lo rechaza con su 400 en el campo y nunca se registra un pago sin monto.
      return { formaPago: 'EFECTIVO', montoRecibido: parsearMonto(valores.montoRecibido) ?? 0 }
  }
}

/**
 * Body del `POST /pagos`. Las ocurrencias van como pares `(turnoId, fecha)` **en el mismo orden en
 * que se muestran**: la API devuelve sus errores por posición (`path: ['ocurrencias', i]`) y
 * `errores-pagos.ts` los resuelve contra esa misma lista. Los textos van sin espacios alrededor y
 * los opcionales vacíos se omiten. Del medio, solo los datos del elegido (`medioDelFormulario`).
 */
export function armarRegistrarPago(
  alumnoId: number,
  ocurrencias: readonly Pick<OcurrenciaACobrar, 'turnoId' | 'fecha'>[],
  valores: PagoFormValues,
): RegistrarPago {
  const observaciones = valores.observaciones?.trim()

  return {
    alumnoId,
    ocurrencias: ocurrencias.map(({ turnoId, fecha }) => ({ turnoId, fecha })),
    fechaPago: valores.fechaPago,
    ...(observaciones ? { observaciones } : {}),
    ...medioDelFormulario(valores),
  }
}
