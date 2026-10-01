import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/errors'
import { MENSAJES_NO_CANCELABLE } from '@/server/features/cancelaciones/cancelaciones.condiciones'
import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
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
// sobre una ocurrencia, que miran su estado, su pago y, para cobrar, el tope de `POST /pagos`.

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
// calcularAcciones (T-43): con el pago de la ocurrencia y el tope de cobro.
// ---------------------------------------------------------------------------------------------

/**
 * Una ocurrencia mínima para `calcularAcciones`, con los campos que le importan. Por defecto, de
 * hoy y con el pago pendiente.
 */
function ocurrencia(datos: {
  estado: 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR'
  tipo: 'SESION_UNICA' | 'RECURRENTE'
  fecha?: string
  pago?: 'PENDIENTE' | 'PAGADO'
  fechaFin?: string | null
  finEfectivo?: string | null
}) {
  return {
    fecha: datos.fecha ?? HOY,
    estado: datos.estado,
    tipo: datos.tipo,
    pago: { estado: datos.pago ?? 'PENDIENTE' },
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

  it('agendada y pagada: cancelar visible y deshabilitada con el motivo de `cancelaciones`; sin registrarPago', () => {
    const acciones = calcularAcciones(
      ocurrencia({ estado: 'AGENDADO', tipo: 'RECURRENTE', pago: 'PAGADO' }),
      HOY,
    )
    expect(acciones).toEqual({
      cancelar: { visible: true, habilitada: false, motivo: MENSAJES_NO_CANCELABLE.PAGADO },
      // Finalizar no mira el pago de esta ocurrencia; una pagada se reprograma (el pago la acompaña).
      finalizar: { visible: true },
      reprogramar: { visible: true },
      registrarPago: { visible: false },
    })
    expect(acciones.cancelar.motivo).toBe('El turno está pagado: no se puede cancelar')
  })

  it('agendada y pendiente: cancelar habilitada, sin `motivo`', () => {
    const { cancelar } = calcularAcciones(
      ocurrencia({ estado: 'AGENDADO', tipo: 'SESION_UNICA' }),
      HOY,
    )
    expect(cancelar).toEqual({ visible: true, habilitada: true })
    expect('motivo' in cancelar).toBe(false)
  })

  it('pasada y pagada: ni cancelar (ya pasó) ni registrarPago (ya está pagada)', () => {
    const acciones = calcularAcciones(
      ocurrencia({
        estado: 'SIN_REGISTRAR',
        tipo: 'SESION_UNICA',
        fecha: '2026-09-15',
        pago: 'PAGADO',
      }),
      HOY,
    )
    expect(acciones.cancelar).toEqual({ visible: false, habilitada: false })
    expect(acciones.registrarPago).toEqual({ visible: false })
  })

  describe('registrarPago y el tope de cobro (el de `POST /pagos`, decisión T-60)', () => {
    const registrarPago = (fecha: string, estado: 'AGENDADO' | 'SIN_REGISTRAR' = 'AGENDADO') =>
      calcularAcciones(ocurrencia({ estado, tipo: 'RECURRENTE', fecha }), HOY).registrarPago

    it('el tope es el de `pagos`: hoy + 56 días', () => {
      expect(limiteDeCobro(HOY)).toBe('2026-11-17')
    })

    it('futura hasta el tope, incluido: visible', () => {
      expect(registrarPago('2026-11-16')).toEqual({ visible: true })
      expect(registrarPago(limiteDeCobro(HOY))).toEqual({ visible: true })
    })

    it('futura después del tope: no visible (la API la rechazaría con FUERA_DE_RANGO)', () => {
      expect(registrarPago('2026-11-18')).toEqual({ visible: false })
      expect(registrarPago('2027-03-01')).toEqual({ visible: false })
    })

    it('las pasadas no tienen tope: una deuda vieja se cobra', () => {
      expect(registrarPago('2025-01-06', 'SIN_REGISTRAR')).toEqual({ visible: true })
    })

    it('fuera del tope, cancelar y reprogramar no cambian: sólo deja de ofrecerse el cobro', () => {
      const acciones = calcularAcciones(
        ocurrencia({ estado: 'AGENDADO', tipo: 'SESION_UNICA', fecha: '2026-12-01' }),
        HOY,
      )
      expect(acciones).toEqual({
        cancelar: { visible: true, habilitada: true },
        finalizar: { visible: false },
        reprogramar: { visible: true },
        registrarPago: { visible: false },
      })
    })
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
