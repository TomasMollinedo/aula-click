import { describe, expect, it } from 'vitest'

import type { OcurrenciaACobrar } from '@/types/pago'
import { ApiError } from '@/utils/fetch-json'

import { interpretarErrorPago } from '../errores-pagos'

// Errores copiados de src/server/features/pagos/pagos.ejemplos.ts y de los mensajes de
// pagos.reglas.ts (el frontend no importa `@/server`). Si cambian allá, se cambian acá.

const MENSAJE_NO_COBRABLES = 'Algunos turnos no se pueden cobrar'
const DETALLES_NO_COBRABLES = [
  {
    path: ['ocurrencias', 1],
    message: 'El turno ya está pagado',
    turnoId: 41,
    fecha: '2026-10-12',
    motivo: 'YA_PAGADO',
    pagoId: 29,
  },
  {
    path: ['ocurrencias', 3],
    message: 'El turno está cancelado',
    turnoId: 57,
    fecha: '2026-10-14',
    motivo: 'CANCELADO',
  },
]
const MENSAJE_MONTO = 'El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)'
const MENSAJE_DE_OTRO_ALUMNO = 'El turno no es del alumno'
const MENSAJE_CONCURRENTE = 'Alguno de los turnos ya fue pagado'

function aCobrar(turnoId: number, fecha: string, materia: string): OcurrenciaACobrar {
  return {
    turnoId,
    fecha,
    horaInicio: turnoId === 41 ? '09:00' : '17:00',
    horaFin: turnoId === 41 ? '10:00' : '18:00',
    materia: { id: turnoId === 41 ? 2 : 7, nombre: materia },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
    importe: 8000,
  }
}

// La lista mostrada, en el orden de `ejemploRegistrar`.
const LISTA = [
  aCobrar(41, '2026-10-05', 'Matemática'),
  aCobrar(41, '2026-10-12', 'Matemática'),
  aCobrar(57, '2026-10-07', 'Física'),
  aCobrar(57, '2026-10-14', 'Física'),
]

describe('interpretarErrorPago: 409 TURNOS_NO_COBRABLES', () => {
  it('con details: un turno por entrada, resuelto contra la lista mostrada', () => {
    const error = new ApiError(
      409,
      'TURNOS_NO_COBRABLES',
      MENSAJE_NO_COBRABLES,
      DETALLES_NO_COBRABLES,
    )
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'turnos',
      mensaje: MENSAJE_NO_COBRABLES,
      turnos: [
        {
          turnoId: 41,
          fecha: '2026-10-12',
          mensaje: 'El turno ya está pagado',
          motivo: 'YA_PAGADO',
          pagoId: 29,
          ocurrencia: LISTA[1],
          linea: 'lunes 12/10 de 9:00 a 10:00 · Matemática — El turno ya está pagado',
        },
        {
          turnoId: 57,
          fecha: '2026-10-14',
          mensaje: 'El turno está cancelado',
          motivo: 'CANCELADO',
          pagoId: null,
          ocurrencia: LISTA[3],
          linea: 'miércoles 14/10 de 17:00 a 18:00 · Física — El turno está cancelado',
        },
      ],
    })
  })

  it('resuelve por turnoId + fecha, no por la posición del path', () => {
    // La lista en otro orden que el del pedido: la posición 1 ya no es el turno 41 del 12/10.
    const desordenada = [LISTA[3], LISTA[2], LISTA[1], LISTA[0]]
    const error = new ApiError(
      409,
      'TURNOS_NO_COBRABLES',
      MENSAJE_NO_COBRABLES,
      DETALLES_NO_COBRABLES,
    )
    const resultado = interpretarErrorPago(error, desordenada)
    expect(resultado.tipo).toBe('turnos')
    if (resultado.tipo !== 'turnos') return
    expect(resultado.turnos.map((t) => t.ocurrencia)).toEqual([LISTA[1], LISTA[3]])
  })

  it('una entrada que no está en la lista: la línea sale igual, con la fecha de la API', () => {
    const error = new ApiError(409, 'TURNOS_NO_COBRABLES', MENSAJE_NO_COBRABLES, [
      {
        path: ['ocurrencias', 0],
        message: 'El turno no existe en esa fecha',
        turnoId: 99,
        fecha: '2026-10-19',
        motivo: 'NO_EXISTE',
      },
    ])
    const resultado = interpretarErrorPago(error, LISTA)
    expect(resultado).toMatchObject({
      tipo: 'turnos',
      turnos: [
        {
          turnoId: 99,
          fecha: '2026-10-19',
          motivo: 'NO_EXISTE',
          ocurrencia: null,
          linea: 'lunes 19/10 — El turno no existe en esa fecha',
        },
      ],
    })
  })

  it('sin details: yaPagado (la última red de la base)', () => {
    const error = new ApiError(409, 'TURNOS_NO_COBRABLES', MENSAJE_CONCURRENTE)
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'yaPagado',
      mensaje: MENSAJE_CONCURRENTE,
    })
  })

  it.each([
    ['details que no es arreglo', { turnoId: 41 }],
    ['details vacío', []],
    ['sin message', [{ ...DETALLES_NO_COBRABLES[0], message: undefined }]],
    ['sin path', [{ ...DETALLES_NO_COBRABLES[0], path: undefined }]],
    ['path de otro campo', [{ ...DETALLES_NO_COBRABLES[0], path: ['fechaPago'] }]],
    ['motivo desconocido', [{ ...DETALLES_NO_COBRABLES[0], motivo: 'OTRO' }]],
    ['sin motivo', [{ ...DETALLES_NO_COBRABLES[0], motivo: undefined }]],
    ['fecha inválida', [{ ...DETALLES_NO_COBRABLES[0], fecha: '2026-13-45' }]],
    ['turnoId no numérico', [{ ...DETALLES_NO_COBRABLES[0], turnoId: '41' }]],
    ['pagoId no numérico', [{ ...DETALLES_NO_COBRABLES[0], pagoId: 'x' }]],
    ['un elemento null', [DETALLES_NO_COBRABLES[0], null]],
  ])('details malformados (%s): general con el message, sin romper', (_caso, details) => {
    const error = new ApiError(409, 'TURNOS_NO_COBRABLES', MENSAJE_NO_COBRABLES, details)
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'general',
      mensaje: MENSAJE_NO_COBRABLES,
    })
  })
})

describe('interpretarErrorPago: 400 VALIDACION', () => {
  it('montoRecibido menor al total: en el campo, con el message de la API tal cual', () => {
    const error = new ApiError(400, 'VALIDACION', MENSAJE_MONTO, [
      { path: ['montoRecibido'], message: MENSAJE_MONTO },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'montoRecibido', mensaje: MENSAJE_MONTO }],
      mensaje: null,
    })
  })

  it('fechaPago futura y observaciones: cada una en su campo, una vez por campo', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['fechaPago'], message: 'La fecha de pago no puede ser posterior a hoy' },
      { path: ['observaciones'], message: 'No puede superar los 500 caracteres' },
      { path: ['observaciones'], message: 'Otro mensaje del mismo campo' },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'campos',
      campos: [
        { campo: 'fechaPago', mensaje: 'La fecha de pago no puede ser posterior a hoy' },
        { campo: 'observaciones', mensaje: 'No puede superar los 500 caracteres' },
      ],
      mensaje: null,
    })
  })

  it('turno de otro alumno: turnos, resuelto contra la lista', () => {
    const error = new ApiError(400, 'VALIDACION', MENSAJE_DE_OTRO_ALUMNO, [
      {
        path: ['ocurrencias', 2],
        message: MENSAJE_DE_OTRO_ALUMNO,
        turnoId: 57,
        fecha: '2026-10-07',
      },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'turnos',
      mensaje: MENSAJE_DE_OTRO_ALUMNO,
      turnos: [
        {
          turnoId: 57,
          fecha: '2026-10-07',
          mensaje: MENSAJE_DE_OTRO_ALUMNO,
          motivo: null,
          pagoId: null,
          ocurrencia: LISTA[2],
          linea: 'miércoles 07/10 de 17:00 a 18:00 · Física — El turno no es del alumno',
        },
      ],
    })
  })

  it('ocurrencia repetida (sin turnoId ni fecha): por la posición en la lista mostrada', () => {
    const mensaje = 'La ocurrencia está repetida en el pedido'
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['ocurrencias', 1], message: mensaje },
    ])
    expect(interpretarErrorPago(error, LISTA)).toMatchObject({
      tipo: 'turnos',
      turnos: [{ turnoId: 41, fecha: '2026-10-12', ocurrencia: LISTA[1] }],
    })
  })

  it('ocurrencia repetida en una posición que no existe: general', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['ocurrencias', 9], message: 'La ocurrencia está repetida en el pedido' },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'general',
      mensaje: 'Datos inválidos',
    })
  })

  it('el total supera el máximo (path ["ocurrencias"]): general con el message del detalle', () => {
    const mensaje =
      'El total del pago ($ 100.000.000,00) supera el máximo de un pago ($ 99.999.999,99): dividilo en varios pagos'
    const error = new ApiError(400, 'VALIDACION', mensaje, [
      { path: ['ocurrencias'], message: mensaje },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({ tipo: 'general', mensaje })
  })

  it('campo y algo que no es un campo: campos, con el resto como mensaje', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['alumnoId'], message: 'Debe ser mayor a 0' },
      { path: ['fechaPago'], message: 'La fecha de pago no puede ser posterior a hoy' },
    ])
    expect(interpretarErrorPago(error, LISTA)).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'fechaPago', mensaje: 'La fecha de pago no puede ser posterior a hoy' }],
      mensaje: 'Debe ser mayor a 0',
    })
  })

  it('sin details o malformados: general con el message', () => {
    expect(interpretarErrorPago(new ApiError(400, 'VALIDACION', 'Datos inválidos'), LISTA)).toEqual(
      {
        tipo: 'general',
        mensaje: 'Datos inválidos',
      },
    )
    expect(
      interpretarErrorPago(
        new ApiError(400, 'VALIDACION', 'Datos inválidos', [{ path: 'x' }]),
        LISTA,
      ),
    ).toEqual({ tipo: 'general', mensaje: 'Datos inválidos' })
  })
})

describe('interpretarErrorPago: el resto cae a general', () => {
  it('404 del alumno, 401 y 500: el message de la API', () => {
    for (const error of [
      new ApiError(404, 'NO_ENCONTRADO', 'Alumno no encontrado'),
      new ApiError(401, 'NO_AUTENTICADO', 'No autenticado'),
      new ApiError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado'),
      new ApiError(409, 'CONFLICTO', 'Otro conflicto'),
    ]) {
      expect(interpretarErrorPago(error, LISTA)).toEqual({
        tipo: 'general',
        mensaje: error.message,
      })
    }
  })

  it('403 SIN_PERMISO: mensaje propio', () => {
    expect(interpretarErrorPago(new ApiError(403, 'SIN_PERMISO', 'Forbidden'), LISTA)).toEqual({
      tipo: 'general',
      mensaje: 'No tenés permiso para esta operación',
    })
  })

  it('error de red (no es un ApiError)', () => {
    expect(interpretarErrorPago(new TypeError('Failed to fetch'), LISTA)).toEqual({
      tipo: 'general',
      mensaje: 'No se pudo registrar el pago. Revisá la conexión e intentá de nuevo.',
    })
  })
})
