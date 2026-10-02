// Seed de PAGOS DE DEMO: cobra ocurrencias de los turnos que ya existen, para recorrer y verificar
// los pagos, el comprobante, la deuda del alumno y el estado de pago en las agendas con muchos datos.
//
// NO crea alumnos, profesores ni turnos: trabaja sobre los alumnos de los otros seeds de demo
// (los que cargaron las usuarias de `DNI_CARGADORES`), así que **lo necesita corrido antes**:
//   pnpm db:seed  →  pnpm exec tsx prisma/seed-datos-demo.ts  →  este script
// Si después volvés a correr `seed-datos-demo.ts`, sus turnos se recrean y estos pagos se borran
// con ellos: corré este de nuevo.
//
// Los pagos los registra `CAJERA`: una usuaria de mesa de entradas **sin cuenta** (nadie puede
// iniciar sesión con ella), así que en el comprobante se ve como una persona más, las
// observaciones son las de un pago real y ningún pago registrado desde la app queda a su nombre.
//
// Idempotente por "limpiar y recrear": cada corrida borra sólo los pagos que registró `CAJERA`
// (y los de la versión anterior de este script, marcados en sus observaciones) y los vuelve a crear
// con fechas relativas a hoy. Nunca toca los pagos registrados desde la app ni los de otros seeds.
//
// Todo lo que cobra respeta las reglas de HU-15 (`docs/dominio.md` → Pagos):
//   - un pago es de UN alumno y puede incluir varias de sus ocurrencias, de distintos turnos;
//   - la ocurrencia existe: el turno está `ACTIVO` y la genera (cae en su día, entre su inicio y su
//     fin efectivo; una finalizada deja de generar desde `fechaDesde`, HU-14);
//   - no está cancelada ni pagada (una ocurrencia se paga una sola vez);
//   - una futura se cobra sólo hasta hoy + 56 días (las pasadas no tienen tope, T-60);
//   - el importe es el precio por hora vigente de su materia, que tiene que tener precio (T-61);
//   - la fecha de pago es hoy o anterior, y nunca anterior a la de la ocurrencia que se cobra por
//     adelantado más reciente: se paga el día de la clase, unos días después o por adelantado;
//   - el monto recibido es opcional y, si se informa, es >= al total (el vuelto no se guarda);
//   - los comprobantes salen correlativos en el orden de las fechas de pago.
//
// Deja a propósito ocurrencias pasadas sin cobrar: así hay alumnos con deuda y alumnos al día.
//
// Los datos son deterministas (generador con semilla fija), salvo el corrimiento de "hoy".
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-pagos-demo.ts             crea (o recrea) los pagos de demo
//   pnpm exec tsx prisma/seed-pagos-demo.ts --limpiar   sólo borra los pagos que creó este script
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, fechaADate, hoy } from '@/server/shared/fechas'

/** Marca de las observaciones de la versión anterior de este script: se limpia por si quedó algo. */
const MARCA_ANTERIOR = '[seed-pagos-demo]'

/**
 * Usuaria de mesa de entradas que registra los pagos, sin cuenta (no puede iniciar sesión). Se
 * busca por DNI y no se borra nunca: los pagos que registró son los que se limpian.
 */
const CAJERA = {
  nombre: 'Carla',
  apellido: 'Ibáñez',
  dni: '33890415',
  email: 'carla.ibanez@gmail.com',
  telefono: '(387) 15-455-6190',
}

/**
 * DNI de las usuarias que cargan los otros seeds de demo (`CARGADOR` de `seed-datos-demo.ts` y de
 * `seed-agenda-demo.ts`): sólo se cobran los turnos de los alumnos que cargaron ellas.
 */
const DNI_CARGADORES = ['30458127', '32156093']

/** Dominios de la versión anterior de esos seeds, por si la base todavía tiene esos alumnos. */
const DOMINIOS_ANTERIORES = ['datos-demo.local', 'agenda-demo.local']

/** Cuántas semanas hacia atrás se miran las ocurrencias pasadas. */
const SEMANAS_ATRAS = 8

/** Tope de cobro de una ocurrencia futura (decisión T-60, `DIAS_MAXIMOS_COBRO` de pagos). */
const DIAS_MAXIMOS_COBRO = 56

/** Probabilidad de cobrar cada tanda de ocurrencias pasadas: el resto queda como deuda. */
const PROBABILIDAD_PAGO_PASADO = 0.6

/** Probabilidad de que un alumno pague por adelantado algunas de sus próximas clases. */
const PROBABILIDAD_ADELANTO = 0.35

const SEMILLA = 20261002

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Generador determinista (mulberry32), igual al de `seed-datos-demo.ts`. */
function crearAzar(semilla: number) {
  let estado = semilla >>> 0
  return {
    decimal(): number {
      estado = (estado + 0x6d2b79f5) >>> 0
      let t = estado
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    entero(min: number, max: number): number {
      return min + Math.floor(this.decimal() * (max - min + 1))
    },
    chance(p: number): boolean {
      return this.decimal() < p
    },
  }
}

type Azar = ReturnType<typeof crearAzar>

const UN_DIA_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` + `dias` (puede ser negativo). */
function sumarDias(fecha: string, dias: number): string {
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * UN_DIA_MS))
}

const minimo = (a: string, b: string) => (a < b ? a : b)

/** Importe de la base (`Decimal`, "8000.00") a centavos, para sumar sin errores de redondeo. */
const aCentavos = (importe: { toString(): string }) => Math.round(Number(importe.toString()) * 100)
const aImporte = (centavos: number) => (centavos / 100).toFixed(2)

// ---------------------------------------------------------------------------------------------
// Limpieza de una corrida anterior
// ---------------------------------------------------------------------------------------------

async function limpiar() {
  const pagos = await prisma.pago.findMany({
    where: {
      OR: [{ createdBy: { dni: CAJERA.dni } }, { observaciones: { startsWith: MARCA_ANTERIOR } }],
    },
    select: { id: true },
  })
  const pagoIds = pagos.map((p) => p.id)
  const { count } = await prisma.pagoTurno.deleteMany({ where: { pagoId: { in: pagoIds } } })
  await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } })
  console.log(`Limpieza: ${pagoIds.length} pagos de este script (${count} ocurrencias cobradas).`)
}

// ---------------------------------------------------------------------------------------------
// Ocurrencias cobrables
// ---------------------------------------------------------------------------------------------

type Ocurrencia = {
  turnoId: number
  alumnoId: number
  materiaId: number
  tipo: 'RECURRENTE' | 'SESION_UNICA'
  fecha: string
  centavos: number
}

/**
 * Ocurrencias que hoy se podrían cobrar desde la app, por alumno y ordenadas por fecha: de turnos
 * `ACTIVO` de los alumnos de demo, entre hace `SEMANAS_ATRAS` semanas y hoy + 56 días, dentro del
 * fin efectivo, sin cancelar, sin pagar y de una materia con precio.
 */
async function ocurrenciasCobrables(fechaHoy: string): Promise<Map<number, Ocurrencia[]>> {
  const desde = sumarDias(fechaHoy, -7 * SEMANAS_ATRAS)
  const tope = sumarDias(fechaHoy, DIAS_MAXIMOS_COBRO)
  const turnos = await prisma.turno.findMany({
    where: {
      estado: 'ACTIVO',
      alumno: {
        OR: [
          { createdBy: { dni: { in: DNI_CARGADORES } } },
          ...DOMINIOS_ANTERIORES.map((dominio) => ({ email: { endsWith: `@${dominio}` } })),
        ],
      },
      fechaInicio: { lte: fechaADate(tope) },
      OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(desde) } }],
      materia: { precioHora: { not: null } },
    },
    select: {
      id: true,
      alumnoId: true,
      materiaId: true,
      tipo: true,
      fechaInicio: true,
      fechaFin: true,
      materia: { select: { precioHora: true } },
      finalizacion: { select: { fechaDesde: true } },
      cancelaciones: { select: { fechaOcurrencia: true } },
      pagoTurnos: { select: { fechaOcurrencia: true } },
    },
    orderBy: { id: 'asc' },
  })

  const porAlumno = new Map<number, Ocurrencia[]>()
  for (const turno of turnos) {
    const inicio = dateAFecha(turno.fechaInicio)
    // Fin efectivo (T-48): el menor entre `fechaFin` y el día anterior a la finalización.
    let fin = turno.fechaFin ? dateAFecha(turno.fechaFin) : tope
    if (turno.finalizacion)
      fin = minimo(fin, sumarDias(dateAFecha(turno.finalizacion.fechaDesde), -1))
    fin = minimo(fin, tope)

    const excluidas = new Set(
      [...turno.cancelaciones, ...turno.pagoTurnos].map((o) => dateAFecha(o.fechaOcurrencia)),
    )
    const centavos = aCentavos(turno.materia.precioHora!)
    const lista = porAlumno.get(turno.alumnoId) ?? []
    // Una sesión única tiene una sola ocurrencia; un recurrente, una por semana (la fecha de inicio
    // cae en el día del bloque, así que sumar 7 días recorre sus ocurrencias).
    for (let fecha = inicio; fecha <= fin; fecha = sumarDias(fecha, 7)) {
      if (fecha >= desde && !excluidas.has(fecha)) {
        lista.push({
          turnoId: turno.id,
          alumnoId: turno.alumnoId,
          materiaId: turno.materiaId,
          tipo: turno.tipo,
          fecha,
          centavos,
        })
      }
      if (turno.tipo === 'SESION_UNICA') break
    }
    if (lista.length > 0) porAlumno.set(turno.alumnoId, lista)
  }
  for (const lista of porAlumno.values()) lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return porAlumno
}

// ---------------------------------------------------------------------------------------------
// Armado de los pagos
// ---------------------------------------------------------------------------------------------

type PagoNuevo = {
  alumnoId: number
  fechaPago: string
  ocurrencias: Ocurrencia[]
  montoRecibido: number | null
  escenario: string
}

/** Monto recibido: a veces no se informa, a veces justo y a veces redondeado (para ver el vuelto). */
function montoRecibido(azar: Azar, totalCentavos: number): number | null {
  const caso = azar.decimal()
  if (caso < 0.4) return null
  if (caso < 0.7) return totalCentavos
  const redondeo = azar.chance(0.5) ? 100000 : 500000 // a $1.000 o a $5.000
  return Math.ceil((totalCentavos + 1) / redondeo) * redondeo
}

function armarPagos(azar: Azar, porAlumno: Map<number, Ocurrencia[]>, fechaHoy: string) {
  const pagos: PagoNuevo[] = []
  const cobradas = new Set<string>()
  const clave = (o: Ocurrencia) => `${o.turnoId}|${o.fecha}`
  const pendientes = (lista: Ocurrencia[]) => lista.filter((o) => !cobradas.has(clave(o)))

  function registrar(
    alumnoId: number,
    fechaPago: string,
    ocurrencias: Ocurrencia[],
    escenario: string,
  ) {
    if (ocurrencias.length === 0) return
    for (const o of ocurrencias) cobradas.add(clave(o))
    const total = ocurrencias.reduce((acc, o) => acc + o.centavos, 0)
    pagos.push({
      alumnoId,
      fechaPago,
      ocurrencias,
      montoRecibido: montoRecibido(azar, total),
      escenario,
    })
  }

  const alumnos = [...porAlumno.keys()].sort((a, b) => a - b)
  const escenarios = {
    dosMaterias: null as number | null,
    seriePrepagada: null as number | null,
    alDia: null as number | null,
  }

  // 1. Un pago con ocurrencias de dos materias distintas del mismo alumno (importes distintos).
  for (const alumnoId of alumnos) {
    const pasadas = pendientes(porAlumno.get(alumnoId)!).filter((o) => o.fecha < fechaHoy)
    const primera = pasadas[0]
    const otraMateria = pasadas.find((o) => primera && o.materiaId !== primera.materiaId)
    if (primera && otraMateria) {
      const ultima = otraMateria.fecha > primera.fecha ? otraMateria.fecha : primera.fecha
      registrar(alumnoId, ultima, [primera, otraMateria], 'Pago de dos materias distintas')
      escenarios.dosMaterias = alumnoId
      break
    }
  }

  // 2. Una serie recurrente pagada por adelantado hasta el tope de 8 semanas (T-60): la siguiente
  //    ocurrencia ya no se podría cobrar todavía.
  for (const alumnoId of alumnos) {
    const futuras = pendientes(porAlumno.get(alumnoId)!).filter(
      (o) => o.fecha >= fechaHoy && o.tipo === 'RECURRENTE',
    )
    const porTurno = new Map<number, Ocurrencia[]>()
    for (const o of futuras) porTurno.set(o.turnoId, [...(porTurno.get(o.turnoId) ?? []), o])
    const serie = [...porTurno.values()].find((lista) => lista.length >= 6)
    if (serie) {
      registrar(alumnoId, fechaHoy, serie, 'Serie pagada por adelantado hasta el tope de 8 semanas')
      escenarios.seriePrepagada = alumnoId
      break
    }
  }

  // 3. Un alumno al día: todas sus ocurrencias pasadas cobradas, en pagos de a 1 a 3.
  const candidatoAlDia = alumnos.find(
    (id) =>
      id !== escenarios.dosMaterias &&
      id !== escenarios.seriePrepagada &&
      pendientes(porAlumno.get(id)!).filter((o) => o.fecha < fechaHoy).length >= 3,
  )
  if (candidatoAlDia !== undefined) {
    const pasadas = pendientes(porAlumno.get(candidatoAlDia)!).filter((o) => o.fecha < fechaHoy)
    for (let i = 0; i < pasadas.length;) {
      const tanda = pasadas.slice(i, i + azar.entero(1, 3))
      registrar(candidatoAlDia, tanda.at(-1)!.fecha, tanda, 'Alumno al día')
      i += tanda.length
    }
    escenarios.alDia = candidatoAlDia
  }

  // 4. El resto, al azar: tandas de 1 a 4 ocurrencias pasadas que se cobran o quedan como deuda, y
  //    a veces un adelanto de las próximas clases (dentro del tope).
  for (const alumnoId of alumnos) {
    if (alumnoId === escenarios.alDia) continue
    const pasadas = pendientes(porAlumno.get(alumnoId)!).filter((o) => o.fecha < fechaHoy)
    for (let i = 0; i < pasadas.length;) {
      const tanda = pasadas.slice(i, i + azar.entero(1, 4))
      i += tanda.length
      if (!azar.chance(PROBABILIDAD_PAGO_PASADO)) continue
      // Se paga el día de la última clase de la tanda o unos días después, nunca después de hoy.
      const fechaPago = minimo(sumarDias(tanda.at(-1)!.fecha, azar.entero(0, 4)), fechaHoy)
      registrar(alumnoId, fechaPago, tanda, tanda.length > 1 ? 'Varias clases juntas' : 'Una clase')
    }

    if (azar.chance(PROBABILIDAD_ADELANTO)) {
      const futuras = pendientes(porAlumno.get(alumnoId)!).filter((o) => o.fecha >= fechaHoy)
      const adelanto = futuras.slice(0, azar.entero(1, 4))
      // Por adelantado: hoy o unos días antes (pero nunca antes de que exista la necesidad: basta
      // con que sea <= hoy y <= la primera clase que se paga).
      const fechaPago = minimo(
        sumarDias(fechaHoy, -azar.entero(0, 3)),
        adelanto[0]?.fecha ?? fechaHoy,
      )
      registrar(alumnoId, fechaPago, adelanto, 'Pago por adelantado')
    }
  }

  return { pagos, escenarios }
}

/** Lo que anota mesa de entradas al registrar el pago (a veces nada), según cómo pagó. */
function observacionDe(escenario: string): string | null {
  switch (escenario) {
    case 'Pago de dos materias distintas':
      return 'Abona las clases de las dos materias juntas.'
    case 'Serie pagada por adelantado hasta el tope de 8 semanas':
      return 'Paga por adelantado las próximas ocho semanas.'
    case 'Pago por adelantado':
      return 'Adelanta sus próximas clases.'
    case 'Varias clases juntas':
      return 'Abona varias clases juntas.'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------------------------

async function crear(azar: Azar) {
  const mesa = await prisma.usuario.upsert({
    where: { dni: CAJERA.dni },
    create: {
      id: randomUUID(),
      ...CAJERA,
      busqueda: normalizarBusqueda(`${CAJERA.apellido} ${CAJERA.nombre} ${CAJERA.dni}`),
      emailVerified: true,
      role: 'MESA_ENTRADAS',
    },
    update: {},
  })
  const formaPago = await prisma.formaPago.findUnique({ where: { nombre: 'Efectivo' } })
  if (!mesa || !formaPago) {
    throw new Error(
      'Faltan datos del seed de desarrollo (usuario de mesa de entradas o forma de pago ' +
        '"Efectivo"). Corré primero `pnpm db:seed` y volvé a intentar.',
    )
  }

  const fechaHoy = hoy()
  const porAlumno = await ocurrenciasCobrables(fechaHoy)
  if (porAlumno.size === 0) {
    throw new Error(
      'No hay turnos de alumnos de demo para cobrar. Corré primero ' +
        '`pnpm exec tsx prisma/seed-datos-demo.ts` y volvé a intentar.',
    )
  }

  const { pagos, escenarios } = armarPagos(azar, porAlumno, fechaHoy)

  // En orden de fecha de pago: así los números de comprobante (autoincrementales) son correlativos
  // con el tiempo, como si se hubieran registrado día por día.
  pagos.sort((a, b) => a.fechaPago.localeCompare(b.fechaPago) || a.alumnoId - b.alumnoId)
  const comprobantes = new Map<string, number>()
  for (const pago of pagos) {
    const total = pago.ocurrencias.reduce((acc, o) => acc + o.centavos, 0)
    const creado = await prisma.pago.create({
      data: {
        alumnoId: pago.alumnoId,
        formaPagoId: formaPago.id,
        importeTotal: aImporte(total),
        fechaPago: fechaADate(pago.fechaPago),
        montoRecibido: pago.montoRecibido === null ? null : aImporte(pago.montoRecibido),
        observaciones: observacionDe(pago.escenario),
        createdById: mesa.id,
        updatedById: mesa.id,
        turnos: {
          create: pago.ocurrencias.map((o) => ({
            turnoId: o.turnoId,
            fechaOcurrencia: fechaADate(o.fecha),
            importeAplicado: aImporte(o.centavos),
          })),
        },
      },
      select: { numeroComprobante: true },
    })
    if (!comprobantes.has(pago.escenario))
      comprobantes.set(pago.escenario, creado.numeroComprobante)
  }

  // --- Resumen, con ejemplos para verificar a mano ---
  const cobradas = pagos.reduce((acc, p) => acc + p.ocurrencias.length, 0)
  const pasadas = [...porAlumno.values()].flat().filter((o) => o.fecha < fechaHoy)
  const cobradasPasadas = pagos
    .flatMap((p) => p.ocurrencias)
    .filter((o) => o.fecha < fechaHoy).length
  const conDeuda = [...porAlumno.entries()].filter(([alumnoId, lista]) => {
    const pagadas = new Set(
      pagos
        .filter((p) => p.alumnoId === alumnoId)
        .flatMap((p) => p.ocurrencias.map((o) => `${o.turnoId}|${o.fecha}`)),
    )
    return lista.some((o) => o.fecha < fechaHoy && !pagadas.has(`${o.turnoId}|${o.fecha}`))
  }).length

  const alumnosEjemplo = await prisma.alumno.findMany({
    where: {
      id: {
        in: [escenarios.dosMaterias, escenarios.seriePrepagada, escenarios.alDia].filter(
          (id): id is number => id !== null,
        ),
      },
    },
    select: { id: true, nombre: true, apellido: true, dni: true },
  })
  const nombre = (id: number | null) => {
    const alumno = alumnosEjemplo.find((a) => a.id === id)
    return alumno ? `${alumno.apellido}, ${alumno.nombre} (DNI ${alumno.dni})` : '—'
  }

  console.log(`Pagos de demo listos (hoy = ${fechaHoy}):`)
  console.log(`  ${pagos.length} pagos con ${cobradas} ocurrencias cobradas`)
  console.log(
    `  ocurrencias pasadas: ${cobradasPasadas} cobradas de ${pasadas.length} (el resto es deuda)`,
  )
  console.log(`  ${conDeuda} alumnos con deuda de ${porAlumno.size} con turnos`)
  console.log('Para verificar:')
  console.log(
    `  dos materias en un pago:   ${nombre(escenarios.dosMaterias)}, comprobante #${comprobantes.get('Pago de dos materias distintas') ?? '—'}`,
  )
  console.log(
    `  serie prepagada (8 sem.):  ${nombre(escenarios.seriePrepagada)}, comprobante #${comprobantes.get('Serie pagada por adelantado hasta el tope de 8 semanas') ?? '—'}`,
  )
  console.log(`  alumno al día (sin deuda): ${nombre(escenarios.alDia)}`)
}

async function main() {
  await limpiar()
  if (!process.argv.includes('--limpiar')) await crear(crearAzar(SEMILLA))
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
