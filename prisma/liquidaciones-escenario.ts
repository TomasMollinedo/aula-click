// Escenario del seed de liquidaciones (`seed-liquidaciones.ts`): profesores, alumnos, clases,
// cobros y pagos a profesores, con todas las fechas relativas a "hoy" para que el seed siga siendo
// realista cuando se corra en otro mes. Sin Prisma ni `hoy()`: recibe el día y la hora de ahora, así
// se puede probar sin base. También simula, en orden cronológico, los pagos a profesores con el
// motor real (`liquidaciones.reglas.ts`), para que lo que el seed guarda como liquidación cerrada
// sea exactamente lo que el sistema habría guardado.
//
// Qué deja en cada estado (con hoy = octubre; las fechas se mueven con el mes):
//   Sofía Benítez   (Matemática y Física) julio y agosto PAGADA · septiembre PENDIENTE_DE_PAGO ·
//                   octubre EN_CURSO, con un turno cobrado sin asistencia, uno agendado y pagado,
//                   otro cerrado sin registrar y otro adeudado.
//   Gustavo Herrera (Química)             julio, agosto y septiembre PAGADA · octubre EN_CURSO. Una
//                   clase de fin de agosto se registra en septiembre y se devenga ahí.
//   Carolina Ledesma (Lengua e Inglés)    julio y agosto PAGADA · se anula un pago de julio:
//                   septiembre queda SALDO_A_DESCONTAR y octubre EN_CURSO arrastra ese saldo.
//   Ricardo Vázquez (Contabilidad)        julio PAGADA · se anula un pago de julio · agosto queda
//                   DESCONTADA dentro de septiembre PAGADA · octubre EN_CURSO.
//   Federico Aguirre (Inglés)             sólo octubre: un pago anulado y vuelto a cobrar, una clase
//                   adeudada y una cobrada de la que todavía no hay asistencia.
//   Y ocho profesores más (Quiroga, Salvatierra, Fernández, Villalba, Maidana, Ibarra, Zerpa y
//   Cabana) con otras combinaciones: meses viejos sin pagar, todo al día, un ajuste por anulación
//   dentro de una liquidación a pagar, un saldo a descontar y profesores recién empezados.
import {
  armarCierre,
  armarLiquidaciones,
  fechaDevengo as calcularFechaDevengo,
  type AnulacionPendiente,
  type CierreDeLiquidacion,
  type Devengado,
  type Liquidacion,
  type MesCerrado,
} from '@/server/features/liquidaciones/liquidaciones.reglas'
import { repartoDeTurno } from '@/server/features/reparto/reparto.reglas'
import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { mesAnterior, mesDe, mesSiguiente, ultimoDiaDelMes } from '@/server/shared/zod'

// ---------- Datos ----------

export type FormaDePago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'
export type MotivoDeAnulacion = 'ERROR_CARGA' | 'FORMA_PAGO_EQUIVOCADA' | 'OTRO'
export type MateriaNombre =
  'Matemática' | 'Física' | 'Química' | 'Lengua' | 'Inglés' | 'Contabilidad'

/** Un día: del mes que está `mes` meses de hoy (0 = el actual) o relativo a hoy. */
export type FechaSpec = { mes: number; dia: number } | { hoyMas: number } | { hoyMenos: number }

const f = (mes: number, dia: number): FechaSpec => ({ mes, dia })
const hoyMenos = (dias: number): FechaSpec => ({ hoyMenos: dias })
const hoyMas = (dias: number): FechaSpec => ({ hoyMas: dias })

export type ProfesorSeed = {
  clave: string
  nombre: string
  apellido: string
  dni: string
  email: string
  telefono: string
  titulo: string
  matricula: string
  capacidad: number
  materias: readonly MateriaNombre[]
  aula: string
}

export const PROFESORES = [
  {
    clave: 'sofia',
    nombre: 'Sofía',
    apellido: 'Benítez',
    dni: '27845112',
    email: 'sofia.benitez@aulaclick.local',
    telefono: '(387) 15-440-2891',
    titulo: 'Profesora en Matemática y Física',
    matricula: 'MP-1021',
    capacidad: 4,
    materias: ['Matemática', 'Física'],
    aula: 'Aula 1',
  },
  {
    clave: 'gustavo',
    nombre: 'Gustavo',
    apellido: 'Herrera',
    dni: '24901376',
    email: 'gustavo.herrera@aulaclick.local',
    telefono: '(387) 15-512-7340',
    titulo: 'Licenciado en Química',
    matricula: 'MP-1022',
    capacidad: 5,
    materias: ['Química'],
    aula: 'Aula 2',
  },
  {
    clave: 'carolina',
    nombre: 'Carolina',
    apellido: 'Ledesma',
    dni: '29377405',
    email: 'carolina.ledesma@aulaclick.local',
    telefono: '(387) 15-601-9824',
    titulo: 'Profesora en Letras',
    matricula: 'MP-1023',
    capacidad: 4,
    materias: ['Lengua', 'Inglés'],
    aula: 'Aula 3',
  },
  {
    clave: 'ricardo',
    nombre: 'Ricardo',
    apellido: 'Vázquez',
    dni: '22658391',
    email: 'ricardo.vazquez@aulaclick.local',
    telefono: '(387) 15-478-3156',
    titulo: 'Contador Público Nacional',
    matricula: 'MP-1024',
    capacidad: 6,
    materias: ['Contabilidad'],
    aula: 'Aula 4',
  },
  {
    clave: 'federico',
    nombre: 'Federico',
    apellido: 'Aguirre',
    dni: '31220987',
    email: 'federico.aguirre@aulaclick.local',
    telefono: '(387) 15-533-6071',
    titulo: 'Traductor Público de Inglés',
    matricula: 'MP-1025',
    capacidad: 4,
    materias: ['Inglés'],
    aula: 'Aula 5',
  },
  {
    clave: 'patricia',
    nombre: 'Patricia',
    apellido: 'Quiroga',
    dni: '26413578',
    email: 'patricia.quiroga@aulaclick.local',
    telefono: '(387) 15-455-1029',
    titulo: 'Profesora en Matemática',
    matricula: 'MP-1026',
    capacidad: 5,
    materias: ['Matemática'],
    aula: 'Aula 6',
  },
  {
    clave: 'diego',
    nombre: 'Diego',
    apellido: 'Salvatierra',
    dni: '28159364',
    email: 'diego.salvatierra@aulaclick.local',
    telefono: '(387) 15-618-7742',
    titulo: 'Licenciado en Física',
    matricula: 'MP-1027',
    capacidad: 4,
    materias: ['Física', 'Matemática'],
    aula: 'Aula 7',
  },
  {
    clave: 'marcela',
    nombre: 'Marcela',
    apellido: 'Fernández',
    dni: '25987413',
    email: 'marcela.fernandez@aulaclick.local',
    telefono: '(387) 15-502-3385',
    titulo: 'Profesora de Lengua y Literatura',
    matricula: 'MP-1028',
    capacidad: 5,
    materias: ['Lengua'],
    aula: 'Aula 8',
  },
  {
    clave: 'hernan',
    nombre: 'Hernán',
    apellido: 'Villalba',
    dni: '30542187',
    email: 'hernan.villalba@aulaclick.local',
    telefono: '(387) 15-569-4418',
    titulo: 'Ingeniero Químico',
    matricula: 'MP-1029',
    capacidad: 4,
    materias: ['Química', 'Física'],
    aula: 'Aula 9',
  },
  {
    clave: 'lucia',
    nombre: 'Lucía',
    apellido: 'Maidana',
    dni: '32671049',
    email: 'lucia.maidana@aulaclick.local',
    telefono: '(387) 15-640-2097',
    titulo: 'Profesora de Inglés',
    matricula: 'MP-1030',
    capacidad: 6,
    materias: ['Inglés'],
    aula: 'Aula 2',
  },
  {
    clave: 'sebastian',
    nombre: 'Sebastián',
    apellido: 'Ibarra',
    dni: '27306825',
    email: 'sebastian.ibarra@aulaclick.local',
    telefono: '(387) 15-481-6650',
    titulo: 'Contador Público Nacional',
    matricula: 'MP-1031',
    capacidad: 5,
    materias: ['Contabilidad', 'Matemática'],
    aula: 'Aula 4',
  },
  {
    clave: 'romina',
    nombre: 'Romina',
    apellido: 'Zerpa',
    dni: '33018472',
    email: 'romina.zerpa@aulaclick.local',
    telefono: '(387) 15-527-9134',
    titulo: 'Profesora de Matemática y Química',
    matricula: 'MP-1032',
    capacidad: 4,
    materias: ['Matemática', 'Química'],
    aula: 'Aula 3',
  },
  {
    clave: 'walter',
    nombre: 'Walter',
    apellido: 'Cabana',
    dni: '29754106',
    email: 'walter.cabana@aulaclick.local',
    telefono: '(387) 15-596-8821',
    titulo: 'Profesor de Física y Química',
    matricula: 'MP-1033',
    capacidad: 5,
    materias: ['Física', 'Química'],
    aula: 'Aula 5',
  },
] as const satisfies readonly ProfesorSeed[]

export type ProfesorClave = (typeof PROFESORES)[number]['clave']

export type AlumnoSeed = {
  clave: string
  nombre: string
  apellido: string
  dni: string
  fechaNacimiento: string
  telefono: string | null
  email: string | null
  nivelEscolaridad: 'PRIMARIO' | 'SECUNDARIO' | 'TERCIARIO' | 'UNIVERSITARIO'
  grado: string
  institucionEducativa: string
  /** Sólo en los menores. */
  tutor: { nombre: string; apellido: string; dni: string; telefono: string; email: string } | null
}

export const ALUMNOS = [
  {
    clave: 'valentina',
    nombre: 'Valentina',
    apellido: 'Aramayo',
    dni: '47118302',
    fechaNacimiento: '2008-05-12',
    telefono: '(387) 15-402-1175',
    email: 'valentina.aramayo@gmail.com',
    nivelEscolaridad: 'SECUNDARIO',
    grado: '6.º año',
    institucionEducativa: 'Colegio Nacional de Salta',
    tutor: null,
  },
  {
    clave: 'joaquin',
    nombre: 'Joaquín',
    apellido: 'Mamaní',
    dni: '47523910',
    fechaNacimiento: '2009-11-03',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '4.º año',
    institucionEducativa: 'Colegio Belgrano',
    tutor: {
      nombre: 'Rosa',
      apellido: 'Quispe',
      dni: '23785640',
      telefono: '(387) 15-566-2034',
      email: 'rosa.quispe@hotmail.com',
    },
  },
  {
    clave: 'camila',
    nombre: 'Camila',
    apellido: 'Torrico',
    dni: '46890217',
    fechaNacimiento: '2007-02-20',
    telefono: '(387) 15-633-4410',
    email: 'camila.torrico@gmail.com',
    nivelEscolaridad: 'UNIVERSITARIO',
    grado: '1.er año de Ingeniería Civil',
    institucionEducativa: 'Universidad Nacional de Salta',
    tutor: null,
  },
  {
    clave: 'tomas',
    nombre: 'Tomás',
    apellido: 'Villagra',
    dni: '48265431',
    fechaNacimiento: '2011-08-30',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '3.er año',
    institucionEducativa: 'Colegio del Huerto',
    tutor: {
      nombre: 'Julio',
      apellido: 'Villagra',
      dni: '26114897',
      telefono: '(387) 15-421-8802',
      email: 'julio.villagra@gmail.com',
    },
  },
  {
    clave: 'lautaro',
    nombre: 'Lautaro',
    apellido: 'Choque',
    dni: '47944188',
    fechaNacimiento: '2010-04-17',
    telefono: '(387) 15-590-7216',
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '4.º año',
    institucionEducativa: 'Escuela de Educación Técnica N.º 3115',
    tutor: {
      nombre: 'Elena',
      apellido: 'Choque',
      dni: '25903318',
      telefono: '(387) 15-488-5530',
      email: 'elena.choque@gmail.com',
    },
  },
  {
    clave: 'brenda',
    nombre: 'Brenda',
    apellido: 'Gutiérrez',
    dni: '45677093',
    fechaNacimiento: '2005-09-09',
    telefono: '(387) 15-617-9043',
    email: 'brenda.gutierrez@gmail.com',
    nivelEscolaridad: 'UNIVERSITARIO',
    grado: '3.er año de Contador Público',
    institucionEducativa: 'Universidad Católica de Salta',
    tutor: null,
  },
  {
    clave: 'mateo',
    nombre: 'Mateo',
    apellido: 'Sarmiento',
    dni: '48571226',
    fechaNacimiento: '2012-01-25',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '2.º año',
    institucionEducativa: 'Colegio Belgrano',
    tutor: {
      nombre: 'Claudia',
      apellido: 'Sarmiento',
      dni: '27650912',
      telefono: '(387) 15-455-7781',
      email: 'claudia.sarmiento@gmail.com',
    },
  },
  {
    clave: 'agustina',
    nombre: 'Agustina',
    apellido: 'Rivero',
    dni: '46233580',
    fechaNacimiento: '2008-12-04',
    telefono: '(387) 15-672-3308',
    email: 'agus.rivero@gmail.com',
    nivelEscolaridad: 'SECUNDARIO',
    grado: '5.º año',
    institucionEducativa: 'Colegio del Huerto',
    tutor: {
      nombre: 'Daniel',
      apellido: 'Rivero',
      dni: '24380165',
      telefono: '(387) 15-409-6627',
      email: 'daniel.rivero@yahoo.com.ar',
    },
  },
  {
    clave: 'nicolas',
    nombre: 'Nicolás',
    apellido: 'Cardozo',
    dni: '44818765',
    fechaNacimiento: '2004-06-28',
    telefono: '(387) 15-584-1269',
    email: 'nico.cardozo@gmail.com',
    nivelEscolaridad: 'TERCIARIO',
    grado: '2.º año de Tecnicatura en Programación',
    institucionEducativa: 'Instituto de Educación Superior N.º 6004',
    tutor: null,
  },
  {
    clave: 'milagros',
    nombre: 'Milagros',
    apellido: 'Ontiveros',
    dni: '48109347',
    fechaNacimiento: '2011-03-14',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '3.er año',
    institucionEducativa: 'Colegio Nacional de Salta',
    tutor: {
      nombre: 'Silvia',
      apellido: 'Ontiveros',
      dni: '28431750',
      telefono: '(387) 15-537-4192',
      email: 'silvia.ontiveros@gmail.com',
    },
  },
  {
    clave: 'facundo',
    nombre: 'Facundo',
    apellido: 'Alancay',
    dni: '46705512',
    fechaNacimiento: '2008-07-22',
    telefono: '(387) 15-649-8835',
    email: 'facu.alancay@gmail.com',
    nivelEscolaridad: 'SECUNDARIO',
    grado: '6.º año',
    institucionEducativa: 'Escuela de Educación Técnica N.º 3115',
    tutor: null,
  },
  {
    clave: 'julieta',
    nombre: 'Julieta',
    apellido: 'Barrionuevo',
    dni: '47390864',
    fechaNacimiento: '2009-02-08',
    telefono: '(387) 15-612-0457',
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '5.º año',
    institucionEducativa: 'Colegio Belgrano',
    tutor: {
      nombre: 'Pablo',
      apellido: 'Barrionuevo',
      dni: '26872304',
      telefono: '(387) 15-428-3916',
      email: 'pablo.barrionuevo@gmail.com',
    },
  },
  {
    clave: 'bruno',
    nombre: 'Bruno',
    apellido: 'Nieva',
    dni: '47856123',
    fechaNacimiento: '2009-06-19',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '4.º año',
    institucionEducativa: 'Colegio del Huerto',
    tutor: {
      nombre: 'Gladys',
      apellido: 'Nieva',
      dni: '24795031',
      telefono: '(387) 15-433-9076',
      email: 'gladys.nieva@gmail.com',
    },
  },
  {
    clave: 'zarate',
    nombre: 'Sofía',
    apellido: 'Zárate',
    dni: '46321877',
    fechaNacimiento: '2007-10-30',
    telefono: '(387) 15-611-5283',
    email: 'sofia.zarate@gmail.com',
    nivelEscolaridad: 'UNIVERSITARIO',
    grado: '1.er año de Nutrición',
    institucionEducativa: 'Universidad Nacional de Salta',
    tutor: null,
  },
  {
    clave: 'ezequiel',
    nombre: 'Ezequiel',
    apellido: 'Soria',
    dni: '48033915',
    fechaNacimiento: '2011-12-02',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '2.º año',
    institucionEducativa: 'Colegio Nacional de Salta',
    tutor: {
      nombre: 'Marcelo',
      apellido: 'Soria',
      dni: '27018644',
      telefono: '(387) 15-474-2250',
      email: 'marcelo.soria@gmail.com',
    },
  },
  {
    clave: 'antonella',
    nombre: 'Antonella',
    apellido: 'Burgos',
    dni: '46598240',
    fechaNacimiento: '2008-03-27',
    telefono: '(387) 15-655-3719',
    email: 'anto.burgos@gmail.com',
    nivelEscolaridad: 'SECUNDARIO',
    grado: '6.º año',
    institucionEducativa: 'Colegio Belgrano',
    tutor: null,
  },
  {
    clave: 'gonzalo',
    nombre: 'Gonzalo',
    apellido: 'Lamas',
    dni: '45912678',
    fechaNacimiento: '2006-01-14',
    telefono: '(387) 15-538-0942',
    email: 'gonzalo.lamas@gmail.com',
    nivelEscolaridad: 'UNIVERSITARIO',
    grado: '2.º año de Ingeniería Industrial',
    institucionEducativa: 'Universidad Católica de Salta',
    tutor: null,
  },
  {
    clave: 'ariana',
    nombre: 'Ariana',
    apellido: 'Colque',
    dni: '47677301',
    fechaNacimiento: '2010-09-05',
    telefono: null,
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '3.er año',
    institucionEducativa: 'Escuela de Educación Técnica N.º 3115',
    tutor: {
      nombre: 'Nora',
      apellido: 'Colque',
      dni: '26340915',
      telefono: '(387) 15-421-6603',
      email: 'nora.colque@hotmail.com',
    },
  },
  {
    clave: 'maximiliano',
    nombre: 'Maximiliano',
    apellido: 'Pastrana',
    dni: '47105839',
    fechaNacimiento: '2009-08-21',
    telefono: '(387) 15-572-4468',
    email: null,
    nivelEscolaridad: 'SECUNDARIO',
    grado: '5.º año',
    institucionEducativa: 'Colegio del Huerto',
    tutor: {
      nombre: 'Irma',
      apellido: 'Pastrana',
      dni: '25276480',
      telefono: '(387) 15-489-1127',
      email: 'irma.pastrana@gmail.com',
    },
  },
  {
    clave: 'luciana',
    nombre: 'Luciana',
    apellido: 'Fabián',
    dni: '46849562',
    fechaNacimiento: '2007-05-11',
    telefono: '(387) 15-624-7390',
    email: 'luciana.fabian@gmail.com',
    nivelEscolaridad: 'TERCIARIO',
    grado: '1.er año del Profesorado de Inglés',
    institucionEducativa: 'Instituto de Educación Superior N.º 6004',
    tutor: null,
  },
] as const satisfies readonly AlumnoSeed[]

export type AlumnoClave = (typeof ALUMNOS)[number]['clave']

type ClaseSeed = {
  profesor: ProfesorClave
  alumno: AlumnoClave
  materia: MateriaNombre
  /** `HH:mm`, en punto (una hora de bloque). */
  hora: string
  fecha: FechaSpec
  /** Sin valor: todavía no se registró. */
  asistencia?: 'PRESENTE' | 'AUSENTE'
  /** Cuándo se cargó la asistencia, si no fue el día de la clase. */
  registradaEl?: FechaSpec
  /** El cobro vigente de la clase. */
  cobro?: string
  /** Un cobro anulado que la clase tuvo antes. */
  cobroAnulado?: string
}

type CobroSeed = {
  clave: string
  alumno: AlumnoClave
  forma: FormaDePago
  fecha: FechaSpec
  anulacion?: { fecha: FechaSpec; motivo: MotivoDeAnulacion; detalle: string }
}

/** Una liquidación pagada por el gerente (`mes` es el desplazamiento respecto del mes actual). */
type PagoDeLiquidacionSeed = { profesor: ProfesorClave; mes: number; fecha: FechaSpec }

function clase(
  profesor: ProfesorClave,
  alumno: AlumnoClave,
  materia: MateriaNombre,
  hora: string,
  fecha: FechaSpec,
  extra: Partial<Pick<ClaseSeed, 'registradaEl' | 'cobro' | 'cobroAnulado'>> & {
    a?: 'P' | 'A'
  } = {},
): ClaseSeed {
  const { a, ...resto } = extra
  return {
    profesor,
    alumno,
    materia,
    hora,
    fecha,
    ...(a ? { asistencia: a === 'P' ? ('PRESENTE' as const) : ('AUSENTE' as const) } : {}),
    ...resto,
  }
}

const CLASES: readonly ClaseSeed[] = [
  // ---- Sofía Benítez: julio y agosto pagados, septiembre pendiente de pago, octubre en curso ----
  clase('sofia', 'valentina', 'Matemática', '15:00', f(-3, 7), { a: 'P', cobro: 's-j-val' }),
  clase('sofia', 'valentina', 'Matemática', '15:00', f(-3, 14), { a: 'P', cobro: 's-j-val' }),
  clase('sofia', 'joaquin', 'Matemática', '16:00', f(-3, 9), { a: 'P', cobro: 's-j-joa' }),
  clase('sofia', 'camila', 'Física', '17:00', f(-3, 16), { a: 'A', cobro: 's-j-cam' }),

  clase('sofia', 'valentina', 'Matemática', '15:00', f(-2, 4), { a: 'P', cobro: 's-a-val' }),
  clase('sofia', 'valentina', 'Matemática', '15:00', f(-2, 11), { a: 'P', cobro: 's-a-val' }),
  clase('sofia', 'tomas', 'Matemática', '16:00', f(-2, 12), { a: 'P', cobro: 's-a-tom' }),
  clase('sofia', 'camila', 'Física', '17:00', f(-2, 19), { a: 'P', cobro: 's-a-cam' }),
  clase('sofia', 'joaquin', 'Matemática', '16:00', f(-2, 21), { a: 'A', cobro: 's-a-joa' }),

  clase('sofia', 'valentina', 'Matemática', '15:00', f(-1, 3), { a: 'P', cobro: 's-s-val' }),
  clase('sofia', 'valentina', 'Matemática', '15:00', f(-1, 10), { a: 'P', cobro: 's-s-val' }),
  clase('sofia', 'valentina', 'Matemática', '15:00', f(-1, 17), { a: 'P', cobro: 's-s-val' }),
  clase('sofia', 'tomas', 'Matemática', '16:00', f(-1, 8), { a: 'P', cobro: 's-s-tom' }),
  clase('sofia', 'tomas', 'Matemática', '16:00', f(-1, 22), { a: 'A', cobro: 's-s-tom' }),
  clase('sofia', 'camila', 'Física', '17:00', f(-1, 15), { a: 'P', cobro: 's-s-cam' }),

  clase('sofia', 'valentina', 'Matemática', '15:00', f(0, 5), { a: 'P', cobro: 's-o-val' }),
  clase('sofia', 'valentina', 'Matemática', '15:00', f(0, 12), { a: 'P', cobro: 's-o-val' }),
  clase('sofia', 'tomas', 'Matemática', '16:00', f(0, 6), { a: 'P', cobro: 's-o-tom' }),
  clase('sofia', 'camila', 'Física', '17:00', f(0, 14), { a: 'P', cobro: 's-o-cam' }),
  // Cobrada, dada hace dos días y sin asistencia todavía: dentro del plazo, no se devenga.
  clase('sofia', 'joaquin', 'Matemática', '16:00', hoyMenos(2), { cobro: 's-o-joa' }),
  // Cobrada, dada hace doce días y sin asistencia: el plazo venció, el importe no se devenga.
  clase('sofia', 'lautaro', 'Matemática', '17:00', hoyMenos(12), { cobro: 's-o-lau' }),
  // Cobrada y agendada: todavía no se dio.
  clase('sofia', 'valentina', 'Matemática', '15:00', hoyMas(4), { cobro: 's-o-val2' }),
  // Dada y con asistencia, pero sin pagar: es deuda del alumno, no ingreso del profesor.
  clase('sofia', 'mateo', 'Física', '15:00', f(0, 9), { a: 'P' }),

  // ---- Gustavo Herrera: tres meses pagados al día, octubre en curso ----
  clase('gustavo', 'agustina', 'Química', '18:00', f(-3, 8), { a: 'P', cobro: 'g-j-agu' }),
  clase('gustavo', 'agustina', 'Química', '18:00', f(-3, 22), { a: 'P', cobro: 'g-j-agu' }),
  clase('gustavo', 'nicolas', 'Química', '10:00', f(-3, 10), { a: 'P', cobro: 'g-j-nic' }),

  clase('gustavo', 'agustina', 'Química', '18:00', f(-2, 12), { a: 'P', cobro: 'g-a-agu' }),
  clase('gustavo', 'nicolas', 'Química', '10:00', f(-2, 14), { a: 'P', cobro: 'g-a-nic' }),
  // Dada a fin de agosto y registrada en septiembre: se devenga en septiembre.
  clase('gustavo', 'milagros', 'Química', '11:00', f(-2, 28), {
    a: 'P',
    registradaEl: f(-1, 2),
    cobro: 'g-a-mil',
  }),

  clase('gustavo', 'agustina', 'Química', '18:00', f(-1, 9), { a: 'P', cobro: 'g-s-agu' }),
  clase('gustavo', 'agustina', 'Química', '18:00', f(-1, 23), { a: 'A', cobro: 'g-s-agu' }),
  clase('gustavo', 'nicolas', 'Química', '10:00', f(-1, 11), { a: 'P', cobro: 'g-s-nic' }),
  clase('gustavo', 'milagros', 'Química', '11:00', f(-1, 15), { a: 'P', cobro: 'g-s-mil' }),

  clase('gustavo', 'agustina', 'Química', '18:00', f(0, 6), { a: 'P', cobro: 'g-o-agu' }),
  clase('gustavo', 'agustina', 'Química', '18:00', f(0, 13), { a: 'P', cobro: 'g-o-agu' }),
  clase('gustavo', 'nicolas', 'Química', '10:00', f(0, 8), { a: 'P', cobro: 'g-o-nic' }),

  // ---- Carolina Ledesma: se anula un pago de julio, septiembre queda con saldo a descontar ----
  clase('carolina', 'brenda', 'Lengua', '14:00', f(-3, 6), { a: 'P', cobro: 'c-j-bre' }),
  clase('carolina', 'brenda', 'Lengua', '14:00', f(-3, 13), { a: 'P', cobro: 'c-j-bre' }),
  clase('carolina', 'julieta', 'Inglés', '19:00', f(-3, 16), { a: 'P', cobro: 'c-j-jul' }),

  clase('carolina', 'julieta', 'Inglés', '19:00', f(-2, 11), { a: 'P', cobro: 'c-a-jul' }),

  clase('carolina', 'facundo', 'Lengua', '14:00', f(-1, 16), { a: 'P', cobro: 'c-s-fac' }),

  clase('carolina', 'facundo', 'Lengua', '14:00', f(0, 7), { a: 'P', cobro: 'c-o-fac' }),
  clase('carolina', 'facundo', 'Lengua', '14:00', f(0, 14), { a: 'P', cobro: 'c-o-fac' }),
  clase('carolina', 'julieta', 'Inglés', '19:00', f(0, 8), { a: 'P', cobro: 'c-o-jul' }),
  clase('carolina', 'brenda', 'Lengua', '15:00', f(0, 13), { a: 'A', cobro: 'c-o-bre' }),

  // ---- Ricardo Vázquez: agosto descontado dentro de septiembre ----
  clase('ricardo', 'brenda', 'Contabilidad', '16:00', f(-3, 9), { a: 'P', cobro: 'r-j-bre' }),
  clase('ricardo', 'brenda', 'Contabilidad', '16:00', f(-3, 16), { a: 'P', cobro: 'r-j-bre' }),

  clase('ricardo', 'nicolas', 'Contabilidad', '16:00', f(-2, 12), { a: 'P', cobro: 'r-a-nic' }),

  clase('ricardo', 'nicolas', 'Contabilidad', '16:00', f(-1, 3), { a: 'P', cobro: 'r-s-nic' }),
  clase('ricardo', 'nicolas', 'Contabilidad', '16:00', f(-1, 17), { a: 'P', cobro: 'r-s-nic' }),
  clase('ricardo', 'brenda', 'Contabilidad', '16:00', f(-1, 10), { a: 'P', cobro: 'r-s-bre' }),

  clase('ricardo', 'nicolas', 'Contabilidad', '16:00', f(0, 8), { a: 'P', cobro: 'r-o-nic' }),
  clase('ricardo', 'nicolas', 'Contabilidad', '16:00', f(0, 15), { a: 'P', cobro: 'r-o-nic' }),

  // ---- Federico Aguirre: sólo octubre ----
  // Cobrada en efectivo por error, anulada y cobrada de nuevo por transferencia.
  clase('federico', 'agustina', 'Inglés', '17:00', f(0, 5), {
    a: 'P',
    cobroAnulado: 'f-o-agu1',
    cobro: 'f-o-agu2',
  }),
  clase('federico', 'milagros', 'Inglés', '18:00', f(0, 6), { a: 'P', cobro: 'f-o-mil' }),
  clase('federico', 'milagros', 'Inglés', '18:00', f(0, 13), { a: 'A', cobro: 'f-o-mil' }),
  clase('federico', 'mateo', 'Inglés', '17:00', f(0, 9), { a: 'P' }),
  clase('federico', 'julieta', 'Inglés', '17:00', hoyMas(2), { cobro: 'f-o-jul' }),
]

const COBROS: readonly CobroSeed[] = [
  { clave: 's-j-val', alumno: 'valentina', forma: 'EFECTIVO', fecha: f(-3, 15) },
  { clave: 's-j-joa', alumno: 'joaquin', forma: 'TRANSFERENCIA', fecha: f(-3, 13) },
  { clave: 's-j-cam', alumno: 'camila', forma: 'DEBITO', fecha: f(-3, 17) },
  { clave: 's-a-val', alumno: 'valentina', forma: 'EFECTIVO', fecha: f(-2, 12) },
  { clave: 's-a-tom', alumno: 'tomas', forma: 'TRANSFERENCIA', fecha: f(-2, 13) },
  { clave: 's-a-cam', alumno: 'camila', forma: 'DEBITO', fecha: f(-2, 20) },
  { clave: 's-a-joa', alumno: 'joaquin', forma: 'EFECTIVO', fecha: f(-2, 22) },
  { clave: 's-s-val', alumno: 'valentina', forma: 'EFECTIVO', fecha: f(-1, 18) },
  { clave: 's-s-tom', alumno: 'tomas', forma: 'TRANSFERENCIA', fecha: f(-1, 23) },
  { clave: 's-s-cam', alumno: 'camila', forma: 'DEBITO', fecha: f(-1, 16) },
  { clave: 's-o-val', alumno: 'valentina', forma: 'EFECTIVO', fecha: f(0, 13) },
  { clave: 's-o-tom', alumno: 'tomas', forma: 'TRANSFERENCIA', fecha: f(0, 7) },
  { clave: 's-o-cam', alumno: 'camila', forma: 'DEBITO', fecha: f(0, 14) },
  { clave: 's-o-joa', alumno: 'joaquin', forma: 'EFECTIVO', fecha: hoyMenos(1) },
  { clave: 's-o-lau', alumno: 'lautaro', forma: 'TRANSFERENCIA', fecha: hoyMenos(12) },
  { clave: 's-o-val2', alumno: 'valentina', forma: 'EFECTIVO', fecha: hoyMenos(1) },

  { clave: 'g-j-agu', alumno: 'agustina', forma: 'TRANSFERENCIA', fecha: f(-3, 23) },
  { clave: 'g-j-nic', alumno: 'nicolas', forma: 'EFECTIVO', fecha: f(-3, 10) },
  { clave: 'g-a-agu', alumno: 'agustina', forma: 'DEBITO', fecha: f(-2, 13) },
  { clave: 'g-a-nic', alumno: 'nicolas', forma: 'EFECTIVO', fecha: f(-2, 14) },
  { clave: 'g-a-mil', alumno: 'milagros', forma: 'TRANSFERENCIA', fecha: f(-2, 28) },
  { clave: 'g-s-agu', alumno: 'agustina', forma: 'EFECTIVO', fecha: f(-1, 24) },
  { clave: 'g-s-nic', alumno: 'nicolas', forma: 'TRANSFERENCIA', fecha: f(-1, 11) },
  { clave: 'g-s-mil', alumno: 'milagros', forma: 'DEBITO', fecha: f(-1, 16) },
  { clave: 'g-o-agu', alumno: 'agustina', forma: 'EFECTIVO', fecha: f(0, 14) },
  { clave: 'g-o-nic', alumno: 'nicolas', forma: 'TRANSFERENCIA', fecha: f(0, 8) },

  {
    clave: 'c-j-bre',
    alumno: 'brenda',
    forma: 'EFECTIVO',
    fecha: f(-3, 14),
    anulacion: {
      fecha: f(-1, 15),
      motivo: 'FORMA_PAGO_EQUIVOCADA',
      detalle: 'Se registró como efectivo pero abonó por transferencia.',
    },
  },
  { clave: 'c-j-jul', alumno: 'julieta', forma: 'TRANSFERENCIA', fecha: f(-3, 17) },
  { clave: 'c-a-jul', alumno: 'julieta', forma: 'TRANSFERENCIA', fecha: f(-2, 12) },
  { clave: 'c-s-fac', alumno: 'facundo', forma: 'DEBITO', fecha: f(-1, 17) },
  { clave: 'c-o-fac', alumno: 'facundo', forma: 'EFECTIVO', fecha: f(0, 14) },
  { clave: 'c-o-jul', alumno: 'julieta', forma: 'TRANSFERENCIA', fecha: f(0, 9) },
  { clave: 'c-o-bre', alumno: 'brenda', forma: 'DEBITO', fecha: f(0, 13) },

  {
    clave: 'r-j-bre',
    alumno: 'brenda',
    forma: 'TRANSFERENCIA',
    fecha: f(-3, 17),
    anulacion: {
      fecha: f(-2, 20),
      motivo: 'ERROR_CARGA',
      detalle: 'El pago se cargó a nombre de otra alumna.',
    },
  },
  { clave: 'r-a-nic', alumno: 'nicolas', forma: 'EFECTIVO', fecha: f(-2, 13) },
  { clave: 'r-s-nic', alumno: 'nicolas', forma: 'TRANSFERENCIA', fecha: f(-1, 18) },
  { clave: 'r-s-bre', alumno: 'brenda', forma: 'DEBITO', fecha: f(-1, 11) },
  { clave: 'r-o-nic', alumno: 'nicolas', forma: 'EFECTIVO', fecha: f(0, 15) },

  {
    clave: 'f-o-agu1',
    alumno: 'agustina',
    forma: 'EFECTIVO',
    fecha: f(0, 6),
    anulacion: {
      fecha: f(0, 7),
      motivo: 'FORMA_PAGO_EQUIVOCADA',
      detalle: 'La familia pagó por transferencia, no en efectivo.',
    },
  },
  { clave: 'f-o-agu2', alumno: 'agustina', forma: 'TRANSFERENCIA', fecha: f(0, 7) },
  { clave: 'f-o-mil', alumno: 'milagros', forma: 'DEBITO', fecha: f(0, 6) },
  { clave: 'f-o-jul', alumno: 'julieta', forma: 'EFECTIVO', fecha: hoyMenos(1) },
]

const PAGOS_DE_LIQUIDACION: readonly PagoDeLiquidacionSeed[] = [
  { profesor: 'sofia', mes: -3, fecha: f(-2, 6) },
  { profesor: 'sofia', mes: -2, fecha: f(-1, 4) },
  { profesor: 'gustavo', mes: -3, fecha: f(-2, 5) },
  { profesor: 'gustavo', mes: -2, fecha: f(-1, 8) },
  { profesor: 'gustavo', mes: -1, fecha: f(0, 6) },
  { profesor: 'carolina', mes: -3, fecha: f(-2, 7) },
  { profesor: 'carolina', mes: -2, fecha: f(-1, 8) },
  { profesor: 'ricardo', mes: -3, fecha: f(-2, 6) },
  // Paga septiembre y, con él, el saldo negativo de agosto (queda DESCONTADA).
  { profesor: 'ricardo', mes: -1, fecha: f(0, 6) },
]

// ---- Más profesores, para que las listas de liquidaciones tengan de dónde mostrar ----

type Dia = number | readonly [dia: number, asistencia: 'P' | 'A']

/** Las clases de un alumno con un profesor en un mes, a la misma hora y con el mismo cobro. */
function mes(
  profesor: ProfesorClave,
  alumno: AlumnoClave,
  materia: MateriaNombre,
  hora: string,
  mesRelativo: number,
  cobro: string,
  dias: readonly Dia[],
): ClaseSeed[] {
  return dias.map((valor) => {
    const [dia, asistencia] = typeof valor === 'number' ? [valor, 'P' as const] : valor
    return clase(profesor, alumno, materia, hora, f(mesRelativo, dia), { a: asistencia, cobro })
  })
}

const cobro = (
  clave: string,
  alumno: AlumnoClave,
  forma: FormaDePago,
  fecha: FechaSpec,
  anulacion?: CobroSeed['anulacion'],
): CobroSeed => ({ clave, alumno, forma, fecha, ...(anulacion ? { anulacion } : {}) })

const CLASES_ADICIONALES: readonly ClaseSeed[] = [
  // ---- Patricia Quiroga: sólo julio pagado; agosto y septiembre se le deben ----
  ...mes('patricia', 'bruno', 'Matemática', '08:00', -3, 'p-j-bru', [7, 14, 21]),
  ...mes('patricia', 'ariana', 'Matemática', '09:00', -3, 'p-j-ari', [8, 22]),
  ...mes('patricia', 'bruno', 'Matemática', '08:00', -2, 'p-a-bru', [4, 11, 18]),
  ...mes('patricia', 'ariana', 'Matemática', '09:00', -2, 'p-a-ari', [12, 26]),
  ...mes('patricia', 'bruno', 'Matemática', '08:00', -1, 'p-s-bru', [8, 15, 22]),
  ...mes('patricia', 'ariana', 'Matemática', '09:00', -1, 'p-s-ari', [9, [23, 'A']]),
  ...mes('patricia', 'bruno', 'Matemática', '08:00', 0, 'p-o-bru', [6, 13]),
  ...mes('patricia', 'ariana', 'Matemática', '09:00', 0, 'p-o-ari', [7, 14]),

  // ---- Diego Salvatierra: al día, con todos los meses cerrados ----
  ...mes('diego', 'gonzalo', 'Física', '12:00', -3, 'd-j-gon', [6, 13, 20]),
  ...mes('diego', 'luciana', 'Matemática', '13:00', -3, 'd-j-luc', [9, 23]),
  ...mes('diego', 'gonzalo', 'Física', '12:00', -2, 'd-a-gon', [5, 12, 19]),
  ...mes('diego', 'luciana', 'Matemática', '13:00', -2, 'd-a-luc', [10, 24]),
  ...mes('diego', 'gonzalo', 'Física', '12:00', -1, 'd-s-gon', [7, 14, 21]),
  ...mes('diego', 'luciana', 'Matemática', '13:00', -1, 'd-s-luc', [8, [22, 'A']]),
  ...mes('diego', 'gonzalo', 'Física', '12:00', 0, 'd-o-gon', [5, 12]),
  ...mes('diego', 'luciana', 'Matemática', '13:00', 0, 'd-o-luc', [6, 13]),

  // ---- Marcela Fernández: empezó en septiembre, todavía sin pagar ----
  ...mes('marcela', 'antonella', 'Lengua', '17:00', -1, 'm-s-ant', [9, 16, 23]),
  ...mes('marcela', 'ezequiel', 'Lengua', '18:00', -1, 'm-s-eze', [10, 24]),
  ...mes('marcela', 'antonella', 'Lengua', '17:00', 0, 'm-o-ant', [7, 14]),
  ...mes('marcela', 'ezequiel', 'Lengua', '18:00', 0, 'm-o-eze', [8, 15]),

  // ---- Hernán Villalba: se anula un pago de agosto y septiembre lo descuenta ----
  ...mes('hernan', 'maximiliano', 'Química', '14:00', -2, 'h-a-max', [11, 18, 25]),
  ...mes('hernan', 'ariana', 'Física', '15:00', -2, 'h-a-ari', [12, 26]),
  ...mes('hernan', 'maximiliano', 'Química', '14:00', -1, 'h-s-max', [8, 15, 22]),
  ...mes('hernan', 'ariana', 'Física', '15:00', -1, 'h-s-ari', [9, 23]),
  ...mes('hernan', 'maximiliano', 'Química', '14:00', 0, 'h-o-max', [6, 13]),
  ...mes('hernan', 'ariana', 'Física', '15:00', 0, 'h-o-ari', [7, [14, 'A']]),

  // ---- Lucía Maidana: septiembre sin pagar y octubre con clases sin asistencia ----
  ...mes('lucia', 'luciana', 'Inglés', '08:00', -1, 'l-s-luc', [9, 16, 23]),
  ...mes('lucia', 'maximiliano', 'Inglés', '09:00', -1, 'l-s-max', [10, 24]),
  ...mes('lucia', 'luciana', 'Inglés', '08:00', 0, 'l-o-luc', [7, 14]),
  clase('lucia', 'maximiliano', 'Inglés', '09:00', f(0, 8), { a: 'P', cobro: 'l-o-max' }),
  // Cerrada sin registrar y agendada, las dos cobradas.
  clase('lucia', 'maximiliano', 'Inglés', '09:00', hoyMenos(12), { cobro: 'l-o-max' }),
  clase('lucia', 'maximiliano', 'Inglés', '09:00', hoyMas(3), { cobro: 'l-o-max' }),

  // ---- Sebastián Ibarra: julio y agosto pagados, septiembre pendiente ----
  ...mes('sebastian', 'gonzalo', 'Contabilidad', '09:00', -3, 'e-j-gon', [8, 15, 22]),
  ...mes('sebastian', 'antonella', 'Matemática', '10:00', -3, 'e-j-ant', [9, 23]),
  ...mes('sebastian', 'gonzalo', 'Contabilidad', '09:00', -2, 'e-a-gon', [5, 12, 19]),
  ...mes('sebastian', 'antonella', 'Matemática', '10:00', -2, 'e-a-ant', [10, 24]),
  ...mes('sebastian', 'gonzalo', 'Contabilidad', '09:00', -1, 'e-s-gon', [9, 16, 23]),
  ...mes('sebastian', 'antonella', 'Matemática', '10:00', -1, 'e-s-ant', [10, 24]),
  ...mes('sebastian', 'gonzalo', 'Contabilidad', '09:00', 0, 'e-o-gon', [7, 14]),
  ...mes('sebastian', 'antonella', 'Matemática', '10:00', 0, 'e-o-ant', [8, 15]),

  // ---- Romina Zerpa: sólo octubre, con una clase dada y sin pagar ----
  ...mes('romina', 'ezequiel', 'Matemática', '10:00', 0, 'z-o-eze', [6, 13]),
  ...mes('romina', 'zarate', 'Química', '11:00', 0, 'z-o-zar', [7, [14, 'A']]),
  clase('romina', 'ezequiel', 'Matemática', '10:00', f(0, 9), { a: 'P' }),

  // ---- Walter Cabana: se anula el pago de agosto y septiembre queda con saldo a descontar ----
  ...mes('walter', 'zarate', 'Física', '14:00', -2, 'w-a-zar', [11, 18, 25]),
  ...mes('walter', 'bruno', 'Química', '15:00', -2, 'w-a-bru', [12, 26]),
  ...mes('walter', 'zarate', 'Física', '14:00', -1, 'w-s-zar', [9]),
  ...mes('walter', 'zarate', 'Física', '14:00', 0, 'w-o-zar', [7, 14]),
  ...mes('walter', 'bruno', 'Química', '15:00', 0, 'w-o-bru', [8, 15]),
]

const COBROS_ADICIONALES: readonly CobroSeed[] = [
  cobro('p-j-bru', 'bruno', 'TRANSFERENCIA', f(-3, 22)),
  cobro('p-j-ari', 'ariana', 'EFECTIVO', f(-3, 23)),
  cobro('p-a-bru', 'bruno', 'TRANSFERENCIA', f(-2, 19)),
  cobro('p-a-ari', 'ariana', 'DEBITO', f(-2, 27)),
  cobro('p-s-bru', 'bruno', 'EFECTIVO', f(-1, 23)),
  cobro('p-s-ari', 'ariana', 'TRANSFERENCIA', f(-1, 24)),
  cobro('p-o-bru', 'bruno', 'EFECTIVO', f(0, 14)),
  cobro('p-o-ari', 'ariana', 'DEBITO', f(0, 15)),

  cobro('d-j-gon', 'gonzalo', 'EFECTIVO', f(-3, 21)),
  cobro('d-j-luc', 'luciana', 'TRANSFERENCIA', f(-3, 24)),
  cobro('d-a-gon', 'gonzalo', 'DEBITO', f(-2, 20)),
  cobro('d-a-luc', 'luciana', 'EFECTIVO', f(-2, 25)),
  cobro('d-s-gon', 'gonzalo', 'TRANSFERENCIA', f(-1, 22)),
  cobro('d-s-luc', 'luciana', 'DEBITO', f(-1, 23)),
  cobro('d-o-gon', 'gonzalo', 'EFECTIVO', f(0, 13)),
  cobro('d-o-luc', 'luciana', 'TRANSFERENCIA', f(0, 14)),

  cobro('m-s-ant', 'antonella', 'TRANSFERENCIA', f(-1, 24)),
  cobro('m-s-eze', 'ezequiel', 'EFECTIVO', f(-1, 25)),
  cobro('m-o-ant', 'antonella', 'DEBITO', f(0, 14)),
  cobro('m-o-eze', 'ezequiel', 'TRANSFERENCIA', f(0, 15)),

  cobro('h-a-max', 'maximiliano', 'EFECTIVO', f(-2, 26), {
    fecha: f(-1, 20),
    motivo: 'ERROR_CARGA',
    detalle: 'El pago se imputó al alumno equivocado.',
  }),
  cobro('h-a-ari', 'ariana', 'TRANSFERENCIA', f(-2, 27)),
  cobro('h-s-max', 'maximiliano', 'DEBITO', f(-1, 23)),
  cobro('h-s-ari', 'ariana', 'TRANSFERENCIA', f(-1, 24)),
  cobro('h-o-max', 'maximiliano', 'EFECTIVO', f(0, 14)),
  cobro('h-o-ari', 'ariana', 'DEBITO', f(0, 15)),

  cobro('l-s-luc', 'luciana', 'EFECTIVO', f(-1, 24)),
  cobro('l-s-max', 'maximiliano', 'TRANSFERENCIA', f(-1, 25)),
  cobro('l-o-luc', 'luciana', 'DEBITO', f(0, 14)),
  cobro('l-o-max', 'maximiliano', 'EFECTIVO', f(0, 9)),

  cobro('e-j-gon', 'gonzalo', 'EFECTIVO', f(-3, 23)),
  cobro('e-j-ant', 'antonella', 'TRANSFERENCIA', f(-3, 24)),
  cobro('e-a-gon', 'gonzalo', 'DEBITO', f(-2, 20)),
  cobro('e-a-ant', 'antonella', 'EFECTIVO', f(-2, 25)),
  cobro('e-s-gon', 'gonzalo', 'TRANSFERENCIA', f(-1, 24)),
  cobro('e-s-ant', 'antonella', 'DEBITO', f(-1, 25)),
  cobro('e-o-gon', 'gonzalo', 'EFECTIVO', f(0, 14)),
  cobro('e-o-ant', 'antonella', 'TRANSFERENCIA', f(0, 15)),

  cobro('z-o-eze', 'ezequiel', 'TRANSFERENCIA', f(0, 14)),
  cobro('z-o-zar', 'zarate', 'EFECTIVO', f(0, 15)),

  cobro('w-a-zar', 'zarate', 'EFECTIVO', f(-2, 26), {
    fecha: f(-1, 15),
    motivo: 'ERROR_CARGA',
    detalle: 'Se cargó con el DNI de otra alumna.',
  }),
  cobro('w-a-bru', 'bruno', 'TRANSFERENCIA', f(-2, 27)),
  cobro('w-s-zar', 'zarate', 'DEBITO', f(-1, 10)),
  cobro('w-o-zar', 'zarate', 'TRANSFERENCIA', f(0, 14)),
  cobro('w-o-bru', 'bruno', 'EFECTIVO', f(0, 15)),
]

const PAGOS_ADICIONALES: readonly PagoDeLiquidacionSeed[] = [
  { profesor: 'patricia', mes: -3, fecha: f(-2, 10) },
  { profesor: 'diego', mes: -3, fecha: f(-2, 5) },
  { profesor: 'diego', mes: -2, fecha: f(-1, 7) },
  { profesor: 'diego', mes: -1, fecha: f(0, 5) },
  { profesor: 'hernan', mes: -2, fecha: f(-1, 7) },
  { profesor: 'sebastian', mes: -3, fecha: f(-2, 8) },
  { profesor: 'sebastian', mes: -2, fecha: f(-1, 9) },
  { profesor: 'walter', mes: -2, fecha: f(-1, 8) },
]

// ---------- Textos ----------

const TEMAS: Record<MateriaNombre, readonly string[]> = {
  Matemática: [
    'Ecuaciones cuadráticas y su gráfica',
    'Funciones lineales: pendiente y ordenada',
    'Trigonometría: razones en el triángulo rectángulo',
    'Sistemas de ecuaciones de 2×2',
    'Límites y primeras derivadas',
  ],
  Física: [
    'Cinemática: MRU y MRUV',
    'Leyes de Newton y diagramas de cuerpo libre',
    'Trabajo y energía mecánica',
    'Circuitos eléctricos en serie y en paralelo',
  ],
  Química: [
    'Estequiometría y reactivo limitante',
    'Balanceo de ecuaciones químicas',
    'Soluciones y concentración molar',
    'Tabla periódica y tipos de enlace',
  ],
  Lengua: [
    'Análisis sintáctico de oraciones compuestas',
    'Comprensión lectora y resumen',
    'Texto argumentativo: tesis y argumentos',
    'Ortografía y reglas de acentuación',
  ],
  Inglés: [
    'Present perfect vs. past simple',
    'First and second conditional',
    'Reading comprehension: noticias',
    'Vocabulario de la vida cotidiana',
  ],
  Contabilidad: [
    'Partida doble y asientos de diario',
    'Armado del balance general',
    'Estado de resultados',
    'Amortizaciones de bienes de uso',
  ],
}

const TRABAJADO = [
  'Se resolvieron los ejercicios de la guía; le costó el planteo inicial pero llegó al resultado.',
  'Repaso de la teoría y práctica con problemas de examen de años anteriores.',
  'Trabajó con autonomía y consultó solo dudas puntuales.',
  'Se corrigió la tarea y se reforzaron los errores más frecuentes.',
]

const INDICACIONES = [
  'Terminar los ejercicios 5 a 8 de la guía.',
  'Repasar los apuntes antes de la próxima clase y anotar las dudas.',
  'Resolver el modelo de examen que se entregó impreso.',
  'Traer la carpeta completa para revisar los trabajos prácticos.',
]

const OBSERVACIONES_AUSENCIA = [
  'Avisó por WhatsApp que no podía asistir (examen en el colegio).',
  'No se presentó y no avisó.',
  'Faltó por un viaje familiar; pidió reprogramar.',
]

export const BANCOS = [
  'Banco Macro',
  'Banco de la Nación Argentina',
  'Banco Galicia',
  'Banco Santander',
]
export const REDES_DEBITO = ['VISA_DEBITO', 'MASTERCARD_DEBITO', 'MAESTRO', 'CABAL_DEBITO'] as const

// ---------- Escenario resuelto ----------

export type AsistenciaResuelta = {
  estado: 'PRESENTE' | 'AUSENTE'
  registradaEl: Date
  trabajado: string | null
  indicaciones: string | null
  observacion: string | null
}

export type ClaseResuelta = {
  indice: number
  profesor: ProfesorClave
  alumno: AlumnoClave
  materia: MateriaNombre
  hora: string
  fecha: string
  tema: string
  creadaEl: Date
  asistencia: AsistenciaResuelta | null
  cobro: string | null
  cobroAnulado: string | null
}

export type CobroResuelto = {
  indice: number
  clave: string
  alumno: AlumnoClave
  forma: FormaDePago
  fechaPago: string
  registradoEl: Date
  anulacion: {
    fecha: string
    registradaEl: Date
    motivo: MotivoDeAnulacion
    detalle: string
  } | null
}

export type PagoDeLiquidacionResuelto = { profesor: ProfesorClave; mes: string; fecha: string }

export type Escenario = {
  hoy: string
  clases: ClaseResuelta[]
  cobros: CobroResuelto[]
  /** Por fecha ascendente (a igual fecha, el orden de arriba). */
  pagosDeLiquidacion: PagoDeLiquidacionResuelto[]
}

/** Un instante de Salta (UTC-3), sin pasarse de `ahora`: nada queda registrado en el futuro. */
export function instante(fecha: string, hora: string, ahora: Date): Date {
  const valor = new Date(`${fecha}T${hora}:00-03:00`)
  return valor.getTime() > ahora.getTime() ? ahora : valor
}

function conDosDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/** El mes `YYYY-MM` que está `desplazamiento` meses del de `hoy`. */
export function mesDesplazado(hoy: string, desplazamiento: number): string {
  let mes = mesDe(hoy)
  for (let i = 0; i < Math.abs(desplazamiento); i++) {
    mes = desplazamiento < 0 ? mesAnterior(mes) : mesSiguiente(mes)
  }
  return mes
}

/** El día hábil más cercano a `fecha` sin salir de su mes (hacia atrás y, si no se puede, adelante). */
function aDiaHabil(fecha: string): string {
  const mes = mesDe(fecha)
  for (const paso of [-1, 1]) {
    let candidata = fecha
    while (diaSemanaISO(candidata) >= 6) candidata = sumarDias(candidata, paso)
    if (mesDe(candidata) === mes) return candidata
  }
  return fecha
}

/** Hacia atrás desde `fecha`, sin pasar de un día hábil (fines de semana no hay clases ni pagos). */
function diaHabilAnterior(fecha: string): string {
  let candidata = fecha
  while (diaSemanaISO(candidata) >= 6) candidata = sumarDias(candidata, -1)
  return candidata
}

/** La fecha `YYYY-MM-DD` de una `FechaSpec`: siempre un día hábil y nunca posterior a hoy salvo `hoyMas`. */
export function resolverFecha(spec: FechaSpec, hoy: string): string {
  if ('hoyMas' in spec) {
    let candidata = sumarDias(hoy, spec.hoyMas)
    while (diaSemanaISO(candidata) >= 6) candidata = sumarDias(candidata, 1)
    return candidata
  }
  if ('hoyMenos' in spec) return diaHabilAnterior(sumarDias(hoy, -spec.hoyMenos))
  const mes = mesDesplazado(hoy, spec.mes)
  const ultimo = Number(ultimoDiaDelMes(mes).slice(8))
  const tope = spec.mes === 0 ? Number(hoy.slice(8)) : ultimo
  const fecha = aDiaHabil(`${mes}-${conDosDigitos(Math.min(spec.dia, tope))}`)
  return fecha > hoy ? diaHabilAnterior(hoy) : fecha
}

function elegir<T>(lista: readonly T[], indice: number): T {
  return lista[indice % lista.length] as T
}

function sumarHoras(hora: string, horas: number, minutos: number): string {
  const [h, m] = hora.split(':').map(Number) as [number, number]
  const total = h * 60 + m + horas * 60 + minutos
  return `${conDosDigitos(Math.floor(total / 60))}:${conDosDigitos(total % 60)}`
}

/**
 * Resuelve todas las fechas del escenario respecto de `hoy`; `ahora` evita instantes futuros. Con
 * `soloProfesores`, deja sólo lo de esos profesores (para cargar los que faltan).
 */
export function armarEscenario(
  hoy: string,
  ahora: Date,
  soloProfesores?: ReadonlySet<ProfesorClave>,
): Escenario {
  const contadorPorMateria = new Map<MateriaNombre, number>()
  const clases: ClaseResuelta[] = [...CLASES, ...CLASES_ADICIONALES].map((seed, indice) => {
    const fecha = resolverFecha(seed.fecha, hoy)
    const n = contadorPorMateria.get(seed.materia) ?? 0
    contadorPorMateria.set(seed.materia, n + 1)
    const tema = elegir(TEMAS[seed.materia], n)

    let asistencia: AsistenciaResuelta | null = null
    if (seed.asistencia) {
      const diaRegistro = seed.registradaEl ? resolverFecha(seed.registradaEl, hoy) : fecha
      const hora = seed.registradaEl ? '09:40' : sumarHoras(seed.hora, 1, 25)
      asistencia = {
        estado: seed.asistencia,
        registradaEl: instante(diaRegistro, hora, ahora),
        trabajado: seed.asistencia === 'PRESENTE' ? elegir(TRABAJADO, indice) : null,
        indicaciones: seed.asistencia === 'PRESENTE' ? elegir(INDICACIONES, indice) : null,
        observacion: seed.asistencia === 'AUSENTE' ? elegir(OBSERVACIONES_AUSENCIA, indice) : null,
      }
    }

    return {
      indice,
      profesor: seed.profesor,
      alumno: seed.alumno,
      materia: seed.materia,
      hora: seed.hora,
      fecha,
      tema,
      creadaEl: instante(sumarDias(fecha, -4), '12:00', ahora),
      asistencia,
      cobro: seed.cobro ?? null,
      cobroAnulado: seed.cobroAnulado ?? null,
    }
  })

  const cobros: CobroResuelto[] = [...COBROS, ...COBROS_ADICIONALES].map((seed, indice) => {
    const fechaPago = resolverFecha(seed.fecha, hoy)
    const hora = `${conDosDigitos(9 + (indice % 8))}:${conDosDigitos((indice * 13) % 60)}`
    return {
      indice,
      clave: seed.clave,
      alumno: seed.alumno,
      forma: seed.forma,
      fechaPago,
      registradoEl: instante(fechaPago, hora, ahora),
      anulacion: seed.anulacion
        ? {
            fecha: resolverFecha(seed.anulacion.fecha, hoy),
            registradaEl: instante(resolverFecha(seed.anulacion.fecha, hoy), '15:10', ahora),
            motivo: seed.anulacion.motivo,
            detalle: seed.anulacion.detalle,
          }
        : null,
    }
  })

  const pagosDeLiquidacion = [...PAGOS_DE_LIQUIDACION, ...PAGOS_ADICIONALES]
    .map((pago) => ({
      profesor: pago.profesor,
      mes: mesDesplazado(hoy, pago.mes),
      fecha: resolverFecha(pago.fecha, hoy),
    }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))

  if (!soloProfesores) return { hoy, clases, cobros, pagosDeLiquidacion }

  // Sólo los profesores elegidos: sus clases, los cobros de esas clases y sus pagos.
  const clasesElegidas = clases.filter((c) => soloProfesores.has(c.profesor))
  const cobrosElegidos = new Set(
    clasesElegidas.flatMap((c) => [c.cobro, c.cobroAnulado].filter((k): k is string => k !== null)),
  )
  return {
    hoy,
    clases: clasesElegidas,
    cobros: cobros.filter((c) => cobrosElegidos.has(c.clave)),
    pagosDeLiquidacion: pagosDeLiquidacion.filter((p) => soloProfesores.has(p.profesor)),
  }
}

// ---------- Simulación de los pagos a profesores ----------

/** Un cobro vigente de una clase con asistencia, listo para que el motor lo devengue. */
export type TurnoCobrado = { cobro: string; devengado: Devengado }

export type PagoDeLiquidacionConId = { profesorId: number; mes: string; fecha: string }

export type Paso = {
  fecha: string
  profesorId: number
  mes: string
  cierre: CierreDeLiquidacion
}

/** La `fechaDevengo` del motor para un cobro registrado y una asistencia registrada. */
export function devengo(pagoRegistradoEl: Date, asistenciaRegistradaEl: Date): string {
  return calcularFechaDevengo({ pagoRegistradoEl, asistenciaRegistradaEl })
}

/**
 * Corre los pagos a profesores en orden cronológico con el motor real. Cada pago se calcula con lo
 * que el sistema sabía ese día: los turnos devengados hasta esa fecha y las anulaciones ya hechas.
 * `anulaciones` dice qué día se anuló cada cobro. Devuelve los cierres a guardar y las liquidaciones
 * abiertas de hoy.
 *
 * Para `AnulacionPendiente.liquidacionTurnoId` y los ajustes de anulación usa el `pagoTurnoId`
 * (que es único por turno): quien guarda lo traduce al id de `LiquidacionTurno`.
 */
export function simular({
  turnos,
  anulaciones,
  pagos,
  hoy,
}: {
  turnos: readonly TurnoCobrado[]
  anulaciones: ReadonlyMap<string, string>
  pagos: readonly PagoDeLiquidacionConId[]
  hoy: string
}): { pasos: Paso[]; abiertas: Liquidacion[] } {
  const mesDeCierre = new Map<number, string>()
  const ajustados = new Set<number>()
  const cerrados: MesCerrado[] = []
  const anuladoAl = (cobro: string, fecha: string) => {
    const dia = anulaciones.get(cobro)
    return dia !== undefined && dia <= fecha
  }

  function abiertasAl(fecha: string): Liquidacion[] {
    const devengados = turnos
      .filter(
        ({ cobro, devengado }) =>
          !mesDeCierre.has(devengado.pagoTurnoId) &&
          devengado.fechaDevengo <= fecha &&
          !anuladoAl(cobro, fecha),
      )
      .map(({ devengado }) => devengado)
    const anulacionesPendientes: AnulacionPendiente[] = turnos
      .filter(
        ({ cobro, devengado }) =>
          mesDeCierre.has(devengado.pagoTurnoId) &&
          anuladoAl(cobro, fecha) &&
          !ajustados.has(devengado.pagoTurnoId),
      )
      .map(({ devengado }) => ({
        liquidacionTurnoId: devengado.pagoTurnoId,
        profesor: devengado.profesor,
        mesOrigen: mesDeCierre.get(devengado.pagoTurnoId) as string,
        numeroComprobante: devengado.numeroComprobante,
        parteProfesor: repartoDeTurno(devengado.importe, devengado.porcentaje).parteProfesor,
      }))
    return armarLiquidaciones({
      devengados,
      liquidacionesCerradas: cerrados,
      anulacionesPendientes,
      hoy: fecha,
    })
  }

  const pasos: Paso[] = []
  for (const pago of pagos) {
    const cierre = armarCierre(abiertasAl(pago.fecha), pago)
    if (!cierre) {
      throw new Error(
        `El escenario no deja pagable la liquidación ${pago.mes} del profesor ${pago.profesorId} el ${pago.fecha}`,
      )
    }
    for (const escritura of cierre.escrituras) {
      cerrados.push({ profesorId: pago.profesorId, mes: escritura.mes })
      for (const turno of escritura.turnos) mesDeCierre.set(turno.pagoTurnoId, escritura.mes)
      for (const ajuste of escritura.ajustes) {
        if (ajuste.tipo === 'ANULACION') ajustados.add(ajuste.liquidacionTurnoId)
      }
    }
    pasos.push({ fecha: pago.fecha, profesorId: pago.profesorId, mes: pago.mes, cierre })
  }

  return { pasos, abiertas: abiertasAl(hoy) }
}
