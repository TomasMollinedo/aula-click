'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { parsearVista, type VistaAgenda } from '../agenda-propia'

type SelectorVistaAgendaProps = {
  value: VistaAgenda
  onChange: (vista: VistaAgenda) => void
}

/**
 * Elige entre la vista por día y la vista por semana de la agenda propia (HU-10). Es un selector,
 * no un contenedor de paneles: usa `TabsList` por la accesibilidad de teclado que ya resuelve
 * Radix, y el contenido lo arma la pantalla según la vista elegida.
 */
export function SelectorVistaAgenda({ value, onChange }: SelectorVistaAgendaProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(parsearVista(v))}>
      <TabsList aria-label="Vista de la agenda">
        <TabsTrigger value="dia" className="px-4">
          Día
        </TabsTrigger>
        <TabsTrigger value="semana" className="px-4">
          Semana
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
