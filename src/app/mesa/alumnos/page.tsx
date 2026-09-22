import Link from 'next/link'

import { AlumnosTable } from '@/features/alumnos/components/AlumnosTable'

export default function AlumnosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alumnos</h1>
        <Link
          href="/mesa/alumnos/nuevo"
          className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
        >
          Nuevo alumno
        </Link>
      </div>
      <AlumnosTable />
    </div>
  )
}
