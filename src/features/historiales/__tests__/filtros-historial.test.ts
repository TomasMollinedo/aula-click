import { describe, expect, it } from 'vitest'

import {
  ANIOS_OFRECIDOS,
  MESES_DEL_ANIO,
  type PeriodoHistorial,
  aParams,
  anioDe,
  aniosOfrecidos,
  esMesFuturo,
  etiquetaNumeroMes,
  hayFiltros,
  leerFiltros,
  mesDe,
  mesDeAnioYNumero,
  numeroDeMes,
  paramsConFiltros,
  paramsSinFiltros,
  periodoConMes,
  periodoConMesYAnio,
  periodoConRango,
  periodoDeOpcion,
  periodoPorDefecto,
  rangoDelMes,
} from '../filtros-historial'

// Los filtros del historial académico en la URL (T-109): el único lugar que conoce los nombres de
// los parámetros. "Hoy" se recibe: ninguna función usa el reloj. El período no se valida acá (un
// `hasta` anterior al `desde` se manda y lo rechaza la API, decisión T-147).

// Jueves 15/10/2026.
const HOY = '2026-10-15'

const leer = (qs: string) => leerFiltros(new URLSearchParams(qs), HOY)
const escribir = (qs: string, filtros: Parameters<typeof paramsConFiltros>[1]) =>
  paramsConFiltros(new URLSearchParams(qs), filtros, HOY).toString()

const MES_EN_CURSO = {
  opcion: 'mes',
  mes: '2026-10',
  desde: '2026-10-01',
  hasta: '2026-10-31',
} satisfies PeriodoHistorial

describe('rangoDelMes y mesDe', () => {
  it('el primero y el último día del mes, también en febrero bisiesto', () => {
    expect(rangoDelMes('2026-10')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(rangoDelMes('2026-11')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    expect(rangoDelMes('2024-02')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' })
    expect(rangoDelMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoDelMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })

  it('el mes de una fecha', () => {
    expect(mesDe('2026-10-15')).toBe('2026-10')
  })
})

describe('periodoPorDefecto', () => {
  it('el mes en curso completo', () => {
    expect(periodoPorDefecto(HOY)).toEqual(MES_EN_CURSO)
  })
})

describe('leerFiltros', () => {
  it('sin parámetros: el mes en curso y sin materia ni profesor', () => {
    expect(leer('')).toEqual({ periodo: MES_EN_CURSO, materiaId: null, profesorId: null })
  })

  it('un mes de la URL, con su rango', () => {
    expect(leer('mes=2026-09').periodo).toEqual({
      opcion: 'mes',
      mes: '2026-09',
      desde: '2026-09-01',
      hasta: '2026-09-30',
    })
  })

  it('un rango con las dos fechas reales; el mes acompaña al `desde`', () => {
    expect(leer('desde=2026-08-10&hasta=2026-09-05').periodo).toEqual({
      opcion: 'rango',
      mes: '2026-08',
      desde: '2026-08-10',
      hasta: '2026-09-05',
    })
  })

  it('un rango invertido no se corrige: lo rechaza la API', () => {
    expect(leer('desde=2026-09-30&hasta=2026-09-01').periodo).toMatchObject({
      opcion: 'rango',
      desde: '2026-09-30',
      hasta: '2026-09-01',
    })
  })

  it('el rango necesita las dos fechas: con una sola cae en el mes en curso', () => {
    expect(leer('desde=2026-08-10').periodo).toEqual(MES_EN_CURSO)
    expect(leer('hasta=2026-08-10').periodo).toEqual(MES_EN_CURSO)
  })

  it('un mes o una fecha que no existen caen en el mes en curso', () => {
    expect(leer('mes=2026-13').periodo).toEqual(MES_EN_CURSO)
    expect(leer('mes=octubre').periodo).toEqual(MES_EN_CURSO)
    expect(leer('mes=2026-10-01').periodo).toEqual(MES_EN_CURSO)
    expect(leer('desde=2026-02-30&hasta=2026-03-01').periodo).toEqual(MES_EN_CURSO)
    expect(leer('desde=30/09/2026&hasta=2026-10-01').periodo).toEqual(MES_EN_CURSO)
  })

  it('el rango gana sobre el mes si vienen los dos', () => {
    expect(leer('mes=2026-09&desde=2026-08-01&hasta=2026-08-31').periodo).toMatchObject({
      opcion: 'rango',
      desde: '2026-08-01',
    })
  })

  it('materia y profesor: enteros positivos; cualquier otra cosa es sin filtro', () => {
    expect(leer('materiaId=3&profesorId=4')).toMatchObject({ materiaId: 3, profesorId: 4 })
    for (const qs of ['materiaId=0', 'materiaId=-2', 'materiaId=abc', 'materiaId=1.5']) {
      expect(leer(qs).materiaId).toBeNull()
    }
  })

  it('un parámetro ajeno (el tab o el detalle del turno) no molesta', () => {
    expect(leer('tab=historial&detalle=31&fecha=2026-10-13')).toEqual({
      periodo: MES_EN_CURSO,
      materiaId: null,
      profesorId: null,
    })
  })
})

describe('paramsConFiltros', () => {
  it('el mes en curso no se escribe: es el valor por defecto', () => {
    expect(escribir('', { periodo: MES_EN_CURSO, materiaId: null, profesorId: null })).toBe('')
  })

  it('otro mes se escribe en `mes`, sin `desde` ni `hasta`', () => {
    expect(
      escribir('', { periodo: periodoConMes('2026-09'), materiaId: null, profesorId: null }),
    ).toBe('mes=2026-09')
  })

  it('un rango se escribe con las dos fechas, sin `mes`', () => {
    const periodo = periodoConRango(MES_EN_CURSO, { desde: '2026-08-01', hasta: '2026-08-31' })
    expect(escribir('', { periodo, materiaId: null, profesorId: null })).toBe(
      'desde=2026-08-01&hasta=2026-08-31',
    )
  })

  it('un filtro vacío no se escribe y los puestos sí', () => {
    expect(escribir('', { periodo: MES_EN_CURSO, materiaId: 3, profesorId: null })).toBe(
      'materiaId=3',
    )
    expect(escribir('', { periodo: MES_EN_CURSO, materiaId: 3, profesorId: 4 })).toBe(
      'materiaId=3&profesorId=4',
    )
  })

  it('los demás parámetros se conservan y los del período anterior se limpian', () => {
    const qs = escribir('tab=historial&mes=2026-07&materiaId=9', {
      periodo: periodoConRango(MES_EN_CURSO, { desde: '2026-08-01', hasta: '2026-08-31' }),
      materiaId: null,
      profesorId: null,
    })
    const params = new URLSearchParams(qs)
    expect(params.get('tab')).toBe('historial')
    expect(params.get('mes')).toBeNull()
    expect(params.get('materiaId')).toBeNull()
    expect(params.get('desde')).toBe('2026-08-01')
  })

  it('no muta los parámetros que recibe', () => {
    const actuales = new URLSearchParams('tab=historial')
    paramsConFiltros(
      actuales,
      { periodo: periodoConMes('2026-09'), materiaId: 3, profesorId: null },
      HOY,
    )
    expect(actuales.toString()).toBe('tab=historial')
  })

  it('ida y vuelta: lo que se escribe es lo que se lee', () => {
    const filtros = {
      periodo: periodoConRango(MES_EN_CURSO, { desde: '2026-08-10', hasta: '2026-09-05' }),
      materiaId: 3,
      profesorId: 4,
    }
    expect(leer(escribir('', filtros))).toEqual(filtros)
  })
})

describe('paramsSinFiltros', () => {
  it('vuelve al mes en curso y saca materia y profesor; conserva el resto', () => {
    const qs = paramsSinFiltros(
      new URLSearchParams('tab=historial&mes=2026-07&materiaId=3&profesorId=4'),
      HOY,
    ).toString()
    expect(qs).toBe('tab=historial')
  })
})

describe('hayFiltros', () => {
  it('el mes en curso sin materia ni profesor no es un filtro', () => {
    expect(hayFiltros({ periodo: MES_EN_CURSO, materiaId: null, profesorId: null }, HOY)).toBe(
      false,
    )
  })

  it('otro mes, un rango, una materia o un profesor sí', () => {
    expect(
      hayFiltros({ periodo: periodoConMes('2026-09'), materiaId: null, profesorId: null }, HOY),
    ).toBe(true)
    expect(
      hayFiltros(
        { periodo: periodoConRango(MES_EN_CURSO, {}), materiaId: null, profesorId: null },
        HOY,
      ),
    ).toBe(true)
    expect(hayFiltros({ periodo: MES_EN_CURSO, materiaId: 3, profesorId: null }, HOY)).toBe(true)
    expect(hayFiltros({ periodo: MES_EN_CURSO, materiaId: null, profesorId: 4 }, HOY)).toBe(true)
  })
})

describe('periodoDeOpcion', () => {
  it('pasar a rango deja las fechas que se estaban viendo', () => {
    expect(periodoDeOpcion('rango', MES_EN_CURSO)).toEqual({
      opcion: 'rango',
      mes: '2026-10',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    })
  })

  it('volver a mes cae en el mes del `desde`, con su rango completo', () => {
    const rango = {
      opcion: 'rango' as const,
      mes: '2026-08',
      desde: '2026-08-10',
      hasta: '2026-09-05',
    }
    expect(periodoDeOpcion('mes', rango)).toEqual({
      opcion: 'mes',
      mes: '2026-08',
      desde: '2026-08-01',
      hasta: '2026-08-31',
    })
  })
})

describe('periodoConRango', () => {
  it('cambiar un extremo conserva el otro, y el mes sigue al `desde`', () => {
    expect(periodoConRango(MES_EN_CURSO, { desde: '2026-07-20' })).toEqual({
      opcion: 'rango',
      mes: '2026-07',
      desde: '2026-07-20',
      hasta: '2026-10-31',
    })
    expect(periodoConRango(MES_EN_CURSO, { hasta: '2026-11-30' })).toEqual({
      opcion: 'rango',
      mes: '2026-10',
      desde: '2026-10-01',
      hasta: '2026-11-30',
    })
  })
})

describe('los dos selectores del mes', () => {
  it('el mes y el año de un `YYYY-MM`, y el `YYYY-MM` que forman', () => {
    expect(numeroDeMes('2026-09')).toBe(9)
    expect(anioDe('2026-09')).toBe(2026)
    expect(mesDeAnioYNumero(2026, 9)).toBe('2026-09')
    expect(mesDeAnioYNumero(2026, 12)).toBe('2026-12')
  })

  it('los doce meses del año, en orden', () => {
    expect(MESES_DEL_ANIO).toHaveLength(12)
    expect(MESES_DEL_ANIO[0]).toBe(1)
    expect(MESES_DEL_ANIO.at(-1)).toBe(12)
  })

  it('el nombre del mes en español, sin el año', () => {
    expect(etiquetaNumeroMes(1)).toBe('enero')
    expect(etiquetaNumeroMes(10)).toBe('octubre')
    expect(etiquetaNumeroMes(12)).toBe('diciembre')
  })

  it('el año de hoy y los anteriores, del más reciente al más antiguo', () => {
    const anios = aniosOfrecidos(HOY)
    expect(anios).toHaveLength(ANIOS_OFRECIDOS)
    expect(anios[0]).toBe(2026)
    expect(anios.at(-1)).toBe(2024)
  })

  it('un año elegido que quedó fuera de la lista se agrega, en orden', () => {
    expect(aniosOfrecidos(HOY, '2020-03')).toEqual([2026, 2025, 2024, 2020])
  })

  it('un año elegido que ya está en la lista no se repite', () => {
    expect(aniosOfrecidos(HOY, '2025-09')).toHaveLength(ANIOS_OFRECIDOS)
  })

  it('un mes posterior al de hoy es futuro; el de hoy y los anteriores, no', () => {
    expect(esMesFuturo('2026-11', HOY)).toBe(true)
    expect(esMesFuturo('2027-01', HOY)).toBe(true)
    expect(esMesFuturo('2026-10', HOY)).toBe(false)
    expect(esMesFuturo('2026-09', HOY)).toBe(false)
  })
})

describe('periodoConMesYAnio', () => {
  const SEPTIEMBRE = periodoConMes('2026-09')

  it('cambiar el mes conserva el año', () => {
    expect(periodoConMesYAnio(SEPTIEMBRE, { numero: 3 }, HOY)).toEqual({
      opcion: 'mes',
      mes: '2026-03',
      desde: '2026-03-01',
      hasta: '2026-03-31',
    })
  })

  it('cambiar el año conserva el mes', () => {
    expect(periodoConMesYAnio(SEPTIEMBRE, { anio: 2024 }, HOY)).toEqual({
      opcion: 'mes',
      mes: '2024-09',
      desde: '2024-09-01',
      hasta: '2024-09-30',
    })
  })

  it('una combinación posterior al mes en curso se recorta al mes en curso', () => {
    expect(periodoConMesYAnio(periodoConMes('2025-12'), { anio: 2026 }, HOY).mes).toBe('2026-10')
    expect(periodoConMesYAnio(SEPTIEMBRE, { numero: 12 }, HOY).mes).toBe('2026-10')
  })

  it('vuelve a la opción "mes" si se venía de un rango', () => {
    const rango: PeriodoHistorial = {
      opcion: 'rango',
      mes: '2026-08',
      desde: '2026-08-10',
      hasta: '2026-09-20',
    }
    expect(periodoConMesYAnio(rango, { numero: 8 }, HOY)).toEqual({
      opcion: 'mes',
      mes: '2026-08',
      desde: '2026-08-01',
      hasta: '2026-08-31',
    })
  })
})

describe('aParams', () => {
  it('el período siempre; los filtros vacíos no se mandan', () => {
    expect(aParams({ periodo: MES_EN_CURSO, materiaId: null, profesorId: null })).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
    })
  })

  it('con materia y profesor', () => {
    expect(aParams({ periodo: MES_EN_CURSO, materiaId: 3, profesorId: 4 })).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      materiaId: 3,
      profesorId: 4,
    })
  })

  it('manda el rango tal como está, aunque esté invertido', () => {
    const periodo = periodoConRango(MES_EN_CURSO, { desde: '2026-09-30', hasta: '2026-09-01' })
    expect(aParams({ periodo, materiaId: null, profesorId: null })).toEqual({
      desde: '2026-09-30',
      hasta: '2026-09-01',
    })
  })
})
