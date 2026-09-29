'use client'

import { CalendarDays, List } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { type ModoAgenda, parsearModo } from '../modo-agenda'

type SelectorModoAgendaProps = {
  value: ModoAgenda
  onChange: (modo: ModoAgenda) => void
}

/**
 * Elige entre ver la agenda como calendario semanal o como lista (HU-19). Como
 * `SelectorVistaAgenda`, es un selector y no un contenedor de paneles: el contenido lo arma
 * `AgendaConModo` según el modo elegido.
 */
export function SelectorModoAgenda({ value, onChange }: SelectorModoAgendaProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(parsearModo(v))}>
      <TabsList aria-label="Modo de la agenda">
        <TabsTrigger value="calendario" className="px-4">
          <CalendarDays />
          Calendario
        </TabsTrigger>
        <TabsTrigger value="lista" className="px-4">
          <List />
          Lista
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
