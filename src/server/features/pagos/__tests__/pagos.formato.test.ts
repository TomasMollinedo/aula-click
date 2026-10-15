import { describe, expect, it } from 'vitest'
import {
  datosDelMedio,
  nombreArchivoComprobante,
  textoAnuladoEl,
  textoMotivoAnulacion,
  textoNumero,
  textoRedDebito,
  textoRegistradoPor,
  textoTarjeta,
  turnosPorMateria,
} from '../pagos.formato'

// Los mismos strings que `src/features/pagos/formato-pagos.ts` (frontend).

describe('textoNumero', () => {
  it('el número tal cual, sin ceros a la izquierda', () => {
    expect(textoNumero(1024)).toBe('N° 1024')
    expect(textoNumero(7)).toBe('N° 7')
  })
})

describe('textoRegistradoPor', () => {
  it('nombre, apellido y el instante en la hora del negocio', () => {
    expect(
      textoRegistradoPor({ nombre: 'Ana', apellido: 'Pérez' }, '2026-10-05T14:30:00.000Z'),
    ).toBe('Registrado por Ana Pérez el 05/10/2026 11:30')
  })

  it('a las 23:30 hora Salta da el día de Salta, no el de UTC', () => {
    expect(
      textoRegistradoPor({ nombre: 'Laura', apellido: 'Gómez' }, '2026-09-23T02:30:00.000Z'),
    ).toBe('Registrado por Laura Gómez el 22/09/2026 23:30')
  })
})

describe('nombreArchivoComprobante', () => {
  it('sólo el número, sin extensión', () => {
    expect(nombreArchivoComprobante(32)).toBe('comprobante-32')
    expect(nombreArchivoComprobante(1024)).toBe('comprobante-1024')
  })
})

describe('datosDelMedio', () => {
  it('efectivo: ninguno (el monto recibido y el vuelto van con el total)', () => {
    expect(datosDelMedio({ transferencia: null, debito: null })).toEqual([])
  })

  it('transferencia: operación, banco y titular', () => {
    expect(
      datosDelMedio({
        transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: 'Marta López' },
        debito: null,
      }),
    ).toEqual([
      { label: 'Operación', valor: '0004829137' },
      { label: 'Banco', valor: 'Banco Macro' },
      { label: 'Titular', valor: 'Marta López' },
    ])
  })

  it('transferencia sin titular: no va', () => {
    expect(
      datosDelMedio({
        transferencia: { operacion: '1', banco: 'Macro', titular: null },
        debito: null,
      }).map((d) => d.label),
    ).toEqual(['Operación', 'Banco'])
  })

  it('débito: red, cupón y la tarjeta con sólo los últimos 4', () => {
    expect(
      datosDelMedio({
        transferencia: null,
        debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
      }),
    ).toEqual([
      { label: 'Red', valor: 'Visa Débito' },
      { label: 'Cupón', valor: '000123' },
      { label: 'Tarjeta', valor: '**** 1234' },
    ])
  })

  it('débito sin los últimos 4: sin tarjeta', () => {
    expect(
      datosDelMedio({
        transferencia: null,
        debito: { red: 'MAESTRO', cupon: '9', ultimos4: null },
      }).map((d) => d.label),
    ).toEqual(['Red', 'Cupón'])
  })
})

describe('textoRedDebito y textoTarjeta', () => {
  it('cada red con su nombre', () => {
    expect(textoRedDebito('MASTERCARD_DEBITO')).toBe('Mastercard Débito')
    expect(textoRedDebito('CABAL_DEBITO')).toBe('Cabal Débito')
    expect(textoRedDebito('OTRA')).toBe('Otra')
  })

  it('la tarjeta con los primeros números ocultos', () => {
    expect(textoTarjeta('1234')).toBe('**** 1234')
  })
})

describe('turnosPorMateria', () => {
  const MATEMATICA = { id: 2, nombre: 'Matemática' }
  const INGLES = { id: 5, nombre: 'Inglés' }
  const turno = (fecha: string, materia: { id: number; nombre: string }, importe: number) => ({
    fecha,
    materia,
    importe,
  })

  it('una materia: un solo grupo con todos sus turnos y el subtotal igual al total', () => {
    const turnos = [turno('2026-09-21', MATEMATICA, 8000), turno('2026-09-28', MATEMATICA, 8000)]
    expect(turnosPorMateria(turnos)).toEqual([{ materia: MATEMATICA, turnos, subtotal: 16000 }])
  })

  it('Inglés y Matemática: un grupo por materia, por nombre, con el subtotal de cada una', () => {
    const turnos = [
      turno('2026-09-21', MATEMATICA, 8000),
      turno('2026-09-22', INGLES, 9000.5),
      turno('2026-09-28', MATEMATICA, 8000),
      turno('2026-09-29', INGLES, 9000.5),
    ]

    const grupos = turnosPorMateria(turnos)

    expect(grupos.map((g) => [g.materia.nombre, g.subtotal])).toEqual([
      ['Inglés', 18001],
      ['Matemática', 16000],
    ])
    // Dentro de cada materia, en el orden del comprobante (fecha y hora).
    expect(grupos[0]?.turnos.map((t) => t.fecha)).toEqual(['2026-09-22', '2026-09-29'])
    expect(grupos[1]?.turnos.map((t) => t.fecha)).toEqual(['2026-09-21', '2026-09-28'])
  })

  it('sin turnos: sin grupos', () => {
    expect(turnosPorMateria([])).toEqual([])
  })
})

describe('textoMotivoAnulacion y textoAnuladoEl', () => {
  it('el motivo con su detalle, o solo el motivo', () => {
    expect(textoMotivoAnulacion({ motivo: 'ERROR_CARGA', detalle: 'se cargó dos veces' })).toBe(
      'Error de carga: se cargó dos veces',
    )
    expect(textoMotivoAnulacion({ motivo: 'FORMA_PAGO_EQUIVOCADA', detalle: null })).toBe(
      'Forma de pago equivocada',
    )
    expect(textoMotivoAnulacion({ motivo: 'OTRO', detalle: 'Pedido del alumno' })).toBe(
      'Otro motivo: Pedido del alumno',
    )
  })

  it('cuándo y quién, en la hora del negocio', () => {
    expect(
      textoAnuladoEl({
        anuladoPor: { nombre: 'Laura', apellido: 'Gómez' },
        anuladoEl: '2026-10-06T12:00:00.000Z',
      }),
    ).toBe('Anulado el 06/10/2026 09:00 por Laura Gómez')
  })
})
