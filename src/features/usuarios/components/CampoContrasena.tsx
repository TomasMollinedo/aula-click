'use client'

import { type ComponentProps, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** Un campo de contraseña enmascarado, con el botón para mostrarla u ocultarla (como el login). */
export function CampoContrasena({
  id,
  label,
  error,
  ...input
}: Omit<ComponentProps<'input'>, 'type'> & { id: string; label: string; error?: string }) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <Field label={label} htmlFor={id} required error={error}>
      <div className="relative">
        <Input
          id={id}
          type={mostrar ? 'text' : 'password'}
          className="pr-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? fieldErrorId(id) : undefined}
          {...input}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={mostrar}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
        >
          {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  )
}
