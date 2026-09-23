import { BarChart3, CalendarDays, MousePointer2, Users } from 'lucide-react'
import Image from 'next/image'

const caracteristicas = [
  {
    icono: Users,
    titulo: 'Gestión de alumnos',
    descripcion: 'Todo en un solo lugar',
  },
  {
    icono: CalendarDays,
    titulo: 'Organización académica',
    descripcion: 'Turnos, materias y más',
  },
  {
    icono: BarChart3,
    titulo: 'Mejor atención',
    descripcion: 'Una comunidad más conectada',
  },
]

export function LoginHero() {
  return (
    <section className="relative hidden min-h-screen w-[52%] overflow-hidden bg-[#eef1fc] lg:block">
      {/* Imagen de fondo */}
      <Image
        src="/login-hero.webp"
        alt=""
        fill
        priority
        sizes="52vw"
        className="object-cover object-bottom"
      />

      {/* Fusión de la imagen con el fondo */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,#eef1fc_0%,#eef1fc_43%,rgba(238,241,252,0.96)_50%,rgba(238,241,252,0.78)_58%,rgba(238,241,252,0.18)_76%,transparent_88%)]"
      />

      {/* Luz decorativa */}
      <div
        aria-hidden
        className="bg-cobalto/15 pointer-events-none absolute -top-24 -right-24 size-96 rounded-full blur-3xl"
      />

      {/* Contenido */}
      <div className="relative z-10 flex max-w-xl flex-col px-12 pt-10">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="bg-cobalto flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <MousePointer2 className="size-5 fill-white text-white" />
          </span>

          <div>
            <p className="text-lg leading-tight font-semibold">
              <span className="text-tinta">Aula</span>
              <span className="text-cobalto">Click</span>
            </p>

            <p className="text-oscuro text-xs">Centro de Atención Académica</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-tinta max-w-sm text-4xl leading-[1.08] font-bold tracking-tight text-balance">
            Acompañamos tu camino académico
          </h1>

          <p className="text-oscuro mt-4 max-w-md text-sm leading-relaxed">
            Un centro de atención diseñado para facilitar la gestión, el seguimiento y el bienestar
            de nuestra comunidad educativa.
          </p>
        </div>

        <ul className="mt-8 space-y-4">
          {caracteristicas.map(({ icono: Icono, titulo, descripcion }) => (
            <li key={titulo} className="flex items-center gap-3">
              <span className="bg-cobalto/10 text-cobalto flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icono className="size-4" />
              </span>

              <div>
                <p className="text-tinta text-sm font-semibold">{titulo}</p>
                <p className="text-oscuro text-xs">{descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
