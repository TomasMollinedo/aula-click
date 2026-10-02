import { describe, expect, it } from 'vitest'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { aCobrarDesdeDetalle, resumenACobrar } from '../a-cobrar'

// Detalle de `types/ocurrencia.ts`: `aCobrarDesdeDetalle` usa solo turnoId, fecha, horario,
// materia, profesor y pago.
const DETALLE: OcurrenciaDetalle = {
  turnoId: 41,
  fecha: '2026-10-05',
  horaInicio: '09:00',
  horaFin: '10:00',
  tipo: 'RECURRENTE',
  estado: 'AGENDADO',
  alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
  materia: { id: 2, nombre: 'Matemática' },
  aula: { id: 1, nombre: 'Aula 1' },
  observaciones: null,
  temas: null,
  serie: { fechaInicio: '2026-09-28', fechaFin: null, finalizacion: null },
  cancelacion: null,
  pago: { estado: 'PENDIENTE', importeVigente: 8000 },
  prioridad: 'BAJA',
  examen: null,
  acciones: {
    cancelar: { visible: true, habilitada: true },
    finalizar: { visible: true },
    reprogramar: { visible: true },
    registrarPago: { visible: true },
  },
  createdAt: '2026-09-20T13:00:00.000Z',
  updatedAt: '2026-09-20T13:00:00.000Z',
  createdBy: null,
  updatedBy: null,
}

const A_COBRAR = {
  turnoId: 41,
  fecha: '2026-10-05',
  horaInicio: '09:00',
  horaFin: '10:00',
  materia: { id: 2, nombre: 'Matemática' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
}

describe('aCobrarDesdeDetalle', () => {
  it('pendiente: el importe es el vigente que manda la API', () => {
    expect(aCobrarDesdeDetalle(DETALLE)).toEqual({ ...A_COBRAR, importe: 8000 })
  })

  it('pendiente y la materia no tiene precio: sin importe', () => {
    const sinPrecio: OcurrenciaDetalle = {
      ...DETALLE,
      pago: { estado: 'PENDIENTE', importeVigente: null },
    }
    expect(aCobrarDesdeDetalle(sinPrecio)).toEqual({ ...A_COBRAR, importe: null })
  })

  it('pagado: sin importe (no se ofrece un precio)', () => {
    const pagado: OcurrenciaDetalle = {
      ...DETALLE,
      pago: {
        estado: 'PAGADO',
        pagoId: 29,
        numeroComprobante: 1020,
        importe: 7500,
        formaPago: { id: 1, nombre: 'Efectivo' },
        fechaPago: '2026-10-01',
        registradoPor: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
        registradoEl: '2026-10-01T13:00:00.000Z',
      },
    }
    expect(aCobrarDesdeDetalle(pagado)).toEqual({ ...A_COBRAR, importe: null })
  })

  it('sin `pago` (el profesor no lo recibe): sin importe', () => {
    expect(aCobrarDesdeDetalle({ ...DETALLE, pago: null })).toEqual({ ...A_COBRAR, importe: null })
  })
})

describe('resumenACobrar', () => {
  it('suma los importes que mandó la API, en centavos', () => {
    expect(resumenACobrar([{ importe: 8000 }, { importe: 8000 }, { importe: 9500.25 }])).toEqual({
      cantidad: 3,
      total: 25500.25,
      sinPrecio: 0,
    })
    expect(resumenACobrar([{ importe: 0.1 }, { importe: 0.2 }]).total).toBe(0.3)
  })

  it('con un importe null: sin total, y cuenta cuántas no tienen precio', () => {
    expect(resumenACobrar([{ importe: 8000 }, { importe: null }, { importe: null }])).toEqual({
      cantidad: 3,
      total: null,
      sinPrecio: 2,
    })
  })

  it('una sola', () => {
    expect(resumenACobrar([{ importe: 8000 }])).toEqual({ cantidad: 1, total: 8000, sinPrecio: 0 })
  })
})
