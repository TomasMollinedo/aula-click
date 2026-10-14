'use client'

import { Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CampoArchivo } from '@/components/ui/campo-archivo'
import { Field } from '@/components/ui/field'

// Mismos límites y mensajes que valida la API (la foto del alumno usa las reglas de la del
// profesor, `contrato-api.md` → Alumnos → Foto): los schemas del frontend no comparten código con
// el backend (T-08). Si cambian allá, se cambian acá.
const FOTO_TIPOS = { 'image/jpeg': 'JPG', 'image/png': 'PNG' } as const
const FOTO_MAX_BYTES = 5 * 1024 * 1024
const FOTO_MENSAJES = {
  tipo: 'La foto debe ser JPG o PNG',
  tamano: 'La foto no puede superar los 5 MB',
}
const CAMPO_ID = 'foto-alumno'

// Cambio de foto elegido en la edición, todavía no guardado: un archivo nuevo o la foto actual
// marcada para quitarse. Lo sube o quita AlumnoForm recién al hacer clic en "Guardar alumno"
// (junto con el resto de los cambios, un solo botón de guardado).
export type CambioFotoPendiente = { tipo: 'archivo'; archivo: File } | { tipo: 'quitar' }

type FotoAlumnoCampoProps =
  | {
      modo: 'crear'
      /** Archivo elegido, todavía no subido: el alumno no tiene id hasta crearse. */
      archivo: File | null
      onArchivoChange: (archivo: File | null) => void
      /** Mientras se guarda el formulario: deshabilita elegir o quitar. */
      disabled?: boolean
    }
  | {
      modo: 'editar'
      /** URL prefirmada de la foto actual, o null si no tiene. */
      fotoUrl: string | null
      cambio: CambioFotoPendiente | null
      onCambioChange: (cambio: CambioFotoPendiente | null) => void
      /** Mientras se guarda el formulario: deshabilita elegir o quitar. */
      disabled?: boolean
    }

// Foto del alumno sobre `CampoArchivo` (components/ui): elegir, arrastrar, vista previa, "Elegir
// otro" y "Quitar". Espejo de FotoProfesorCampo (cada feature tiene el suyo). En ambos modos el
// archivo (o la marca de "quitar") queda en el estado del formulario: en el alta lo sube
// AlumnoNuevo después de crear al alumno; en la edición lo sube o quita AlumnoForm al guardar.
export function FotoAlumnoCampo(props: FotoAlumnoCampoProps) {
  if (props.modo === 'crear') {
    return (
      <Field label="Foto" htmlFor={CAMPO_ID} optional>
        <CampoArchivo
          id={CAMPO_ID}
          aceptar={FOTO_TIPOS}
          maxBytes={FOTO_MAX_BYTES}
          mensajes={FOTO_MENSAJES}
          valor={props.archivo}
          onCambiar={props.onArchivoChange}
          deshabilitado={props.disabled}
        />
      </Field>
    )
  }

  const { fotoUrl, cambio, onCambioChange, disabled } = props
  const archivoNuevo = cambio?.tipo === 'archivo' ? cambio.archivo : null
  // La foto guardada se ve mientras no haya un cambio pendiente (ni un archivo nuevo ni "quitar").
  const actual =
    cambio === null && fotoUrl ? { url: fotoUrl, nombre: 'Foto actual', esImagen: true } : null
  // El cambio queda pendiente hasta "Guardar alumno": este aviso y "Dejar la foto actual" son la
  // confirmación de reemplazar o quitar la foto (mismo patrón que la del profesor).
  const aviso =
    cambio?.tipo === 'quitar'
      ? 'La foto actual se quita al guardar el alumno'
      : cambio?.tipo === 'archivo'
        ? 'La foto nueva se guarda con "Guardar alumno"'
        : null

  return (
    <Field label="Foto" htmlFor={CAMPO_ID} optional>
      <CampoArchivo
        id={CAMPO_ID}
        aceptar={FOTO_TIPOS}
        maxBytes={FOTO_MAX_BYTES}
        mensajes={FOTO_MENSAJES}
        valor={archivoNuevo}
        // Quitar el archivo nuevo deshace el cambio: vuelve a verse la foto guardada, si había.
        onCambiar={(archivo) => onCambioChange(archivo ? { tipo: 'archivo', archivo } : null)}
        actual={actual}
        onQuitarActual={() => onCambioChange({ tipo: 'quitar' })}
        deshabilitado={disabled}
      />
      {aviso && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">{aviso}</p>
          {fotoUrl && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              disabled={disabled}
              onClick={() => onCambioChange(null)}
            >
              <Undo2 />
              Dejar la foto actual
            </Button>
          )}
        </div>
      )}
    </Field>
  )
}
