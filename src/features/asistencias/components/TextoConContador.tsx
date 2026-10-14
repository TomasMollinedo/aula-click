'use client'

import type { ComponentProps } from 'react'

import { Field, fieldErrorId } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { textoContador } from '../formato-asistencias'

/** Un texto de la asistencia con su contador de caracteres ("12/1000"). */
export function TextoConContador({
  id,
  label,
  max,
  value,
  error,
  ...textarea
}: Omit<ComponentProps<'textarea'>, 'value' | 'maxLength'> & {
  id: string
  label: string
  max: number
  value: string
  error?: string
}) {
  const idContador = `${id}-contador`
  return (
    <Field label={label} htmlFor={id} optional error={error}>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={2}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldErrorId(id)} ${idContador}` : idContador}
        {...textarea}
      />
      <p id={idContador} className="text-muted-foreground text-right text-xs">
        {textoContador(value, max)}
      </p>
    </Field>
  )
}
