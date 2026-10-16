import { describe, expect, it } from 'vitest'
import {
  ORDEN_PROFESORES_POR_DEFECTO,
  alumnosAtendidos,
  conteosDeAsistencia,
  filasDeMaterias,
  filasDeProfesores,
  clasesCerradasDelSistema,
  ordenarProfesores,
  profesoresConTurnosPorRegistrar,
  resumenDeAsistencia,
  soloQueNoRegistran,
  ventanaDeRegistro,
  type OcurrenciaAsistencia,
} from '../tablero.reglas'

// Reglas puras de la asistencia del tablero (HU-39, T-112, decisión T-162). Los estados y el plazo
// los decide el motor de ocurrencias: acá se parte de ellos.

const MATERIAS: Record<number, string> = { 1: 'Álgebra', 2: 'Matemática', 3: 'Física' }

const PROFESORES: Record<number, { nombre: string; apellido: string }> = {
  1: { nombre: 'Ana', apellido: 'Gómez' },
  2: { nombre: 'Luis', apellido: 'Pérez' },
  3: { nombre: 'Marta', apellido: 'Álvarez' },
  4: { nombre: 'Juan', apellido: 'Pérez' },
}

type Opciones = { profesorId?: number; materiaId?: number; alumnoId?: number }

let secuencia = 0

function ocurrencia(
  estado: OcurrenciaAsistencia['estado'],
  { profesorId = 1, materiaId = 2, alumnoId }: Opciones = {},
): OcurrenciaAsistencia {
  secuencia += 1
  // El motor da plazo a toda ocurrencia pasada no cancelada; las agendadas y canceladas no lo tienen.
  const conPlazo = estado !== 'AGENDADO' && estado !== 'CANCELADO'
  return {
    fecha: '2026-09-28',
    estado,
    bloqueAgendaId: 10,
    alumnoId: alumnoId ?? 1000 + secuencia,
    plazoAsistencia: conPlazo ? { vence: '2026-10-05', vencido: false } : null,
    materia: { id: materiaId, nombre: MATERIAS[materiaId] ?? `Materia ${materiaId}` },
    profesor: {
      id: profesorId,
      ...(PROFESORES[profesorId] ?? { nombre: 'Nombre', apellido: `Apellido ${profesorId}` }),
    },
  }
}

/** Un "Sin registrar" que cerró el sistema (plazo vencido). */
function cerrado(opciones: Opciones = {}): OcurrenciaAsistencia {
  return {
    ...ocurrencia('SIN_REGISTRAR', opciones),
    plazoAsistencia: { vence: '2026-10-05', vencido: true },
  }
}

const repetir = (cantidad: number, crear: () => OcurrenciaAsistencia) =>
  Array.from({ length: cantidad }, crear)

describe('conteosDeAsistencia', () => {
  it('cantidad y porcentaje sobre los turnos con asistencia registrada, no sobre el total', () => {
    const resultado = conteosDeAsistencia([
      ...repetir(3, () => ocurrencia('REALIZADO')),
      ocurrencia('AUSENTE'),
      // Fuera de la base: ni cerrados ni pendientes ni agendados ni cancelados.
      cerrado(),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('AGENDADO'),
      ocurrencia('CANCELADO'),
    ])

    expect(resultado.asistio).toEqual({ cantidad: 3, porcentaje: 75 })
    expect(resultado.noAsistio).toEqual({ cantidad: 1, porcentaje: 25 })
  })

  it('redondea a un decimal sin ajustar para sumar 100', () => {
    const resultado = conteosDeAsistencia([
      ocurrencia('REALIZADO'),
      ocurrencia('REALIZADO'),
      ocurrencia('AUSENTE'),
    ])

    expect(resultado.asistio.porcentaje).toBe(66.7)
    expect(resultado.noAsistio.porcentaje).toBe(33.3)
  })

  it('base 0 (ninguna asistencia registrada) → todo en 0, sin dividir por cero', () => {
    const resultado = conteosDeAsistencia([cerrado(), ocurrencia('AGENDADO')])

    expect(resultado.asistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(resultado.noAsistio).toEqual({ cantidad: 0, porcentaje: 0 })
    expect(conteosDeAsistencia([]).asistio).toEqual({ cantidad: 0, porcentaje: 0 })
  })
})

describe('alumnosAtendidos', () => {
  it('alumnos distintos con al menos un turno realizado', () => {
    expect(
      alumnosAtendidos([
        ocurrencia('REALIZADO', { alumnoId: 1 }),
        ocurrencia('REALIZADO', { alumnoId: 1 }),
        ocurrencia('REALIZADO', { alumnoId: 2 }),
      ]),
    ).toBe(2)
  })

  it('un alumno sólo con ausencias, cerrados, agendados o cancelados no cuenta', () => {
    expect(
      alumnosAtendidos([
        ocurrencia('AUSENTE', { alumnoId: 1 }),
        cerrado({ alumnoId: 2 }),
        ocurrencia('AGENDADO', { alumnoId: 3 }),
        ocurrencia('CANCELADO', { alumnoId: 4 }),
        ocurrencia('REALIZADO', { alumnoId: 5 }),
      ]),
    ).toBe(1)
  })

  it('sin turnos → 0', () => {
    expect(alumnosAtendidos([])).toBe(0)
  })
})

describe('filasDeProfesores', () => {
  it('asistencias registradas, cerrados, sin registrar y sus tres porcentajes sobre el total', () => {
    const filas = filasDeProfesores([
      ...repetir(3, () => ocurrencia('REALIZADO')),
      ocurrencia('AUSENTE'),
      cerrado(),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('AGENDADO'),
      // Un cancelado no cuenta: ni en las cifras ni en la base del porcentaje.
      ocurrencia('CANCELADO'),
    ])

    expect(filas).toEqual([
      {
        profesor: { id: 1, nombre: 'Ana', apellido: 'Gómez' },
        // 3 presentes y 1 ausente: las dos cuentan como asistencia registrada.
        // El total son los turnos que ya pasaron y no se cancelaron: 4 + 1 + 2 = 7. Los agendados
        // y los cancelados no están.
        asistenciasRegistradas: 4,
        porcentajeRegistrado: 57.1,
        cerradosSinRegistrar: 1,
        porcentajeCerrados: 14.3,
        sinRegistrar: 2,
        porcentajeSinRegistrar: 28.6,
        total: 7,
        noRegistraAsistencia: true,
      },
    ])
  })

  it('`noRegistraAsistencia` sólo con un cerrado: los pendientes dentro del plazo no alcanzan', () => {
    const filas = filasDeProfesores([
      ocurrencia('SIN_REGISTRAR', { profesorId: 1 }),
      ocurrencia('REALIZADO', { profesorId: 1 }),
      cerrado({ profesorId: 2 }),
    ])

    const porId = new Map(filas.map((f) => [f.profesor.id, f]))
    expect(porId.get(1)?.noRegistraAsistencia).toBe(false)
    expect(porId.get(1)?.cerradosSinRegistrar).toBe(0)
    expect(porId.get(2)?.noRegistraAsistencia).toBe(true)
  })

  it('un profesor con todos los turnos cancelados no tiene fila', () => {
    const filas = filasDeProfesores([
      ocurrencia('CANCELADO', { profesorId: 1 }),
      ocurrencia('REALIZADO', { profesorId: 2 }),
    ])

    expect(filas.map((f) => f.profesor.id)).toEqual([2])
  })

  it('un profesor que registró todo y no tiene nada pendiente llega a 100 %, aunque sus alumnos hayan faltado', () => {
    const [fila] = filasDeProfesores([
      ocurrencia('REALIZADO'),
      ocurrencia('AUSENTE'),
      ocurrencia('AUSENTE'),
    ])

    expect(fila).toMatchObject({
      asistenciasRegistradas: 3,
      porcentajeRegistrado: 100,
      cerradosSinRegistrar: 0,
      sinRegistrar: 0,
      total: 3,
    })
  })

  it('lo que está dentro del plazo no es una falta, pero tampoco está registrado: cuenta en el total', () => {
    const [fila] = filasDeProfesores([
      ocurrencia('REALIZADO'),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('SIN_REGISTRAR'),
      ocurrencia('SIN_REGISTRAR'),
    ])

    expect(fila).toMatchObject({
      asistenciasRegistradas: 1,
      porcentajeRegistrado: 25,
      cerradosSinRegistrar: 0,
      porcentajeCerrados: 0,
      sinRegistrar: 3,
      porcentajeSinRegistrar: 75,
      total: 4,
      noRegistraAsistencia: false,
    })
  })

  it('profesor que no registró nada y todo cerrado → 0 % registrado', () => {
    const [fila] = filasDeProfesores([cerrado(), cerrado()])

    expect(fila).toMatchObject({
      asistenciasRegistradas: 0,
      porcentajeRegistrado: 0,
      cerradosSinRegistrar: 2,
      porcentajeCerrados: 100,
      sinRegistrar: 0,
      total: 2,
    })
  })

  it('profesor sólo con agendados → todo en 0 (base 0, sin dividir por cero)', () => {
    const [fila] = filasDeProfesores([ocurrencia('AGENDADO')])

    expect(fila).toMatchObject({
      asistenciasRegistradas: 0,
      porcentajeRegistrado: 0,
      cerradosSinRegistrar: 0,
      porcentajeCerrados: 0,
      sinRegistrar: 0,
      porcentajeSinRegistrar: 0,
      total: 0,
    })
  })

  it('sólo agregados: la fila no trae nada del alumno ni el campo interno `busqueda`', () => {
    const [fila] = filasDeProfesores([ocurrencia('REALIZADO')])

    expect(Object.keys(fila ?? {}).sort()).toEqual([
      'asistenciasRegistradas',
      'cerradosSinRegistrar',
      'noRegistraAsistencia',
      'porcentajeCerrados',
      'porcentajeRegistrado',
      'porcentajeSinRegistrar',
      'profesor',
      'sinRegistrar',
      'total',
    ])
    expect(Object.keys(fila?.profesor ?? {}).sort()).toEqual(['apellido', 'id', 'nombre'])
  })

  it('sin turnos → sin filas', () => {
    expect(filasDeProfesores([])).toEqual([])
  })
})

describe('filasDeMaterias', () => {
  it('las mismas cifras agrupadas por materia, sin `noRegistraAsistencia`', () => {
    const filas = filasDeMaterias([
      ocurrencia('REALIZADO', { materiaId: 2 }),
      ocurrencia('AUSENTE', { materiaId: 2 }),
      cerrado({ materiaId: 2 }),
      ocurrencia('SIN_REGISTRAR', { materiaId: 2 }),
      ocurrencia('CANCELADO', { materiaId: 3 }),
    ])

    expect(filas).toEqual([
      {
        materia: { id: 2, nombre: 'Matemática' },
        asistenciasRegistradas: 2,
        // 2 registradas, 1 cerrado y 1 dentro del plazo: 4 turnos.
        porcentajeRegistrado: 50,
        cerradosSinRegistrar: 1,
        porcentajeCerrados: 25,
        sinRegistrar: 1,
        porcentajeSinRegistrar: 25,
        total: 4,
      },
    ])
  })

  it('orden fijo: cerrados sin registrar de mayor a menor; en empate, nombre', () => {
    const filas = filasDeMaterias([
      ocurrencia('REALIZADO', { materiaId: 2 }),
      cerrado({ materiaId: 3 }),
      cerrado({ materiaId: 3 }),
      cerrado({ materiaId: 2 }),
      cerrado({ materiaId: 1 }),
    ])

    expect(filas.map((f) => f.materia.nombre)).toEqual(['Física', 'Álgebra', 'Matemática'])
  })
})

describe('ordenarProfesores y soloQueNoRegistran', () => {
  // Gómez: 5 cerrados, Pérez L.: 2, Pérez J.: 2, Álvarez: 0 (con más asistencias registradas).
  const filas = filasDeProfesores([
    ...repetir(5, () => cerrado({ profesorId: 1 })),
    ocurrencia('REALIZADO', { profesorId: 1 }),
    ...repetir(2, () => cerrado({ profesorId: 2 })),
    ...repetir(2, () => cerrado({ profesorId: 4 })),
    ...repetir(4, () => ocurrencia('REALIZADO', { profesorId: 3 })),
    ocurrencia('AUSENTE', { profesorId: 3 }),
  ])
  const apellidos = (lista: typeof filas) =>
    lista.map((f) => `${f.profesor.apellido} ${f.profesor.nombre}`)

  it('por defecto: cerrados sin registrar de mayor a menor; en empate, apellido, nombre e id', () => {
    expect(apellidos(ordenarProfesores(filas, ORDEN_PROFESORES_POR_DEFECTO))).toEqual([
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
      'Álvarez Marta',
    ])
  })

  it('ascendente invierte el criterio principal pero no el desempate', () => {
    expect(
      apellidos(ordenarProfesores(filas, { orden: 'cerradosSinRegistrar', direccion: 'asc' })),
    ).toEqual(['Álvarez Marta', 'Pérez Juan', 'Pérez Luis', 'Gómez Ana'])
  })

  it.each([
    ['asistenciasRegistradas', 'desc', 'Álvarez Marta'],
    ['porcentajeRegistrado', 'desc', 'Álvarez Marta'],
    ['porcentajeRegistrado', 'asc', 'Pérez Juan'],
    ['porcentajeCerrados', 'desc', 'Pérez Juan'],
    ['sinRegistrar', 'asc', 'Álvarez Marta'],
  ] as const)('por `%s` %s empieza con %s', (orden, direccion, primero) => {
    expect(apellidos(ordenarProfesores(filas, { orden, direccion }))[0]).toBe(primero)
  })

  it('por `profesor` ordena por apellido y nombre (con acentos, a la manera del español)', () => {
    expect(apellidos(ordenarProfesores(filas, { orden: 'profesor', direccion: 'asc' }))).toEqual([
      'Álvarez Marta',
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
    ])
    expect(apellidos(ordenarProfesores(filas, { orden: 'profesor', direccion: 'desc' }))[0]).toBe(
      'Pérez Luis',
    )
  })

  it('no modifica la lista que recibe', () => {
    const antes = apellidos(filas)

    ordenarProfesores(filas, { orden: 'profesor', direccion: 'desc' })

    expect(apellidos(filas)).toEqual(antes)
  })

  it('`soloQueNoRegistran` deja sólo a los que tienen al menos un turno cerrado sin registrar', () => {
    expect(apellidos(soloQueNoRegistran(filas)).sort()).toEqual([
      'Gómez Ana',
      'Pérez Juan',
      'Pérez Luis',
    ])
  })

  it('el filtro sin ningún profesor que no registre → lista vacía', () => {
    expect(soloQueNoRegistran(filasDeProfesores([ocurrencia('REALIZADO')]))).toEqual([])
  })
})

describe('resumenDeAsistencia', () => {
  it('presentes, ausentes, sin registrar y cerrados, cada uno sobre los cuatro juntos', () => {
    const resumen = resumenDeAsistencia([
      ...repetir(3, () => ocurrencia('REALIZADO', { profesorId: 1 })),
      ocurrencia('AUSENTE', { profesorId: 2 }),
      cerrado({ profesorId: 1 }),
      cerrado({ profesorId: 1 }),
      ocurrencia('SIN_REGISTRAR', { profesorId: 3 }),
      // Fuera de la base: todavía no pasó o se canceló.
      ocurrencia('AGENDADO', { profesorId: 3 }),
      ocurrencia('CANCELADO', { profesorId: 4 }),
    ])

    expect(resumen).toEqual({
      presentes: { cantidad: 3, porcentaje: 42.9 },
      ausentes: { cantidad: 1, porcentaje: 14.3 },
      sinRegistrar: { cantidad: 1, porcentaje: 14.3 },
      cerrados: { cantidad: 2, porcentaje: 28.6 },
      total: 7,
      // Los dos cerrados son de la clase del 28/09.
      clasesCerradas: { desde: '2026-09-28', hasta: '2026-09-28' },
    })
  })

  it('base 0 → todo en 0, sin dividir por cero', () => {
    const vacio = { cantidad: 0, porcentaje: 0 }
    const sinNada = {
      presentes: vacio,
      ausentes: vacio,
      sinRegistrar: vacio,
      cerrados: vacio,
      total: 0,
      clasesCerradas: null,
    }

    expect(resumenDeAsistencia([])).toEqual(sinNada)
    expect(resumenDeAsistencia([ocurrencia('AGENDADO'), ocurrencia('CANCELADO')])).toEqual(sinNada)
  })

  it('no trae nada de los alumnos ni una cantidad de alumnos con baja asistencia', () => {
    expect(Object.keys(resumenDeAsistencia([ocurrencia('REALIZADO')])).sort()).toEqual([
      'ausentes',
      'cerrados',
      'clasesCerradas',
      'presentes',
      'sinRegistrar',
      'total',
    ])
  })
})

describe('clasesCerradasDelSistema', () => {
  const cerradoDelDia = (fecha: string) => ({ ...cerrado(), fecha })

  it('de la clase más antigua a la más reciente entre las que cerró el sistema', () => {
    expect(
      clasesCerradasDelSistema([
        cerradoDelDia('2026-09-24'),
        cerradoDelDia('2026-09-17'),
        cerradoDelDia('2026-10-01'),
      ]),
    ).toEqual({ desde: '2026-09-17', hasta: '2026-10-01' })
  })

  it('una sola clase cerrada → la misma fecha en las dos puntas', () => {
    expect(clasesCerradasDelSistema([cerradoDelDia('2026-09-24')])).toEqual({
      desde: '2026-09-24',
      hasta: '2026-09-24',
    })
  })

  it('los pendientes dentro del plazo, los registrados, los agendados y los cancelados no cuentan', () => {
    expect(
      clasesCerradasDelSistema([
        ocurrencia('SIN_REGISTRAR'),
        ocurrencia('REALIZADO'),
        ocurrencia('AUSENTE'),
        ocurrencia('AGENDADO'),
        ocurrencia('CANCELADO'),
      ]),
    ).toBeNull()
  })

  it('sin ocurrencias → null', () => {
    expect(clasesCerradasDelSistema([])).toBeNull()
  })
})

describe('ventanaDeRegistro', () => {
  it('va de 7 días atrás a hoy, el plazo que tiene el profesor para registrar', () => {
    expect(ventanaDeRegistro('2026-10-15')).toEqual({ desde: '2026-10-08', hasta: '2026-10-15' })
  })

  it('cruza el fin de mes y de año', () => {
    expect(ventanaDeRegistro('2026-01-03')).toEqual({ desde: '2025-12-27', hasta: '2026-01-03' })
  })
})

describe('profesoresConTurnosPorRegistrar', () => {
  it('cuenta los profesores con al menos un turno sin registrar dentro del plazo, una vez cada uno', () => {
    expect(
      profesoresConTurnosPorRegistrar([
        ocurrencia('SIN_REGISTRAR', { profesorId: 1 }),
        ocurrencia('SIN_REGISTRAR', { profesorId: 1 }),
        ocurrencia('SIN_REGISTRAR', { profesorId: 2 }),
      ]),
    ).toBe(2)
  })

  it('los cerrados por el sistema, los registrados, los agendados y los cancelados no cuentan', () => {
    expect(
      profesoresConTurnosPorRegistrar([
        cerrado({ profesorId: 1 }),
        ocurrencia('REALIZADO', { profesorId: 2 }),
        ocurrencia('AUSENTE', { profesorId: 3 }),
        ocurrencia('AGENDADO', { profesorId: 4 }),
        ocurrencia('CANCELADO', { profesorId: 5 }),
      ]),
    ).toBe(0)
  })

  it('sin ocurrencias → 0', () => {
    expect(profesoresConTurnosPorRegistrar([])).toBe(0)
  })
})
