import { describe, expect, it } from 'vitest'

import {
  FILTROS_POR_DEFECTO,
  aParamsAsistencia,
  filtrosConOrden,
  leerFiltrosAsistencia,
  paramsConFiltrosAsistencia,
  type FiltrosAsistencia,
} from '../filtros-asistencia'

// El estado de las dos tablas de "Asistencia" en la URL (HU-39, T-113): el único lugar que conoce
// esos parámetros. Un valor inválido cae en el por defecto (la URL no rompe la pantalla) y lo que
// se escribe es sólo lo que no es por defecto.

const leer = (qs: string) => leerFiltrosAsistencia(new URLSearchParams(qs))
const escribir = (qs: string, filtros: FiltrosAsistencia) =>
  paramsConFiltrosAsistencia(new URLSearchParams(qs), filtros).toString()

describe('leerFiltrosAsistencia', () => {
  it('sin parámetros, los mismos valores por defecto que la API', () => {
    expect(leer('')).toEqual({
      paginaProfesores: 1,
      paginaMaterias: 1,
      orden: 'cerradosSinRegistrar',
      direccion: 'desc',
      soloSinRegistrar: false,
    })
  })

  it('cada tabla tiene su página', () => {
    expect(leer('paginaProfesores=3&paginaMaterias=2')).toMatchObject({
      paginaProfesores: 3,
      paginaMaterias: 2,
    })
  })

  it('una página que no es un entero >= 1 cae en 1', () => {
    for (const qs of [
      'paginaProfesores=0',
      'paginaProfesores=-2',
      'paginaProfesores=abc',
      'paginaProfesores=1.5',
      'paginaProfesores=',
    ]) {
      expect(leer(qs).paginaProfesores).toBe(1)
    }
  })

  it('el orden y la dirección de la API', () => {
    expect(leer('orden=porcentajeAsistencia&direccion=asc')).toMatchObject({
      orden: 'porcentajeAsistencia',
      direccion: 'asc',
    })
  })

  it('un orden o una dirección que no existen caen en el por defecto', () => {
    expect(leer('orden=alumno&direccion=arriba')).toMatchObject({
      orden: 'cerradosSinRegistrar',
      direccion: 'desc',
    })
  })

  it('`soloSinRegistrar` sólo es verdadero con "true"', () => {
    expect(leer('soloSinRegistrar=true').soloSinRegistrar).toBe(true)
    expect(leer('soloSinRegistrar=1').soloSinRegistrar).toBe(false)
    expect(leer('soloSinRegistrar=false').soloSinRegistrar).toBe(false)
    expect(leer('').soloSinRegistrar).toBe(false)
  })
})

describe('paramsConFiltrosAsistencia', () => {
  it('los valores por defecto no se escriben', () => {
    expect(escribir('', FILTROS_POR_DEFECTO)).toBe('')
    expect(
      escribir('paginaProfesores=4&orden=ausencias&soloSinRegistrar=true', FILTROS_POR_DEFECTO),
    ).toBe('')
  })

  it('escribe sólo lo que cambió, y conserva el resto de la URL', () => {
    expect(
      escribir('seccion=asistencia&periodo=mes', {
        ...FILTROS_POR_DEFECTO,
        paginaProfesores: 2,
        orden: 'ausencias',
        direccion: 'asc',
        soloSinRegistrar: true,
      }),
    ).toBe(
      'seccion=asistencia&periodo=mes&paginaProfesores=2&orden=ausencias&direccion=asc&soloSinRegistrar=true',
    )
  })

  it('cambiar una página no mueve la otra', () => {
    const conMaterias = { ...FILTROS_POR_DEFECTO, paginaMaterias: 3 }
    expect(escribir('', { ...conMaterias, paginaProfesores: 2 })).toBe(
      'paginaProfesores=2&paginaMaterias=3',
    )
  })

  it('no muta los parámetros que recibe', () => {
    const actuales = new URLSearchParams('periodo=mes')
    paramsConFiltrosAsistencia(actuales, { ...FILTROS_POR_DEFECTO, paginaMaterias: 2 })
    expect(actuales.toString()).toBe('periodo=mes')
  })
})

describe('filtrosConOrden', () => {
  it('una columna nueva ordena de mayor a menor, y el profesor de la A a la Z', () => {
    expect(filtrosConOrden(FILTROS_POR_DEFECTO, 'ausencias')).toMatchObject({
      orden: 'ausencias',
      direccion: 'desc',
    })
    expect(filtrosConOrden(FILTROS_POR_DEFECTO, 'profesor')).toMatchObject({
      orden: 'profesor',
      direccion: 'asc',
    })
  })

  it('la misma columna invierte la dirección', () => {
    const porAusencias = filtrosConOrden(FILTROS_POR_DEFECTO, 'ausencias')
    expect(filtrosConOrden(porAusencias, 'ausencias').direccion).toBe('asc')
    expect(filtrosConOrden({ ...porAusencias, direccion: 'asc' }, 'ausencias').direccion).toBe(
      'desc',
    )
  })

  it('vuelve a la primera página de profesores y no toca la de materias', () => {
    const resultado = filtrosConOrden(
      { ...FILTROS_POR_DEFECTO, paginaProfesores: 4, paginaMaterias: 3 },
      'ausencias',
    )
    expect(resultado.paginaProfesores).toBe(1)
    expect(resultado.paginaMaterias).toBe(3)
  })

  it('conserva el filtro de sin registrar', () => {
    const conFiltro = { ...FILTROS_POR_DEFECTO, soloSinRegistrar: true }
    expect(filtrosConOrden(conFiltro, 'dentroDelPlazo').soloSinRegistrar).toBe(true)
  })
})

describe('aParamsAsistencia', () => {
  it('el período que se ve más el estado de las tablas', () => {
    expect(
      aParamsAsistencia({ desde: '2026-09-28', hasta: '2026-10-04' }, FILTROS_POR_DEFECTO),
    ).toEqual({
      desde: '2026-09-28',
      hasta: '2026-10-04',
      paginaProfesores: 1,
      paginaMaterias: 1,
      orden: 'cerradosSinRegistrar',
      direccion: 'desc',
      soloSinRegistrar: false,
    })
  })
})
