import { describe, expect, it } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import { ejemploAltaEnTramos, ejemploDisponibilidad } from '../turnos.ejemplos'
import {
  disponibilidadParaElAlumno,
  errorParaElAlumno,
  MENSAJE_ALUMNO_SUPERPUESTO_PORTAL,
  resumenParaElAlumno,
} from '../mis-turnos.reglas'

// Lo que cambia para el alumno al sacar un turno (HU-29): textos y datos que no ve nunca.

describe('errorParaElAlumno', () => {
  it('ALUMNO_SUPERPUESTO: el mensaje para el alumno, con los mismos details (sus turnos)', () => {
    const details = [{ turnoId: 40 }]
    const original = new ConflictError('El alumno ya tiene un turno en ese horario', {
      code: 'ALUMNO_SUPERPUESTO',
      details,
    })

    expect(errorParaElAlumno(original)).toMatchObject({
      statusCode: 409,
      code: 'ALUMNO_SUPERPUESTO',
      message: MENSAJE_ALUMNO_SUPERPUESTO_PORTAL,
      details,
    })
  })

  it('BLOQUE_LLENO: el mismo mensaje y las mismas fechas, sin la capacidad efectiva', () => {
    const original = new ConflictError('Hay fechas sin lugar: …', {
      code: 'BLOQUE_LLENO',
      details: [{ bloqueId: 11, capacidadEfectiva: 6, fechas: ['2026-10-26'], sinLugar: false }],
    })

    expect(errorParaElAlumno(original)).toMatchObject({
      code: 'BLOQUE_LLENO',
      message: 'Hay fechas sin lugar: …',
      details: [{ bloqueId: 11, fechas: ['2026-10-26'], sinLugar: false }],
    })
    expect(JSON.stringify((errorParaElAlumno(original) as ConflictError).details)).not.toContain(
      'capacidadEfectiva',
    )
  })

  it('el resto de los errores pasa igual', () => {
    const errores = [
      new ValidationError('x'),
      new NotFoundError('y'),
      new ConflictError('z', { code: 'DEUDA_VENCIDA' }),
      new Error('no es AppError'),
    ]
    for (const error of errores) expect(errorParaElAlumno(error)).toBe(error)
  })
})

describe('disponibilidadParaElAlumno', () => {
  it('cada hora sólo dice si está disponible; suma el valor por clase y no trae cupos', () => {
    const [item] = disponibilidadParaElAlumno(ejemploDisponibilidad, 8000)

    expect(item?.valorPorClase).toBe(8000)
    expect(item?.horas.map((hora) => hora.disponible)).toEqual(
      ejemploDisponibilidad[0]?.horas.map((hora) => !hora.lleno),
    )
    expect(JSON.stringify(item)).not.toMatch(/capacidadEfectiva|ocupacion|lleno/)
  })
})

describe('resumenParaElAlumno', () => {
  it('materia, profesor, aula, día y tipo del alta, cada turno con su hora y fechas, sin auditoría ni observaciones', () => {
    const resumen = resumenParaElAlumno(ejemploAltaEnTramos)

    expect(resumen).toMatchObject({
      cantidad: ejemploAltaEnTramos.cantidad,
      tipo: 'RECURRENTE',
      fechasSinTurno: ejemploAltaEnTramos.fechasSinTurno,
    })
    expect(resumen.turnos).toHaveLength(ejemploAltaEnTramos.turnos.length)
    expect(JSON.stringify(resumen)).not.toMatch(/observaciones|createdBy|updatedBy|"dni"/)
  })
})
