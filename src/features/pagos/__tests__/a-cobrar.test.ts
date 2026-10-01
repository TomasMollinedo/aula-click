import { describe, expect, it } from 'vitest'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

import { aCobrarDesdeDetalle, resumenACobrar } from '../a-cobrar'

// Detalle de `types/ocurrencia.ts` (T-44): `aCobrarDesdeDetalle` usa solo turnoId, fecha, horario,
// materia y profesor.
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
  // TODO integración detalle (prompt 2): `OcurrenciaDetalle` ya no trae `pago`; hasta que el detalle
  // tenga de dónde sacar el importe, sale siempre `null`. Vuelven los dos casos de abajo.
  it('provisorio: copia la ocurrencia (turnoId + fecha, definición B) sin importe', () => {
    expect(aCobrarDesdeDetalle(DETALLE)).toEqual({ ...A_COBRAR, importe: null })
  })

  it.todo('pendiente: el importe es el vigente que manda la API')
  it.todo('pagado: sin importe (no se ofrece un precio)')
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
