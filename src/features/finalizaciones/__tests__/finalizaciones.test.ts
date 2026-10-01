import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'
import { formatearPesos } from '@/utils/moneda'

import { interpretarErrorFinalizacion } from '../errores-api'
import {
  DETALLE_MAX,
  MENSAJE_DETALLE_OBLIGATORIO,
  MENSAJE_FECHA_OBLIGATORIA,
  detalleParaEnviar,
  esFechaConFormato,
  finalizacionFormSchema,
} from '../finalizaciones.schema'
import type { TurnoPagado } from '../finalizaciones.types'
import {
  avisoOtrosTramos,
  avisoPagados,
  lineaPagado,
  mensajeFinalizado,
  resumenPrevia,
  resumenTurno,
  textoTramo,
  textoUsarFecha,
} from '../formato-finalizaciones'

const pagado: TurnoPagado = {
  fecha: '2026-11-16',
  horaInicio: '09:00',
  horaFin: '10:00',
  importe: 7500,
}

describe('finalizacionFormSchema', () => {
  const valido = { fechaDesde: '2026-10-19', motivo: 'CANCELACION_ALUMNO', detalle: '' }

  it('acepta fecha y motivo, sin detalle', () => {
    expect(finalizacionFormSchema.safeParse(valido).success).toBe(true)
  })

  it('sin fecha pide elegirla', () => {
    const res = finalizacionFormSchema.safeParse({ ...valido, fechaDesde: '' })
    expect(res.error?.issues[0]).toMatchObject({
      path: ['fechaDesde'],
      message: MENSAJE_FECHA_OBLIGATORIA,
    })
  })

  it.each(['19/10/2026', '2026-10-1', '2026-02-30'])('rechaza la fecha %j', (fechaDesde) => {
    const res = finalizacionFormSchema.safeParse({ ...valido, fechaDesde })
    expect(res.error?.issues[0]?.path).toEqual(['fechaDesde'])
    expect(esFechaConFormato(fechaDesde)).toBe(false)
  })

  it('esFechaConFormato: solo una fecha completa habilita la previa', () => {
    expect(esFechaConFormato('2026-10-19')).toBe(true)
    expect(esFechaConFormato('')).toBe(false)
    expect(esFechaConFormato(undefined)).toBe(false)
  })

  it('sin motivo pide elegirlo', () => {
    const res = finalizacionFormSchema.safeParse({ ...valido, motivo: '' })
    expect(res.error?.issues[0]).toMatchObject({ path: ['motivo'], message: 'Elegí un motivo' })
  })

  it.each(['', '   '])('"Otro" con detalle %j exige el detalle', (detalle) => {
    const res = finalizacionFormSchema.safeParse({ ...valido, motivo: 'OTRO', detalle })
    expect(res.error?.issues).toEqual([
      expect.objectContaining({ path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO }),
    ])
  })

  it('"Otro" con detalle es válido', () => {
    expect(
      finalizacionFormSchema.safeParse({ ...valido, motivo: 'OTRO', detalle: 'Se muda' }).success,
    ).toBe(true)
  })

  it('el detalle admite 500 caracteres y no 501', () => {
    const con = (n: number) =>
      finalizacionFormSchema.safeParse({ ...valido, detalle: 'x'.repeat(n) })
    expect(con(DETALLE_MAX).success).toBe(true)
    expect(con(DETALLE_MAX + 1).success).toBe(false)
  })

  it('detalleParaEnviar recorta y omite el vacío', () => {
    expect(detalleParaEnviar('  Se muda ')).toBe('Se muda')
    expect(detalleParaEnviar('   ')).toBeUndefined()
  })
})

describe('interpretarErrorFinalizacion', () => {
  it('400: marca la fecha con el mensaje de la API', () => {
    const mensaje =
      'Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno.'
    const error = new ApiError(400, 'VALIDACION', mensaje, [
      { path: ['fechaDesde'], message: mensaje },
    ])
    expect(interpretarErrorFinalizacion(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [{ campo: 'fechaDesde', mensaje }],
      mensaje: null,
    })
  })

  it('400: marca el detalle y deja lo que no es de un campo como mensaje general', () => {
    const error = new ApiError(400, 'VALIDACION', 'Datos inválidos', [
      { path: ['detalle'], message: 'El detalle es obligatorio cuando el motivo es "Otro"' },
      { path: ['turnoId'], message: 'Turno inválido' },
    ])
    expect(interpretarErrorFinalizacion(error)).toEqual({
      tipo: 'campos',
      camposMarcados: [
        { campo: 'detalle', mensaje: 'El detalle es obligatorio cuando el motivo es "Otro"' },
      ],
      mensaje: 'Turno inválido',
    })
  })

  it('400 sin details: el mensaje de la API como general', () => {
    expect(
      interpretarErrorFinalizacion(new ApiError(400, 'VALIDACION', 'Datos inválidos')),
    ).toEqual({ tipo: 'campos', camposMarcados: [], mensaje: 'Datos inválidos' })
  })

  it('409 TURNOS_PAGADOS con una fecha posible', () => {
    const error = new ApiError(409, 'TURNOS_PAGADOS', 'Hay turnos pagados desde esa fecha', {
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
      pagadas: [pagado],
    })
    expect(interpretarErrorFinalizacion(error)).toEqual({
      tipo: 'pagados',
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
      pagadas: [pagado],
    })
  })

  it('409 TURNOS_PAGADOS hasta el final de la serie: sin fecha para elegir', () => {
    const error = new ApiError(409, 'TURNOS_PAGADOS', 'Los turnos pagados llegan hasta el final', {
      ultimaFechaPagada: '2026-11-30',
      fechaDesdeMinima: null,
      pagadas: [{ ...pagado, fecha: '2026-11-30' }],
    })
    expect(interpretarErrorFinalizacion(error)).toMatchObject({
      tipo: 'pagados',
      ultimaFechaPagada: '2026-11-30',
      fechaDesdeMinima: null,
    })
  })

  it.each([
    undefined,
    [{ path: ['fechaDesde'], message: 'x' }],
    { ultimaFechaPagada: '2026-11-16', fechaDesdeMinima: '2026-11-23' },
    { ultimaFechaPagada: null, fechaDesdeMinima: null, pagadas: [] },
    { ultimaFechaPagada: '2026-11-16', fechaDesdeMinima: null, pagadas: [{ fecha: '2026-11-16' }] },
  ])('409 TURNOS_PAGADOS con details %j cae al mensaje general', (details) => {
    const error = new ApiError(409, 'TURNOS_PAGADOS', 'Hay turnos pagados desde esa fecha', details)
    expect(interpretarErrorFinalizacion(error)).toEqual({
      tipo: 'general',
      mensaje: 'Hay turnos pagados desde esa fecha',
      definitivo: false,
    })
  })

  it('409 CONFLICTO y 404: el mensaje de la API, sin dejar confirmar', () => {
    expect(
      interpretarErrorFinalizacion(new ApiError(409, 'CONFLICTO', 'El turno ya fue finalizado')),
    ).toEqual({ tipo: 'general', mensaje: 'El turno ya fue finalizado', definitivo: true })
    expect(
      interpretarErrorFinalizacion(new ApiError(404, 'NO_ENCONTRADO', 'Turno no encontrado')),
    ).toEqual({ tipo: 'general', mensaje: 'Turno no encontrado', definitivo: true })
  })

  it('403: sin permiso', () => {
    expect(interpretarErrorFinalizacion(new ApiError(403, 'SIN_PERMISO', 'x'))).toEqual({
      tipo: 'general',
      mensaje: 'No tenés permiso para finalizar turnos',
      definitivo: true,
    })
  })

  it('cualquier otro error: mensaje general que se puede reintentar', () => {
    expect(interpretarErrorFinalizacion(new ApiError(500, 'ERROR_INTERNO', 'Falló'))).toEqual({
      tipo: 'general',
      mensaje: 'Falló',
      definitivo: false,
    })
  })
})

describe('formato', () => {
  it('el resumen del turno lleva materia, alumno, día y horario', () => {
    expect(
      resumenTurno({
        fecha: '2026-10-19',
        horaInicio: '09:00',
        horaFin: '10:00',
        materia: { nombre: 'Matemática' },
        alumno: { nombre: 'Lucía', apellido: 'González' },
      }),
    ).toBe('Matemática de Lucía González, los lunes de 9:00 a 10:00')
  })

  it('resumen de una serie con fin', () => {
    expect(resumenPrevia({ cantidad: 7, desde: '2026-10-19', hasta: '2026-11-30' })).toBe(
      'Se liberan 7 turnos, del 19/10 al 30/11',
    )
  })

  it('resumen de un solo turno', () => {
    expect(resumenPrevia({ cantidad: 1, desde: '2026-10-19', hasta: '2026-10-19' })).toBe(
      'Se libera 1 turno, el 19/10',
    )
    // Queda uno sin cancelar en un rango de varias fechas: no se sabe cuál, se dice el rango.
    expect(resumenPrevia({ cantidad: 1, desde: '2026-10-19', hasta: '2026-11-30' })).toBe(
      'Se libera 1 turno, del 19/10 al 30/11',
    )
  })

  it('resumen de una serie sin fin', () => {
    expect(resumenPrevia({ cantidad: null, desde: '2026-10-19', hasta: null })).toBe(
      'Se liberan todos los turnos desde el 19/10',
    )
  })

  it('resumen sin turnos por liberar (las fechas restantes ya estaban canceladas)', () => {
    expect(resumenPrevia({ cantidad: 0, desde: '2026-10-19', hasta: '2026-11-30' })).toBe(
      'No se libera ningún turno: los del 19/10 al 30/11 ya están cancelados. La serie termina igual desde el 19/10',
    )
    expect(resumenPrevia({ cantidad: 0, desde: '2026-10-19', hasta: '2026-10-19' })).toBe(
      'No se libera ningún turno: el del 19/10 ya está cancelado. La serie termina igual desde el 19/10',
    )
  })

  it('la línea de un pagado: fecha con día, horario e importe en pesos', () => {
    expect(lineaPagado(pagado)).toBe(`lunes 16/11 de 9:00 a 10:00 · ${formatearPesos(7500)}`)
    expect(lineaPagado(pagado)).toMatch(/\$\s7\.500,00$/)
  })

  it('aviso de pagados con una fecha posible', () => {
    expect(avisoPagados({ ultimaFechaPagada: '2026-11-16', fechaDesdeMinima: '2026-11-23' })).toBe(
      'Elegí una fecha posterior al último turno pagado (16/11)',
    )
    expect(textoUsarFecha('2026-11-23')).toBe('Usar el 23/11')
  })

  it('aviso de pagados que llegan hasta el final de la serie', () => {
    expect(avisoPagados({ ultimaFechaPagada: '2026-11-30', fechaDesdeMinima: null })).toBe(
      'Los turnos pagados llegan hasta el final de la serie (30/11): no se puede finalizar',
    )
  })

  it('un tramo posterior, con y sin fin', () => {
    expect(textoTramo({ turnoId: 58, fechaInicio: '2026-12-14', fechaFin: '2026-12-28' })).toBe(
      'del 14/12 al 28/12',
    )
    expect(textoTramo({ turnoId: 58, fechaInicio: '2026-12-14', fechaFin: null })).toBe(
      'desde el 14/12, sin fecha de fin',
    )
  })

  it('aviso de tramos posteriores, uno o varios', () => {
    expect(avisoOtrosTramos([{ turnoId: 58, fechaInicio: '2026-12-14', fechaFin: null }])).toBe(
      'El alumno tiene otro tramo posterior de la misma hora y materia (desde el 14/12, sin fecha de fin). No se finaliza con este: se finaliza desde su propio detalle.',
    )
    expect(
      avisoOtrosTramos([
        { turnoId: 58, fechaInicio: '2026-12-07', fechaFin: '2026-12-14' },
        { turnoId: 59, fechaInicio: '2026-12-28', fechaFin: null },
      ]),
    ).toBe(
      'El alumno tiene 2 tramos posteriores de la misma hora y materia (del 07/12 al 14/12; desde el 28/12, sin fecha de fin). No se finalizan con este: cada uno se finaliza desde su propio detalle.',
    )
  })

  it('el toast de éxito, con lo que devuelve el 201', () => {
    expect(mensajeFinalizado({ cantidad: 7, desde: '2026-10-19' })).toBe(
      'Turno finalizado desde el 19/10. Se liberaron 7 turnos.',
    )
    expect(mensajeFinalizado({ cantidad: 1, desde: '2026-10-19' })).toBe(
      'Turno finalizado desde el 19/10. Se liberó 1 turno.',
    )
    expect(mensajeFinalizado({ cantidad: 0, desde: '2026-10-19' })).toBe(
      'Turno finalizado desde el 19/10.',
    )
    expect(mensajeFinalizado({ cantidad: null, desde: '2026-10-19' })).toBe(
      'Turno finalizado desde el 19/10. Los lugares quedaron disponibles.',
    )
  })
})

describe('definición D de las PO', () => {
  // Los turnos pagados sólo se informan: la feature no ofrece ni nombra deshacer un pago. Se revisa
  // el código entero (textos, nombres y comentarios), salvo este archivo.
  const raiz = fileURLToPath(new URL('..', import.meta.url))
  const archivos = (readdirSync(raiz, { recursive: true }) as string[])
    .filter((ruta) => /\.tsx?$/.test(ruta) && !ruta.includes('__tests__'))
    .map((ruta) => join(raiz, ruta))

  it('encuentra los archivos de la feature', () => {
    expect(archivos.length).toBeGreaterThan(8)
  })

  it.each(archivos)('%s no menciona deshacer pagos', (archivo) => {
    expect(readFileSync(archivo, 'utf8')).not.toMatch(new RegExp('anul', 'i'))
  })
})
