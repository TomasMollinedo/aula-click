// Seed del SPRINT REVIEW 3: deja la base como la de un centro que funciona hace seis meses, para la
// demo del review. NO es el seed de desarrollo (`prisma/seed.ts`, el de `pnpm db:seed`): es un
// script aparte que **lo necesita corrido antes** (roles, gerente, materias con precio, aulas,
// formas de pago y el historial del porcentaje del centro) y que se corre **solo**, sobre una base
// limpia: los totales que deja (deuda y cobrado del mes) son globales y cualquier dato de otro seed
// de demo los rompe. Si encuentra alumnos, profesores, turnos o pagos ajenos, aborta.
//
// Qué arma (todo relativo a `hoy()` en Salta; M = mes en curso, la historia arranca el día 1 de M-6):
//   - 10 profesores con cuenta (`PASSWORD_PROFESORES`), con su horario semanal, sus materias y una
//     carga distinta. Beatriz Aguirre es la principal: hoy tiene 4 horas (8 a 12) con 3 alumnos en
//     cada una, ayer dio clases sin registrar la asistencia (varias ya cobradas) y su liquidación de
//     M-1 queda pendiente de pago.
//   - ~60 alumnos (10 destacados y ~50 de fondo) con altas repartidas en el semestre, series
//     recurrentes (algunas cortadas por el receso invernal de julio, otras finalizadas), sesiones
//     únicas de repaso antes de los exámenes, cancelaciones, asistencias con lo trabajado y las
//     indicaciones de cada clase, exámenes con nota y pagos con las tres formas de pago.
//   - Alejo Alderete, el alumno central: 5.º año, Matemática (2 h) y Física (1 h) con Aguirre desde
//     el principio, historial académico encadenado, exámenes con mejora, acceso al portal y deuda
//     desde fines de M-1 (adeudados y próximos en las dos materias).
//   - Liquidaciones PAGADA de M-6 a M-2 para los 10 profesores (armadas con `cierreDeLiquidacion`, la
//     regla real del cierre), M-1 abierta y pendiente de pago y M en curso.
//   - Ningún movimiento de hoy: la caja del día queda vacía para la demo.
// Al final hay un **cuadre explícito y determinista**: total adeudado = $1.000.000 y cobrado del mes
// hasta ayer = $2.000.000. El seed se verifica a sí mismo con las funciones reales de la app
// (`totalAdeudado`, `totalCobradoEntre`, el motor de ocurrencias y el de liquidaciones) y falla con
// un error claro si algo no da.
//
// Los datos son verosímiles y deterministas (generador con semilla fija). Lo carga `CARGADOR`, una
// usuaria de mesa de entradas **sin cuenta**; las liquidaciones las registra el gerente del seed de
// desarrollo. Martín Pérez y Lucía López (del seed de desarrollo) no se tocan. El horario está
// pensado para correrse un viernes (el día del review); si se corre otro día, la semana rota para
// que "hoy" siga siendo el día de las 4 horas de Aguirre.
//
// Idempotente por "limpiar y recrear": cada corrida borra lo que creó `CARGADOR` (sus profesores con
// sus liquidaciones, sus alumnos con sus turnos, pagos, exámenes y cuenta del portal, también lo que
// se haya registrado desde la app sobre ellos) y lo vuelve a crear.
//
// Cómo correrlo (sobre una base limpia):
//   pnpm prisma migrate reset --force
//   pnpm db:seed
//   pnpm db:seed:review                                  (= pnpm exec tsx prisma/seed-review-sprint3.ts)
//   pnpm exec tsx prisma/seed-review-sprint3.ts --limpiar   sólo borra lo que creó este script
import 'dotenv/config'
import { env } from '@/config/env'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  leerAdeudados,
  leerProximos,
  totalAdeudado,
} from '@/server/features/cuentas/cuentas.condiciones'
import { esAdeudado } from '@/server/features/cuentas/cuentas.reglas'
import {
  cierreDeLiquidacion,
  liquidacionDe,
} from '@/server/features/liquidaciones/liquidaciones.condiciones'
import { estaDevengado, fechaDevengo } from '@/server/features/liquidaciones/liquidaciones.reglas'
import { limiteDeCobro, totalCobradoEntre } from '@/server/features/pagos/pagos.condiciones'
import { repartoDeTurno } from '@/server/features/reparto/reparto.condiciones'
import { leerOcurrencias } from '@/server/features/turnos/ocurrencias.condiciones'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import {
  dateAFecha,
  diaSemanaISO,
  fechaADate,
  fechaEnZona,
  hoy,
  proximaFechaDelDia,
  sumarDias,
} from '@/server/shared/fechas'
import { mesDe, minutosAHora, ultimoDiaDelMes } from '@/server/shared/zod'

// ---------------------------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------------------------

/**
 * Usuaria de mesa de entradas que carga todo, sin cuenta (nadie puede iniciar sesión con ella). Se
 * busca por DNI y no se borra nunca: lo que creó es lo que se limpia.
 */
const CARGADOR = {
  nombre: 'Mariela',
  apellido: 'Toledo',
  dni: '29874015',
  email: 'mariela.toledo@gmail.com',
  telefono: '(387) 15-447-3021',
}

/** Contraseña de los profesores (la misma de los otros seeds de demo). Sólo desarrollo. */
const PASSWORD_PROFESORES = 'demo-1234'

/** Semilla del generador: la misma semilla da siempre el mismo centro. */
const SEMILLA = 20261016

/** Totales globales que tienen que dar exactos (en pesos). */
const DEUDA_OBJETIVO = 1_000_000
const COBRADO_OBJETIVO = 2_000_000

/** Rango de la parte del profesor en la liquidación de M-1 y del "Este mes" de Aguirre. */
const RANGO_LIQUIDACION_M1 = { min: 180_000, max: 650_000 }
const RANGO_ESTE_MES_AGUIRRE = { min: 250_000, max: 400_000 }

/** Ningún texto de la base puede contener estas palabras (búsqueda sin distinguir mayúsculas). */
const PALABRAS_PROHIBIDAS = /seed|demo|test|prueba|ejemplo|lorem|fake|xxx/i

/** Dominio reservado de las cuentas del portal (el mismo de `prisma/seed.ts`). */
const DOMINIO_EMAIL_ALUMNOS = 'alumnos.aulaclick.invalid'

/** Tope de alumnos de fondo (además de los 10 destacados): se crean hasta completar la carga. */
const MAX_FONDO = 80

// ---------------------------------------------------------------------------------------------
// Fechas (todo relativo a hoy, en Salta)
// ---------------------------------------------------------------------------------------------

const HOY = hoy()
const AYER = sumarDias(HOY, -1)

/** `YYYY-MM-DD` del día `dia` del mes a `meses` del actual (el día se recorta al último del mes). */
function enMes(meses: number, dia: number): string {
  const [anio, mes] = HOY.split('-').map(Number) as [number, number]
  const ultimo = new Date(Date.UTC(anio, mes + meses, 0)).getUTCDate()
  return dateAFecha(new Date(Date.UTC(anio, mes - 1 + meses, Math.min(dia, ultimo))))
}

const INICIO = enMes(-6, 1)
const MES_ACTUAL = mesDe(HOY)
const PRIMERO_DEL_MES = enMes(0, 1)
/** Hasta dónde se controlan capacidad y superposición de las series sin fin. */
const HORIZONTE = sumarDias(HOY, 84)

/** Instante de `fecha` a `minutos` desde medianoche, en Salta (UTC-3, sin horario de verano). */
function instante(fecha: string, minutos: number): Date {
  return new Date(`${fecha}T${minutosAHora(minutos)}:00-03:00`)
}

/** Mes (`YYYY-MM`) a `meses` del actual. */
const mesA = (meses: number) => mesDe(enMes(meses, 1))

/** Sábado → viernes, domingo → lunes: un examen cae en un día de colegio. */
function diaHabil(fecha: string): string {
  const dia = diaSemanaISO(fecha)
  return dia === 6 ? sumarDias(fecha, -1) : dia === 7 ? sumarDias(fecha, 1) : fecha
}

/** Fechas de `diaSemana` (ISO) en `[desde, hasta]`. */
function fechasDelDia(diaSemana: number, desde: string, hasta: string): string[] {
  const fechas: string[] = []
  for (let f = proximaFechaDelDia(diaSemana, desde); f <= hasta; f = sumarDias(f, 7)) fechas.push(f)
  return fechas
}

/**
 * El horario se piensa con el viernes como "hoy" (día 5 de la plantilla). Si se corre otro día, la
 * semana rota para que el día 5 de la plantilla sea el de hoy.
 */
const DIA_HOY = diaSemanaISO(HOY)
const diaReal = (plantilla: number) => ((plantilla - 5 + DIA_HOY - 1 + 14) % 7) + 1

/** Receso invernal de Salta: las dos semanas que empiezan el primer lunes desde el 6 de julio. */
function recesoInvernal(): { desde: string; hasta: string } | null {
  const anios = new Set([Number(INICIO.slice(0, 4)), Number(HOY.slice(0, 4))])
  for (const anio of anios) {
    const desde = proximaFechaDelDia(1, `${anio}-07-06`)
    const hasta = sumarDias(desde, 11)
    if (desde >= INICIO && hasta < HOY) return { desde, hasta }
  }
  return null
}
const RECESO = recesoInvernal()

/** Unidad del programa por la que va alguien que empieza en `fecha` (avanza con los meses). */
function unidadDeInicio(programa: Unidad[], fecha: string): number {
  const dias = (fechaADate(fecha).getTime() - fechaADate(INICIO).getTime()) / 864e5
  return Math.min(programa.length - 1, Math.floor(Math.max(0, dias / 30) * 0.8))
}

const NOMBRES_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const nombreMes = (fecha: string) => NOMBRES_MESES[Number(fecha.slice(5, 7)) - 1] as string
const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`

/** `fecha` menos `anios` años de calendario (un 29/02 que no existe pasa a 28/02). */
function restarAnios(fecha: string, anios: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number]
  const destino = anio - anios
  const bisiesto = (destino % 4 === 0 && destino % 100 !== 0) || destino % 400 === 0
  const diaFinal = mes === 2 && dia === 29 && !bisiesto ? 28 : dia
  return `${destino}-${String(mes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------------------------
// Generador determinista
// ---------------------------------------------------------------------------------------------

/** mulberry32: la misma semilla da siempre la misma secuencia. */
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
    de<T>(lista: readonly T[]): T {
      return lista[this.entero(0, lista.length - 1)] as T
    },
    chance(p: number): boolean {
      return this.decimal() < p
    },
    pesado<T>(opciones: readonly [T, number][]): T {
      const total = opciones.reduce((s, [, peso]) => s + peso, 0)
      let r = this.decimal() * total
      for (const [valor, peso] of opciones) {
        r -= peso
        if (r < 0) return valor
      }
      return (opciones.at(-1) as [T, number])[0]
    },
    mezclar<T>(lista: readonly T[]): T[] {
      const copia = [...lista]
      for (let i = copia.length - 1; i > 0; i--) {
        const j = this.entero(0, i)
        ;[copia[i], copia[j]] = [copia[j] as T, copia[i] as T]
      }
      return copia
    },
    /** UUID v4 con los bytes del generador (determinista). */
    uuid(): string {
      const bytes = Array.from({ length: 16 }, () => this.entero(0, 255))
      bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40
      bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
      const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    },
    digitos(cantidad: number): string {
      return Array.from({ length: cantidad }, (_, i) =>
        String(i === 0 ? this.entero(1, 9) : this.entero(0, 9)),
      ).join('')
    },
  }
}
type Azar = ReturnType<typeof crearAzar>

// ---------------------------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------------------------

type Materia = 'MAT' | 'FIS' | 'QUI' | 'LEN' | 'ING' | 'CON'
type Nivel = 'PRIMARIO' | 'SECUNDARIO' | 'TERCIARIO' | 'UNIVERSITARIO'
type Genero = 'F' | 'M'
type Patron = 'MENSUAL' | 'POR_CLASE' | 'ATRASADO' | 'QUINCENAL'
type Forma = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'
type Motivo = 'CANCELACION_ALUMNO' | 'CANCELACION_PROFESOR' | 'PROBLEMA_ADMINISTRATIVO' | 'OTRO'

const NOMBRE_MATERIA: Record<Materia, string> = {
  MAT: 'Matemática',
  FIS: 'Física',
  QUI: 'Química',
  LEN: 'Lengua',
  ING: 'Inglés',
  CON: 'Contabilidad',
}

const NOMBRES_F = [
  'Sofía',
  'Martina',
  'Catalina',
  'Julieta',
  'Camila',
  'Emilia',
  'Renata',
  'Guadalupe',
  'Malena',
  'Agustina',
  'Pilar',
  'Josefina',
  'Florencia',
  'Micaela',
  'Antonella',
  'Milagros',
  'Abril',
  'Lourdes',
  'Candela',
  'Rocío',
  'Luciana',
  'Victoria',
  'Paloma',
  'Ailén',
  'Morena',
  'Brenda',
]
const NOMBRES_M = [
  'Benicio',
  'Thiago',
  'Lorenzo',
  'Santino',
  'Facundo',
  'Bruno',
  'Ramiro',
  'Matías',
  'Nicolás',
  'Franco',
  'Lautaro',
  'Emiliano',
  'Agustín',
  'Valentín',
  'Gonzalo',
  'Máximo',
  'Felipe',
  'Santiago',
  'Juan Cruz',
  'Mateo',
  'Lucas',
  'Gabriel',
  'Ezequiel',
  'Leonel',
  'Kevin',
]
const APELLIDOS = [
  'Villagrán',
  'Yapura',
  'Aramayo',
  'Vilte',
  'Farfán',
  'Leguizamón',
  'Nieva',
  'Bravo',
  'Carrizo',
  'Domínguez',
  'Escalante',
  'Fernández',
  'Gallo',
  'Sosa',
  'Paz',
  'Vera',
  'Arias',
  'Ibáñez',
  'Juárez',
  'Lamas',
  'Medina',
  'Ortiz',
  'Palacios',
  'Soria',
  'Torres',
  'Zalazar',
  'Choque',
  'Mendoza',
  'Alfaro',
  'Barrios',
  'Castro',
  'Díaz',
  'Funes',
  'Liendro',
  'Cardozo',
  'Romero',
  'Rivero',
  'Valdez',
  'Pastrana',
  'Ontiveros',
  'Tolaba',
  'Guanuco',
  'Quispe',
  'Apaza',
  'Cáceres',
  'Correa',
  'Moya',
  'Agüero',
  'Rodas',
  'Lobo',
]
const TUTORES_F = [
  'Claudia',
  'Gabriela',
  'Silvina',
  'Mariana',
  'Andrea',
  'Carina',
  'Patricia',
  'Romina',
  'Soledad',
  'Cecilia',
  'Viviana',
  'Mónica',
  'Alejandra',
  'Vanesa',
]
const TUTORES_M = [
  'Marcelo',
  'Sergio',
  'Diego',
  'Fernando',
  'Pablo',
  'Hernán',
  'Javier',
  'Walter',
  'Raúl',
  'Daniel',
  'Carlos',
  'Rubén',
  'Gerardo',
  'Néstor',
]

const COLEGIOS_SECUNDARIOS = [
  'Colegio Belgrano',
  'Bachillerato Humanista Moderno',
  'Colegio Nacional de Salta',
  'Colegio del Huerto',
  'Colegio de Jesús',
  'Colegio Santa Rosa de Viterbo',
  'Escuela Normal Gral. Manuel Belgrano',
  'Colegio San Pablo',
  'Colegio San Alberto Magno',
]
const ESCUELAS_PRIMARIAS = [
  'Colegio de Jesús',
  'Colegio del Huerto',
  'Colegio Belgrano',
  'Colegio San Pablo',
  'Escuela Normal Gral. Manuel Belgrano',
]
const TERCIARIOS = [
  { institucion: 'Instituto Superior del Profesorado de Salta', carrera: 'Profesorado de Inglés' },
  { institucion: 'Instituto Monseñor Tavella', carrera: 'Tecnicatura en Administración' },
  { institucion: 'Instituto Superior del Profesorado de Salta', carrera: 'Profesorado de Lengua' },
]
const UNIVERSIDADES = [
  { institucion: 'Universidad Nacional de Salta (UNSa)', carrera: 'Ingeniería Civil' },
  { institucion: 'Universidad Nacional de Salta (UNSa)', carrera: 'Ingeniería Química' },
  { institucion: 'Universidad Nacional de Salta (UNSa)', carrera: 'Contador Público' },
  { institucion: 'Universidad Nacional de Salta (UNSa)', carrera: 'Bioquímica' },
  { institucion: 'Universidad Católica de Salta (UCASAL)', carrera: 'Contador Público' },
  { institucion: 'Universidad Católica de Salta (UCASAL)', carrera: 'Ingeniería Industrial' },
  { institucion: 'Universidad Católica de Salta (UCASAL)', carrera: 'Licenciatura en Nutrición' },
]

const BANCOS = [
  'Banco Macro',
  'Banco Macro',
  'Banco Macro',
  'Banco de la Nación Argentina',
  'Banco Galicia',
  'Banco Santander',
  'Mercado Pago',
  'Mercado Pago',
  'Brubank',
  'Naranja X',
]

const PROVEEDORES_EMAIL = ['gmail.com', 'gmail.com', 'gmail.com', 'hotmail.com', 'yahoo.com.ar']

/** Celular de Salta como lo escribe la gente: `(387) 15-4xx-xxxx`. */
function telefono(azar: Azar): string {
  return `(387) 15-${azar.entero(400, 599)}-${String(azar.entero(0, 9999)).padStart(4, '0')}`
}

const sinSimbolos = (texto: string) => normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '')

/** DNI coherente con el año de nacimiento (los más jóvenes tienen números más altos). */
function dniPara(anioNacimiento: number, azar: Azar): string {
  const base = 28_000_000 + (anioNacimiento - 1980) * 770_000
  return String(base + azar.entero(-250_000, 250_000))
}

const busquedaDe = (nombre: string, apellido: string, dni: string) =>
  normalizarBusqueda(`${apellido} ${nombre} ${dni}`)

// ---------------------------------------------------------------------------------------------
// Profesores (horario con la plantilla de días: 1 = lunes … 6 = sábado; 5 = el día de hoy)
// ---------------------------------------------------------------------------------------------

type ProfesorDef = {
  clave: string
  nombre: string
  apellido: string
  genero: Genero
  dni: string
  email: string
  telefono: string
  titulo: string
  matricula: string
  capacidad: number
  materias: Materia[]
  /** [día de la plantilla, hora desde, hora hasta) */
  horario: [number, number, number][]
  /** Horas-alumno semanales que se le intentan asignar (Aguirre tiene su grilla fija). */
  carga: number
  /** Proporción de presentes, de asistencias registradas tarde y de clases que nunca registra. */
  presentismo: number
  registroTarde: number
  sinRegistrar: number
}

const PROFESORES: ProfesorDef[] = [
  {
    clave: 'aguirre',
    nombre: 'Beatriz',
    apellido: 'Aguirre',
    genero: 'F',
    dni: '28914356',
    email: 'beatriz.aguirre@gmail.com',
    telefono: '(387) 15-413-6648',
    titulo: 'Profesora en Matemática y Física',
    matricula: 'MP-0418',
    capacidad: 3,
    materias: ['MAT', 'FIS'],
    horario: [
      [1, 17, 19],
      [2, 17, 19],
      [3, 17, 19],
      [4, 17, 20],
      [5, 8, 12],
    ],
    carga: 0,
    presentismo: 0.92,
    registroTarde: 0.1,
    sinRegistrar: 0,
  },
  {
    clave: 'mamani',
    nombre: 'Gustavo',
    apellido: 'Mamaní',
    genero: 'M',
    dni: '26487315',
    email: 'gustavo.mamani@hotmail.com',
    telefono: '(387) 15-428-9134',
    titulo: 'Profesor en Matemática',
    matricula: 'MP-0352',
    capacidad: 4,
    materias: ['MAT'],
    horario: [
      [1, 14, 18],
      [3, 14, 18],
      [6, 9, 12],
    ],
    carga: 15,
    presentismo: 0.9,
    registroTarde: 0.15,
    sinRegistrar: 0.02,
  },
  {
    clave: 'cruz',
    nombre: 'Natalia',
    apellido: 'Cruz',
    genero: 'F',
    dni: '31205874',
    email: 'natalia.cruz@gmail.com',
    telefono: '(387) 15-466-2071',
    titulo: 'Traductora Pública de Inglés',
    matricula: 'MP-0467',
    capacidad: 4,
    materias: ['ING'],
    horario: [
      [1, 18, 20],
      [2, 18, 20],
      [3, 18, 20],
      [4, 18, 20],
      [6, 9, 12],
    ],
    carga: 13,
    presentismo: 0.88,
    registroTarde: 0.1,
    sinRegistrar: 0.02,
  },
  {
    clave: 'saravia',
    nombre: 'Federico',
    apellido: 'Saravia',
    genero: 'M',
    dni: '27650119',
    email: 'federico.saravia@yahoo.com.ar',
    telefono: '(387) 15-509-3346',
    titulo: 'Ingeniero Electrónico',
    matricula: 'MP-0389',
    capacidad: 3,
    materias: ['FIS', 'MAT'],
    horario: [
      [2, 14, 18],
      [4, 14, 18],
      [5, 15, 18],
    ],
    carga: 12,
    presentismo: 0.86,
    registroTarde: 0.45,
    sinRegistrar: 0.05,
  },
  {
    clave: 'gutierrez',
    nombre: 'Carolina',
    apellido: 'Gutiérrez',
    genero: 'F',
    dni: '30118642',
    email: 'carolina.gutierrez@gmail.com',
    telefono: '(387) 15-441-8820',
    titulo: 'Licenciada en Química',
    matricula: 'MP-0431',
    capacidad: 3,
    materias: ['QUI'],
    horario: [
      [1, 15, 19],
      [3, 15, 19],
      [5, 9, 12],
    ],
    carga: 10,
    presentismo: 0.92,
    registroTarde: 0.05,
    sinRegistrar: 0.01,
  },
  {
    clave: 'figueroa',
    nombre: 'Leandro',
    apellido: 'Figueroa',
    genero: 'M',
    dni: '32456980',
    email: 'leandro.figueroa@hotmail.com',
    telefono: '(387) 15-583-1207',
    titulo: 'Contador Público',
    matricula: 'MP-0503',
    capacidad: 3,
    materias: ['CON', 'MAT'],
    horario: [
      [2, 18, 20],
      [3, 18, 20],
      [4, 18, 20],
      [6, 10, 12],
    ],
    carga: 8,
    presentismo: 0.89,
    registroTarde: 0.1,
    sinRegistrar: 0.03,
  },
  {
    clave: 'cornejo',
    nombre: 'Paula',
    apellido: 'Cornejo',
    genero: 'F',
    dni: '29870321',
    email: 'paula.cornejo@gmail.com',
    telefono: '(387) 15-452-6619',
    titulo: 'Profesora en Lengua y Literatura',
    matricula: 'MP-0377',
    capacidad: 3,
    materias: ['LEN'],
    horario: [
      [1, 9, 12],
      [3, 9, 12],
      [2, 15, 17],
    ],
    carga: 9,
    presentismo: 0.93,
    registroTarde: 0.05,
    sinRegistrar: 0.01,
  },
  {
    clave: 'zerpa',
    nombre: 'Daniela',
    apellido: 'Zerpa',
    genero: 'F',
    dni: '33561047',
    email: 'daniela.zerpa@yahoo.com.ar',
    telefono: '(387) 15-497-0453',
    titulo: 'Profesora de Inglés',
    matricula: 'MP-0526',
    capacidad: 4,
    materias: ['ING'],
    horario: [
      [2, 8, 12],
      [4, 8, 12],
      [1, 14, 16],
      [3, 14, 16],
      [5, 14, 16],
      [6, 9, 11],
    ],
    carga: 14,
    presentismo: 0.84,
    registroTarde: 0.12,
    sinRegistrar: 0.04,
  },
  {
    clave: 'chocobar',
    nombre: 'Ricardo',
    apellido: 'Chocobar',
    genero: 'M',
    dni: '25713408',
    email: 'ricardo.chocobar@gmail.com',
    telefono: '(387) 15-418-7762',
    titulo: 'Profesor en Física',
    matricula: 'MP-0329',
    capacidad: 3,
    materias: ['FIS', 'QUI'],
    horario: [
      [3, 16, 20],
      [5, 16, 20],
      [6, 8, 10],
    ],
    carga: 12,
    presentismo: 0.9,
    registroTarde: 0.25,
    sinRegistrar: 0.06,
  },
  {
    clave: 'burgos',
    nombre: 'Lorena',
    apellido: 'Burgos',
    genero: 'F',
    dni: '30784215',
    email: 'lorena.burgos@hotmail.com',
    telefono: '(387) 15-534-2290',
    titulo: 'Profesora en Letras',
    matricula: 'MP-0458',
    capacidad: 4,
    materias: ['LEN'],
    horario: [
      [4, 15, 18],
      [5, 15, 18],
      [1, 18, 20],
    ],
    carga: 9,
    presentismo: 0.9,
    registroTarde: 0.05,
    sinRegistrar: 0.02,
  },
]

// ---------------------------------------------------------------------------------------------
// Alumnos destacados
// ---------------------------------------------------------------------------------------------

type TutorDatos = {
  nombre: string
  apellido: string
  genero: Genero
  dni: string | null
  telefono: string
  email: string
}

type AlumnoModelo = {
  clave: string
  nombre: string
  apellido: string
  genero: Genero
  dni: string
  fechaNacimiento: string
  nivel: Nivel
  grado: string | null
  institucion: string | null
  telefono: string | null
  email: string | null
  tutor: TutorDatos | null
  observaciones: string | null
  patron: Patron
  forma: Forma
  banco: string
  red: 'VISA_DEBITO' | 'MASTERCARD_DEBITO' | 'MAESTRO' | 'CABAL_DEBITO'
  ultimos4: string
  /** Desde esta fecha no paga más (deuda vencida). */
  deudaDesde: string | null
  /** Alumno de la grilla fija de Aguirre: no tiene deuda (salvo Alejo). */
  deAguirre: boolean
  /** Materias que se le asignan al azar (con cuántas horas), además de las de la grilla fija. */
  extras: { materia: Materia; horas: number }[]
  /**
   * Materias posibles para su nivel (con su peso). En los alumnos de fondo, la materia de cada
   * `extra` se elige al asignarla, según qué profesores están más lejos de su carga.
   */
  opcionesMateria: [Materia, number][] | null
  /** Desde cuándo cursa lo que se le asigna al azar. */
  inicio: string
  /** Fin de su última serie (finalización), si dejó. */
  deja: string | null
  createdAt: Date | null
}

type DestacadoDef = Omit<
  AlumnoModelo,
  | 'banco'
  | 'red'
  | 'ultimos4'
  | 'deudaDesde'
  | 'deAguirre'
  | 'createdAt'
  | 'deja'
  | 'opcionesMateria'
> & { edadDias: number }

/** Destacados: la fecha de nacimiento sale de la edad (años) y `edadDias` (días antes). */
function destacados(): DestacadoDef[] {
  return [
    {
      clave: 'alejo',
      nombre: 'Alejo',
      apellido: 'Alderete',
      genero: 'M',
      dni: '49318274',
      fechaNacimiento: '17',
      edadDias: 219,
      nivel: 'SECUNDARIO',
      grado: '5.º año',
      institucion: 'Colegio Belgrano',
      telefono: '(387) 15-461-2087',
      email: 'alejo.alderete@gmail.com',
      tutor: {
        nombre: 'Verónica',
        apellido: 'Ruiz',
        genero: 'F',
        dni: '25861437',
        telefono: '(387) 15-432-7718',
        email: 'veronica.ruiz@hotmail.com',
      },
      observaciones:
        'Se prepara para el ingreso a Ingeniería en la UNSa. Viene dos veces por semana a ' +
        'Matemática y una a Física con la profesora Aguirre.',
      patron: 'QUINCENAL',
      forma: 'TRANSFERENCIA',
      extras: [],
      inicio: INICIO,
    },
    {
      clave: 'valentina',
      nombre: 'Valentina',
      apellido: 'Ríos',
      genero: 'F',
      dni: '50127493',
      fechaNacimiento: '16',
      edadDias: 87,
      nivel: 'SECUNDARIO',
      grado: '4.º año',
      institucion: 'Bachillerato Humanista Moderno',
      telefono: '(387) 15-476-3302',
      email: null,
      tutor: {
        nombre: 'Marcelo',
        apellido: 'Ríos',
        genero: 'M',
        dni: '24310588',
        telefono: '(387) 15-420-9915',
        email: 'marcelo.rios@gmail.com',
      },
      observaciones: 'Compañera de Alejo en el horario del viernes.',
      patron: 'MENSUAL',
      forma: 'TRANSFERENCIA',
      extras: [],
      inicio: INICIO,
    },
    {
      clave: 'tomas',
      nombre: 'Tomás',
      apellido: 'Guaymás',
      genero: 'M',
      dni: '49702615',
      fechaNacimiento: '17',
      edadDias: 41,
      nivel: 'SECUNDARIO',
      grado: '5.º año',
      institucion: 'Colegio Nacional de Salta',
      telefono: '(387) 15-488-0127',
      email: 'tomas.guaymas@gmail.com',
      tutor: {
        nombre: 'Claudia',
        apellido: 'Vilte',
        genero: 'F',
        dni: '26905341',
        telefono: '(387) 15-455-6203',
        email: 'claudia.vilte@yahoo.com.ar',
      },
      observaciones: 'Quiere seguir Ingeniería Química. Le cuesta el planteo de los problemas.',
      patron: 'POR_CLASE',
      forma: 'EFECTIVO',
      extras: [{ materia: 'ING', horas: 1 }],
      inicio: enMes(-5, 4),
    },
    {
      clave: 'delfina',
      nombre: 'Delfina',
      apellido: 'Colque',
      genero: 'F',
      dni: '54861203',
      fechaNacimiento: '11',
      edadDias: 150,
      nivel: 'PRIMARIO',
      grado: '6.º grado',
      institucion: 'Colegio de Jesús',
      telefono: null,
      email: null,
      tutor: {
        nombre: 'Sergio',
        apellido: 'Colque',
        genero: 'M',
        dni: '29104766',
        telefono: '(387) 15-503-4418',
        email: 'sergio.colque@hotmail.com',
      },
      observaciones: 'La trae la abuela los lunes. Necesita acompañamiento en comprensión lectora.',
      patron: 'MENSUAL',
      forma: 'EFECTIVO',
      extras: [
        { materia: 'LEN', horas: 1 },
        { materia: 'MAT', horas: 1 },
      ],
      inicio: enMes(-6, 6),
    },
    {
      clave: 'joaquin',
      nombre: 'Joaquín',
      apellido: 'Ovando',
      genero: 'M',
      dni: '46218907',
      fechaNacimiento: '20',
      edadDias: 263,
      nivel: 'UNIVERSITARIO',
      grado: 'Ingeniería Civil, 1.º año',
      institucion: 'Universidad Nacional de Salta (UNSa)',
      telefono: '(387) 15-512-6631',
      email: 'joaquin.ovando@gmail.com',
      tutor: null,
      observaciones: 'Recursa Análisis Matemático I y Física I en la facultad.',
      patron: 'MENSUAL',
      forma: 'TRANSFERENCIA',
      extras: [{ materia: 'FIS', horas: 1 }],
      inicio: enMes(-6, 3),
    },
    {
      clave: 'camila',
      nombre: 'Camila',
      apellido: 'Herrera',
      genero: 'F',
      dni: '44587120',
      fechaNacimiento: '22',
      edadDias: 120,
      nivel: 'UNIVERSITARIO',
      grado: 'Contador Público, 2.º año',
      institucion: 'Universidad Católica de Salta (UCASAL)',
      telefono: '(387) 15-437-9054',
      email: 'camila.herrera@hotmail.com',
      tutor: null,
      observaciones: 'Trabaja a la mañana: sólo puede venir después de las 18.',
      patron: 'ATRASADO',
      forma: 'TRANSFERENCIA',
      extras: [
        { materia: 'CON', horas: 2 },
        { materia: 'ING', horas: 1 },
      ],
      inicio: enMes(-6, 8),
    },
    {
      clave: 'martina',
      nombre: 'Martina',
      apellido: 'Cabrera',
      genero: 'F',
      dni: '51406872',
      fechaNacimiento: '15',
      edadDias: 33,
      nivel: 'SECUNDARIO',
      grado: '3.º año',
      institucion: 'Colegio del Huerto',
      telefono: '(387) 15-579-2048',
      email: null,
      tutor: {
        nombre: 'Gabriela',
        apellido: 'Cabrera',
        genero: 'F',
        dni: '27318840',
        telefono: '(387) 15-461-7783',
        email: 'gabriela.cabrera@gmail.com',
      },
      observaciones: null,
      patron: 'MENSUAL',
      forma: 'DEBITO',
      extras: [{ materia: 'QUI', horas: 1 }],
      inicio: enMes(-6, 2),
    },
    {
      clave: 'bautista',
      nombre: 'Bautista',
      apellido: 'Quiroga',
      genero: 'M',
      dni: '52390174',
      fechaNacimiento: '14',
      edadDias: 200,
      nivel: 'SECUNDARIO',
      grado: '2.º año',
      institucion: 'Colegio San Pablo',
      telefono: null,
      email: null,
      tutor: {
        nombre: 'Diego',
        apellido: 'Quiroga',
        genero: 'M',
        dni: '28566017',
        telefono: '(387) 15-590-1432',
        email: 'diego.quiroga@gmail.com',
      },
      observaciones: 'Viene después del colegio, los martes y jueves.',
      patron: 'POR_CLASE',
      forma: 'EFECTIVO',
      extras: [
        { materia: 'ING', horas: 1 },
        { materia: 'MAT', horas: 1 },
      ],
      inicio: enMes(-2, 10),
    },
    {
      clave: 'ignacio',
      nombre: 'Ignacio',
      apellido: 'Sandoval',
      genero: 'M',
      dni: '47055381',
      fechaNacimiento: '19',
      edadDias: 77,
      nivel: 'TERCIARIO',
      grado: 'Profesorado de Inglés, 1.º año',
      institucion: 'Instituto Superior del Profesorado de Salta',
      telefono: '(387) 15-426-8891',
      email: 'ignacio.sandoval@yahoo.com.ar',
      tutor: null,
      observaciones: null,
      patron: 'QUINCENAL',
      forma: 'EFECTIVO',
      extras: [
        { materia: 'LEN', horas: 1 },
        { materia: 'ING', horas: 2 },
      ],
      inicio: enMes(-5, 11),
    },
    {
      clave: 'sofia',
      nombre: 'Sofía',
      apellido: 'Tapia',
      genero: 'F',
      dni: '48102269',
      fechaNacimiento: '18',
      edadDias: 190,
      nivel: 'SECUNDARIO',
      grado: '5.º año',
      institucion: 'Colegio de Jesús',
      telefono: '(387) 15-448-5036',
      email: 'sofia.tapia@gmail.com',
      tutor: null,
      observaciones: 'Prepara el ingreso a Bioquímica.',
      patron: 'MENSUAL',
      forma: 'DEBITO',
      extras: [{ materia: 'QUI', horas: 1 }],
      inicio: enMes(-6, 2),
    },
  ]
}

// ---------------------------------------------------------------------------------------------
// Grilla fija de Aguirre (días de la plantilla). `f<n>` son alumnos de fondo.
// ---------------------------------------------------------------------------------------------

type FilaGrilla = {
  alumno: string
  materia: 'MAT' | 'FIS'
  horas: [number, number][]
  desde: string
  /** Fecha de fin cargada en el alta. */
  hasta?: string
  finaliza?: { desde: string; detalle: string }
  receso?: boolean
}

function grillaAguirre(): FilaGrilla[] {
  return [
    // Alejo: Matemática martes 17 y "hoy" 10, Física jueves 18. Corta en el receso de julio.
    {
      alumno: 'alejo',
      materia: 'MAT',
      horas: [
        [2, 17],
        [5, 10],
      ],
      desde: INICIO,
      receso: true,
    },
    { alumno: 'alejo', materia: 'FIS', horas: [[4, 18]], desde: INICIO, receso: true },
    // Hoy, 10 a 11: Alejo con dos compañeros destacados.
    { alumno: 'valentina', materia: 'MAT', horas: [[5, 10]], desde: enMes(-6, 6) },
    { alumno: 'tomas', materia: 'FIS', horas: [[5, 10]], desde: enMes(-5, 4), receso: true },
    // Hoy, 8 a 9.
    { alumno: 'joaquin', materia: 'MAT', horas: [[5, 8]], desde: enMes(-6, 3) },
    { alumno: 'f1', materia: 'FIS', horas: [[5, 8]], desde: enMes(-6, 8), receso: true },
    { alumno: 'f2', materia: 'MAT', horas: [[5, 8]], desde: enMes(-2, 3) },
    {
      alumno: 'f3',
      materia: 'MAT',
      horas: [[5, 8]],
      desde: enMes(-6, 1),
      finaliza: { desde: enMes(-4, 12), detalle: 'Aprobó el trimestral y deja de venir por ahora' },
    },
    // Hoy, 9 a 10.
    { alumno: 'martina', materia: 'MAT', horas: [[5, 9]], desde: enMes(-6, 2), receso: true },
    { alumno: 'f4', materia: 'FIS', horas: [[5, 9]], desde: enMes(-2, 5) },
    { alumno: 'f5', materia: 'MAT', horas: [[5, 9]], desde: enMes(-6, 7) },
    { alumno: 'f6', materia: 'FIS', horas: [[5, 9]], desde: enMes(-6, 9), hasta: enMes(-3, 3) },
    // Hoy, 11 a 12.
    { alumno: 'f7', materia: 'MAT', horas: [[5, 11]], desde: enMes(-6, 1) },
    { alumno: 'f8', materia: 'MAT', horas: [[5, 11]], desde: enMes(-1, 24) },
    { alumno: 'f9', materia: 'FIS', horas: [[5, 11]], desde: enMes(-6, 10), receso: true },
    {
      alumno: 'f19',
      materia: 'MAT',
      horas: [[5, 11]],
      desde: enMes(-6, 1),
      finaliza: { desde: enMes(-2, 20), detalle: 'Se cambió al turno tarde del colegio' },
    },
    // Jueves (ayer): todos pagan el mes por adelantado, salvo Alejo.
    { alumno: 'sofia', materia: 'FIS', horas: [[4, 17]], desde: enMes(-6, 2) },
    { alumno: 'f10', materia: 'MAT', horas: [[4, 17]], desde: enMes(-2, 4) },
    { alumno: 'f11', materia: 'FIS', horas: [[4, 18]], desde: enMes(-6, 9) },
    { alumno: 'f12', materia: 'MAT', horas: [[4, 19]], desde: enMes(-6, 2) },
    { alumno: 'f13', materia: 'MAT', horas: [[4, 19]], desde: enMes(0, 1) },
    // Martes y lunes.
    { alumno: 'f14', materia: 'MAT', horas: [[2, 17]], desde: enMes(-6, 7) },
    { alumno: 'f15', materia: 'FIS', horas: [[2, 18]], desde: enMes(-4, 2) },
    {
      alumno: 'f20',
      materia: 'MAT',
      horas: [[2, 18]],
      desde: enMes(-6, 14),
      finaliza: { desde: enMes(-3, 1), detalle: 'Terminó de preparar la mesa de julio' },
    },
    { alumno: 'f16', materia: 'MAT', horas: [[1, 17]], desde: enMes(-6, 6) },
    // Alumnos nuevos de septiembre y octubre (época de evaluaciones).
    { alumno: 'f17', materia: 'FIS', horas: [[1, 17]], desde: enMes(0, 1) },
    { alumno: 'f18', materia: 'MAT', horas: [[1, 18]], desde: enMes(-1, 26) },
  ]
}

/** Alumnos de fondo de la grilla de Aguirre que son universitarios (el resto, secundario). */
const FONDO_UNIVERSITARIO = new Set(['f14', 'f17'])

// ---------------------------------------------------------------------------------------------
// Programas: lo que se trabaja clase a clase
// ---------------------------------------------------------------------------------------------

type Unidad = { nombre: string; subtemas: string[] }

const MAT_QUINTO: Unidad[] = [
  {
    nombre: 'Funciones',
    subtemas: [
      'concepto de función y sus formas de representación',
      'dominio e imagen a partir del gráfico',
      'dominio de funciones racionales y con raíces',
      'ceros e intervalos de positividad y negatividad',
      'crecimiento, decrecimiento y extremos',
      'composición de funciones y función inversa',
    ],
  },
  {
    nombre: 'Función lineal y cuadrática',
    subtemas: [
      'pendiente y ordenada al origen',
      'rectas paralelas y perpendiculares',
      'sistemas de ecuaciones lineales con dos incógnitas',
      'función cuadrática: vértice, eje de simetría y raíces',
      'forma canónica y factorizada de la cuadrática',
      'problemas de optimización con funciones cuadráticas',
    ],
  },
  {
    nombre: 'Función exponencial y logarítmica',
    subtemas: [
      'potencias de exponente racional y función exponencial',
      'gráficos y desplazamientos de la exponencial',
      'definición y propiedades de los logaritmos',
      'ecuaciones exponenciales',
      'ecuaciones logarítmicas',
      'problemas de crecimiento y decaimiento',
    ],
  },
  {
    nombre: 'Trigonometría',
    subtemas: [
      'razones trigonométricas en el triángulo rectángulo',
      'sistema circular y circunferencia trigonométrica',
      'teorema del seno y del coseno',
      'identidades trigonométricas',
      'ecuaciones trigonométricas',
    ],
  },
  {
    nombre: 'Sucesiones',
    subtemas: [
      'sucesiones: término general y definición recursiva',
      'progresiones aritméticas',
      'progresiones geométricas',
    ],
  },
  {
    nombre: 'Introducción a límites',
    subtemas: [
      'noción intuitiva de límite con tablas y gráficos',
      'límites laterales',
      'cálculo de límites con indeterminación 0/0',
    ],
  },
]

const FIS_SECUNDARIO: Unidad[] = [
  {
    nombre: 'Cinemática',
    subtemas: [
      'sistema de referencia, posición y desplazamiento',
      'movimiento rectilíneo uniforme (MRU)',
      'gráficos de posición y velocidad en función del tiempo',
      'MRUV: aceleración y ecuaciones horarias',
      'encuentro de dos móviles',
    ],
  },
  {
    nombre: 'Caída libre y tiro vertical',
    subtemas: [
      'caída libre',
      'tiro vertical hacia arriba',
      'problemas combinados de caída libre y tiro vertical',
    ],
  },
  {
    nombre: 'Tiro oblicuo',
    subtemas: [
      'composición de movimientos',
      'tiro horizontal',
      'tiro oblicuo: alcance y altura máxima',
    ],
  },
  {
    nombre: 'Dinámica',
    subtemas: [
      'leyes de Newton',
      'diagramas de cuerpo libre',
      'plano inclinado',
      'fuerza de rozamiento',
    ],
  },
  {
    nombre: 'Trabajo y energía',
    subtemas: [
      'trabajo de una fuerza',
      'energía cinética y potencial',
      'conservación de la energía mecánica',
      'potencia',
    ],
  },
]

const MAT_SECUNDARIO: Unidad[] = [
  {
    nombre: 'Números reales',
    subtemas: [
      'operaciones con radicales',
      'racionalización de denominadores',
      'notación científica',
    ],
  },
  {
    nombre: 'Polinomios',
    subtemas: [
      'operaciones con polinomios',
      'regla de Ruffini y teorema del resto',
      'casos de factoreo',
    ],
  },
  {
    nombre: 'Ecuaciones e inecuaciones',
    subtemas: [
      'ecuaciones de primer grado',
      'inecuaciones y su representación',
      'ecuaciones con módulo',
    ],
  },
  {
    nombre: 'Función lineal',
    subtemas: ['pendiente y ordenada al origen', 'ecuación de la recta', 'sistemas de ecuaciones'],
  },
  {
    nombre: 'Función cuadrática',
    subtemas: [
      'gráfico de la parábola',
      'fórmula resolvente',
      'problemas con ecuaciones cuadráticas',
    ],
  },
  {
    nombre: 'Trigonometría',
    subtemas: [
      'razones trigonométricas',
      'resolución de triángulos rectángulos',
      'problemas de aplicación',
    ],
  },
]

const MAT_PRIMARIO: Unidad[] = [
  {
    nombre: 'Fracciones',
    subtemas: [
      'fracciones equivalentes',
      'suma y resta de fracciones',
      'multiplicación y división de fracciones',
    ],
  },
  {
    nombre: 'Números decimales',
    subtemas: ['expresiones decimales', 'operaciones con decimales', 'problemas con dinero'],
  },
  {
    nombre: 'Proporcionalidad',
    subtemas: ['proporcionalidad directa', 'porcentaje', 'escalas'],
  },
  {
    nombre: 'Geometría',
    subtemas: ['perímetro de figuras', 'área de figuras', 'ángulos y triángulos'],
  },
]

const MAT_UNIVERSITARIO: Unidad[] = [
  {
    nombre: 'Funciones y límites',
    subtemas: ['funciones elementales', 'límites y continuidad', 'asíntotas'],
  },
  {
    nombre: 'Derivadas',
    subtemas: ['definición de derivada', 'reglas de derivación', 'regla de la cadena'],
  },
  {
    nombre: 'Aplicaciones de la derivada',
    subtemas: ['recta tangente', 'máximos y mínimos', 'estudio completo de funciones'],
  },
  {
    nombre: 'Integrales',
    subtemas: [
      'integrales inmediatas',
      'sustitución',
      'integración por partes',
      'área entre curvas',
    ],
  },
]

const FIS_UNIVERSITARIO: Unidad[] = [
  {
    nombre: 'Vectores y cinemática',
    subtemas: ['álgebra vectorial', 'cinemática en dos dimensiones', 'movimiento circular'],
  },
  {
    nombre: 'Dinámica de la partícula',
    subtemas: ['leyes de Newton', 'rozamiento', 'dinámica del movimiento circular'],
  },
  {
    nombre: 'Trabajo y energía',
    subtemas: ['teorema del trabajo y la energía', 'fuerzas conservativas', 'potencia'],
  },
  {
    nombre: 'Sistemas de partículas',
    subtemas: ['centro de masa', 'cantidad de movimiento', 'choques'],
  },
]

const QUIMICA: Unidad[] = [
  {
    nombre: 'Estructura atómica',
    subtemas: ['partículas subatómicas', 'configuración electrónica', 'tabla periódica'],
  },
  {
    nombre: 'Uniones químicas',
    subtemas: ['unión iónica', 'unión covalente', 'estructuras de Lewis'],
  },
  { nombre: 'Nomenclatura', subtemas: ['óxidos e hidróxidos', 'ácidos', 'sales'] },
  {
    nombre: 'Estequiometría',
    subtemas: ['mol y masa molar', 'balanceo de ecuaciones', 'reactivo limitante'],
  },
  { nombre: 'Soluciones', subtemas: ['concentración porcentual', 'molaridad', 'diluciones'] },
]

const LENGUA_PRIMARIO: Unidad[] = [
  {
    nombre: 'Comprensión lectora',
    subtemas: ['lectura de cuentos', 'idea principal de un texto', 'secuencia narrativa'],
  },
  { nombre: 'Gramática', subtemas: ['sustantivos y adjetivos', 'verbos', 'oración y párrafo'] },
  { nombre: 'Ortografía', subtemas: ['uso de la b y la v', 'uso de la c, s y z', 'tildación'] },
]

const LENGUA: Unidad[] = [
  {
    nombre: 'Comprensión lectora',
    subtemas: ['lectura y análisis de cuentos', 'textos expositivos', 'resumen y síntesis'],
  },
  {
    nombre: 'Sintaxis',
    subtemas: [
      'oración simple',
      'modificadores del sujeto y del predicado',
      'oraciones compuestas',
    ],
  },
  {
    nombre: 'Textos argumentativos',
    subtemas: ['tesis y argumentos', 'conectores', 'producción de un texto argumentativo'],
  },
  { nombre: 'Normativa', subtemas: ['tildación', 'puntuación', 'revisión de textos propios'] },
]

const INGLES: Unidad[] = [
  {
    nombre: 'Present tenses',
    subtemas: ['present simple', 'present continuous', 'present simple vs. present continuous'],
  },
  { nombre: 'Past tenses', subtemas: ['past simple', 'past continuous', 'used to'] },
  {
    nombre: 'Present perfect',
    subtemas: ['present perfect', 'for y since', 'present perfect vs. past simple'],
  },
  { nombre: 'Futuro', subtemas: ['will y going to', 'first conditional', 'second conditional'] },
  {
    nombre: 'Reading y writing',
    subtemas: ['comprensión de textos', 'redacción de un email', 'vocabulario de la unidad'],
  },
]

const CONTABILIDAD: Unidad[] = [
  {
    nombre: 'Patrimonio',
    subtemas: [
      'activo, pasivo y patrimonio neto',
      'ecuación contable',
      'variaciones patrimoniales',
    ],
  },
  {
    nombre: 'Registración',
    subtemas: ['asientos en el libro diario', 'libro mayor', 'balance de sumas y saldos'],
  },
  {
    nombre: 'Operaciones',
    subtemas: ['compras y ventas', 'documentación comercial', 'IVA en las operaciones'],
  },
  {
    nombre: 'Cierre de ejercicio',
    subtemas: ['ajustes de cierre', 'amortizaciones', 'estados contables'],
  },
]

function programaPara(materia: Materia, nivel: Nivel, grado: string | null): Unidad[] {
  const quinto = nivel === 'SECUNDARIO' && grado === '5.º año'
  switch (materia) {
    case 'MAT':
      if (nivel === 'PRIMARIO') return MAT_PRIMARIO
      if (nivel === 'UNIVERSITARIO' || nivel === 'TERCIARIO') return MAT_UNIVERSITARIO
      return quinto ? MAT_QUINTO : MAT_SECUNDARIO
    case 'FIS':
      return nivel === 'UNIVERSITARIO' ? FIS_UNIVERSITARIO : FIS_SECUNDARIO
    case 'QUI':
      return QUIMICA
    case 'LEN':
      return nivel === 'PRIMARIO' ? LENGUA_PRIMARIO : LENGUA
    case 'ING':
      return INGLES
    case 'CON':
      return CONTABILIDAD
  }
}

/** Cómo se nombra el material de práctica de cada materia. */
function recurso(materia: Materia, guia: number, a: number, b: number): string {
  switch (materia) {
    case 'ING':
      return `las actividades ${a} a ${b} de la unidad ${guia} del cuadernillo`
    case 'LEN':
      return `las consignas ${a} a ${b} del cuadernillo ${guia}`
    case 'CON':
      return `los ejercicios ${a} a ${b} del práctico ${guia}`
    default:
      return `los ejercicios ${a} a ${b} de la guía ${guia}`
  }
}

/**
 * Unidad de Alejo según la fecha (el año de 5.º): funciones → lineal y cuadrática → exponencial y
 * logarítmica → trigonometría → sucesiones → límites; en Física, cinemática → caída libre → tiro
 * oblicuo → dinámica → trabajo y energía.
 */
function unidadPorFecha(materia: 'MAT' | 'FIS', fecha: string): number {
  const cortes =
    materia === 'MAT'
      ? [enMes(-5, 21), enMes(-3, 4), enMes(-1, 1), enMes(-1, 29), enMes(0, 9)]
      : [enMes(-5, 28), enMes(-3, 4), enMes(-2, 20), enMes(-1, 24)]
  const i = cortes.findIndex((corte) => fecha < corte)
  return i === -1 ? cortes.length : i
}

// ---------------------------------------------------------------------------------------------
// Modelo en memoria
// ---------------------------------------------------------------------------------------------

type Bloque = {
  idx: number
  prof: number
  dia: number
  hora: number
  aulaId: number
  capacidad: number
}

type Fila = {
  idx: number
  bloque: number
  alumno: number
  materia: Materia
  tipo: 'RECURRENTE' | 'SESION_UNICA'
  fechaInicio: string
  fechaFin: string | null
  serieId: string | null
  temas: string | null
  observaciones: string | null
  createdAt: Date
  finalizacion: { fechaDesde: string; detalle: string; createdAt: Date } | null
  /** Fechas efectivas de la fila hasta el horizonte. */
  fechas: string[]
}

type Asistencia = {
  estado: 'PRESENTE' | 'AUSENTE'
  createdAt: Date
  trabajado: string | null
  indicaciones: string | null
  observacion: string | null
}

type Ocurr = {
  idx: number
  fila: Fila
  fecha: string
  cancelacion: { motivo: Motivo; detalle: string | null; createdAt: Date } | null
  asistencia: Asistencia | null
  pago: PagoModelo | null
}

type PagoModelo = {
  idx: number
  alumno: number
  fecha: string
  minutos: number
  items: Ocurr[]
  forma: Forma
  observaciones: string | null
  /** Cobro de cuadre a cuenta (se marca para el texto). */
  aCuenta?: boolean
}

type ExamenModelo = {
  alumno: number
  materia: Materia
  fecha: string
  observaciones: string | null
  resultado: 'CON_NOTA' | 'AUSENTE' | null
  nota: number | null
  notaPor: 'PROFESOR' | 'MESA' | null
  prof: number
  createdAt: Date
  notaCreatedAt: Date | null
}

/** Elige una opción por grupo (o ninguna) para sumar exactamente `objetivo` (múltiplo de $500). */
function elegirExacto<T>(grupos: { valor: number; dato: T }[][], objetivo: number): T[] | null {
  const UNIDAD = 500
  if (objetivo === 0) return []
  if (objetivo < 0 || objetivo % UNIDAD !== 0) return null
  const meta = objetivo / UNIDAD
  // eleccion[g][s] = opción de g con la que se llegó a s (-1 = ninguna), -2 = no alcanzable.
  const eleccion: Int16Array[] = []
  let alcanzable = new Uint8Array(meta + 1)
  alcanzable[0] = 1
  for (const opciones of grupos) {
    const fila = new Int16Array(meta + 1).fill(-2)
    const siguiente = new Uint8Array(meta + 1)
    for (let s = 0; s <= meta; s++) {
      if (!alcanzable[s]) continue
      if (fila[s] === -2) {
        fila[s] = -1
        siguiente[s] = 1
      }
      opciones.forEach((opcion, i) => {
        if (opcion.valor % UNIDAD !== 0) return
        const t = s + opcion.valor / UNIDAD
        if (t <= meta && fila[t] === -2) {
          fila[t] = i
          siguiente[t] = 1
        }
      })
    }
    eleccion.push(fila)
    alcanzable = siguiente
  }
  if (!alcanzable[meta]) return null
  const elegidos: T[] = []
  let s = meta
  for (let g = grupos.length - 1; g >= 0; g--) {
    const i = (eleccion[g] as Int16Array)[s] as number
    if (i >= 0) {
      const opcion = (grupos[g] as { valor: number; dato: T }[])[i] as { valor: number; dato: T }
      elegidos.push(opcion.dato)
      s -= opcion.valor / UNIDAD
    }
  }
  return s === 0 ? elegidos : null
}

// ---------------------------------------------------------------------------------------------
// Limpieza y chequeo de base limpia
// ---------------------------------------------------------------------------------------------

async function idsPropios() {
  const cargador = await prisma.usuario.findUnique({ where: { dni: CARGADOR.dni } })
  if (!cargador) return null
  const alumnoIds = (
    await prisma.alumno.findMany({ where: { createdById: cargador.id }, select: { id: true } })
  ).map((a) => a.id)
  const usuarioIds = (
    await prisma.usuario.findMany({
      where: {
        OR: [{ createdById: cargador.id, role: 'PROFESOR' }, { alumnoId: { in: alumnoIds } }],
      },
      select: { id: true },
    })
  ).map((u) => u.id)
  const profesorIds = (
    await prisma.profesor.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { id: true },
    })
  ).map((p) => p.id)
  return { cargador, alumnoIds, usuarioIds, profesorIds }
}

/**
 * La base tiene que estar limpia: sólo lo del seed de desarrollo (Martín Pérez, Lucía López) y lo de
 * este seed. Cualquier alumno, profesor, turno o pago ajeno rompe los totales globales.
 */
async function chequearBaseLimpia() {
  const propios = await idsPropios()
  const dniLucia = env.SEED_ALUMNO_DNI ?? '45123456'
  const alumnosPropios = propios?.alumnoIds ?? []
  const [alumnos, profesores, turnos, pagos] = await Promise.all([
    prisma.alumno.count({ where: { id: { notIn: alumnosPropios }, dni: { not: dniLucia } } }),
    // Los profesores del seed de desarrollo no tienen creador; los de otros seeds, sí.
    prisma.profesor.count({
      where: {
        id: { notIn: propios?.profesorIds ?? [] },
        usuario: { createdById: { not: null } },
      },
    }),
    prisma.turno.count({ where: { alumnoId: { notIn: alumnosPropios } } }),
    prisma.pago.count({ where: { alumnoId: { notIn: alumnosPropios } } }),
  ])
  if (alumnos + profesores + turnos + pagos > 0) {
    throw new Error(
      `La base no está limpia: hay ${alumnos} alumnos, ${profesores} profesores, ${turnos} turnos ` +
        `y ${pagos} pagos que no son del seed de desarrollo ni de este seed (¿otro seed de demo?). ` +
        'Los totales de la demo son globales: corré primero ' +
        '`pnpm prisma migrate reset --force && pnpm db:seed` y después este seed.',
    )
  }
}

/** Borra lo que creó `CARGADOR` y todo lo que cuelga de ello (también lo cargado desde la app). */
async function limpiar() {
  const propios = await idsPropios()
  if (!propios) {
    console.log('Limpieza: no hay nada que borrar.')
    return
  }
  const { cargador, alumnoIds, usuarioIds, profesorIds } = propios
  const turnoIds = (
    await prisma.turno.findMany({
      where: {
        OR: [
          { alumnoId: { in: alumnoIds } },
          { bloqueAgenda: { profesorId: { in: profesorIds } } },
        ],
      },
      select: { id: true },
    })
  ).map((t) => t.id)
  const pagoIds = (
    await prisma.pago.findMany({
      where: {
        OR: [
          { alumnoId: { in: alumnoIds } },
          { createdById: cargador.id },
          { turnos: { some: { turnoId: { in: turnoIds } } } },
        ],
      },
      select: { id: true },
    })
  ).map((p) => p.id)
  const liquidacionIds = (
    await prisma.liquidacion.findMany({
      where: { profesorId: { in: profesorIds } },
      select: { id: true },
    })
  ).map((l) => l.id)

  // Orden que respeta las FK (todas son onDelete: Restrict).
  await prisma.comprobanteAdjunto.deleteMany({
    where: { OR: [{ pagoId: { in: pagoIds } }, { liquidacionId: { in: liquidacionIds } }] },
  })
  await prisma.ajusteLiquidacion.deleteMany({
    where: {
      OR: [
        { liquidacionId: { in: liquidacionIds } },
        { liquidacionOrigenId: { in: liquidacionIds } },
        { liquidacionTurno: { liquidacionId: { in: liquidacionIds } } },
      ],
    },
  })
  await prisma.liquidacionTurno.deleteMany({
    where: {
      OR: [{ liquidacionId: { in: liquidacionIds } }, { pagoTurno: { pagoId: { in: pagoIds } } }],
    },
  })
  await prisma.liquidacion.updateMany({
    where: { id: { in: liquidacionIds } },
    data: { descontadaEnId: null },
  })
  await prisma.liquidacion.deleteMany({ where: { id: { in: liquidacionIds } } })
  await prisma.examen.deleteMany({ where: { alumnoId: { in: alumnoIds } } })
  await prisma.asistenciaTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.anulacionPago.deleteMany({ where: { pagoId: { in: pagoIds } } })
  await prisma.pagoTurno.deleteMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { pagoId: { in: pagoIds } }] },
  })
  await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } })
  await prisma.cancelacionTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.finalizacionRecurrencia.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } })
  await prisma.asignacionMateria.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.bloqueAgenda.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } })
  await prisma.session.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.account.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } })
  await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } })

  console.log(
    `Limpieza: ${profesorIds.length} profesores, ${alumnoIds.length} alumnos, ${turnoIds.length} ` +
      `turnos, ${pagoIds.length} pagos y ${liquidacionIds.length} liquidaciones.`,
  )
}

// ---------------------------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------------------------

/** Lo que tiene que existir de antes (`pnpm db:seed`). */
async function requisitos() {
  const materias = await prisma.materia.findMany({
    where: { estado: 'ACTIVO', precioHora: { not: null } },
    select: { id: true, busqueda: true, precioHora: true },
  })
  const materiaPorClave = {} as Record<Materia, { id: number; precio: number }>
  for (const clave of Object.keys(NOMBRE_MATERIA) as Materia[]) {
    const fila = materias.find((m) => m.busqueda === normalizarBusqueda(NOMBRE_MATERIA[clave]))
    if (!fila || !fila.precioHora) {
      throw new Error(
        `Falta la materia ${NOMBRE_MATERIA[clave]} con precio. Corré primero \`pnpm db:seed\`.`,
      )
    }
    materiaPorClave[clave] = { id: fila.id, precio: fila.precioHora.toNumber() }
  }
  const aulas = await prisma.aula.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id: 'asc' } })
  const formas = await prisma.formaPago.findMany({ where: { tipoFormaPago: { not: null } } })
  const formaPorTipo = new Map(formas.map((f) => [f.tipoFormaPago as Forma, f.id]))
  const gerente = await prisma.usuario.findFirst({
    where: { role: 'GERENTE', estado: 'ACTIVO', accounts: { some: {} } },
    orderBy: { createdAt: 'asc' },
  })
  const rol = await prisma.rol.findUnique({ where: { id: 'ALUMNO' } })
  if (
    !gerente ||
    !rol ||
    aulas.length === 0 ||
    !(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const).every((t) => formaPorTipo.has(t))
  ) {
    throw new Error(
      'Faltan datos del seed de desarrollo (roles, gerente, aulas o formas de pago). Corré ' +
        'primero `pnpm db:seed` y volvé a intentar.',
    )
  }
  return { materiaPorClave, aulas, formaPorTipo, gerente }
}

/**
 * Historial del porcentaje del centro: el seed de desarrollo carga 12 % (M-2) y 15 % (M-1). Se
 * agrega 10 % desde el día 1 de M-6 si no hay ninguno anterior, así cada cobro de la historia tiene
 * su porcentaje vigente. No se borra en la limpieza.
 */
async function asegurarPorcentajeInicial(gerenteId: string) {
  const desde = instante(INICIO, 8 * 60)
  const anterior = await prisma.porcentajeCentro.count({ where: { createdAt: { lte: desde } } })
  if (anterior === 0) {
    await prisma.porcentajeCentro.create({
      data: { porcentaje: '10.00', createdAt: desde, createdById: gerenteId },
    })
  }
  return prisma.porcentajeCentro.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
}

/** Lo que la generación necesita de la base: se lee una sola vez, antes de probar semillas. */
async function leerContexto() {
  const { materiaPorClave, aulas, formaPorTipo, gerente } = await requisitos()
  const porcentajes = await asegurarPorcentajeInicial(gerente.id)
  const bloquesExistentes = (
    await prisma.bloqueAgenda.findMany({
      where: { estado: 'ACTIVO' },
      select: { aulaId: true, diaSemana: true, horaInicio: true },
    })
  ).map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`)
  return { materiaPorClave, aulas, formaPorTipo, gerente, porcentajes, bloquesExistentes }
}
type Contexto = Awaited<ReturnType<typeof leerContexto>>

/** El cuadre exacto no se pudo armar con esta semilla: se prueba la siguiente. */
class SinCuadre extends Error {}

/**
 * Genera el centro entero en memoria (sin tocar la base) con el generador `azar`: profesores,
 * alumnos, turnos, cancelaciones, asistencias, exámenes, pagos y el cuadre exacto de la deuda y de
 * lo cobrado en el mes.
 */
function generar(azar: Azar, ctx: Contexto) {
  const { materiaPorClave, aulas, porcentajes } = ctx
  /** Porcentaje vigente en un instante: el último registrado hasta ese momento. */
  const porcentajeEn = (momento: Date): number => {
    const vigente = porcentajes.filter((p) => p.createdAt <= momento).at(-1)
    if (!vigente)
      throw new Error(`No hay porcentaje del centro vigente el ${momento.toISOString()}`)
    return vigente.porcentaje.toNumber()
  }
  const precioDe = (materia: Materia) => materiaPorClave[materia].precio

  // --- Bloques: una fila por hora, en un aula libre con capacidad >= la del profesor ---------
  const bloques: Bloque[] = []
  const aulaOcupada = new Set(ctx.bloquesExistentes)
  const porCapacidad = [...aulas].sort((a, b) => a.capacidad - b.capacidad || a.id - b.id)
  PROFESORES.forEach((prof, p) => {
    for (const [plantilla, desde, hasta] of prof.horario) {
      const dia = diaReal(plantilla)
      const horas = Array.from({ length: hasta - desde }, (_, i) => (desde + i) * 60)
      const aula = porCapacidad.find(
        (a) =>
          a.capacidad >= prof.capacidad &&
          horas.every((h) => !aulaOcupada.has(`${a.id}|${dia}|${h}`)),
      )
      if (!aula) throw new Error(`No hay aula libre para ${prof.apellido} el día ${dia}.`)
      for (const hora of horas) {
        aulaOcupada.add(`${aula.id}|${dia}|${hora}`)
        bloques.push({
          idx: bloques.length,
          prof: p,
          dia,
          hora,
          aulaId: aula.id,
          capacidad: Math.min(prof.capacidad, aula.capacidad),
        })
      }
    }
  })
  const bloqueDe = (prof: number, plantilla: number, hora: number) => {
    const bloque = bloques.find(
      (b) => b.prof === prof && b.dia === diaReal(plantilla) && b.hora === hora * 60,
    )
    if (!bloque)
      throw new Error(`Bloque inexistente: profesor ${prof}, día ${plantilla}, ${hora} h`)
    return bloque
  }
  const AGUIRRE = 0

  // --- Alumnos -------------------------------------------------------------------------------
  const alumnos: AlumnoModelo[] = []
  const nombresUsados = new Set<string>()
  const emailsUsados = new Set<string>()
  const formaAlAzar = (): Forma =>
    azar.pesado<Forma>([
      ['EFECTIVO', 45],
      ['TRANSFERENCIA', 40],
      ['DEBITO', 15],
    ])
  const redAlAzar = () =>
    azar.pesado<AlumnoModelo['red']>([
      ['VISA_DEBITO', 50],
      ['MASTERCARD_DEBITO', 25],
      ['MAESTRO', 10],
      ['CABAL_DEBITO', 15],
    ])
  const emailPara = (nombre: string, apellido: string) => {
    const base = `${sinSimbolos(nombre)}.${sinSimbolos(apellido)}`
    let email = `${base}@${azar.de(PROVEEDORES_EMAIL)}`
    if (emailsUsados.has(email) || azar.chance(0.25)) {
      email = `${base}${String(azar.entero(1, 99)).padStart(2, '0')}@${azar.de(PROVEEDORES_EMAIL)}`
    }
    emailsUsados.add(email)
    return email
  }

  for (const d of destacados()) {
    const fechaNacimiento = sumarDias(restarAnios(HOY, Number(d.fechaNacimiento)), -d.edadDias)
    nombresUsados.add(`${d.nombre}|${d.apellido}`)
    if (d.email) emailsUsados.add(d.email)
    alumnos.push({
      ...d,
      fechaNacimiento,
      banco: azar.de(BANCOS),
      red: redAlAzar(),
      ultimos4: azar.digitos(4),
      deudaDesde: null,
      deAguirre: false,
      deja: null,
      opcionesMateria: null,
      createdAt: null,
    })
  }

  const clavesGrilla = [...new Set(grillaAguirre().map((g) => g.alumno))].filter((c) =>
    c.startsWith('f'),
  )
  const ordenFondo = clavesGrilla.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const crearFondo = (i: number) => {
    const clave = i < ordenFondo.length ? (ordenFondo[i] as string) : `g${i}`
    const enGrilla = i < ordenFondo.length
    const genero: Genero = azar.chance(0.5) ? 'F' : 'M'
    let nombre = ''
    let apellido = ''
    do {
      nombre = azar.de(genero === 'F' ? NOMBRES_F : NOMBRES_M)
      apellido = azar.de(APELLIDOS)
    } while (nombresUsados.has(`${nombre}|${apellido}`))
    nombresUsados.add(`${nombre}|${apellido}`)

    const nivel: Nivel = enGrilla
      ? FONDO_UNIVERSITARIO.has(clave)
        ? 'UNIVERSITARIO'
        : 'SECUNDARIO'
      : azar.pesado<Nivel>([
          ['PRIMARIO', 15],
          ['SECUNDARIO', 50],
          ['TERCIARIO', 12],
          ['UNIVERSITARIO', 26],
        ])
    let edad = 0
    let grado: string | null = null
    let institucion: string | null = null
    if (nivel === 'PRIMARIO') {
      const g = azar.entero(4, 7)
      edad = g + 5
      grado = `${g}.º grado`
      institucion = azar.de(ESCUELAS_PRIMARIAS)
    } else if (nivel === 'SECUNDARIO') {
      const anio = enGrilla ? azar.entero(3, 5) : azar.entero(1, 5)
      edad = 12 + anio + (azar.chance(0.3) ? 1 : 0)
      grado = `${anio}.º año`
      institucion = azar.de(COLEGIOS_SECUNDARIOS)
    } else if (nivel === 'TERCIARIO') {
      const t = azar.de(TERCIARIOS)
      edad = azar.entero(19, 27)
      grado = `${t.carrera}, ${azar.entero(1, 2)}.º año`
      institucion = t.institucion
    } else {
      const u = azar.de(UNIVERSIDADES)
      edad = azar.entero(18, 25)
      grado = `${u.carrera}, ${azar.entero(1, 3)}.º año`
      institucion = u.institucion
    }
    const fechaNacimiento = sumarDias(restarAnios(HOY, edad), -azar.entero(5, 350))
    const menor = fechaNacimiento > restarAnios(HOY, 18)
    const dni = dniPara(Number(fechaNacimiento.slice(0, 4)), azar)
    const generoTutor: Genero = azar.chance(0.6) ? 'F' : 'M'
    const nombreTutor = azar.de(generoTutor === 'F' ? TUTORES_F : TUTORES_M)
    const apellidoTutor = azar.chance(0.65) ? apellido : azar.de(APELLIDOS)
    const tutor: TutorDatos | null = menor
      ? {
          nombre: nombreTutor,
          apellido: apellidoTutor,
          genero: generoTutor,
          dni: azar.chance(0.8) ? dniPara(azar.entero(1972, 1990), azar) : null,
          telefono: telefono(azar),
          email: emailPara(nombreTutor, apellidoTutor),
        }
      : null

    // Materias al azar según el nivel (los de la grilla de Aguirre ya tienen la suya).
    const opciones: [Materia, number][] =
      nivel === 'PRIMARIO'
        ? [
            ['MAT', 45],
            ['LEN', 40],
            ['ING', 25],
          ]
        : nivel === 'SECUNDARIO'
          ? [
              ['MAT', 34],
              ['ING', 28],
              ['FIS', 15],
              ['QUI', 19],
              ['LEN', 16],
            ]
          : nivel === 'TERCIARIO'
            ? [
                ['ING', 40],
                ['LEN', 25],
                ['CON', 25],
                ['MAT', 10],
              ]
            : [
                ['MAT', 28],
                ['FIS', 18],
                ['QUI', 26],
                ['CON', 16],
                ['ING', 16],
              ]
    const cuantas = enGrilla
      ? azar.chance(0.3)
        ? 1
        : 0
      : azar.pesado<number>([
          [1, 55],
          [2, 35],
          [3, 10],
        ])
    const extras: { materia: Materia; horas: number }[] = []
    while (extras.length < cuantas) {
      const materia = azar.pesado(opciones)
      if (enGrilla && (materia === 'MAT' || materia === 'FIS')) continue
      if (extras.some((e) => e.materia === materia)) continue
      extras.push({
        materia,
        horas: azar.pesado<number>([
          [1, 50],
          [2, 42],
          [3, 8],
        ]),
      })
    }

    // Cuándo empieza: muchas altas en abril (arranque), mayo y junio, y otras en agosto-septiembre
    // (evaluaciones).
    const mesInicio = azar.pesado<number>([
      [-6, 54],
      [-5, 16],
      [-4, 11],
      [-3, 1],
      [-2, 4],
      [-1, 9],
      [0, 2],
    ])
    let inicio = enMes(mesInicio, azar.entero(1, mesInicio === 0 ? 10 : 24))
    if (RECESO && inicio >= RECESO.desde && inicio <= RECESO.hasta)
      inicio = sumarDias(RECESO.hasta, 3)
    if (inicio >= HOY) inicio = sumarDias(HOY, -azar.entero(3, 8))
    if (inicio < INICIO) inicio = INICIO

    alumnos.push({
      clave,
      nombre,
      apellido,
      genero,
      dni,
      fechaNacimiento,
      nivel,
      grado,
      institucion,
      telefono: menor && azar.chance(0.5) ? null : telefono(azar),
      email: menor && azar.chance(0.5) ? null : emailPara(nombre, apellido),
      tutor,
      observaciones: azar.chance(0.3)
        ? azar.de([
            'Prefiere los turnos de la tarde.',
            'Necesita refuerzo en resolución de problemas.',
            'Se reincorporó después de un tiempo sin venir.',
            'Lo acompaña la madre los días de clase.',
            'Rinde la materia en la mesa de diciembre.',
            'Trabaja a la mañana.',
            'Tiene buena base; viene a afianzar los temas del colegio.',
          ])
        : null,
      patron: enGrilla
        ? azar.chance(0.6)
          ? 'MENSUAL'
          : 'POR_CLASE'
        : azar.pesado<Patron>([
            ['MENSUAL', 42],
            ['POR_CLASE', 31],
            ['ATRASADO', 23],
            ['QUINCENAL', 4],
          ]),
      forma: formaAlAzar(),
      banco: azar.de(BANCOS),
      red: redAlAzar(),
      ultimos4: azar.digitos(4),
      deudaDesde: null,
      deAguirre: enGrilla,
      extras,
      inicio,
      deja: null,
      opcionesMateria: opciones,
      createdAt: null,
    })
  }
  for (let i = 0; i < ordenFondo.length; i++) crearFondo(i)
  const alumnoPorClave = new Map(alumnos.map((a, i) => [a.clave, i]))
  const indiceAlumno = (clave: string) => {
    const i = alumnoPorClave.get(clave)
    if (i === undefined) throw new Error(`Alumno inexistente: ${clave}`)
    return i
  }
  const ALEJO = indiceAlumno('alejo')

  // Los de la grilla de Aguirre que pagan el mes por adelantado (los del jueves, para "ayer").
  for (const fila of grillaAguirre()) {
    const a = alumnos[indiceAlumno(fila.alumno)] as AlumnoModelo
    if (fila.alumno !== 'alejo') a.deAguirre = true
    if (fila.horas.some(([dia]) => dia === 4) && fila.alumno !== 'alejo') a.patron = 'MENSUAL'
  }

  // --- Filas (turnos) con control de capacidad y superposición ------------------------------
  const filas: Fila[] = []
  const ocupacion = new Map<string, number>()
  const alumnoOcupado = new Set<string>()
  const cargaProf = PROFESORES.map(() => 0)
  const claveOcupacion = (bloque: number, fecha: string) => `${bloque}|${fecha}`
  const claveAlumno = (alumno: number, bloque: Bloque, fecha: string) =>
    `${alumno}|${bloque.dia}|${bloque.hora}|${fecha}`

  /** Fechas efectivas de una fila: de `inicio` a su fin (o finalización), hasta el horizonte. */
  const fechasDeFila = (bloque: Bloque, inicio: string, fin: string | null) =>
    fechasDelDia(bloque.dia, inicio, fin === null || fin > HORIZONTE ? HORIZONTE : fin)

  const hayLugar = (bloque: Bloque, alumno: number, fechas: string[]) =>
    fechas.length > 0 &&
    fechas.every(
      (f) =>
        (ocupacion.get(claveOcupacion(bloque.idx, f)) ?? 0) < bloque.capacidad &&
        !alumnoOcupado.has(claveAlumno(alumno, bloque, f)),
    )

  const reservar = (bloque: Bloque, alumno: number, fechas: string[]) => {
    for (const f of fechas) {
      const clave = claveOcupacion(bloque.idx, f)
      ocupacion.set(clave, (ocupacion.get(clave) ?? 0) + 1)
      alumnoOcupado.add(claveAlumno(alumno, bloque, f))
      if (f < HOY) cargaProf[bloque.prof] = (cargaProf[bloque.prof] as number) + 1
    }
  }

  /** Momento del alta de algo que empieza en `fecha`: unos días antes, nunca hoy. */
  const altaPara = (fecha: string, maxDias = 4): Date => {
    let dia = sumarDias(fecha, -azar.entero(0, maxDias))
    if (dia < INICIO) dia = INICIO
    if (dia >= HOY) dia = sumarDias(HOY, -azar.entero(1, 3))
    return instante(dia, azar.entero(9 * 60, 19 * 60 + 30))
  }

  type Segmento = { desde: string; hasta: string | null; fechaFin: string | null }

  /**
   * Los tramos de un alta: si el alumno corta en el receso, el primero termina antes (con fecha de
   * fin cargada) y el segundo es un alta nueva después; si deja, su último tramo se finaliza.
   */
  const segmentosDe = (
    desde: string,
    fechaFin: string | null,
    deja: string | null,
    corta: boolean,
  ): Segmento[] => {
    const fin = deja ? sumarDias(deja, -1) : fechaFin
    if (corta && RECESO && desde < RECESO.desde && (fin === null || fin > RECESO.hasta)) {
      return [
        { desde, hasta: sumarDias(RECESO.desde, -1), fechaFin: sumarDias(RECESO.desde, -1) },
        { desde: sumarDias(RECESO.hasta, 3), hasta: fin, fechaFin },
      ]
    }
    return [{ desde, hasta: fin, fechaFin }]
  }

  /** Crea las filas de un alta (una por hora, mismo `serieId`). Devuelve false si no entra. */
  const crearAlta = (
    alumno: number,
    materia: Materia,
    horas: Bloque[],
    segmento: Segmento,
    deja: string | null,
    textos: { temas: string | null; observaciones: string | null },
    detalleFinalizacion: string | null,
  ): boolean => {
    const porHora = horas.map((bloque) => {
      // Ninguna serie empieza hoy: si su primera fecha cae hoy, arranca la semana que viene.
      let inicio = proximaFechaDelDia(bloque.dia, segmento.desde)
      if (inicio === HOY) inicio = sumarDias(HOY, 7)
      const fechaFin =
        segmento.fechaFin === null
          ? null
          : (fechasDelDia(bloque.dia, inicio, segmento.fechaFin).at(-1) ?? null)
      const fechas = fechasDeFila(bloque, inicio, segmento.hasta)
      return { bloque, inicio, fechaFin, fechas }
    })
    if (
      porHora.some((h) => h.fechas.length === 0 || (h.fechaFin !== null && h.fechaFin < h.inicio))
    )
      return false
    if (!porHora.every((h) => hayLugar(h.bloque, alumno, h.fechas))) return false
    const serieId = azar.uuid()
    const primera = porHora.map((h) => h.inicio).sort()[0] as string
    const createdAt = altaPara(primera)
    for (const h of porHora) {
      reservar(h.bloque, alumno, h.fechas)
      const finaliza =
        deja !== null && (segmento.hasta === null || segmento.hasta >= sumarDias(deja, -7))
      filas.push({
        idx: filas.length,
        bloque: h.bloque.idx,
        alumno,
        materia,
        tipo: 'RECURRENTE',
        fechaInicio: h.inicio,
        fechaFin: h.fechaFin,
        serieId,
        temas: textos.temas,
        observaciones: textos.observaciones,
        createdAt,
        finalizacion:
          finaliza && deja
            ? {
                fechaDesde: deja,
                detalle: detalleFinalizacion ?? 'Deja de venir',
                createdAt: altaPara(deja, 5),
              }
            : null,
        fechas: h.fechas,
      })
    }
    return true
  }

  const temasDeAlta = (alumno: AlumnoModelo, materia: Materia, desde: string): string | null => {
    const programa = programaPara(materia, alumno.nivel, alumno.grado)
    if (alumno.clave === 'alejo' && (materia === 'MAT' || materia === 'FIS')) {
      // Antes del receso, las dos primeras unidades; después, lo que queda del año.
      const u = unidadPorFecha(materia, desde)
      const unidades = programa.slice(u, u === 0 ? 2 : undefined).map((x) => x.nombre.toLowerCase())
      const texto = unidades.join('; ')
      return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`
    }
    if (!azar.chance(0.45)) return null
    return (programa[unidadDeInicio(programa, desde)] as Unidad).nombre
  }
  const OBSERVACIONES_TURNO = [
    'Prepara el trimestral',
    'Refuerzo semanal de lo que ve en el colegio',
    'Le cuesta la resolución de problemas',
    'Recursa la materia en la facultad',
    'Viene a preparar el ingreso',
    'Prepara la mesa de diciembre',
    null,
    null,
    null,
  ]

  // 1. Grilla fija de Aguirre.
  for (const g of grillaAguirre()) {
    const alumno = indiceAlumno(g.alumno)
    const a = alumnos[alumno] as AlumnoModelo
    const horas = g.horas.map(([dia, hora]) => bloqueDe(AGUIRRE, dia, hora))
    const deja = g.finaliza?.desde ?? null
    const segmentos = segmentosDe(g.desde, g.hasta ?? null, deja, g.receso === true)
    for (const segmento of segmentos) {
      const ok = crearAlta(
        alumno,
        g.materia,
        horas,
        segmento,
        deja,
        {
          temas: temasDeAlta(a, g.materia, segmento.desde),
          observaciones:
            g.alumno === 'alejo'
              ? 'Preparación para el ingreso a Ingeniería'
              : azar.de(OBSERVACIONES_TURNO),
        },
        g.finaliza?.detalle ?? null,
      )
      if (!ok) throw new Error(`La grilla de Aguirre no entra: ${g.alumno} ${g.materia}`)
    }
  }

  // 2. Materias al azar (los demás profesores), con quién tiene menos carga para su objetivo.
  const semanas = Math.round(
    (fechaADate(HOY).getTime() - fechaADate(INICIO).getTime()) / (7 * 864e5),
  )
  const objetivo = PROFESORES.map((p) => p.carga * semanas)
  const DETALLES_DEJA = [
    'Aprobó la materia y deja de venir',
    'Se mudó a Tucumán con la familia',
    'Por el horario del trabajo no puede seguir',
    'Terminó de preparar el examen',
    'La familia decidió suspender las clases por ahora',
  ]
  const asignarExtras = (a: AlumnoModelo, alumno: number) => {
    if (a.extras.length === 0) return
    // Algunos dejan (finalización) y otros cortan en el receso (casi todos los escolares y
    // algunos de la facultad, que también tiene vacaciones de invierno).
    const puedeDejar =
      !a.deAguirre && a.clave.startsWith('g') && sumarDias(a.inicio, 49) < sumarDias(HOY, -21)
    if (puedeDejar && azar.chance(0.12)) {
      let deja = sumarDias(a.inicio, 7 * azar.entero(7, 18))
      if (deja > sumarDias(HOY, -21)) deja = sumarDias(HOY, -azar.entero(21, 35))
      a.deja = deja
    }
    const escolar = a.nivel === 'PRIMARIO' || a.nivel === 'SECUNDARIO'
    const corta = azar.chance(escolar ? 0.62 : 0.25)
    for (const extra of a.extras) {
      // Fondo: la materia, entre las de su nivel, según cuánto les falta a sus profesores.
      if (a.opcionesMateria) {
        const tomadas = new Set(
          a.extras
            .filter((e) => e !== extra)
            .map((e) => e.materia)
            .concat(a.deAguirre ? ['MAT', 'FIS'] : []),
        )
        const posibles = a.opcionesMateria.filter(([materia]) => !tomadas.has(materia))
        if (posibles.length > 0) {
          extra.materia = azar.pesado(
            posibles.map(([materia, peso]): [Materia, number] => [
              materia,
              peso *
                PROFESORES.reduce(
                  (s, p, i) =>
                    i === AGUIRRE || !p.materias.includes(materia)
                      ? s
                      : s +
                        Math.max(
                          0.02,
                          ((objetivo[i] as number) - (cargaProf[i] as number)) /
                            (objetivo[i] as number),
                        ) **
                          2,
                  0,
                ),
            ]),
          )
        }
      }
      const candidatos = PROFESORES.map((p, i) => ({ p, i })).filter(
        ({ p, i }) => i !== AGUIRRE && p.materias.includes(extra.materia),
      )
      let asignado = false
      for (let intento = 0; intento < 6 && !asignado; intento++) {
        const prof = azar.pesado(
          candidatos.map(({ i }): [number, number] => [
            i,
            Math.max(
              0.03,
              ((objetivo[i] as number) - (cargaProf[i] as number)) / (objetivo[i] as number),
            ) ** 3,
          ]),
        )
        const desde =
          extra === a.extras[0]
            ? a.inicio
            : sumarDias(a.inicio, azar.chance(0.7) ? 0 : 7 * azar.entero(2, 8))
        const segmentos = segmentosDe(desde >= HOY ? a.inicio : desde, null, a.deja, corta)
        // Las horas: días distintos (o dos seguidas el mismo día).
        // Se prefieren las horas que ya tienen alumnos sin estar llenas (clases de 2 o 3).
        const puntuados = azar.mezclar(bloques.filter((b) => b.prof === prof)).map((b) => {
          const fecha = proximaFechaDelDia(b.dia, segmentos[0]?.desde ?? a.inicio)
          const n = ocupacion.get(claveOcupacion(b.idx, fecha)) ?? 0
          const lleno = n + 1 >= b.capacidad
          return { b, puntaje: (n === 0 ? 0.05 : lleno ? 2.5 : 3) + azar.decimal() * 0.8 }
        })
        const elegidas: Bloque[] = []
        for (const { b } of puntuados.sort((x, y) => y.puntaje - x.puntaje)) {
          if (elegidas.length >= extra.horas) break
          const otraDelDia = elegidas.find((e) => e.dia === b.dia)
          if (otraDelDia && !(Math.abs(otraDelDia.hora - b.hora) === 60 && azar.chance(0.6)))
            continue
          const libre = segmentos.every((s) => {
            const inicio = proximaFechaDelDia(b.dia, s.desde)
            return hayLugar(b, alumno, fechasDeFila(b, inicio, s.hasta))
          })
          if (libre) elegidas.push(b)
        }
        if (elegidas.length < extra.horas) continue
        const alta = { temas: null as string | null, observaciones: azar.de(OBSERVACIONES_TURNO) }
        asignado = segmentos.every((s, k) => {
          alta.temas = temasDeAlta(a, extra.materia, s.desde)
          return crearAlta(
            alumno,
            extra.materia,
            elegidas,
            s,
            k === segmentos.length - 1 ? a.deja : null,
            alta,
            azar.de(DETALLES_DEJA),
          )
        })
      }
    }
  }
  alumnos.forEach((a, alumno) => asignarExtras(a, alumno))

  // Alumnos de fondo nuevos, de a uno, hasta completar la carga de los profesores: así el volumen
  // del centro (y lo cobrado por mes) no depende de cuántas materias le tocaron a cada uno.
  const objetivoTotal = objetivo.reduce((s, o, i) => (i === AGUIRRE ? s : s + o), 0)
  const cargaTotal = () => cargaProf.reduce((s, c, i) => (i === AGUIRRE ? s : s + c), 0)
  for (let i = ordenFondo.length; cargaTotal() < objetivoTotal && i < MAX_FONDO; i++) {
    crearFondo(i)
    asignarExtras(alumnos.at(-1) as AlumnoModelo, alumnos.length - 1)
  }

  // --- Deudores de más de 30 días: tres alumnos de fondo que dejaron de pagar hace tiempo, de los
  // profesores con más alumnos (su liquidación de M-1 lo absorbe sin quedar fuera de rango) ---
  const conMasAlumnos = new Set(['mamani', 'cruz', 'zerpa', 'saravia', 'gutierrez'])
  const candidatosDeuda = alumnos
    .map((a, i) => ({ a, i }))
    .filter(
      ({ a, i }) =>
        !a.deAguirre &&
        a.clave.startsWith('g') &&
        a.deja === null &&
        a.inicio <= enMes(-3, 1) &&
        filas.some((f) => f.alumno === i && f.fechas.some((d) => d < HOY && d >= enMes(-1, 1))) &&
        filas
          .filter((f) => f.alumno === i)
          .every((f) =>
            conMasAlumnos.has(
              (PROFESORES[(bloques[f.bloque] as Bloque).prof] as ProfesorDef).clave,
            ),
          ),
    )
  const deudoresViejos = azar.mezclar(candidatosDeuda).slice(0, 3)
  for (const { a } of deudoresViejos) {
    // Dejan de pagar a fines de M-2: todo M-1 queda impago (deuda vencida).
    a.deudaDesde = enMes(-2, azar.entero(22, 28))
    a.patron = azar.chance(0.5) ? 'MENSUAL' : 'POR_CLASE'
  }

  // --- Exámenes y sesiones únicas de repaso ---------------------------------------------------
  const examenes: ExamenModelo[] = []
  const profDeAlumnoMateria = (alumno: number, materia: Materia, fecha: string): number | null => {
    const fila =
      filas.find(
        (f) =>
          f.alumno === alumno &&
          f.materia === materia &&
          f.tipo === 'RECURRENTE' &&
          f.fechaInicio <= fecha &&
          (f.fechas.at(-1) ?? '') >= sumarDias(fecha, -14),
      ) ?? filas.find((f) => f.alumno === alumno && f.materia === materia)
    return fila ? (bloques[fila.bloque] as Bloque).prof : null
  }

  /** Sesión única de repaso en un bloque del profesor, en `fecha`, si hay lugar. */
  const crearSesion = (
    alumno: number,
    materia: Materia,
    bloque: Bloque,
    fecha: string,
    temas: string,
  ) => {
    if (fecha === HOY || fecha < INICIO || diaSemanaISO(fecha) !== bloque.dia) return false
    if (!hayLugar(bloque, alumno, [fecha])) return false
    reservar(bloque, alumno, [fecha])
    filas.push({
      idx: filas.length,
      bloque: bloque.idx,
      alumno,
      materia,
      tipo: 'SESION_UNICA',
      fechaInicio: fecha,
      fechaFin: fecha,
      serieId: null,
      temas,
      observaciones: azar.chance(0.5) ? 'Consulta antes de la evaluación' : null,
      createdAt: altaPara(fecha, 6),
      finalizacion: null,
      fechas: [fecha],
    })
    return true
  }

  /** Nota y su carga: unos días después del examen, nunca hoy. */
  const notaCargada = (fecha: string): Date | null => {
    const dia = sumarDias(fecha, azar.entero(1, 5))
    if (dia >= HOY) return null
    return instante(dia, azar.entero(9 * 60, 20 * 60))
  }

  // Alejo: un examen por trimestre en cada materia, uno ausente con su recuperatorio y uno pendiente.
  const examenesAlejo: {
    materia: 'MAT' | 'FIS'
    fecha: string
    obs: string
    resultado: 'CON_NOTA' | 'AUSENTE' | null
    nota: number | null
    repaso?: boolean
  }[] = [
    {
      materia: 'MAT',
      fecha: enMes(-5, 20),
      obs: 'Evaluación trimestral: funciones, dominio e imagen',
      resultado: 'CON_NOTA',
      nota: 5,
    },
    {
      materia: 'FIS',
      fecha: enMes(-5, 27),
      obs: 'Evaluación trimestral: MRU y MRUV',
      resultado: 'CON_NOTA',
      nota: 6,
    },
    {
      materia: 'MAT',
      fecha: enMes(-4, 24),
      obs: 'Evaluación: función lineal y cuadrática',
      resultado: 'AUSENTE',
      nota: null,
    },
    {
      materia: 'MAT',
      fecha: enMes(-3, 1),
      obs: 'Recuperatorio: función lineal y cuadrática',
      resultado: 'CON_NOTA',
      nota: 6.5,
      repaso: true,
    },
    {
      materia: 'FIS',
      fecha: enMes(-2, 12),
      obs: 'Evaluación trimestral: caída libre, tiro vertical y tiro oblicuo',
      resultado: 'CON_NOTA',
      nota: 7,
    },
    {
      materia: 'MAT',
      fecha: enMes(-2, 26),
      obs: 'Evaluación trimestral: función exponencial y logarítmica',
      resultado: 'CON_NOTA',
      nota: 7.5,
      repaso: true,
    },
    {
      materia: 'FIS',
      fecha: enMes(-1, 16),
      obs: 'Evaluación: leyes de Newton y rozamiento',
      resultado: 'CON_NOTA',
      nota: 7.5,
      repaso: true,
    },
    {
      materia: 'MAT',
      fecha: enMes(-1, 30),
      obs: 'Evaluación: trigonometría, identidades y ecuaciones',
      resultado: 'CON_NOTA',
      nota: 8,
    },
    {
      materia: 'MAT',
      fecha: enMes(0, 28),
      obs: 'Evaluación trimestral: sucesiones e introducción a límites',
      resultado: null,
      nota: null,
      repaso: true,
    },
    {
      materia: 'FIS',
      fecha: enMes(1, 4),
      obs: 'Evaluación trimestral: trabajo, energía y potencia',
      resultado: null,
      nota: null,
    },
  ]
  for (const e of examenesAlejo) {
    let fecha = diaHabil(e.fecha)
    if (e.resultado === null && fecha <= sumarDias(HOY, 3)) fecha = diaHabil(sumarDias(HOY, 12))
    if (e.resultado !== null && fecha >= HOY) fecha = diaHabil(sumarDias(HOY, -3))
    examenes.push({
      alumno: ALEJO,
      materia: e.materia,
      fecha,
      observaciones: e.obs,
      resultado: e.resultado,
      nota: e.nota,
      notaPor: e.resultado ? 'PROFESOR' : null,
      prof: AGUIRRE,
      createdAt: altaPara(sumarDias(fecha, -azar.entero(10, 18)), 2),
      notaCreatedAt: e.resultado ? notaCargada(fecha) : null,
    })
    // Repaso el miércoles anterior (Aguirre no tiene alumnos fijos ese día).
    if (e.repaso) {
      const miercoles = diaReal(3)
      let fechaRepaso = sumarDias(fecha, -1)
      while (diaSemanaISO(fechaRepaso) !== miercoles) fechaRepaso = sumarDias(fechaRepaso, -1)
      const temas = `Repaso para la evaluación del ${ddmm(fecha)}: ${e.obs.split(': ')[1] ?? NOMBRE_MATERIA[e.materia]}`
      if (!crearSesion(ALEJO, e.materia, bloqueDe(AGUIRRE, 3, 17), fechaRepaso, temas)) {
        crearSesion(ALEJO, e.materia, bloqueDe(AGUIRRE, 3, 18), fechaRepaso, temas)
      }
    }
  }

  // Los demás: exámenes pasados con nota (algunos sin cargar) y, a veces, uno pendiente.
  const gruposCursada = new Map<
    string,
    { alumno: number; materia: Materia; desde: string; hasta: string }
  >()
  for (const f of filas) {
    if (f.alumno === ALEJO || f.tipo !== 'RECURRENTE') continue
    const clave = `${f.alumno}|${f.materia}`
    const actual = gruposCursada.get(clave)
    const desde = f.fechas[0] as string
    const hasta = f.fechas.at(-1) as string
    gruposCursada.set(clave, {
      alumno: f.alumno,
      materia: f.materia,
      desde: actual && actual.desde < desde ? actual.desde : desde,
      hasta: actual && actual.hasta > hasta ? actual.hasta : hasta,
    })
  }
  for (const g of gruposCursada.values()) {
    const a = alumnos[g.alumno] as AlumnoModelo
    const programa = programaPara(g.materia, a.nivel, a.grado)
    const universitario = a.nivel === 'UNIVERSITARIO' || a.nivel === 'TERCIARIO'
    const pasadosHasta = g.hasta < HOY ? g.hasta : AYER
    const cantidad = azar.pesado<number>([
      [0, a.deAguirre ? 10 : 35],
      [1, 40],
      [2, 25],
    ])
    const desdeExamen = sumarDias(g.desde, 24)
    const fechas = new Set<string>()
    for (let k = 0; k < cantidad && desdeExamen < pasadosHasta; k++) {
      const total = (fechaADate(pasadosHasta).getTime() - fechaADate(desdeExamen).getTime()) / 864e5
      fechas.add(diaHabil(sumarDias(desdeExamen, azar.entero(0, Math.max(0, Math.floor(total))))))
    }
    const parciales = ['Primer parcial', 'Segundo parcial', 'Recuperatorio del primer parcial']
    ;[...fechas]
      .filter((f) => f < HOY)
      .sort()
      .forEach((fecha, k) => {
        const unidad = programa[
          Math.min(programa.length - 1, k + Math.floor(azar.decimal() * 2))
        ] as Unidad
        const prof = profDeAlumnoMateria(g.alumno, g.materia, fecha)
        if (prof === null) return
        const reciente = fecha >= sumarDias(HOY, -12)
        const sinNota = reciente && azar.chance(0.4)
        const ausente = !sinNota && azar.chance(0.07)
        const notaCreatedAt = notaCargada(fecha)
        const conResultado = !sinNota && notaCreatedAt !== null
        examenes.push({
          alumno: g.alumno,
          materia: g.materia,
          fecha,
          observaciones: universitario
            ? (parciales[k] ?? 'Parcial')
            : azar.chance(0.8)
              ? `Evaluación de ${unidad.nombre.charAt(0).toLowerCase()}${unidad.nombre.slice(1)}`
              : null,
          resultado: conResultado ? (ausente ? 'AUSENTE' : 'CON_NOTA') : null,
          nota:
            conResultado && !ausente
              ? azar.de([4, 5, 5.5, 6, 6, 6.5, 7, 7, 7.5, 8, 8, 8.5, 9, 9.5, 10])
              : null,
          notaPor: conResultado ? (azar.chance(0.8) ? 'PROFESOR' : 'MESA') : null,
          prof,
          createdAt: altaPara(sumarDias(fecha, -azar.entero(7, 20)), 2),
          notaCreatedAt: conResultado ? notaCreatedAt : null,
        })
      })
    // Pendiente (a lo sumo uno por materia): sólo si sigue cursando.
    if (g.hasta >= HOY && azar.chance(0.32)) {
      const fecha = diaHabil(sumarDias(HOY, azar.entero(4, 40)))
      const prof = profDeAlumnoMateria(g.alumno, g.materia, HOY)
      if (prof !== null && fecha !== HOY) {
        const unidad = azar.de(programa)
        examenes.push({
          alumno: g.alumno,
          materia: g.materia,
          fecha,
          observaciones: universitario
            ? 'Segundo parcial'
            : `Evaluación de ${unidad.nombre.charAt(0).toLowerCase()}${unidad.nombre.slice(1)}`,
          resultado: null,
          nota: null,
          notaPor: null,
          prof,
          createdAt: altaPara(sumarDias(HOY, -azar.entero(1, 9)), 0),
          notaCreatedAt: null,
        })
      }
    }
  }
  // Sesiones únicas de consulta antes de algunos exámenes (no de Alejo, que ya tiene las suyas).
  for (const e of examenes) {
    // Los repasos en las horas de Aguirre son sólo los de Alejo.
    if (e.alumno === ALEJO || e.prof === AGUIRRE || !azar.chance(0.3)) continue
    const propios = azar.mezclar(bloques.filter((b) => b.prof === e.prof))
    for (let atras = 1; atras <= 6; atras++) {
      const fecha = sumarDias(e.fecha, -atras)
      const bloque = propios.find((b) => b.dia === diaSemanaISO(fecha))
      if (!bloque) continue
      const tema = e.observaciones?.replace(/^Evaluación de /, '') ?? NOMBRE_MATERIA[e.materia]
      if (crearSesion(e.alumno, e.materia, bloque, fecha, `Repaso para la evaluación: ${tema}`))
        break
    }
  }

  // --- Ocurrencias ---------------------------------------------------------------------------
  const ocurrencias: Ocurr[] = []
  for (const f of filas) {
    for (const fecha of f.fechas) {
      ocurrencias.push({
        idx: ocurrencias.length,
        fila: f,
        fecha,
        cancelacion: null,
        asistencia: null,
        pago: null,
      })
    }
  }
  const bloqueDeOcurr = (o: Ocurr) => bloques[o.fila.bloque] as Bloque
  const profDeOcurr = (o: Ocurr) => bloqueDeOcurr(o).prof
  const esAguirreHoyOAyer = (o: Ocurr) =>
    profDeOcurr(o) === AGUIRRE && (o.fecha === HOY || o.fecha === AYER)
  const ordenar = (lista: Ocurr[]) =>
    lista.sort(
      (x, y) => x.fecha.localeCompare(y.fecha) || bloqueDeOcurr(x).hora - bloqueDeOcurr(y).hora,
    )

  // --- Cancelaciones -------------------------------------------------------------------------
  const DETALLES_ALUMNO = [
    'Avisó que tenía una evaluación en el colegio ese día',
    'Turno médico',
    'Viaje familiar',
    'Avisó la familia que estaba con fiebre',
    'Tenía un acto en el colegio',
    'Cumpleaños familiar',
    null,
  ]
  const momentoCancelacion = (o: Ocurr): Date => {
    const hora = bloqueDeOcurr(o).hora
    let dia = sumarDias(o.fecha, -azar.entero(0, 2))
    let minutos =
      dia === o.fecha
        ? azar.entero(8 * 60, Math.max(8 * 60, hora - 60))
        : azar.entero(9 * 60, 20 * 60)
    if (dia >= HOY) {
      dia = sumarDias(HOY, -azar.entero(1, 3))
      minutos = azar.entero(9 * 60, 19 * 60)
    }
    return instante(dia, minutos)
  }
  for (const o of ocurrencias) {
    if (o.fecha === HOY || esAguirreHoyOAyer(o) || o.fila.tipo === 'SESION_UNICA') continue
    if (o.fecha === o.fila.fechas[0]) continue
    if (o.fecha > sumarDias(HOY, 21)) continue
    if (o.fila.alumno === ALEJO) continue
    // Las clases de Aguirre de este mes no se cancelan (su "Este mes" de la demo).
    if (profDeOcurr(o) === AGUIRRE && o.fecha >= PRIMERO_DEL_MES) continue
    const p = o.fecha > HOY ? 0.018 : 0.033
    if (!azar.chance(p)) continue
    const motivo = azar.pesado<Motivo>([
      ['CANCELACION_ALUMNO', 88],
      ['PROBLEMA_ADMINISTRATIVO', 6],
      ['OTRO', 6],
    ])
    o.cancelacion = {
      motivo,
      detalle:
        motivo === 'CANCELACION_ALUMNO'
          ? azar.de(DETALLES_ALUMNO)
          : motivo === 'PROBLEMA_ADMINISTRATIVO'
            ? 'Corte de luz en el centro'
            : 'Paro de transporte',
      createdAt: momentoCancelacion(o),
    }
  }
  // El profesor cancela su clase entera algunas veces (todos los alumnos de esa hora).
  const clasesPasadas = [
    ...new Set(
      ocurrencias
        .filter((o) => o.fecha < AYER && o.fecha > INICIO)
        .map((o) => `${o.fila.bloque}|${o.fecha}`),
    ),
  ]
  for (const clase of azar.mezclar(clasesPasadas).slice(0, 9)) {
    const [bloque, fecha] = clase.split('|')
    const prof = PROFESORES[(bloques[Number(bloque)] as Bloque).prof] as ProfesorDef
    const delaClase = ocurrencias.filter(
      (o) =>
        o.fila.bloque === Number(bloque) &&
        o.fecha === fecha &&
        !o.cancelacion &&
        o.fecha !== o.fila.fechas[0],
    )
    if (delaClase.length === 0 || delaClase.some((o) => o.fila.alumno === ALEJO)) continue
    const detalle = azar.de([
      `${prof.genero === 'F' ? 'La profesora' : 'El profesor'} tuvo un turno médico`,
      `${prof.genero === 'F' ? 'La profesora' : 'El profesor'} tomaba examen en su escuela`,
      `${prof.genero === 'F' ? 'La profesora' : 'El profesor'} avisó que estaba enferm${prof.genero === 'F' ? 'a' : 'o'}`,
    ])
    const createdAt = momentoCancelacion(delaClase[0] as Ocurr)
    for (const o of delaClase)
      o.cancelacion = { motivo: 'CANCELACION_PROFESOR', detalle, createdAt }
  }
  // Alejo: una clase que canceló la profesora (con su compañero de esa hora) y una suya en cada
  // materia.
  const deLaProfesora = ocurrencias.find(
    (o) =>
      o.fila.alumno === ALEJO &&
      o.fila.bloque === bloqueDe(AGUIRRE, 2, 17).idx &&
      o.fecha >= enMes(-4, 5),
  )
  if (deLaProfesora) {
    const createdAt = momentoCancelacion(deLaProfesora)
    for (const o of ocurrencias) {
      if (o.fila.bloque === deLaProfesora.fila.bloque && o.fecha === deLaProfesora.fecha) {
        o.cancelacion = {
          motivo: 'CANCELACION_PROFESOR',
          detalle: 'La profesora tuvo un turno médico',
          createdAt,
        }
      }
    }
  }
  const deAlejo = (materia: Materia) =>
    ordenar(
      ocurrencias.filter(
        (o) =>
          o.fila.alumno === ALEJO && o.fila.materia === materia && o.fila.tipo === 'RECURRENTE',
      ),
    )
  for (const [materia, cuando, detalle] of [
    ['MAT', enMes(-5, 12), 'Tenía un acto en el colegio'],
    ['FIS', enMes(-2, 5), 'Viaje con el colegio a Cafayate'],
  ] as const) {
    const o = deAlejo(materia).find((x) => x.fecha >= cuando)
    if (o)
      o.cancelacion = { motivo: 'CANCELACION_ALUMNO', detalle, createdAt: momentoCancelacion(o) }
  }

  // --- Asistencias ---------------------------------------------------------------------------
  const OBS_AUSENTE_MENOR = [
    'Avisó la familia que estaba con fiebre',
    'No vino y no avisó',
    'Avisó que tenía un turno médico',
    'Tenía un acto en el colegio',
    'Avisó por mensaje que no llegaba por el paro de colectivos',
    'Viajó con la familia',
  ]
  const OBS_AUSENTE_MAYOR = [
    'Avisó que le cambiaron el horario del trabajo',
    'Tenía examen en la facultad ese día',
    'No vino y no avisó',
    'Avisó por mensaje que se sentía mal',
    'Avisó a último momento que no llegaba',
  ]
  const registro = (o: Ocurr, prof: ProfesorDef): Date | null => {
    const fin = bloqueDeOcurr(o).hora + 60
    const tarde = azar.chance(prof.registroTarde)
    if (tarde) {
      // Aguirre, si no la registra en el día, lo hace al día siguiente; otros tardan más.
      const dia = sumarDias(o.fecha, prof.clave === 'aguirre' ? 1 : azar.entero(1, 4))
      if (dia >= HOY) return null
      if (mesDe(dia) !== mesDe(o.fecha))
        return instante(o.fecha, Math.min(fin + azar.entero(0, 90), 20 * 60 + 30))
      return instante(dia, azar.entero(8 * 60, 20 * 60))
    }
    return instante(o.fecha, Math.min(fin + azar.entero(0, 100), 20 * 60 + 30))
  }
  for (const o of ocurrencias) {
    if (o.fecha >= HOY || o.cancelacion) continue
    const prof = PROFESORES[profDeOcurr(o)] as ProfesorDef
    if (profDeOcurr(o) === AGUIRRE && o.fecha === AYER) continue
    if (o.fila.alumno !== ALEJO && o.fecha < sumarDias(HOY, -7) && azar.chance(prof.sinRegistrar))
      continue
    const createdAt = registro(o, prof)
    if (!createdAt) continue
    const a = alumnos[o.fila.alumno] as AlumnoModelo
    const presente = azar.chance(o.fila.alumno === ALEJO ? 0.95 : prof.presentismo)
    o.asistencia = {
      estado: presente ? 'PRESENTE' : 'AUSENTE',
      createdAt,
      trabajado: null,
      indicaciones: null,
      observacion: presente ? null : azar.de(a.tutor ? OBS_AUSENTE_MENOR : OBS_AUSENTE_MAYOR),
    }
  }
  // Las ausencias de Alejo, con lo que avisó la madre.
  const ausenciasAlejo: [Materia, string, string][] = [
    ['MAT', enMes(-6, 20), 'Avisó la madre que estaba enfermo'],
    ['FIS', enMes(-4, 8), 'Avisó la madre que tenía turno con el dentista'],
    ['MAT', enMes(-2, 18), 'Tenía un torneo de fútbol del colegio'],
  ]
  for (const o of ocurrencias) {
    if (o.fila.alumno === ALEJO && o.asistencia?.estado === 'AUSENTE') {
      o.asistencia.estado = 'PRESENTE'
      o.asistencia.observacion = null
    }
  }
  for (const [materia, cuando, observacion] of ausenciasAlejo) {
    const o = deAlejo(materia).find((x) => x.fecha >= cuando && x.asistencia && !x.cancelacion)
    if (o?.asistencia) {
      o.asistencia.estado = 'AUSENTE'
      o.asistencia.observacion = observacion
    }
  }

  // Lo trabajado y las indicaciones, encadenados clase a clase por alumno y materia.
  const examenesDe = (alumno: number, materia: Materia) =>
    examenes
      .filter((e) => e.alumno === alumno && e.materia === materia)
      .sort((x, y) => x.fecha.localeCompare(y.fecha))
  const COMENTARIOS_TAREA = [
    'los resolvió casi todos sin ayuda',
    'tuvo dudas en los últimos dos',
    'le costó el planteo de los problemas',
    'trajo todo hecho y bien presentado',
    'hizo la mitad; el resto se terminó en clase',
  ]
  const porCursada = new Map<string, Ocurr[]>()
  for (const o of ocurrencias) {
    if (!o.asistencia) continue
    const clave = `${o.fila.alumno}|${o.fila.materia}`
    porCursada.set(clave, [...(porCursada.get(clave) ?? []), o])
  }
  for (const lista of porCursada.values()) {
    ordenar(lista)
    const primera = lista[0] as Ocurr
    const alumno = primera.fila.alumno
    const materia = primera.fila.materia
    const a = alumnos[alumno] as AlumnoModelo
    const prof = profDeOcurr(primera)
    const esAlejo = alumno === ALEJO
    const detallado = esAlejo || prof === AGUIRRE || azar.chance(0.6)
    const programa = programaPara(materia, a.nivel, a.grado)
    const porFecha = esAlejo || programa === MAT_QUINTO || programa === FIS_SECUNDARIO
    const exs = examenesDe(alumno, materia)
    type Previa = {
      indicaciones: { guia: number; a: number; b: number } | null
      ausente: boolean
      subtema: string
    }
    let anterior = null as Previa | null
    let ejercicio = 1
    let guiaActual = 0
    let k = unidadDeInicio(programa, primera.fecha) * 5 + azar.entero(0, 2)
    for (const o of lista) {
      const asistencia = o.asistencia as Asistencia
      if (asistencia.estado === 'AUSENTE') {
        if (anterior !== null) anterior = { ...(anterior as Previa), ausente: true }
        continue
      }
      const u =
        porFecha && (materia === 'MAT' || materia === 'FIS')
          ? unidadPorFecha(materia, o.fecha)
          : Math.floor(k / 5) % programa.length
      const unidad = programa[Math.min(u, programa.length - 1)] as Unidad
      const guia = Math.min(u, programa.length - 1) + 1
      if (guia !== guiaActual) {
        guiaActual = guia
        ejercicio = 1
      }
      const sub = porFecha
        ? (unidad.subtemas[
            Math.min(
              unidad.subtemas.length - 1,
              Math.floor(
                lista.filter(
                  (x) =>
                    x.asistencia?.estado === 'PRESENTE' &&
                    x.fecha < o.fecha &&
                    (materia === 'MAT' || materia === 'FIS') &&
                    unidadPorFecha(materia, x.fecha) === u,
                ).length / 2,
              ),
            )
          ] as string)
        : (unidad.subtemas[Math.floor(k / 2) % unidad.subtemas.length] as string)
      k++
      const proximo = exs.find((e) => e.fecha > o.fecha && e.fecha <= sumarDias(o.fecha, 7))
      const reciente = exs.find(
        (e) => e.fecha < o.fecha && e.fecha >= sumarDias(o.fecha, -8) && e.resultado === 'CON_NOTA',
      )
      const partes: string[] = []
      if (anterior === null) {
        partes.push(
          esAlejo
            ? 'Primera clase: diagnóstico de los temas del año y organización del trabajo.'
            : 'Primera clase: se revisó qué temas está viendo y cómo viene.',
        )
      } else if (anterior.ausente) {
        partes.push('Se retomó lo que quedó pendiente antes de la falta.')
      } else if (anterior.indicaciones && detallado) {
        const { guia: g, a: x, b: y } = anterior.indicaciones
        partes.push(
          azar.chance(0.5)
            ? `Se corrigieron ${recurso(materia, g, x, y)} que quedaron de tarea.`
            : `Revisamos la tarea (${recurso(materia, g, x, y)}): ${azar.de(COMENTARIOS_TAREA)}.`,
        )
      }
      if (reciente)
        partes.push(
          `Se revisó la evaluación del ${ddmm(reciente.fecha)} y se corrigieron los errores.`,
        )
      if (o.fila.tipo === 'SESION_UNICA' || proximo) {
        partes.push(
          `Repaso integrador de ${unidad.nombre.toLowerCase()} para la evaluación del ${ddmm(proximo?.fecha ?? o.fecha)}.`,
        )
      } else if (anterior && anterior.subtema === sub) {
        partes.push(
          `Se continuó con ${sub}${azar.chance(0.5) ? ', con ejercicios de mayor dificultad' : ', resolviendo problemas de aplicación'}.`,
        )
      } else {
        partes.push(`Se trabajó ${sub}.`)
      }
      const cantidad = azar.entero(4, 8)
      const indic =
        detallado || azar.chance(0.5) ? { guia, a: ejercicio, b: ejercicio + cantidad - 1 } : null
      if (indic) ejercicio += cantidad
      asistencia.trabajado = partes.join(' ')
      asistencia.indicaciones = indic
        ? proximo && detallado
          ? `Repasar ${unidad.nombre.toLowerCase()} para la evaluación del ${ddmm(proximo.fecha)} y resolver ${recurso(materia, indic.guia, indic.a, indic.b)}.`
          : `Resolver ${recurso(materia, indic.guia, indic.a, indic.b)} (${sub}).`
        : null
      anterior = { indicaciones: indic, ausente: false, subtema: sub }
    }
  }

  // --- Pagos ---------------------------------------------------------------------------------
  const pagos: PagoModelo[] = []
  const formaDelPago = (a: AlumnoModelo): Forma => (azar.chance(0.8) ? a.forma : formaAlAzar())
  const minutosDePago = (alumno: number, fecha: string, items: Ocurr[]): number => {
    const delDia = items.filter((o) => o.fecha === fecha).map((o) => bloqueDeOcurr(o).hora)
    const ya = pagos.filter((p) => p.alumno === alumno && p.fecha === fecha).map((p) => p.minutos)
    let minutos: number
    if (delDia.length > 0) {
      const desde = Math.min(...delDia)
      const hasta = Math.max(...delDia) + 60
      minutos =
        azar.chance(0.5) && desde - 25 >= 8 * 60
          ? desde - azar.entero(5, 25)
          : Math.min(hasta + azar.entero(0, 20), 20 * 60 + 30)
    } else {
      minutos = azar.entero(9 * 60, 19 * 60 + 30)
    }
    while (ya.includes(minutos)) minutos += 2
    return Math.min(minutos, 20 * 60 + 30)
  }
  const registrarPago = (
    alumno: number,
    fecha: string,
    items: Ocurr[],
    observaciones: string | null,
  ) => {
    if (fecha >= HOY) throw new Error('Un pago no puede ser de hoy ni futuro')
    const a = alumnos[alumno] as AlumnoModelo
    // Por materia y de a 12 como mucho.
    const porMateria = new Map<Materia, Ocurr[]>()
    for (const o of ordenar([...items]))
      porMateria.set(o.fila.materia, [...(porMateria.get(o.fila.materia) ?? []), o])
    const grupos: Ocurr[][] = []
    const juntos = [...porMateria.values()].flat()
    if (juntos.length <= 12 && azar.chance(0.5)) grupos.push(juntos)
    else
      for (const lista of porMateria.values())
        for (let i = 0; i < lista.length; i += 12) grupos.push(lista.slice(i, i + 12))
    for (const grupo of grupos) {
      const pago: PagoModelo = {
        idx: pagos.length,
        alumno,
        fecha,
        minutos: minutosDePago(alumno, fecha, grupo),
        items: grupo,
        forma: formaDelPago(a),
        observaciones,
      }
      for (const o of grupo) {
        if (o.pago) throw new Error('Ocurrencia pagada dos veces')
        if (o.cancelacion) throw new Error('Ocurrencia cancelada cobrada')
        if (o.fecha > limiteDeCobro(fecha)) throw new Error('Ocurrencia fuera del tope de cobro')
        o.pago = pago
      }
      pagos.push(pago)
    }
  }
  const mesesDeHistoria = [-6, -5, -4, -3, -2, -1, 0]
  const pagadoPor = (a: AlumnoModelo, fecha: string) =>
    a.deudaDesde === null || fecha < a.deudaDesde

  alumnos.forEach((a, alumno) => {
    const propias = ordenar(ocurrencias.filter((o) => o.fila.alumno === alumno && !o.cancelacion))
    if (propias.length === 0) return
    const ultimaDelMes = (mes: string) => propias.filter((o) => mesDe(o.fecha) === mes).at(-1)
    const quienPaga = a.tutor ? (a.tutor.genero === 'F' ? 'Pagó la madre' : 'Pagó el padre') : null
    const obs = (texto: string | null) =>
      azar.chance(0.25) ? texto : azar.chance(0.15) ? quienPaga : null

    if (a.patron === 'MENSUAL') {
      for (const m of mesesDeHistoria) {
        const mes = mesA(m)
        const delMes = propias.filter((o) => mesDe(o.fecha) === mes && !o.pago)
        const primera = delMes[0]
        if (!primera || primera.fecha >= HOY || !pagadoPor(a, primera.fecha)) continue
        const items = delMes.filter((o) => o.fecha <= limiteDeCobro(primera.fecha))
        registrarPago(
          alumno,
          primera.fecha,
          items,
          obs(`Abona ${nombreMes(primera.fecha)} por adelantado`),
        )
      }
    } else if (a.patron === 'ATRASADO') {
      for (const m of mesesDeHistoria.slice(0, -1)) {
        const mes = mesA(m)
        const delMes = propias.filter((o) => mesDe(o.fecha) === mes && !o.pago)
        const ultima = ultimaDelMes(mes)
        if (!ultima || delMes.length === 0) continue
        const fecha = ultima.fecha
        if (fecha >= HOY || !pagadoPor(a, fecha)) continue
        registrarPago(alumno, fecha, delMes, obs(`Abona las clases de ${nombreMes(ultima.fecha)}`))
      }
    } else if (a.patron === 'POR_CLASE') {
      let pendientes: Ocurr[] = []
      for (const o of propias) {
        if (o.fecha >= HOY || !pagadoPor(a, o.fecha)) break
        pendientes.push(o)
        const otraMismoDia = propias.find(
          (x) => x.fecha === o.fecha && bloqueDeOcurr(x).hora > bloqueDeOcurr(o).hora,
        )
        if (otraMismoDia) continue
        const finDeM1 = o === ultimaDelMes(mesA(-1))
        if (finDeM1 || azar.chance(0.93) || pendientes.length >= 3) {
          registrarPago(
            alumno,
            o.fecha,
            pendientes,
            pendientes.length > 1 ? obs('Paga las clases juntas') : null,
          )
          pendientes = []
        }
      }
    } else {
      // QUINCENAL: cada dos semanas, lo ya dado (y a fin de M-1, lo del mes). Alejo deja de pagar
      // a fines de M-1.
      const corte = alumno === ALEJO ? sumarDias(HOY, -22) : AYER
      const ultimaAntesDelCorte = propias.filter((o) => o.fecha <= corte).at(-1)
      let proximo = sumarDias((propias[0] as Ocurr).fecha, 13)
      for (const o of propias) {
        if (o.fecha > corte || !pagadoPor(a, o.fecha)) break
        const otraMismoDia = propias.find(
          (x) => x.fecha === o.fecha && bloqueDeOcurr(x).hora > bloqueDeOcurr(o).hora,
        )
        if (otraMismoDia) continue
        const finDeM1 = o === ultimaDelMes(mesA(-1)) && alumno !== ALEJO
        if (o.fecha >= proximo || finDeM1 || o === ultimaAntesDelCorte) {
          const items = propias.filter((x) => x.fecha <= o.fecha && !x.pago)
          if (items.length > 0)
            registrarPago(
              alumno,
              o.fecha,
              items,
              obs('Abona las clases de las últimas dos semanas'),
            )
          proximo = sumarDias(o.fecha, 14)
        }
      }
    }
  })

  // --- Cuadre de la deuda (exacto) --------------------------------------------------------------
  const precioOcurr = (o: Ocurr) => precioDe(o.fila.materia)
  const adeudada = (o: Ocurr) =>
    esAdeudado(
      {
        fecha: o.fecha,
        estado: o.cancelacion ? 'CANCELADO' : 'AGENDADO',
        pago: { estado: o.pago ? 'PAGADO' : 'PENDIENTE' },
      },
      HOY,
    )
  const deudaModelo = () => ocurrencias.filter(adeudada).reduce((s, o) => s + precioOcurr(o), 0)
  const cobradoModelo = () =>
    pagos
      .filter((p) => p.items.length > 0 && p.fecha >= PRIMERO_DEL_MES && p.fecha < HOY)
      .reduce((s, p) => s + p.items.reduce((t, o) => t + precioOcurr(o), 0), 0)
  const deudaInicial = deudaModelo()
  const cobradoInicial = cobradoModelo()
  const intocable = (alumno: number) => {
    const a = alumnos[alumno] as AlumnoModelo
    return alumno === ALEJO || a.deAguirre || a.deudaDesde !== null
  }

  const diferenciaDeuda = deudaInicial - DEUDA_OBJETIVO
  if (diferenciaDeuda > 0) {
    // Sobra deuda: algunos atrasados pagan "a cuenta" sus primeras clases impagas del mes.
    const grupos = alumnos
      .map((_, alumno) => alumno)
      .filter((alumno) => !intocable(alumno))
      .map((alumno) => {
        const impagas = ordenar(
          ocurrencias.filter(
            (o) => o.fila.alumno === alumno && adeudada(o) && o.fecha >= PRIMERO_DEL_MES,
          ),
        )
        return impagas.slice(0, -1).map((_, k) => {
          const items = impagas.slice(0, k + 1)
          return { valor: items.reduce((s, o) => s + precioOcurr(o), 0), dato: { alumno, items } }
        })
      })
      .filter((g) => g.length > 0)
    const elegidos = elegirExacto(grupos, diferenciaDeuda)
    if (!elegidos) throw new SinCuadre(`No se pudo cuadrar la deuda (sobran $${diferenciaDeuda}).`)
    for (const { alumno, items } of elegidos) {
      const fecha = (items.at(-1) as Ocurr).fecha
      registrarPago(alumno, fecha, items, 'Pago a cuenta de las clases del mes')
    }
  } else if (diferenciaDeuda < 0) {
    // Falta deuda: algunos que pagan por clase (o cada dos semanas) no pagaron sus últimas clases.
    const grupos = alumnos
      .map((_, alumno) => alumno)
      .filter((alumno) => !intocable(alumno))
      .map((alumno) => {
        const delMes = pagos
          .filter(
            (p) =>
              p.alumno === alumno &&
              p.fecha >= PRIMERO_DEL_MES &&
              p.items.length > 0 &&
              p.items.every((o) => o.fecha < HOY && o.fecha >= PRIMERO_DEL_MES),
          )
          .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.minutos - y.minutos)
        const patron = (alumnos[alumno] as AlumnoModelo).patron
        if (patron !== 'POR_CLASE' && patron !== 'QUINCENAL') return []
        return delMes.map((_, k) => {
          const quitados = delMes.slice(delMes.length - 1 - k)
          return {
            valor: quitados.reduce(
              (s, p) => s + p.items.reduce((t, o) => t + precioOcurr(o), 0),
              0,
            ),
            dato: quitados,
          }
        })
      })
      .filter((g) => g.length > 0)
    const elegidos = elegirExacto(grupos, -diferenciaDeuda)
    if (!elegidos) throw new SinCuadre(`No se pudo cuadrar la deuda (faltan $${-diferenciaDeuda}).`)
    for (const p of elegidos.flat()) {
      for (const o of p.items) o.pago = null
      p.items = []
    }
  }

  // --- Cuadre de lo cobrado en el mes (exacto, sólo con ocurrencias futuras) -------------------
  const diferenciaCobrado = cobradoModelo() - COBRADO_OBJETIVO
  const mensualesDelMes = alumnos
    .map((a, alumno) => ({ a, alumno }))
    .filter(({ a, alumno }) => a.patron === 'MENSUAL' && alumno !== ALEJO)
  if (diferenciaCobrado > 0) {
    // Algunos pagaron el mes hasta una fecha y no completo: se sacan sus últimas fechas futuras.
    const grupos = mensualesDelMes.map(({ alumno }) => {
      const futuras = ordenar(
        ocurrencias.filter(
          (o) =>
            o.fila.alumno === alumno && o.fecha >= HOY && o.pago && o.pago.fecha >= PRIMERO_DEL_MES,
        ),
      )
      return futuras.map((_, k) => {
        const items = futuras.slice(futuras.length - 1 - k)
        return { valor: items.reduce((s, o) => s + precioOcurr(o), 0), dato: items }
      })
    })
    const elegidos = elegirExacto(grupos, diferenciaCobrado)
    if (!elegidos)
      throw new SinCuadre(`No se pudo cuadrar lo cobrado (sobran $${diferenciaCobrado}).`)
    for (const o of elegidos.flat()) {
      const pago = o.pago as PagoModelo
      pago.items = pago.items.filter((x) => x !== o)
      o.pago = null
    }
  } else if (diferenciaCobrado < 0) {
    // Algunos pagaron además las primeras clases del mes que viene.
    const grupos = mensualesDelMes.map(({ alumno }) => {
      const ultimoPago = pagos
        .filter((p) => p.alumno === alumno && p.fecha >= PRIMERO_DEL_MES && p.items.length > 0)
        .sort((x, y) => x.fecha.localeCompare(y.fecha))
        .at(-1)
      if (!ultimoPago) return []
      const siguientes = ordenar(
        ocurrencias.filter(
          (o) =>
            o.fila.alumno === alumno &&
            o.fecha >= HOY &&
            !o.pago &&
            !o.cancelacion &&
            o.fecha <= limiteDeCobro(ultimoPago.fecha),
        ),
      ).slice(0, 6)
      return siguientes.map((_, k) => {
        const items = siguientes.slice(0, k + 1)
        return {
          valor: items.reduce((s, o) => s + precioOcurr(o), 0),
          dato: { alumno, fecha: ultimoPago.fecha, items },
        }
      })
    })
    const elegidos = elegirExacto(grupos, -diferenciaCobrado)
    if (!elegidos)
      throw new SinCuadre(`No se pudo cuadrar lo cobrado (faltan $${-diferenciaCobrado}).`)
    for (const { alumno, fecha, items } of elegidos) {
      registrarPago(alumno, fecha, items, `Adelanta clases de ${nombreMes(enMes(1, 1))}`)
    }
  }
  if (deudaModelo() !== DEUDA_OBJETIVO || cobradoModelo() !== COBRADO_OBJETIVO) {
    throw new Error(
      `El cuadre en memoria no dio: deuda ${deudaModelo()} y cobrado ${cobradoModelo()}.`,
    )
  }

  return {
    bloques,
    alumnos,
    filas,
    ocurrencias,
    pagos,
    examenes,
    ALEJO,
    precioOcurr,
    porcentajeEn,
    profDeOcurr,
    adeudada,
    deudaInicial,
    cobradoInicial,
  }
}
type Modelo = ReturnType<typeof generar>

/** Ocupación de los últimos 60 días de cada profesor: turnos no cancelados / capacidad de sus clases. */
function ocupaciones(m: Modelo): number[] {
  return PROFESORES.map((_, i) => {
    const clases = new Map<string, number>()
    for (const o of m.ocurrencias) {
      if (
        o.cancelacion ||
        o.fecha >= HOY ||
        o.fecha < sumarDias(HOY, -60) ||
        m.profDeOcurr(o) !== i
      )
        continue
      const clave = `${o.fila.bloque}|${o.fecha}`
      clases.set(clave, (clases.get(clave) ?? 0) + 1)
    }
    const turnos = [...clases.values()].reduce((s, n) => s + n, 0)
    const capacidad = [...clases.keys()].reduce(
      (s, c) => s + (m.bloques[Number(c.split('|')[0])] as Bloque).capacidad,
      0,
    )
    return capacidad ? Math.round((100 * turnos) / capacidad) : 0
  })
}

/**
 * Lo que tiene que parecer real y no se puede fijar a mano (depende de toda la historia), medido
 * sobre el modelo con las reglas reales del devengo y del reparto: la forma de la evolución mensual,
 * la liquidación de M-1 de cada profesor, "Este mes" de Aguirre, la ocupación, los deudores, las
 * cancelaciones y el presentismo. Devuelve lo que no cumple (vacío = la semilla sirve).
 */
function evaluar(m: Modelo): string[] {
  const problemas: string[] = []
  const importe = (p: PagoModelo) => p.items.reduce((s, o) => s + m.precioOcurr(o), 0)
  const cobrado = [-5, -4, -3, -2, -1].map((k) =>
    m.pagos.filter((p) => mesDe(p.fecha) === mesA(k)).reduce((s, p) => s + importe(p), 0),
  )
  const [mayo, junio, julio, agosto, septiembre] = cobrado as [
    number,
    number,
    number,
    number,
    number,
  ]
  if (cobrado.some((v) => v < 3_300_000 || v > 4_300_000))
    problemas.push(`cobrado mensual ${cobrado.join(' / ')}`)
  if (!(
    junio > mayo &&
    julio < junio * 0.93 &&
    agosto > julio * 1.08 &&
    septiembre > agosto * 1.02
  )) {
    problemas.push(`forma de la evolución ${cobrado.join(' / ')}`)
  }

  // Liquidación de M-1 y "Este mes" (en centavos), con el devengo y el reparto de la app.
  const m1 = PROFESORES.map(() => 0)
  const esteMes = PROFESORES.map(() => 0)
  for (const p of m.pagos) {
    const registrado = instante(p.fecha, p.minutos)
    for (const o of p.items) {
      if (!o.asistencia || !estaDevengado({ pagoVigente: true, asistencia: o.asistencia.estado }))
        continue
      const devengo = fechaDevengo({
        pagoRegistradoEl: registrado,
        asistenciaRegistradaEl: o.asistencia.createdAt,
      })
      const parte = Math.round(
        repartoDeTurno(m.precioOcurr(o), m.porcentajeEn(registrado)).parteProfesor * 100,
      )
      const prof = m.profDeOcurr(o)
      if (mesDe(devengo) === mesA(-1)) m1[prof] = (m1[prof] as number) + parte
      if (mesDe(devengo) === MES_ACTUAL) esteMes[prof] = (esteMes[prof] as number) + parte
    }
  }
  m1.forEach((centavos, i) => {
    if (
      centavos < (RANGO_LIQUIDACION_M1.min + 5_000) * 100 ||
      centavos > (RANGO_LIQUIDACION_M1.max - 5_000) * 100
    ) {
      problemas.push(`M-1 de ${(PROFESORES[i] as ProfesorDef).apellido}: ${centavos / 100}`)
    }
  })
  if (m1.filter((c) => c > (m1[0] as number)).length > 2)
    problemas.push('Aguirre no está entre las más altas de M-1')
  const aguirre = (esteMes[0] as number) / 100
  if (
    aguirre < RANGO_ESTE_MES_AGUIRRE.min + 5_000 ||
    aguirre > RANGO_ESTE_MES_AGUIRRE.max - 5_000
  ) {
    problemas.push(`"Este mes" de Aguirre: ${aguirre}`)
  }

  ocupaciones(m).forEach((porcentaje, i) => {
    if (porcentaje < 55 || porcentaje > 85) {
      problemas.push(`ocupación de ${(PROFESORES[i] as ProfesorDef).apellido}: ${porcentaje} %`)
    }
  })
  const deudores = new Set(m.ocurrencias.filter(m.adeudada).map((o) => o.fila.alumno))
  deudores.delete(m.ALEJO)
  if (deudores.size < 15 || deudores.size > 20)
    problemas.push(`${deudores.size} deudores además de Alejo`)
  const pasadas = m.ocurrencias.filter((o) => o.fecha < HOY)
  const canceladas = pasadas.filter((o) => o.cancelacion).length / pasadas.length
  if (canceladas < 0.03 || canceladas > 0.05)
    problemas.push(`cancelaciones ${(100 * canceladas).toFixed(1)} %`)
  const conAsistencia = m.ocurrencias.filter((o) => o.asistencia)
  const presentes =
    conAsistencia.filter((o) => o.asistencia?.estado === 'PRESENTE').length / conAsistencia.length
  if (presentes < 0.85 || presentes > 0.93)
    problemas.push(`presentes ${(100 * presentes).toFixed(1)} %`)
  return problemas
}

/** Cuántas semillas se prueban como mucho antes de quedarse con la mejor. */
const MAX_INTENTOS = 200

/**
 * Prueba semillas consecutivas desde `SEMILLA` hasta encontrar un centro que cumpla `evaluar`, y lo
 * escribe. Es determinista: con la misma fecha de hoy, siempre elige la misma semilla.
 */
async function crear() {
  const ctx = await leerContexto()
  let elegido: { modelo: Modelo; azar: Azar; problemas: string[]; semilla: number } | null = null
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const semilla = SEMILLA + intento
    const azar = crearAzar(semilla)
    let modelo: Modelo
    try {
      modelo = generar(azar, ctx)
    } catch (error) {
      if (error instanceof SinCuadre) continue
      throw error
    }
    const problemas = evaluar(modelo)
    if (process.env.SEED_DIAG)
      console.log(semilla, problemas.map((p) => p.slice(0, 60)).join(' | '))
    if (!elegido || problemas.length < elegido.problemas.length)
      elegido = { modelo, azar, problemas, semilla }
    if (problemas.length === 0) break
  }
  if (!elegido) throw new Error(`Ninguna de las ${MAX_INTENTOS} semillas pudo cuadrar los totales.`)
  if (elegido.problemas.length > 0) {
    console.warn(
      `Ninguna semilla cumplió todas las metas; se usa la ${elegido.semilla}, que no cumple:\n  - ` +
        elegido.problemas.join('\n  - '),
    )
  }
  return { ...(await escribir(elegido.modelo, ctx, elegido.azar)), semilla: elegido.semilla }
}

/** Escribe en la base el centro generado y cierra las liquidaciones de M-6 a M-2. */
async function escribir(m: Modelo, ctx: Contexto, azar: Azar) {
  const {
    bloques,
    alumnos,
    filas,
    ocurrencias,
    pagos,
    examenes,
    ALEJO,
    precioOcurr,
    porcentajeEn,
    profDeOcurr,
    adeudada,
    deudaInicial,
    cobradoInicial,
  } = m
  const { materiaPorClave, formaPorTipo, gerente } = ctx

  const cargador = await prisma.usuario.upsert({
    where: { dni: CARGADOR.dni },
    create: {
      id: azar.uuid(),
      ...CARGADOR,
      busqueda: busquedaDe(CARGADOR.nombre, CARGADOR.apellido, CARGADOR.dni),
      emailVerified: true,
      role: 'MESA_ENTRADAS',
      createdAt: instante(INICIO, 8 * 60),
      updatedAt: instante(INICIO, 8 * 60),
    },
    update: {},
  })
  const auditoria = { createdById: cargador.id, updatedById: cargador.id }

  // Profesores con cuenta, dados de alta el primer día de la historia.
  const hash = await hashPassword(PASSWORD_PROFESORES)
  const altaProfesores = instante(INICIO, 9 * 60)
  const usuariosProf = PROFESORES.map((p) => ({
    id: azar.uuid(),
    nombre: p.nombre,
    apellido: p.apellido,
    dni: p.dni,
    busqueda: busquedaDe(p.nombre, p.apellido, p.dni),
    telefono: p.telefono,
    email: p.email,
    emailVerified: true,
    role: 'PROFESOR',
    ...auditoria,
    createdAt: altaProfesores,
    updatedAt: altaProfesores,
  }))
  await prisma.usuario.createMany({ data: usuariosProf })
  await prisma.account.createMany({
    data: usuariosProf.map((u) => ({
      id: azar.uuid(),
      providerId: 'credential',
      accountId: u.id,
      userId: u.id,
      password: hash,
      createdAt: altaProfesores,
      updatedAt: altaProfesores,
    })),
  })
  const profesoresDb = (
    await prisma.profesor.createManyAndReturn({
      data: PROFESORES.map((p, i) => ({
        usuarioId: (usuariosProf[i] as (typeof usuariosProf)[number]).id,
        titulo: p.titulo,
        matricula: p.matricula,
        capacidad: p.capacidad,
      })),
      select: { id: true, usuarioId: true },
    })
  ).sort((x, y) => x.id - y.id)
  const profId = (p: number) => (profesoresDb[p] as { id: number }).id
  const profUsuario = (p: number) => (usuariosProf[p] as { id: string }).id
  await prisma.asignacionMateria.createMany({
    data: PROFESORES.flatMap((p, i) =>
      p.materias.map((m) => ({
        profesorId: profId(i),
        materiaId: materiaPorClave[m].id,
        ...auditoria,
        createdAt: altaProfesores,
        updatedAt: altaProfesores,
      })),
    ),
  })
  const bloquesDb = (
    await prisma.bloqueAgenda.createManyAndReturn({
      data: bloques.map((b) => ({
        profesorId: profId(b.prof),
        aulaId: b.aulaId,
        diaSemana: b.dia,
        horaInicio: b.hora,
        horaFin: b.hora + 60,
        ...auditoria,
        createdAt: altaProfesores,
        updatedAt: altaProfesores,
      })),
      select: { id: true },
    })
  ).sort((x, y) => x.id - y.id)

  // Alumnos: el alta, unos días antes de su primera clase.
  alumnos.forEach((a, i) => {
    const primera = filas
      .filter((f) => f.alumno === i)
      .map((f) => f.createdAt)
      .sort((x, y) => x.getTime() - y.getTime())[0]
    const base = primera ?? instante(sumarDias(HOY, -10), 10 * 60)
    let dia = sumarDias(fechaEnZona(base), -azar.entero(0, 3))
    if (dia < INICIO) dia = INICIO
    if (dia >= HOY) dia = AYER
    let createdAt = instante(dia, azar.entero(9 * 60, 19 * 60))
    if (createdAt > base) createdAt = new Date(base.getTime() - 20 * 60 * 1000)
    a.createdAt = createdAt
  })
  const alumnosDb = (
    await prisma.alumno.createManyAndReturn({
      data: alumnos.map((a) => ({
        nombre: a.nombre,
        apellido: a.apellido,
        dni: a.dni,
        busqueda: busquedaDe(a.nombre, a.apellido, a.dni),
        fechaNacimiento: fechaADate(a.fechaNacimiento),
        telefono: a.telefono,
        email: a.email,
        tutorNombre: a.tutor?.nombre ?? null,
        tutorApellido: a.tutor?.apellido ?? null,
        tutorDni: a.tutor?.dni ?? null,
        tutorTelefono: a.tutor?.telefono ?? null,
        tutorEmail: a.tutor?.email ?? null,
        nivelEscolaridad: a.nivel,
        grado: a.grado,
        institucionEducativa: a.institucion,
        observaciones: a.observaciones,
        ...auditoria,
        createdAt: a.createdAt as Date,
        updatedAt: a.createdAt as Date,
      })),
      select: { id: true },
    })
  ).sort((x, y) => x.id - y.id)
  const alumnoId = (i: number) => (alumnosDb[i] as { id: number }).id

  // Acceso al portal de Alejo (regla de `usuarioDelAlumno` del seed de desarrollo).
  const alejo = alumnos[ALEJO] as AlumnoModelo
  const baseUsuario = `${sinSimbolos(alejo.nombre).charAt(0)}${sinSimbolos(alejo.apellido)}${alejo.dni.slice(-3)}`
  let usuarioAlejo = baseUsuario
  for (let n = 2; await prisma.usuario.findUnique({ where: { username: usuarioAlejo } }); n++) {
    usuarioAlejo = `${baseUsuario}-${n}`
  }
  const altaPortal = instante(diaHabil(enMes(-1, 8)), 10 * 60 + 40)
  const cuentaAlejo = await prisma.usuario.create({
    data: {
      id: azar.uuid(),
      nombre: alejo.nombre,
      apellido: alejo.apellido,
      dni: alejo.dni,
      busqueda: busquedaDe(alejo.nombre, alejo.apellido, alejo.dni),
      telefono: alejo.telefono ?? (alejo.tutor as TutorDatos).telefono,
      email: `${usuarioAlejo}@${DOMINIO_EMAIL_ALUMNOS}`,
      emailVerified: true,
      username: usuarioAlejo,
      displayUsername: usuarioAlejo,
      role: 'ALUMNO',
      alumnoId: alumnoId(ALEJO),
      ...auditoria,
      createdAt: altaPortal,
      updatedAt: altaPortal,
    },
  })
  await prisma.account.create({
    data: {
      id: azar.uuid(),
      providerId: 'credential',
      accountId: cuentaAlejo.id,
      userId: cuentaAlejo.id,
      password: await hashPassword(alejo.dni),
      contrasenaInicial: true,
      createdAt: altaPortal,
      updatedAt: altaPortal,
    },
  })

  // Turnos.
  const turnosDb = (
    await prisma.turno.createManyAndReturn({
      data: filas.map((f) => ({
        bloqueAgendaId: (bloquesDb[f.bloque] as { id: number }).id,
        alumnoId: alumnoId(f.alumno),
        materiaId: materiaPorClave[f.materia].id,
        tipo: f.tipo,
        fechaInicio: fechaADate(f.fechaInicio),
        fechaFin: f.fechaFin === null ? null : fechaADate(f.fechaFin),
        observaciones: f.observaciones,
        temas: f.temas,
        serieId: f.serieId,
        ...auditoria,
        createdAt: f.createdAt,
        updatedAt: f.createdAt,
      })),
      select: { id: true },
    })
  ).sort((x, y) => x.id - y.id)
  const turnoId = (f: Fila) => (turnosDb[f.idx] as { id: number }).id

  await prisma.finalizacionRecurrencia.createMany({
    data: filas.flatMap((f) =>
      f.finalizacion
        ? [
            {
              turnoId: turnoId(f),
              fechaDesde: fechaADate(f.finalizacion.fechaDesde),
              motivo: 'CANCELACION_ALUMNO' as const,
              detalle: f.finalizacion.detalle,
              createdById: cargador.id,
              createdAt: f.finalizacion.createdAt,
            },
          ]
        : [],
    ),
  })
  await prisma.cancelacionTurno.createMany({
    data: ocurrencias.flatMap((o) =>
      o.cancelacion
        ? [
            {
              turnoId: turnoId(o.fila),
              fechaOcurrencia: fechaADate(o.fecha),
              motivo: o.cancelacion.motivo,
              detalle: o.cancelacion.detalle,
              createdById: cargador.id,
              createdAt: o.cancelacion.createdAt,
            },
          ]
        : [],
    ),
  })
  const asistenciasData = ocurrencias.flatMap((o) => {
    if (!o.asistencia) return []
    const usuario = profUsuario(profDeOcurr(o))
    return [
      {
        turnoId: turnoId(o.fila),
        fechaOcurrencia: fechaADate(o.fecha),
        estado: o.asistencia.estado,
        trabajado: o.asistencia.trabajado,
        indicaciones: o.asistencia.indicaciones,
        observacion: o.asistencia.observacion,
        createdById: usuario,
        updatedById: usuario,
        createdAt: o.asistencia.createdAt,
        updatedAt: o.asistencia.createdAt,
      },
    ]
  })
  for (let i = 0; i < asistenciasData.length; i += 1000) {
    await prisma.asistenciaTurno.createMany({ data: asistenciasData.slice(i, i + 1000) })
  }
  await prisma.examen.createMany({
    data: examenes.map((e) => {
      const notaPor =
        e.notaPor === 'PROFESOR' ? profUsuario(e.prof) : e.notaPor === 'MESA' ? cargador.id : null
      return {
        alumnoId: alumnoId(e.alumno),
        materiaId: materiaPorClave[e.materia].id,
        fecha: fechaADate(e.fecha),
        observaciones: e.observaciones,
        resultado: e.resultado,
        nota: e.nota === null ? null : e.nota.toFixed(2),
        notaCreatedById: notaPor,
        notaCreatedAt: e.notaCreatedAt,
        ...auditoria,
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      }
    }),
  })

  // Pagos, en orden de registro (los números de comprobante salen correlativos).
  const vigentes = pagos
    .filter((p) => p.items.length > 0)
    .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.minutos - y.minutos || x.idx - y.idx)
  const datosDePago = vigentes.map((p) => {
    const a = alumnos[p.alumno] as AlumnoModelo
    const importe = p.items.reduce((s, o) => s + precioOcurr(o), 0)
    const createdAt = instante(p.fecha, p.minutos)
    let montoRecibido: number | null = null
    if (p.forma === 'EFECTIVO') {
      const r = azar.decimal()
      montoRecibido =
        r < 0.45
          ? importe
          : r < 0.75
            ? Math.ceil(importe / 1000) * 1000
            : Math.ceil(importe / (importe > 30_000 ? 20_000 : 10_000)) *
              (importe > 30_000 ? 20_000 : 10_000)
    }
    const titular =
      a.tutor && azar.chance(0.9)
        ? `${a.tutor.nombre} ${a.tutor.apellido}`
        : `${a.nombre} ${a.apellido}`
    return {
      pago: p,
      createdAt,
      data: {
        alumnoId: alumnoId(p.alumno),
        formaPagoId: formaPorTipo.get(p.forma) as number,
        importeTotal: importe.toFixed(2),
        fechaPago: fechaADate(p.fecha),
        montoRecibido: montoRecibido === null ? null : montoRecibido.toFixed(2),
        observaciones: p.observaciones,
        transferenciaOperacion:
          p.forma === 'TRANSFERENCIA' ? azar.digitos(azar.entero(10, 12)) : null,
        transferenciaBanco:
          p.forma === 'TRANSFERENCIA' ? (azar.chance(0.85) ? a.banco : azar.de(BANCOS)) : null,
        transferenciaTitular: p.forma === 'TRANSFERENCIA' ? titular : null,
        debitoRed: p.forma === 'DEBITO' ? a.red : null,
        debitoCupon:
          p.forma === 'DEBITO'
            ? String(azar.entero(1, 99999)).padStart(azar.chance(0.5) ? 4 : 6, '0')
            : null,
        debitoUltimos4: p.forma === 'DEBITO' ? a.ultimos4 : null,
        estado: 'VIGENTE' as const,
        ...auditoria,
        createdAt,
        updatedAt: createdAt,
      },
    }
  })
  const pagosDb = (
    await prisma.pago.createManyAndReturn({
      data: datosDePago.map((d) => d.data),
      select: { id: true },
    })
  ).sort((x, y) => x.id - y.id)
  const pagoTurnos = datosDePago.flatMap((d, i) =>
    d.pago.items.map((o) => ({
      pagoId: (pagosDb[i] as { id: number }).id,
      turnoId: turnoId(o.fila),
      fechaOcurrencia: fechaADate(o.fecha),
      importeAplicado: precioOcurr(o).toFixed(2),
      porcentajeCentro: porcentajeEn(d.createdAt).toFixed(2),
      vigente: true,
    })),
  )
  for (let i = 0; i < pagoTurnos.length; i += 1000) {
    await prisma.pagoTurno.createMany({ data: pagoTurnos.slice(i, i + 1000) })
  }

  // --- Liquidaciones de M-6 a M-2: el cierre real (`cierreDeLiquidacion`), pagado a principios
  // del mes siguiente por el gerente. ---------------------------------------------------------
  for (const m of [-6, -5, -4, -3, -2]) {
    const mes = mesA(m)
    const diaBase = azar.entero(2, 7)
    for (let p = 0; p < PROFESORES.length; p++) {
      const cierre = await cierreDeLiquidacion(prisma, { profesorId: profId(p), mes, hoy: HOY })
      if (!cierre)
        throw new Error(
          `${(PROFESORES[p] as ProfesorDef).apellido} no tiene nada para liquidar en ${mes}.`,
        )
      if (cierre.escrituras.length !== 1 || cierre.escrituras.some((e) => e.ajustes.length > 0)) {
        throw new Error(`La liquidación de ${mes} tiene ajustes o saldos: no debería.`)
      }
      const escritura = cierre.escrituras[0] as (typeof cierre.escrituras)[number]
      let fecha = diaHabil(enMes(m + 1, diaBase + azar.entero(0, 2)))
      if (fecha === HOY || fecha <= ultimoDiaDelMes(mes)) fecha = diaHabil(enMes(m + 1, 3))
      const createdAt = instante(fecha, azar.entero(10 * 60, 13 * 60 + 30))
      const prof = PROFESORES[p] as ProfesorDef
      await prisma.liquidacion.create({
        data: {
          profesorId: profId(p),
          mes: fechaADate(`${mes}-01`),
          estado: 'PAGADA',
          totalCobrado: escritura.totalCobrado.toFixed(2),
          parteCentro: escritura.parteCentro.toFixed(2),
          parteProfesor: escritura.parteProfesor.toFixed(2),
          totalAjustes: escritura.totalAjustes.toFixed(2),
          total: escritura.total.toFixed(2),
          fechaTransferencia: fechaADate(fecha),
          numeroOperacion: azar.digitos(azar.entero(10, 12)),
          observaciones: azar.chance(0.3)
            ? `Transferencia a la cuenta del ${azar.de(['Banco Macro', 'Banco de la Nación Argentina', 'Banco Galicia'])} ${prof.genero === 'F' ? 'de la profesora' : 'del profesor'}`
            : null,
          createdById: gerente.id,
          createdAt,
          turnos: {
            createMany: {
              data: escritura.turnos.map((t) => ({
                pagoTurnoId: t.pagoTurnoId,
                fechaDevengo: fechaADate(t.fechaDevengo),
                importe: t.importe.toFixed(2),
                porcentajeCentro: t.porcentaje.toFixed(2),
                parteProfesor: t.parteProfesor.toFixed(2),
              })),
            },
          },
        },
      })
    }
  }

  // Catálogos del seed de desarrollo dados de alta hoy: se llevan al inicio de la historia (no se
  // tocan los datos de Martín Pérez ni de Lucía López).
  const inicioHistoria = instante(INICIO, 8 * 60 + 30)
  const desdeHoy = instante(HOY, 0)
  await prisma.materia.updateMany({
    where: { createdAt: { gte: desdeHoy } },
    data: { createdAt: inicioHistoria, updatedAt: inicioHistoria },
  })
  await prisma.formaPago.updateMany({
    where: { createdAt: { gte: desdeHoy } },
    data: { createdAt: inicioHistoria, updatedAt: inicioHistoria },
  })
  await prisma.usuario.updateMany({
    where: { createdAt: { gte: desdeHoy }, role: { in: ['MESA_ENTRADAS', 'GERENTE'] } },
    data: { createdAt: inicioHistoria, updatedAt: inicioHistoria },
  })

  const ocupacion = ocupaciones(m)
  return {
    ocupacionPorProfesor: PROFESORES.map((p, i) => `${p.apellido} ${ocupacion[i]} %`),
    profesores: PROFESORES.map((p, i) => ({ ...p, id: profId(i) })),
    alejoId: alumnoId(ALEJO),
    usuarioAlejo,
    materiaPorClave,
    diagnostico: {
      deudaInicial,
      cobradoInicial,
      alumnos: alumnos.length,
      turnos: filas.length,
      ocurrencias: ocurrencias.length,
      pagos: vigentes.length,
      examenes: examenes.length,
      deudores: new Set(ocurrencias.filter(adeudada).map((o) => o.fila.alumno)).size,
      canceladas: ocurrencias.filter((o) => o.cancelacion && o.fecha < HOY).length,
      pasadas: ocurrencias.filter((o) => o.fecha < HOY).length,
      presentes: ocurrencias.filter((o) => o.asistencia?.estado === 'PRESENTE').length,
      conAsistencia: ocurrencias.filter((o) => o.asistencia).length,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Verificación con las funciones reales de la app
// ---------------------------------------------------------------------------------------------

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function verificar(creado: Awaited<ReturnType<typeof crear>>) {
  const errores: string[] = []
  const exigir = (condicion: boolean, mensaje: string) => {
    if (!condicion) errores.push(mensaje)
  }
  const aguirre = creado.profesores[0] as (typeof creado.profesores)[number]

  // 1 y 2. Totales globales.
  const deuda = await totalAdeudado(prisma, { hoy: HOY })
  const cobrado = await totalCobradoEntre(prisma, { desde: PRIMERO_DEL_MES, hasta: HOY })
  exigir(
    deuda === DEUDA_OBJETIVO,
    `Total adeudado: ${pesos(deuda)} (se esperaba ${pesos(DEUDA_OBJETIVO)})`,
  )
  exigir(
    cobrado === COBRADO_OBJETIVO,
    `Cobrado del mes: ${pesos(cobrado)} (se esperaba ${pesos(COBRADO_OBJETIVO)})`,
  )

  // 3. Sin anulaciones, ajustes ni adjuntos.
  const [anulaciones, anulados, noVigentes, ajustes, adjuntos] = await Promise.all([
    prisma.anulacionPago.count(),
    prisma.pago.count({ where: { estado: 'ANULADO' } }),
    prisma.pagoTurno.count({ where: { OR: [{ vigente: null }, { vigente: false }] } }),
    prisma.ajusteLiquidacion.count(),
    prisma.comprobanteAdjunto.count(),
  ])
  exigir(
    anulaciones + anulados + noVigentes + ajustes + adjuntos === 0,
    `Hay anulaciones (${anulaciones}), pagos anulados (${anulados}), cobros no vigentes ` +
      `(${noVigentes}), ajustes (${ajustes}) o comprobantes adjuntos (${adjuntos})`,
  )

  // 4. Caja de hoy vacía (y nada registrado hoy).
  const desdeHoy = instante(HOY, 0)
  const [pagosHoy, liquidacionesHoy, asistenciasHoy, cancelacionesHoy, examenesHoy] =
    await Promise.all([
      prisma.pago.count({
        where: { OR: [{ fechaPago: fechaADate(HOY) }, { createdAt: { gte: desdeHoy } }] },
      }),
      prisma.liquidacion.count({
        where: { OR: [{ fechaTransferencia: fechaADate(HOY) }, { createdAt: { gte: desdeHoy } }] },
      }),
      prisma.asistenciaTurno.count({ where: { createdAt: { gte: desdeHoy } } }),
      prisma.cancelacionTurno.count({ where: { createdAt: { gte: desdeHoy } } }),
      prisma.examen.count({
        where: { OR: [{ createdAt: { gte: desdeHoy } }, { fecha: fechaADate(HOY) }] },
      }),
    ])
  exigir(pagosHoy === 0, `Hay ${pagosHoy} pagos de hoy`)
  exigir(
    liquidacionesHoy === 0,
    `Hay ${liquidacionesHoy} liquidaciones transferidas o registradas hoy`,
  )
  exigir(
    asistenciasHoy + cancelacionesHoy + examenesHoy === 0,
    `Hay registros de hoy: ${asistenciasHoy} asistencias, ${cancelacionesHoy} cancelaciones, ${examenesHoy} exámenes`,
  )

  // 5. Hoy de Aguirre: 4 horas (8, 9, 10 y 11), 3 alumnos en cada una, Alejo en la de las 10.
  const deHoy = (
    await leerOcurrencias(prisma, { desde: HOY, hasta: HOY, profesorId: aguirre.id })
  ).filter((o) => o.estado !== 'CANCELADO')
  const porHora = new Map<number, typeof deHoy>()
  for (const o of deHoy) porHora.set(o.horaInicio, [...(porHora.get(o.horaInicio) ?? []), o])
  const horas = [...porHora.keys()].sort((a, b) => a - b)
  exigir(
    horas.join(',') === '480,540,600,660' && [...porHora.values()].every((l) => l.length === 3),
    `Hoy de Aguirre: horas ${horas.map(minutosAHora).join(', ')} con ${[...porHora.values()].map((l) => l.length).join(', ')} alumnos`,
  )
  exigir(
    (porHora.get(600) ?? []).some((o) => o.alumnoId === creado.alejoId),
    'Alejo no está en la hora de las 10 de Aguirre',
  )
  exigir(
    deHoy.every((o) => o.asistencia === null),
    'Hay asistencias registradas hoy en Aguirre',
  )
  exigir(
    new Set(deHoy.map((o) => o.alumnoId)).size === deHoy.length,
    'Un alumno está en dos horas de hoy',
  )

  // 6. Alejo: adeudadas y próximas en las dos materias.
  for (const clave of ['MAT', 'FIS'] as const) {
    const filtro = {
      alumnoId: creado.alejoId,
      materiaIds: [creado.materiaPorClave[clave].id],
      hoy: HOY,
    }
    const [adeudadas, proximas] = await Promise.all([
      leerAdeudados(prisma, filtro),
      leerProximos(prisma, filtro),
    ])
    exigir(
      adeudadas.length > 0 && proximas.length > 0,
      `Alejo en ${NOMBRE_MATERIA[clave]}: ${adeudadas.length} adeudadas y ${proximas.length} próximas`,
    )
    if (clave === 'MAT')
      exigir(adeudadas.length >= 5, `Alejo debe sólo ${adeudadas.length} clases de Matemática`)
  }

  // 7. Ayer de Aguirre: al menos 3 clases cobradas sin asistencia (pago anterior a ayer).
  const deAyer = await leerOcurrencias(prisma, { desde: AYER, hasta: AYER, profesorId: aguirre.id })
  const cobradasSinAsistencia = deAyer.filter(
    (o) => o.estado !== 'CANCELADO' && o.pago.estado === 'PAGADO' && o.asistencia === null,
  )
  const pagosDeAyer = await prisma.pago.findMany({
    where: { id: { in: cobradasSinAsistencia.map((o) => o.pago.pagoId as number) } },
    select: { fechaPago: true },
  })
  exigir(
    cobradasSinAsistencia.length >= 3 && pagosDeAyer.every((p) => dateAFecha(p.fechaPago) < AYER),
    `Ayer de Aguirre: ${cobradasSinAsistencia.length} clases cobradas por adelantado sin asistencia`,
  )
  exigir(
    deAyer.every((o) => o.asistencia === null),
    'Aguirre registró asistencias de ayer',
  )

  // 8. Liquidaciones: M-6 a M-2 pagadas; M-1 pendiente, sin ajustes y en rango; M de Aguirre.
  const septiembre: { apellido: string; nombre: string; total: number }[] = []
  for (const prof of creado.profesores) {
    const pagadas = await prisma.liquidacion.count({
      where: {
        profesorId: prof.id,
        estado: 'PAGADA',
        mes: { gte: fechaADate(`${mesA(-6)}-01`), lte: fechaADate(`${mesA(-2)}-01`) },
      },
    })
    exigir(
      pagadas === 5,
      `${prof.apellido}: ${pagadas} liquidaciones pagadas de M-6 a M-2 (se esperaban 5)`,
    )
    const m1 = await liquidacionDe(prisma, { profesorId: prof.id, mes: mesA(-1), hoy: HOY })
    exigir(
      m1 !== null &&
        m1.estado === 'PENDIENTE_DE_PAGO' &&
        m1.totalAjustes === 0 &&
        m1.total >= RANGO_LIQUIDACION_M1.min &&
        m1.total <= RANGO_LIQUIDACION_M1.max,
      `${prof.apellido}: liquidación de ${mesA(-1)} ${m1?.estado ?? 'inexistente'} por ${pesos(m1?.total ?? 0)}`,
    )
    septiembre.push({ apellido: prof.apellido, nombre: prof.nombre, total: m1?.total ?? 0 })
  }
  const esteMes = await liquidacionDe(prisma, { profesorId: aguirre.id, mes: MES_ACTUAL, hoy: HOY })
  exigir(
    esteMes !== null &&
      esteMes.total >= RANGO_ESTE_MES_AGUIRRE.min &&
      esteMes.total <= RANGO_ESTE_MES_AGUIRRE.max,
    `"Este mes" de Aguirre: ${pesos(esteMes?.total ?? 0)}`,
  )
  const aguirreM1 = septiembre[0] as (typeof septiembre)[number]
  exigir(
    septiembre.filter((s) => s.total > aguirreM1.total).length <= 2,
    'Aguirre no está entre las liquidaciones más altas de M-1',
  )

  // 9. Ningún texto con palabras prohibidas.
  const textos = [
    ...(await prisma.usuario.findMany({
      select: { nombre: true, apellido: true, email: true, telefono: true, username: true },
    })),
    ...(await prisma.alumno.findMany()),
    ...(await prisma.profesor.findMany({ select: { titulo: true, matricula: true } })),
    ...(await prisma.materia.findMany({ select: { nombre: true, descripcion: true } })),
    ...(await prisma.turno.findMany({ select: { observaciones: true, temas: true } })),
    ...(await prisma.asistenciaTurno.findMany({
      select: { trabajado: true, indicaciones: true, observacion: true },
    })),
    ...(await prisma.examen.findMany({ select: { observaciones: true } })),
    ...(await prisma.pago.findMany({
      select: {
        observaciones: true,
        transferenciaOperacion: true,
        transferenciaBanco: true,
        transferenciaTitular: true,
        debitoCupon: true,
      },
    })),
    ...(await prisma.cancelacionTurno.findMany({ select: { detalle: true } })),
    ...(await prisma.finalizacionRecurrencia.findMany({ select: { detalle: true } })),
    ...(await prisma.liquidacion.findMany({
      select: { numeroOperacion: true, observaciones: true },
    })),
    ...(await prisma.aula.findMany({ select: { nombre: true } })),
    ...(await prisma.formaPago.findMany({ select: { nombre: true } })),
    ...(await prisma.rol.findMany({ select: { nombre: true, descripcion: true } })),
  ].flatMap((fila) => Object.values(fila).filter((v): v is string => typeof v === 'string'))
  const prohibidos = textos.filter((t) => PALABRAS_PROHIBIDAS.test(t))
  exigir(
    prohibidos.length === 0,
    `Textos con palabras prohibidas: ${prohibidos.slice(0, 5).join(' | ')}`,
  )

  return { errores, deuda, cobrado, septiembre, esteMes: esteMes?.total ?? 0 }
}

// ---------------------------------------------------------------------------------------------

async function main() {
  await chequearBaseLimpia()
  await limpiar()
  if (process.argv.includes('--limpiar')) return

  const creado = await crear()
  const verificado = await verificar(creado)
  const d = creado.diagnostico

  console.log(`\nSprint Review 3 listo (hoy = ${HOY}, historia desde ${INICIO}).`)
  console.log(
    `  ${creado.profesores.length} profesores, ${d.alumnos} alumnos, ${d.turnos} turnos ` +
      `(${d.ocurrencias} ocurrencias hasta ${HORIZONTE}), ${d.pagos} pagos y ${d.examenes} exámenes.`,
  )
  console.log(
    `  Presentes: ${((100 * d.presentes) / d.conAsistencia).toFixed(1)} %; canceladas: ` +
      `${((100 * d.canceladas) / d.pasadas).toFixed(1)} % de las pasadas; ${d.deudores} alumnos con deuda.`,
  )
  console.log(`  Ocupación (últimos 60 días): ${creado.ocupacionPorProfesor.join(', ')}.`)
  console.log('\nCredenciales:')
  console.log(`  Aguirre: beatriz.aguirre@gmail.com / ${PASSWORD_PROFESORES}`)
  console.log(
    `  Alejo (portal): usuario "${creado.usuarioAlejo}", contraseña inicial = su DNI (49318274)`,
  )
  console.log(`  El resto de los profesores: su email / ${PASSWORD_PROFESORES}`)
  console.log('\nVerificado con las funciones de la app:')
  console.log(`  Total adeudado: ${pesos(verificado.deuda)}`)
  console.log(`  Cobrado de ${MES_ACTUAL} hasta ayer: ${pesos(verificado.cobrado)}`)
  console.log(`  "Este mes" de Aguirre: ${pesos(verificado.esteMes)}`)
  console.log('\nCobrado por mes (evolución del tablero):')
  for (const m of [-5, -4, -3, -2, -1, 0]) {
    const desde = enMes(m, 1)
    const hasta = m === 0 ? HOY : ultimoDiaDelMes(mesA(m))
    console.log(`  ${mesA(m)}: ${pesos(await totalCobradoEntre(prisma, { desde, hasta }))}`)
  }
  console.log(`\nLiquidación de ${mesA(-1)} (pendiente de pago), por profesor:`)
  for (const s of [...verificado.septiembre].sort((a, b) => b.total - a.total)) {
    console.log(`  ${`${s.apellido}, ${s.nombre}`.padEnd(22)} ${pesos(s.total)}`)
  }
  if (verificado.errores.length > 0) {
    throw new Error(`\nLa verificación falló:\n  - ${verificado.errores.join('\n  - ')}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
