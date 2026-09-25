import { describe, expect, it } from 'vitest'
import { agruparMateriasPorAlumno } from '../materias-por-alumno'

describe('agruparMateriasPorAlumno', () => {
  it('agrupa las materias de cada alumno', () => {
    const resultado = agruparMateriasPorAlumno([
      { alumnoId: 1, materia: { id: 2, nombre: 'Matemática' } },
      { alumnoId: 1, materia: { id: 7, nombre: 'Física' } },
      { alumnoId: 2, materia: { id: 2, nombre: 'Matemática' } },
    ])

    expect(resultado.get(1)).toEqual([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])
    expect(resultado.get(2)).toEqual([{ id: 2, nombre: 'Matemática' }])
  })

  it('no repite una materia aunque el alumno tenga varios turnos vigentes de ella', () => {
    const resultado = agruparMateriasPorAlumno([
      { alumnoId: 1, materia: { id: 2, nombre: 'Matemática' } },
      { alumnoId: 1, materia: { id: 2, nombre: 'Matemática' } },
    ])

    expect(resultado.get(1)).toEqual([{ id: 2, nombre: 'Matemática' }])
  })

  it('sin turnos, no hay ningún alumno en el mapa', () => {
    expect(agruparMateriasPorAlumno([]).size).toBe(0)
  })

  it('conserva el orden de llegada (la consulta ya ordena por nombre de materia)', () => {
    const resultado = agruparMateriasPorAlumno([
      { alumnoId: 1, materia: { id: 7, nombre: 'Física' } },
      { alumnoId: 1, materia: { id: 2, nombre: 'Matemática' } },
    ])

    expect(resultado.get(1)?.map((materia) => materia.nombre)).toEqual(['Física', 'Matemática'])
  })
})
