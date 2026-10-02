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
import type { OtraHora, PreviaFinalizacion, TurnoPagado } from '../finalizaciones.types'
import {
  avisoOtrasHoras,
  avisoPagados,
  lineaPagado,
  mensajeFinalizado,
  resumenPrevia,
  resumenTurno,
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

  it('409 TURNOS_PAGADOS con pagados de varios tramos de la hora: la lista llega entera', () => {
    // Finalizar actúa sobre todos los tramos de la hora: los pagados pueden ser de tramos distintos.
    const pagadas = [
      { ...pagado, fecha: '2026-10-19' },
      { ...pagado, fecha: '2026-11-16' },
    ]
    const error = new ApiError(409, 'TURNOS_PAGADOS', 'Hay turnos pagados desde esa fecha', {
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
      pagadas,
    })
    expect(interpretarErrorFinalizacion(error)).toEqual({
      tipo: 'pagados',
      ultimaFechaPagada: '2026-11-16',
      fechaDesdeMinima: '2026-11-23',
      pagadas,
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

  const hora = (horaInicio: string, horaFin: string, turnoId = 42): OtraHora => ({
    turnoId,
    fecha: '2026-10-19',
    horaInicio,
    horaFin,
  })

  it('aviso de otra hora de la clase, que sigue agendada', () => {
    expect(avisoOtrasHoras([hora('10:00', '11:00')])).toBe(
      'Esta clase también tiene la hora de 10:00 a 11:00, que sigue agendada: finalizala desde su detalle',
    )
    // Como el resto de la pantalla, sin el cero adelante de la hora.
    expect(avisoOtrasHoras([hora('08:00', '09:00')])).toBe(
      'Esta clase también tiene la hora de 8:00 a 9:00, que sigue agendada: finalizala desde su detalle',
    )
  })

  it('aviso de varias otras horas, en plural', () => {
    expect(avisoOtrasHoras([hora('10:00', '11:00'), hora('11:00', '12:00', 43)])).toBe(
      'Esta clase también tiene las horas de 10:00 a 11:00 y de 11:00 a 12:00, que siguen agendadas: finalizalas desde su detalle',
    )
    expect(
      avisoOtrasHoras([
        hora('10:00', '11:00'),
        hora('11:00', '12:00', 43),
        hora('12:00', '13:00', 44),
      ]),
    ).toBe(
      'Esta clase también tiene las horas de 10:00 a 11:00, de 11:00 a 12:00 y de 12:00 a 13:00, que siguen agendadas: finalizalas desde su detalle',
    )
  })

  it('sin otras horas no hay aviso', () => {
    expect(avisoOtrasHoras([])).toBe('')
  })

  it('la previa trae otrasHoras con la forma del contrato (sin otrosTramos)', () => {
    // Compila sólo si `PreviaFinalizacion` sigue al contrato nuevo.
    const previa: PreviaFinalizacion = {
      cantidad: 7,
      desde: '2026-10-12',
      hasta: '2026-11-30',
      pagadas: [],
      ultimaFechaPagada: null,
      fechaDesdeMinima: null,
      otrasHoras: [{ turnoId: 42, fecha: '2026-10-12', horaInicio: '10:00', horaFin: '11:00' }],
    }
    expect(Object.keys(previa)).not.toContain('otrosTramos')
    expect(resumenPrevia(previa)).toBe('Se liberan 7 turnos, del 12/10 al 30/11')
    expect(avisoOtrasHoras(previa.otrasHoras)).toContain('de 10:00 a 11:00')
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
