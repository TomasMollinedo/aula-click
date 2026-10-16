import { describe, expect, it } from 'vitest'

import {
  FILTROS_FINANZAS_POR_DEFECTO,
  aParamsFinanzas,
  filtrosFinanzasConOrden,
  leerFiltrosFinanzas,
  paramsConFiltrosFinanzas,
} from '../filtros-finanzas'

// El estado de la tabla por profesor de "Finanzas" en la URL (HU-47, T-135): el único lugar que
// conoce `page`, `orden` y `direccion`. Lo que importa es que un valor que la API no acepta caiga
// en el por defecto (la URL nunca rompe la pantalla), que los valores por defecto no se escriban y
// que el resto de la URL (la sección y el período) sobreviva.

const leer = (qs: string) => leerFiltrosFinanzas(new URLSearchParams(qs))
const escribir = (qs: string, filtros: Parameters<typeof paramsConFiltrosFinanzas>[1]) =>
  paramsConFiltrosFinanzas(new URLSearchParams(qs), filtros).toString()

describe('leerFiltrosFinanzas', () => {
  it('sin parámetros, los mismos valores que toma la API', () => {
    expect(leer('')).toEqual({ page: 1, orden: 'totalCobrado', direccion: 'desc' })
  })

  it('lee la página, el orden y la dirección de la URL', () => {
    expect(leer('page=3&orden=parteCentro&direccion=asc')).toEqual({
      page: 3,
      orden: 'parteCentro',
      direccion: 'asc',
    })
  })

  it('una página que no es un entero >= 1 cae en la primera', () => {
    for (const qs of ['page=0', 'page=-2', 'page=1.5', 'page=dos', 'page=', 'page=1e3']) {
      expect(leer(qs).page).toBe(1)
    }
  })

  it('un orden o una dirección que no existen caen en el por defecto', () => {
    expect(leer('orden=margen&direccion=arriba')).toEqual(FILTROS_FINANZAS_POR_DEFECTO)
    // El orden de "Asistencia" no es un orden de "Finanzas".
    expect(leer('orden=cerradosSinRegistrar').orden).toBe('totalCobrado')
  })

  it('no mira los demás parámetros', () => {
    expect(leer('seccion=finanzas&periodo=mes&page=2').page).toBe(2)
  })
})

describe('paramsConFiltrosFinanzas', () => {
  it('los valores por defecto no se escriben', () => {
    expect(escribir('', FILTROS_FINANZAS_POR_DEFECTO)).toBe('')
    expect(escribir('page=4&orden=pagado&direccion=asc', FILTROS_FINANZAS_POR_DEFECTO)).toBe('')
  })

  it('los demás sí', () => {
    expect(escribir('', { page: 2, orden: 'saldoPendiente', direccion: 'asc' })).toBe(
      'page=2&orden=saldoPendiente&direccion=asc',
    )
  })

  it('conserva la sección y el período', () => {
    expect(
      escribir('seccion=finanzas&periodo=rango&desde=2026-09-01&hasta=2026-09-30', {
        ...FILTROS_FINANZAS_POR_DEFECTO,
        page: 2,
      }),
    ).toBe('seccion=finanzas&periodo=rango&desde=2026-09-01&hasta=2026-09-30&page=2')
  })

  it('no muta los parámetros que recibe', () => {
    const actuales = new URLSearchParams('page=3')
    paramsConFiltrosFinanzas(actuales, FILTROS_FINANZAS_POR_DEFECTO)
    expect(actuales.toString()).toBe('page=3')
  })
})

describe('filtrosFinanzasConOrden', () => {
  it('una columna nueva empieza por su dirección natural y vuelve a la primera página', () => {
    const filtros = { page: 4, orden: 'totalCobrado', direccion: 'desc' } as const
    // Los números, de mayor a menor.
    expect(filtrosFinanzasConOrden(filtros, 'parteCentro')).toEqual({
      page: 1,
      orden: 'parteCentro',
      direccion: 'desc',
    })
    // El nombre del profesor, de la A a la Z.
    expect(filtrosFinanzasConOrden(filtros, 'profesor')).toEqual({
      page: 1,
      orden: 'profesor',
      direccion: 'asc',
    })
  })

  it('la misma columna invierte la dirección', () => {
    const filtros = { page: 1, orden: 'pagado', direccion: 'desc' } as const
    const invertido = filtrosFinanzasConOrden(filtros, 'pagado')
    expect(invertido).toEqual({ page: 1, orden: 'pagado', direccion: 'asc' })
    expect(filtrosFinanzasConOrden(invertido, 'pagado').direccion).toBe('desc')
  })
})

describe('aParamsFinanzas', () => {
  it('el período que se ve más el estado de la tabla', () => {
    expect(
      aParamsFinanzas({ desde: '2026-10-01', hasta: '2026-10-31' }, FILTROS_FINANZAS_POR_DEFECTO),
    ).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      page: 1,
      orden: 'totalCobrado',
      direccion: 'desc',
    })
  })
})
