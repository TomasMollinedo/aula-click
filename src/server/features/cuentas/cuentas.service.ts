import { NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { Adeudado } from './cuentas.condiciones'
import type { CuentasRepository } from './cuentas.repository'
import { paginarEnMemoria, primerDiaDelMes, totalDe } from './cuentas.reglas'
import type {
  AdeudadoGlobal,
  AdeudadosGlobal,
  AdeudadosQuery,
  CuentaDelAlumno,
  OcurrenciaDeCuenta,
} from './cuentas.validation'

// Cuenta del alumno y vista global de la deuda (HU-16, T-53). No conoce HTTP ni Prisma: lanza
// AppError o sus subclases. No hace consultas propias: qué se adeuda y qué es próximo lo leen las
// condiciones por el repository; acá se calcula `hoy`, se chequea el alumno, se suma, se pagina y
// se arman los DTOs.

const MENSAJE_ALUMNO_NO_ENCONTRADO = 'Alumno no encontrado'

/**
 * DTO de una ocurrencia de la cuenta, **campo por campo** (nunca con spread de la `Ocurrencia`:
 * `busqueda` es interno). Horas `HH:mm`. Sólo llegan `SIN_REGISTRAR` (adeudados) o `AGENDADO`
 * (próximos): lo garantizan las reglas.
 */
function aOcurrenciaDeCuenta({ ocurrencia, importe }: Adeudado): OcurrenciaDeCuenta {
  return {
    turnoId: ocurrencia.turnoId,
    fecha: ocurrencia.fecha,
    horaInicio: minutosAHora(ocurrencia.horaInicio),
    horaFin: minutosAHora(ocurrencia.horaFin),
    materia: { id: ocurrencia.materia.id, nombre: ocurrencia.materia.nombre },
    profesor: {
      id: ocurrencia.profesor.id,
      nombre: ocurrencia.profesor.nombre,
      apellido: ocurrencia.profesor.apellido,
    },
    estado: ocurrencia.estado as OcurrenciaDeCuenta['estado'],
    importe,
  }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearCuentasService({
  repository,
  alumnosRepository,
  reloj,
}: {
  repository: Pick<
    CuentasRepository,
    'leerAdeudados' | 'leerProximos' | 'sumarPagos' | 'listarPagos' | 'dnisDeAlumnos'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /** 404 si el alumno no existe. Su estado no importa: un alumno dado de baja puede deber. */
  async function exigirAlumno(alumnoId: number): Promise<void> {
    const alumno = await alumnosRepository.buscarPorId(alumnoId)
    if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)
  }

  return {
    /**
     * Cuenta de un alumno: total adeudado, pagado del mes (por `fechaPago`, del día 1 del mes de
     * hoy a hoy), adeudados, próximos e historial de pagos. 404 si el alumno no existe.
     */
    async obtenerCuenta(alumnoId: number): Promise<CuentaDelAlumno> {
      await exigirAlumno(alumnoId)
      const fechaHoy = hoy(reloj)
      const [adeudados, proximos, pagadoDelMes, pagos] = await Promise.all([
        repository.leerAdeudados({ alumnoId, hoy: fechaHoy }),
        repository.leerProximos({ alumnoId, hoy: fechaHoy }),
        repository.sumarPagos(alumnoId, primerDiaDelMes(fechaHoy), fechaHoy),
        repository.listarPagos(alumnoId),
      ])
      return {
        totalAdeudado: totalDe(adeudados),
        pagadoDelMes,
        adeudados: adeudados.map(aOcurrenciaDeCuenta),
        proximos: proximos.map(aOcurrenciaDeCuenta),
        pagos,
      }
    },

    /**
     * Vista global de la deuda, paginada en memoria, del más antiguo al más reciente, con el total
     * de **todos** los adeudados del filtro (no de la página). Con `alumnoId`, 404 si el alumno no
     * existe. El DNI se lee sólo para los alumnos de la página.
     */
    async listarAdeudados(query: AdeudadosQuery): Promise<AdeudadosGlobal> {
      if (query.alumnoId !== undefined) await exigirAlumno(query.alumnoId)
      const adeudados = await repository.leerAdeudados({
        alumnoId: query.alumnoId,
        hoy: hoy(reloj),
      })
      const pagina = paginarEnMemoria(adeudados, query)
      const dnis = await repository.dnisDeAlumnos(pagina.data.map((a) => a.ocurrencia.alumno.id))
      const data = pagina.data.map((adeudado): AdeudadoGlobal => ({
        ...aOcurrenciaDeCuenta(adeudado),
        alumno: {
          id: adeudado.ocurrencia.alumno.id,
          nombre: adeudado.ocurrencia.alumno.nombre,
          apellido: adeudado.ocurrencia.alumno.apellido,
          dni: dnis.get(adeudado.ocurrencia.alumno.id) ?? '',
        },
      }))
      return { data, meta: pagina.meta, totalAdeudado: totalDe(adeudados) }
    },
  }
}

export type CuentasService = ReturnType<typeof crearCuentasService>
