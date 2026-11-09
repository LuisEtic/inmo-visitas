import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { clientConfig } from '../config/client'
import { seedClients, seedProperties, type PropertyStatus } from '../data/seed'

const palette: Array<{ name: string; token: string; hex: string }> = [
  { name: 'bg', token: '--color-bg', hex: '#FFFFFF' },
  { name: 'surface', token: '--color-surface', hex: '#F5F5F4' },
  { name: 'surface-alt', token: '--color-surface-alt', hex: '#EDEDEC' },
  { name: 'border', token: '--color-border', hex: '#E0E0DE' },
  { name: 'text-primary', token: '--color-text-primary', hex: '#111111' },
  { name: 'text-secondary', token: '--color-text-secondary', hex: '#6B6B6B' },
  { name: 'accent', token: '--color-accent', hex: '#111111' },
  { name: 'success', token: '--color-success', hex: '#16A34A' },
  { name: 'warning', token: '--color-warning', hex: '#D97706' },
  { name: 'error', token: '--color-error', hex: '#DC2626' },
  { name: 'info', token: '--color-info', hex: '#2563EB' },
]

const typeScale: Array<{ name: string; className: string; sample: string }> = [
  { name: 'text-xs · 12/16', className: 'text-xs', sample: 'Nota de visita · 12 px' },
  { name: 'text-sm · 14/20', className: 'text-sm', sample: 'Nota de visita · 14 px' },
  { name: 'text-base · 16/24', className: 'text-base', sample: 'Nota de visita · 16 px' },
  { name: 'text-lg · 18/28', className: 'text-lg', sample: 'Nota de visita · 18 px' },
  { name: 'text-xl · 24/32', className: 'text-xl', sample: 'Nota de visita' },
  { name: 'text-2xl · 32/40', className: 'text-2xl', sample: 'Nota de visita' },
]

const statusLabels: Record<PropertyStatus, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

export default function DesignSystem() {
  const v18 = seedProperties.find((p) => p.reference === 'V-18')
  if (!v18) {
    return <p className="p-8 text-sm text-error">Seed incompleto: falta V-18.</p>
  }

  return (
    <main className="mx-auto max-w-4xl bg-bg px-4 py-12 text-text-primary sm:px-8">
      <header className="mb-12">
        <p className="font-mono text-xs text-text-secondary">inmo-visitas · Fase 1</p>
        <h1 className="mt-2 text-2xl">{clientConfig.name} — Sistema de diseño</h1>
        <p className="mt-2 text-base text-text-secondary">
          Minimal-Mono. Tokens de color, tipografía, radios, sombras, espaciado
          y motion. Esta es la única pantalla de la Fase 1.
        </p>
      </header>

      <section className="mb-12" aria-labelledby="paleta">
        <h2 id="paleta" className="text-xl">Paleta</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {palette.map((color) => (
            <div
              key={color.name}
              className="rounded-md border border-border bg-surface p-4 shadow-sm"
            >
              <span
                className="block h-12 w-full rounded-sm border border-border"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold">{color.name}</p>
              <p className="font-mono text-xs text-text-secondary">{color.hex}</p>
              <p className="font-mono text-xs text-text-secondary">{color.token}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12" aria-labelledby="tipografia">
        <h2 id="tipografia" className="text-xl">Tipografía</h2>
        <div className="mt-4 space-y-6 rounded-lg border border-border bg-surface p-6">
          <div>
            <p className="text-sm font-semibold text-text-secondary">
              Inter (sans) — texto general y UI
            </p>
            <div className="mt-2 space-y-2">
              {typeScale.map((row) => (
                <div key={`sans-${row.name}`} className="flex items-baseline gap-4">
                  <span className="w-36 shrink-0 font-mono text-xs text-text-secondary">
                    {row.name}
                  </span>
                  <span className={row.className}>{row.sample}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary">
              JetBrains Mono (mono) — datos, referencias, cifras y evidencias
            </p>
            <div className="mt-2 space-y-2 font-mono">
              {typeScale.map((row) => (
                <div key={`mono-${row.name}`} className="flex items-baseline gap-4">
                  <span className="w-36 shrink-0 font-mono text-xs text-text-secondary">
                    {row.name}
                  </span>
                  <span className={row.className}>{row.sample}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12" aria-labelledby="botones">
        <h2 id="botones" className="text-xl">Botones</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-6">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button disabled>Primario deshabilitado</Button>
          <Button variant="secondary" disabled>
            Secundario deshabilitado
          </Button>
          <Button size="sm">Pequeño</Button>
          <Button size="lg">Grande</Button>
        </div>
      </section>

      <section className="mb-12" aria-labelledby="tarjeta">
        <h2 id="tarjeta" className="text-xl">Tarjeta de ejemplo — datos seed</h2>
        <article className="mt-4 max-w-md rounded-lg border border-border bg-surface p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-sm font-semibold">{v18.reference}</p>
            <Badge variant={v18.status}>{statusLabels[v18.status]}</Badge>
          </div>
          <p className="mt-2 text-base">{v18.address}</p>
          <p className="text-sm text-text-secondary">{v18.city}</p>
          <p className="mt-4 font-mono text-lg">{formatPrice(v18.price)}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Propietario: {v18.ownerName}
            {v18.ownerPhone !== null ? ` · ${v18.ownerPhone}` : ''}
          </p>
        </article>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="disponible">disponible</Badge>
          <Badge variant="reservado">reservado</Badge>
          <Badge variant="vendido">vendido</Badge>
          <Badge variant="neutral">neutral</Badge>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Seed cargado: {seedProperties.length} propiedades y {seedClients.length}{' '}
          clientes.
        </p>
      </section>

      <section className="mb-12" aria-labelledby="evidencia">
        <h2 id="evidencia" className="text-xl">Evidencia (simulada)</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Así se mostrará en fases futuras la evidencia del dictado junto a cada
          dato extraído.
        </p>
        <blockquote className="mt-4 rounded-md bg-surface p-6">
          <p className="font-mono text-sm">
            “Le gusta la distribución, pero le preocupa el ruido. Quiere volver el
            viernes; falta la hora. Su presupuesto sigue siendo 230.000 euros.”
          </p>
          <footer className="mt-2 font-mono text-xs text-text-secondary">
            — Ana García · visita V-18 · objeción: ruido
          </footer>
        </blockquote>
      </section>

      <section aria-labelledby="tokens">
        <h2 id="tokens" className="text-xl">Radios, sombras y espaciado</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-sm border border-border bg-surface p-4 shadow-sm">
            <p className="font-mono text-xs">radius-sm · 4px</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-4 shadow-sm">
            <p className="font-mono text-xs">radius-md · 8px</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 shadow-md">
            <p className="font-mono text-xs">radius-lg · 12px</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Espaciado base 4 px → 4, 8, 12, 16, 24, 32, 48, 64. Motion: hover/focus
          150 ms ease-out; aperturas de modal/panel 200 ms ease-in-out.
        </p>
      </section>
    </main>
  )
}
