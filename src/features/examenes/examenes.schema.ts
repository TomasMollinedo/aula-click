import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type {
  ExamenCrear,
  ExamenEditar,
  ExamenItem,
  NotaCargar,
  ResultadoExamen,
  TipoExamen,
} from './examenes.types'

// Schema del formulario de examen: solo formato (docs/arquitectura-frontend.md → Formularios). Que
// la materia esté activa, que el profesor la dicte y que no haya otro examen pendiente de esa
// materia lo decide la API.

export const OBSERVACIONES_MAX = 500

/** Tipos en el orden de la lista, con el texto que ve la persona. */
export const TIPOS_EXAMEN: { valor: TipoExamen; etiqueta: string }[] = [
  { valor: 'PARCIAL', etiqueta: 'Parcial' },
  { valor: 'FINAL', etiqueta: 'Final' },
  { valor: 'RECUPERATORIO', etiqueta: 'Recuperatorio' },
  { valor: 'TRABAJO_PRACTICO', etiqueta: 'Trabajo práctico' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const VALORES = TIPOS_EXAMEN.map((t) => t.valor) as [TipoExamen, ...TipoExamen[]]

export const MENSAJE_MATERIA_OBLIGATORIA = 'Elegí una materia'
export const MENSAJE_FECHA_OBLIGATORIA = 'Elegí la fecha del examen'
export const MENSAJE_TIPO_OBLIGATORIO = 'Elegí el tipo de examen'

/** Campos del formulario que puede marcar un error de la API. */
export const EXAMEN_FORM_FIELDS = ['materiaId', 'fecha', 'tipo', 'observaciones'] as const
export type CampoExamenForm = (typeof EXAMEN_FORM_FIELDS)[number]

export const examenFormSchema = z.object({
  // El id de la materia como string: es el `value` del Select.
  materiaId: z.string().regex(/^[1-9]\d*$/, MENSAJE_MATERIA_OBLIGATORIA),
  fecha: z
    .string()
    .min(1, MENSAJE_FECHA_OBLIGATORIA)
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: debe tener formato AAAA-MM-DD')
    .refine((v) => isValid(parseISO(v)), 'La fecha no es válida'),
  tipo: z.enum(VALORES, { error: MENSAJE_TIPO_OBLIGATORIO }),
  observaciones: z
    .string()
    .max(OBSERVACIONES_MAX, `No puede superar los ${OBSERVACIONES_MAX} caracteres`),
})

export type ExamenFormValues = z.infer<typeof examenFormSchema>

/** Valores del formulario antes de elegir: el tipo arranca vacío (no hay uno por defecto). */
export type ExamenFormInicial = Omit<ExamenFormValues, 'tipo'> & { tipo: TipoExamen | '' }

/** Formulario vacío (alta) o con los datos del examen que se edita. */
export function valoresIniciales(examen?: ExamenItem): ExamenFormInicial {
  if (!examen) return { materiaId: '', fecha: '', tipo: '', observaciones: '' }
  return {
    materiaId: String(examen.materia.id),
    fecha: examen.fecha,
    tipo: examen.tipo,
    observaciones: examen.observaciones ?? '',
  }
}

/** Body del alta. Las observaciones vacías no se mandan. */
export function aBodyCrear(alumnoId: number, valores: ExamenFormValues): ExamenCrear {
  const observaciones = valores.observaciones.trim()
  return {
    alumnoId,
    materiaId: Number(valores.materiaId),
    fecha: valores.fecha,
    tipo: valores.tipo,
    ...(observaciones ? { observaciones } : {}),
  }
}

/**
 * Body de la edición: solo lo que cambió respecto del examen (la API vuelve a chequear la materia
 * y el pendiente solo si viajan `materiaId` o `fecha`). `null` si no cambió nada. Las observaciones
 * vaciadas viajan como `''`, que la API guarda como "sin observaciones".
 */
export function aBodyEditar(examen: ExamenItem, valores: ExamenFormValues): ExamenEditar | null {
  const cambios: ExamenEditar = {}
  const materiaId = Number(valores.materiaId)
  const observaciones = valores.observaciones.trim()

  if (materiaId !== examen.materia.id) cambios.materiaId = materiaId
  if (valores.fecha !== examen.fecha) cambios.fecha = valores.fecha
  if (valores.tipo !== examen.tipo) cambios.tipo = valores.tipo
  if (observaciones !== (examen.observaciones ?? '')) cambios.observaciones = observaciones

  return Object.keys(cambios).length > 0 ? cambios : null
}

// ---------- Nota del examen (HU-34) ----------

/** Resultados en el orden del diálogo, con el texto que ve la persona. */
export const RESULTADOS_NOTA: { valor: ResultadoExamen; etiqueta: string }[] = [
  { valor: 'CON_NOTA', etiqueta: 'Con nota' },
  { valor: 'AUSENTE', etiqueta: 'Ausente al examen' },
]

export const MENSAJE_RESULTADO_OBLIGATORIO = 'Elegí si tiene nota o estuvo ausente'
export const MENSAJE_NOTA_OBLIGATORIA = 'Ingresá la nota'
export const MENSAJE_NOTA_FORMATO = 'Ingresá un número con hasta dos decimales (por ejemplo 7,5)'

/** Un número con coma (o punto) decimal y hasta dos decimales: `7`, `7,5`, `7,25`. */
const FORMATO_NOTA = /^\d{1,2}([.,]\d{1,2})?$/

/** Campos del formulario de la nota que puede marcar un error de la API. */
export const NOTA_FORM_FIELDS = ['resultado', 'nota'] as const
export type CampoNotaForm = (typeof NOTA_FORM_FIELDS)[number]

/**
 * Formulario de la nota: solo formato. La nota se escribe con coma decimal; el rango (de 1 a 10) lo
 * valida la API, y su 400 se muestra en el campo.
 */
export const notaFormSchema = z
  .object({
    resultado: z.enum(['CON_NOTA', 'AUSENTE'], { error: MENSAJE_RESULTADO_OBLIGATORIO }),
    nota: z.string(),
  })
  .superRefine((valores, ctx) => {
    if (valores.resultado !== 'CON_NOTA') return
    const nota = valores.nota.trim()
    if (!nota) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: MENSAJE_NOTA_OBLIGATORIA })
    } else if (!FORMATO_NOTA.test(nota)) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: MENSAJE_NOTA_FORMATO })
    }
  })

export type NotaFormValues = z.infer<typeof notaFormSchema>

/** Antes de elegir, el resultado arranca vacío. */
export type NotaFormInicial = Omit<NotaFormValues, 'resultado'> & {
  resultado: ResultadoExamen | ''
}

/** `7.5` → `'7,5'`: la nota como se escribe en el formulario y se muestra en la lista. */
export function notaConComa(nota: number): string {
  return String(nota).replace('.', ',')
}

/** El formulario con la nota que ya tiene (corregir) o vacío (cargar). */
export function valoresInicialesNota(
  examen: Pick<ExamenItem, 'resultado' | 'nota'>,
): NotaFormInicial {
  return {
    resultado: examen.resultado ?? '',
    nota: examen.nota === null ? '' : notaConComa(examen.nota),
  }
}

/** Body de `PATCH /examenes/{id}/nota`: la nota como número; un ausente, sin nota. */
export function aBodyNota(valores: NotaFormValues): NotaCargar {
  if (valores.resultado === 'AUSENTE') return { resultado: 'AUSENTE' }
  return { resultado: 'CON_NOTA', nota: Number(valores.nota.trim().replace(',', '.')) }
}
