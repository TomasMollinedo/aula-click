import { describe, expect, it } from 'vitest'

import { pagoParaAcciones } from '../pago-detalle'
import type { DetallePago } from '../pago-detalle.types'

const detalle: DetallePago = {
  id: 31,
  numeroComprobante: 1024,
  fechaPago: '2026-10-05',
  alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
  turnos: [
    {
      turnoId: 41,
      fecha: '2026-10-05',
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
      importe: 8000,
    },
  ],
  total: 8000,
  montoRecibido: null,
  vuelto: null,
  formaPago: { codigo: 'DEBITO', nombre: 'Tarjeta de débito' },
  transferencia: null,
  debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
  estado: 'VIGENTE',
  anulacion: null,
  observaciones: 'Paga octubre',
  registradoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  registradoEl: '2026-10-05T14:30:00.000Z',
  cantidad: 1,
  adjunto: null,
  acciones: { anular: true, reemplazarAdjunto: true, quitarAdjunto: false },
}

describe('pagoParaAcciones', () => {
  it('lo justo para las acciones del pie, con las acciones tal como las mandó la API', () => {
    expect(pagoParaAcciones(detalle)).toStrictEqual({
      id: 31,
      numeroComprobante: 1024,
      estado: 'VIGENTE',
      alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
      total: 8000,
      cantidad: 1,
      acciones: { anular: true, reemplazarAdjunto: true, quitarAdjunto: false },
    })
  })

  it('un pago anulado lleva su estado y las acciones de la API (todas en false)', () => {
    const anulado = pagoParaAcciones({
      ...detalle,
      estado: 'ANULADO',
      acciones: { anular: false, reemplazarAdjunto: false, quitarAdjunto: false },
    })
    expect(anulado.estado).toBe('ANULADO')
    expect(anulado.acciones).toEqual({
      anular: false,
      reemplazarAdjunto: false,
      quitarAdjunto: false,
    })
  })

  it('no comparte objetos con la respuesta: las acciones no pueden cambiar el detalle', () => {
    const pago = pagoParaAcciones(detalle)
    expect(pago.acciones).not.toBe(detalle.acciones)
    expect(pago.alumno).not.toBe(detalle.alumno)
  })
})
