import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/errors'
import {
  ACCIONES_SIN_PERMISO,
  DIAS_ADELANTE_POR_DEFECTO,
  DIAS_ATRAS_POR_DEFECTO,
  MENSAJE_FUERA_DE_VENTANA,
  MENSAJE_RANGO_INVERTIDO,
  calcularAcciones,
  validarRangoOcurrencias,
  ventanaOcurrencias,
} from '../ocurrencias.reglas'

// Reglas puras de `ocurrencias` (T-43): la ventana de `GET /ocurrencias` y las acciones permitidas
// sobre una ocurrencia. Sin pago (a pedido explícito): `cancelar` y `registrarPago` no lo miran.

/** Ejecuta `accion`, que debe lanzar, y devuelve el error. */
function errorDe(accion: () => unknown): unknown {
  try {
    accion()
  } catch (error) {
    return error
  }
  return expect.fail('Se esperaba un error')
}

const HOY = '2026-09-22'

describe('ventanaOcurrencias', () => {
  it('30 días atrás y 8 semanas (56 días) adelante de hoy', () => {
    expect(ventanaOcurrencias(HOY)).toEqual({
      desde: '2026-08-23',
      hasta: '2026-11-17',
    })
  })
})

describe('validarRangoOcurrencias', () => {
  it('acepta el rango por defecto y cualquier sub-rango dentro de la ventana', () => {
    expect(() => validarRangoOcurrencias('2026-08-23', '2026-11-17', HOY)).not.toThrow()
    expect(() => validarRangoOcurrencias(HOY, HOY, HOY)).not.toThrow()
  })

  it('`hasta` anterior a `desde`: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoOcurrencias('2026-09-22', '2026-09-21', HOY))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO },
    ])
  })

  it('`desde` anterior a la ventana: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoOcurrencias('2026-08-22', HOY, HOY))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_FUERA_DE_VENTANA },
    ])
  })

  it('`hasta` posterior a la ventana: 400 sobre `hasta`', () => {
    const error = errorDe(() => validarRangoOcurrencias(HOY, '2026-11-18', HOY))
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).details).toEqual([
      { path: ['hasta'], message: MENSAJE_FUERA_DE_VENTANA },
    ])
  })

  it('los valores por defecto son también los bordes de la ventana', () => {
    expect(DIAS_ATRAS_POR_DEFECTO).toBe(30)
    expect(DIAS_ADELANTE_POR_DEFECTO).toBe(56)
  })
})

// ---------------------------------------------------------------------------------------------
// calcularAcciones (T-43): sin mirar pago, a pedido explícito.
// ---------------------------------------------------------------------------------------------

/** Una ocurrencia mínima para `calcularAcciones`, con los campos que le importan. */
function ocurrencia(datos: {
  estado: 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR'
  tipo: 'SESION_UNICA' | 'RECURRENTE'
  fechaFin?: string | null
  finEfectivo?: string | null
}) {
  return {
    estado: datos.estado,
    tipo: datos.tipo,
    serie: { fechaFin: datos.fechaFin ?? null, finEfectivo: datos.finEfectivo ?? null },
  }
}

describe('calcularAcciones', () => {
  it('agendada, sesión única: cancelar y reprogramar habilitados, finalizar no visible', () => {
    const acciones = calcularAcciones(ocurrencia({ estado: 'AGENDADO', tipo: 'SESION_UNICA' }), HOY)
    expect(acciones).toEqual({
      cancelar: { visible: true, habilitada: true },
      finalizar: { visible: false },
      reprogramar: { visible: true },
      registrarPago: { visible: true },
    })
  })

  it('agendada, recurrente vigente y sin finalizar: las cuatro visibles', () => {
    const acciones = calcularAcciones(
      ocurrencia({ estado: 'AGENDADO', tipo: 'RECURRENTE', fechaFin: null, finEfectivo: null }),
      HOY,
    )
    expect(acciones).toEqual({
      cancelar: { visible: true, habilitada: true },
      finalizar: { visible: true },
      reprogramar: { visible: true },
      registrarPago: { visible: true },
    })
  })

  it('pasada (SIN_REGISTRAR): cancelar y reprogramar no visibles; registrarPago sigue visible', () => {
    const acciones = calcularAcciones(
      ocurrencia({ estado: 'SIN_REGISTRAR', tipo: 'SESION_UNICA' }),
      HOY,
    )
    expect(acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: true },
    })
  })

  it('cancelada: cancelar, reprogramar y registrarPago no visibles', () => {
    const acciones = calcularAcciones(
      ocurrencia({ estado: 'CANCELADO', tipo: 'SESION_UNICA' }),
      HOY,
    )
    expect(acciones).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
    })
  })

  it('recurrente con una finalización ya aplicada (finEfectivo < fechaFin): finalizar no visible', () => {
    const acciones = calcularAcciones(
      ocurrencia({
        estado: 'AGENDADO',
        tipo: 'RECURRENTE',
        fechaFin: '2026-12-31',
        finEfectivo: '2026-10-05',
      }),
      HOY,
    )
    expect(acciones.finalizar).toEqual({ visible: false })
  })

  it('recurrente no vigente (fin efectivo ya pasó): finalizar no visible', () => {
    const acciones = calcularAcciones(
      ocurrencia({
        estado: 'SIN_REGISTRAR',
        tipo: 'RECURRENTE',
        fechaFin: '2026-09-01',
        finEfectivo: '2026-09-01',
      }),
      HOY,
    )
    expect(acciones.finalizar).toEqual({ visible: false })
  })

  it('no mira el pago: `cancelar` y `registrarPago` no dependen de él (decisión explícita)', () => {
    // `calcularAcciones` no recibe `pago` en absoluto: si tomara alguno de más, esto no compilaría.
    const acciones = calcularAcciones(ocurrencia({ estado: 'AGENDADO', tipo: 'SESION_UNICA' }), HOY)
    expect(acciones.cancelar).toEqual({ visible: true, habilitada: true })
  })
})

describe('ACCIONES_SIN_PERMISO', () => {
  it('las cuatro acciones no visibles / no habilitadas', () => {
    expect(ACCIONES_SIN_PERMISO).toEqual({
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: false },
    })
  })
})
