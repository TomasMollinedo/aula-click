// Seed de desarrollo de las liquidaciones (HU-43 a HU-47): cinco profesores con cuatro meses de
// clases, cobros con las tres formas de pago, asistencias, pagos anulados y liquidaciones ya
// pagadas, de modo que "Liquidaciones", "Mis ingresos", la caja y la pestaña Finanzas del tablero
// tengan datos en todos sus estados (qué queda en cada uno, en `liquidaciones-escenario.ts`).
//
// Se corre DESPUÉS de `pnpm db:seed` (usa sus usuarios, materias, aulas, formas de pago y el
// porcentaje del centro) con `pnpm db:seed:liquidaciones`. Las fechas son relativas a hoy.
// Es idempotente a su manera: los profesores y los alumnos son upsert; si los alumnos del escenario
// ya tienen pagos, no vuelve a cargar clases ni cobros (para repetirlo, vaciá la base).
//
// Las liquidaciones cerradas no se calculan a mano: las produce el motor real
// (`armarLiquidaciones` / `armarCierre`) simulando los pagos en orden cronológico, y se guardan
// como las guarda `liquidacionesRepository.pagar`. Todo el escenario va en una sola transacción.
import 'dotenv/config'
import { env } from '@/config/env'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { ahora, diaSemanaISO, fechaADate, fechaEnZona, hoy } from '@/server/shared/fechas'
import { horaAMinutos, mesDe, primerDiaDelMes } from '@/server/shared/zod'
import {
  ALUMNOS,
  armarEscenario,
  BANCOS,
  devengo,
  instante,
  PROFESORES,
  REDES_DEBITO,
  simular,
  type AlumnoClave,
  type ClaseResuelta,
  type CobroResuelto,
  type ProfesorClave,
  type TurnoCobrado,
} from './liquidaciones-escenario'
import { upsertUsuario } from './seed-comun'

type Tx = Prisma.TransactionClient

// Muchas escrituras en una sola transacción: el margen por defecto (5 s) no alcanza.
const TRANSACCION = { timeout: 120_000, maxWait: 15_000 } as const

const aDecimal = (importe: number) => importe.toFixed(2)
const aCentavos = (importe: number) => Math.round(importe * 100)
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

function requerida(valor: string | undefined, nombre: string): string {
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`)
  }
  return valor
}

async function usuarioPorEmail(email: string, descripcion: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario) {
    throw new Error(
      `No existe el usuario de ${descripcion} (${email}): corré antes \`pnpm db:seed\``,
    )
  }
  return usuario
}

/** Profesores y alumnos del escenario (upsert) y lo que hace falta para colgarles las clases. */
async function prepararPersonas(mesaId: string, passwordProfesor: string) {
  const materias = new Map<string, { id: number; precio: number }>()
  const nombresDeMaterias = new Set(PROFESORES.flatMap((p) => p.materias))
  for (const nombre of nombresDeMaterias) {
    const materia = await prisma.materia.findUnique({
      where: { busqueda: normalizarBusqueda(nombre) },
    })
    if (!materia?.precioHora) {
      throw new Error(
        `La materia ${nombre} no existe o no tiene precio: corré antes \`pnpm db:seed\``,
      )
    }
    materias.set(nombre, { id: materia.id, precio: materia.precioHora.toNumber() })
  }

  const profesores = new Map<
    ProfesorClave,
    { id: number; usuarioId: string; nombre: string; apellido: string; aulaId: number }
  >()
  for (const datos of PROFESORES) {
    const aula = await prisma.aula.findUnique({ where: { nombre: datos.aula } })
    if (!aula) throw new Error(`No existe el ${datos.aula}: corré antes \`pnpm db:seed\``)

    const usuario = await upsertUsuario({
      role: 'PROFESOR',
      email: datos.email,
      password: passwordProfesor,
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      telefono: datos.telefono,
    })
    const profesor = await prisma.profesor.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        titulo: datos.titulo,
        matricula: datos.matricula,
        capacidad: datos.capacidad,
      },
      update: {},
    })
    for (const nombre of datos.materias) {
      const materiaId = (materias.get(nombre) as { id: number }).id
      await prisma.asignacionMateria.upsert({
        where: { profesorId_materiaId: { profesorId: profesor.id, materiaId } },
        create: { profesorId: profesor.id, materiaId, createdById: mesaId, updatedById: mesaId },
        update: {},
      })
    }
    profesores.set(datos.clave, {
      id: profesor.id,
      usuarioId: usuario.id,
      nombre: datos.nombre,
      apellido: datos.apellido,
      aulaId: aula.id,
    })
  }

  const alumnos = new Map<
    AlumnoClave,
    { id: number; nombre: string; apellido: string; titular: string }
  >()
  for (const datos of ALUMNOS) {
    const alumno = await prisma.alumno.upsert({
      where: { dni: datos.dni },
      create: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        fechaNacimiento: fechaADate(datos.fechaNacimiento),
        telefono: datos.telefono,
        email: datos.email,
        tutorNombre: datos.tutor?.nombre ?? null,
        tutorApellido: datos.tutor?.apellido ?? null,
        tutorDni: datos.tutor?.dni ?? null,
        tutorTelefono: datos.tutor?.telefono ?? null,
        tutorEmail: datos.tutor?.email ?? null,
        nivelEscolaridad: datos.nivelEscolaridad,
        grado: datos.grado,
        institucionEducativa: datos.institucionEducativa,
        createdById: mesaId,
        updatedById: mesaId,
      },
      update: {},
    })
    // Quien paga una transferencia: el tutor, si el alumno es menor.
    const titular = datos.tutor
      ? `${datos.tutor.nombre} ${datos.tutor.apellido}`
      : `${datos.nombre} ${datos.apellido}`
    alumnos.set(datos.clave, {
      id: alumno.id,
      nombre: datos.nombre,
      apellido: datos.apellido,
      titular,
    })
  }

  return { materias, profesores, alumnos }
}

type Personas = Awaited<ReturnType<typeof prepararPersonas>>

/** Los datos propios de cada forma de pago (HU-23), con valores que se repiten lo menos posible. */
function datosDelMedio(cobro: CobroResuelto, titular: string, total: number) {
  const n = cobro.indice
  if (cobro.forma === 'EFECTIVO') {
    // Paga con billetes de 5.000: el vuelto sale de la diferencia.
    return { montoRecibido: aDecimal(Math.ceil(total / 5000) * 5000) }
  }
  if (cobro.forma === 'TRANSFERENCIA') {
    return {
      transferenciaOperacion: String(31_450_000 + n * 137),
      transferenciaBanco: BANCOS[n % BANCOS.length] as string,
      transferenciaTitular: titular,
    }
  }
  return {
    debitoRed: REDES_DEBITO[n % REDES_DEBITO.length] as (typeof REDES_DEBITO)[number],
    debitoCupon: String(100_200 + n * 37),
    debitoUltimos4: String(1000 + ((n * 173) % 9000)),
  }
}

async function cargarEscenario(
  tx: Tx,
  personas: Personas,
  gerenteId: string,
  mesaId: string,
  pendientes: ReadonlySet<ProfesorClave>,
) {
  const hoyActual = hoy()
  const escenario = armarEscenario(hoyActual, ahora(), pendientes)
  const { materias, profesores, alumnos } = personas

  // El historial del porcentaje del seed base arranca dos meses atrás; para cobrar desde el primer
  // mes hace falta uno anterior (10 %), así cada cobro guarda el porcentaje que regía ese día.
  const primerCobro = escenario.cobros.reduce(
    (menor, cobro) => (cobro.registradoEl < menor ? cobro.registradoEl : menor),
    escenario.cobros[0]!.registradoEl,
  )
  const historial = await tx.porcentajeCentro.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { porcentaje: true, createdAt: true },
  })
  if (historial.length === 0) {
    throw new Error('No hay porcentaje del centro configurado: corré antes `pnpm db:seed`')
  }
  const inicioPrimerMes = instante(`${mesDe(fechaEnZona(primerCobro))}-01`, '09:00', ahora())
  if ((historial[0] as { createdAt: Date }).createdAt > primerCobro) {
    const fila = await tx.porcentajeCentro.create({
      data: { porcentaje: '10.00', createdAt: inicioPrimerMes, createdById: gerenteId },
      select: { porcentaje: true, createdAt: true },
    })
    historial.unshift(fila)
  }
  const porcentajeEn = (momento: Date): number => {
    const vigente = [...historial].reverse().find((fila) => fila.createdAt <= momento)
    return (vigente ?? (historial[0] as (typeof historial)[number])).porcentaje.toNumber()
  }

  // 1. Horario, turnos y asistencias. Cada clase es una sesión única de una hora.
  const bloques = new Map<string, number>()
  const turnoDe = new Map<number, number>()
  const clasesPorFecha = [...escenario.clases].sort(
    (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || a.indice - b.indice,
  )
  for (const c of clasesPorFecha) {
    const profesor = profesores.get(c.profesor)!
    const diaSemana = diaSemanaISO(c.fecha)
    const horaInicio = horaAMinutos(c.hora)
    const claveBloque = `${profesor.id}|${diaSemana}|${horaInicio}`
    let bloqueId = bloques.get(claveBloque)
    if (bloqueId === undefined) {
      const existente = await tx.bloqueAgenda.findFirst({
        where: {
          profesorId: profesor.id,
          aulaId: profesor.aulaId,
          diaSemana,
          horaInicio,
          estado: 'ACTIVO',
        },
        select: { id: true },
      })
      bloqueId =
        existente?.id ??
        (
          await tx.bloqueAgenda.create({
            data: {
              profesorId: profesor.id,
              aulaId: profesor.aulaId,
              diaSemana,
              horaInicio,
              horaFin: horaInicio + 60,
              createdById: mesaId,
              updatedById: mesaId,
            },
            select: { id: true },
          })
        ).id
      bloques.set(claveBloque, bloqueId)
    }

    const turno = await tx.turno.create({
      data: {
        bloqueAgendaId: bloqueId,
        alumnoId: alumnos.get(c.alumno)!.id,
        materiaId: materias.get(c.materia)!.id,
        tipo: 'SESION_UNICA',
        fechaInicio: fechaADate(c.fecha),
        fechaFin: fechaADate(c.fecha),
        temas: c.tema,
        createdById: mesaId,
        updatedById: mesaId,
        createdAt: c.creadaEl,
        updatedAt: c.creadaEl,
      },
      select: { id: true },
    })
    turnoDe.set(c.indice, turno.id)

    if (c.asistencia) {
      await tx.asistenciaTurno.create({
        data: {
          turnoId: turno.id,
          fechaOcurrencia: fechaADate(c.fecha),
          estado: c.asistencia.estado,
          trabajado: c.asistencia.trabajado,
          indicaciones: c.asistencia.indicaciones,
          observacion: c.asistencia.observacion,
          createdById: profesor.usuarioId,
          updatedById: profesor.usuarioId,
          createdAt: c.asistencia.registradaEl,
          updatedAt: c.asistencia.registradaEl,
        },
      })
    }
  }

  // 2. Cobros, en el orden en que se registraron (así el número de comprobante es correlativo).
  const clasesDe = (cobro: CobroResuelto): ClaseResuelta[] =>
    escenario.clases.filter((c) => c.cobro === cobro.clave || c.cobroAnulado === cobro.clave)
  const turnosCobrados: TurnoCobrado[] = []
  const numeroDe = new Map<string, number>()
  const cobrosEnOrden = [...escenario.cobros].sort(
    (a, b) => a.registradoEl.getTime() - b.registradoEl.getTime() || a.indice - b.indice,
  )
  for (const cobro of cobrosEnOrden) {
    const clases = clasesDe(cobro)
    if (clases.length === 0) throw new Error(`El cobro ${cobro.clave} no tiene clases`)
    const alumno = alumnos.get(cobro.alumno)!
    for (const c of clases) {
      if (c.alumno !== cobro.alumno) throw new Error(`El cobro ${cobro.clave} mezcla alumnos`)
    }
    const totalCentavos = clases.reduce(
      (suma, c) => suma + aCentavos(materias.get(c.materia)!.precio),
      0,
    )
    const total = totalCentavos / 100
    const formaPago = await tx.formaPago.findUniqueOrThrow({
      where: { tipoFormaPago: cobro.forma },
      select: { id: true },
    })
    const pago = await tx.pago.create({
      data: {
        alumnoId: alumno.id,
        formaPagoId: formaPago.id,
        importeTotal: aDecimal(total),
        fechaPago: fechaADate(cobro.fechaPago),
        observaciones:
          clases.length > 1 ? `Abona ${clases.length} clases de ${clases[0]!.materia}` : null,
        estado: cobro.anulacion ? 'ANULADO' : 'VIGENTE',
        ...datosDelMedio(cobro, alumno.titular, total),
        createdById: mesaId,
        updatedById: mesaId,
        createdAt: cobro.registradoEl,
        updatedAt: cobro.registradoEl,
      },
      select: { id: true, numeroComprobante: true },
    })
    numeroDe.set(cobro.clave, pago.numeroComprobante)

    const porcentaje = porcentajeEn(cobro.registradoEl)
    for (const c of clases) {
      const precio = materias.get(c.materia)!.precio
      const profesor = profesores.get(c.profesor)!
      const pagoTurno = await tx.pagoTurno.create({
        data: {
          pagoId: pago.id,
          turnoId: turnoDe.get(c.indice)!,
          fechaOcurrencia: fechaADate(c.fecha),
          importeAplicado: aDecimal(precio),
          porcentajeCentro: aDecimal(porcentaje),
          // Un pago anulado deja sus filas en `null` (decisión T-133).
          vigente: cobro.anulacion ? null : true,
        },
        select: { id: true },
      })
      if (c.asistencia) {
        const hora = horaAMinutos(c.hora)
        const alumnoDatos = alumnos.get(c.alumno)!
        turnosCobrados.push({
          cobro: cobro.clave,
          devengado: {
            pagoTurnoId: pagoTurno.id,
            turnoId: turnoDe.get(c.indice)!,
            fecha: c.fecha,
            horaInicio: hora,
            horaFin: hora + 60,
            alumno: {
              id: alumnoDatos.id,
              nombre: alumnoDatos.nombre,
              apellido: alumnoDatos.apellido,
            },
            materia: { id: materias.get(c.materia)!.id, nombre: c.materia },
            profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
            numeroComprobante: pago.numeroComprobante,
            importe: precio,
            porcentaje,
            fechaDevengo: devengo(cobro.registradoEl, c.asistencia.registradaEl),
          },
        })
      }
    }

    if (cobro.anulacion) {
      await tx.anulacionPago.create({
        data: {
          pagoId: pago.id,
          motivo: cobro.anulacion.motivo,
          detalle: cobro.anulacion.detalle,
          createdById: mesaId,
          createdAt: cobro.anulacion.registradaEl,
        },
      })
    }
  }

  // 3. Pagos a profesores: el motor decide qué se cierra y con qué importes; acá sólo se guarda.
  const profesorPorId = new Map([...profesores.entries()].map(([clave, p]) => [clave, p.id]))
  const anulaciones = new Map(
    escenario.cobros.filter((c) => c.anulacion).map((c) => [c.clave, c.anulacion!.fecha]),
  )
  const { pasos, abiertas } = simular({
    turnos: turnosCobrados,
    anulaciones,
    pagos: escenario.pagosDeLiquidacion.map((pago) => ({
      profesorId: profesorPorId.get(pago.profesor)!,
      mes: pago.mes,
      fecha: pago.fecha,
    })),
    hoy: hoyActual,
  })

  const liquidacionTurnoDe = new Map<number, number>() // pagoTurnoId → LiquidacionTurno.id
  let operacion = 0
  for (const paso of pasos) {
    operacion++
    const registradaEl = instante(paso.fecha, '11:20', ahora())
    const idPorMes = new Map<string, number>()
    const idDe = (mes: string) => {
      const id = idPorMes.get(mes)
      if (id === undefined) throw new Error(`Falta la liquidación ${mes} del cierre`)
      return id
    }
    // De la más nueva a la más vieja: la PAGADA primero, así cada DESCONTADA ya tiene el id de la
    // que la absorbió (igual que `liquidacionesRepository.pagar`).
    for (const escritura of [...paso.cierre.escrituras].reverse()) {
      const pagada = escritura.estado === 'PAGADA'
      const creada = await tx.liquidacion.create({
        data: {
          profesorId: paso.profesorId,
          mes: fechaADate(primerDiaDelMes(escritura.mes)),
          estado: escritura.estado,
          totalCobrado: aDecimal(escritura.totalCobrado),
          parteCentro: aDecimal(escritura.parteCentro),
          parteProfesor: aDecimal(escritura.parteProfesor),
          totalAjustes: aDecimal(escritura.totalAjustes),
          total: aDecimal(escritura.total),
          fechaTransferencia: pagada ? fechaADate(paso.fecha) : null,
          numeroOperacion: pagada ? String(58_204_000 + operacion * 311) : null,
          observaciones: pagada && operacion % 3 === 0 ? 'Transferido al CBU declarado.' : null,
          descontadaEnId:
            escritura.descontadaEnMes === null ? null : idDe(escritura.descontadaEnMes),
          createdById: gerenteId,
          createdAt: registradaEl,
          turnos: {
            createMany: {
              data: escritura.turnos.map((turno) => ({
                pagoTurnoId: turno.pagoTurnoId,
                fechaDevengo: fechaADate(turno.fechaDevengo),
                importe: aDecimal(turno.importe),
                porcentajeCentro: aDecimal(turno.porcentaje),
                parteProfesor: aDecimal(turno.parteProfesor),
              })),
            },
          },
        },
        select: { id: true, turnos: { select: { id: true, pagoTurnoId: true } } },
      })
      idPorMes.set(escritura.mes, creada.id)
      for (const turno of creada.turnos) liquidacionTurnoDe.set(turno.pagoTurnoId, turno.id)
    }

    const ajustes = paso.cierre.escrituras.flatMap((escritura) =>
      escritura.ajustes.map((ajuste) => {
        if (ajuste.tipo === 'SALDO_ANTERIOR') {
          return {
            liquidacionId: idDe(escritura.mes),
            tipo: 'SALDO_ANTERIOR' as const,
            importe: aDecimal(ajuste.importe),
            liquidacionOrigenId: idDe(ajuste.mesOrigen),
          }
        }
        // `ajuste.liquidacionTurnoId` es, para la simulación, el `pagoTurnoId` del turno.
        const liquidacionTurnoId = liquidacionTurnoDe.get(ajuste.liquidacionTurnoId)
        if (liquidacionTurnoId === undefined) {
          throw new Error(`No se guardó el turno liquidado ${ajuste.liquidacionTurnoId}`)
        }
        return {
          liquidacionId: idDe(escritura.mes),
          tipo: 'ANULACION' as const,
          importe: aDecimal(ajuste.importe),
          liquidacionTurnoId,
        }
      }),
    )
    if (ajustes.length > 0) await tx.ajusteLiquidacion.createMany({ data: ajustes })
  }

  return { escenario, pasos, abiertas }
}

async function main() {
  const gerente = await usuarioPorEmail(
    requerida(env.SEED_GERENTE_EMAIL, 'SEED_GERENTE_EMAIL'),
    'gerente',
  )
  const mesa = await usuarioPorEmail(
    requerida(env.SEED_MESA_ENTRADAS_EMAIL, 'SEED_MESA_ENTRADAS_EMAIL'),
    'mesa de entradas',
  )
  const passwordProfesor = requerida(env.SEED_PROFESOR_PASSWORD, 'SEED_PROFESOR_PASSWORD')

  const personas = await prepararPersonas(mesa.id, passwordProfesor)

  // Un profesor ya está cargado si tiene algún turno: se pueden sumar profesores al escenario y
  // volver a correr el seed sin duplicar los que ya estaban.
  const pendientes = new Set<ProfesorClave>()
  for (const [clave, profesor] of personas.profesores) {
    const turnos = await prisma.turno.count({
      where: { bloqueAgenda: { profesorId: profesor.id } },
    })
    if (turnos === 0) pendientes.add(clave)
  }
  if (pendientes.size === 0) {
    console.log(
      'Los profesores del escenario ya tienen clases: no se vuelve a cargar nada. ' +
        'Profesores y alumnos quedaron actualizados.',
    )
    return
  }

  const { escenario, pasos, abiertas } = await prisma.$transaction(
    (tx) => cargarEscenario(tx, personas, gerente.id, mesa.id, pendientes),
    TRANSACCION,
  )

  const nombre = (p: { nombre: string; apellido: string }) => `${p.apellido}, ${p.nombre}`
  const profesorDe = (id: number) =>
    [...personas.profesores.values()].find((p) => p.id === id) ?? {
      nombre: '',
      apellido: String(id),
    }

  console.log(
    `Seed de liquidaciones: ${pendientes.size} profesor(es) cargados ahora (${PROFESORES.length} en el ` +
      `escenario), ${escenario.clases.length} clases y ${escenario.cobros.length} cobros ` +
      `(contraseña de los profesores: la de SEED_PROFESOR_PASSWORD).`,
  )
  console.log('\nLiquidaciones cerradas:')
  for (const paso of pasos) {
    for (const e of paso.cierre.escrituras) {
      console.log(
        `  ${nombre(profesorDe(paso.profesorId)).padEnd(20)} ${e.mes}  ${e.estado.padEnd(10)} ` +
          `${pesos.format(e.total)}${e.descontadaEnMes ? `  (absorbida por ${e.descontadaEnMes})` : ''}`,
      )
    }
  }
  console.log('\nLiquidaciones abiertas (las calcula la API al consultar):')
  for (const l of abiertas) {
    console.log(
      `  ${nombre(l.profesor).padEnd(20)} ${l.mes}  ${l.estado.padEnd(18)} ${pesos.format(l.total)}`,
    )
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
