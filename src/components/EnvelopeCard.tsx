import { Link } from 'react-router-dom'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Progress } from '@/components/ui/progress'
import { money, pct } from '@/lib/format'
import type { EnvelopeInfo } from '@/lib/calc'
import { cn } from '@/lib/utils'

export function corEstado(estado: EnvelopeInfo['estado']) {
  switch (estado) {
    case 'vermelho':
      return { barra: 'bg-destructive', texto: 'text-destructive' }
    case 'amarelo':
      return { barra: 'bg-warning', texto: 'text-warning-foreground' }
    case 'sem_orcamento':
      return { barra: 'bg-muted-foreground/40', texto: 'text-muted-foreground' }
    default:
      return { barra: 'bg-success', texto: 'text-success' }
  }
}

export function EnvelopeCard({ env, mostrarSemana = true }: { env: EnvelopeInfo; mostrarSemana?: boolean }) {
  const c = corEstado(env.estado)
  const semOrc = env.estado === 'sem_orcamento'
  return (
    <Link
      to="/orcamentos"
      className="block rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <CategoriaIcon icone={env.categoria.icone} cor={env.categoria.cor} className="h-10 w-10" size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold truncate">{env.categoria.nome}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{semOrc ? '' : pct(env.pct)}</span>
          </div>
          {semOrc ? (
            <p className="text-sm text-muted-foreground">
              Gasto {money(env.gasto)} · <span className="text-primary">defina um envelope</span>
            </p>
          ) : env.estourou ? (
            <p className={cn('text-sm font-semibold', c.texto)}>Estourou {money(env.estourouValor)}</p>
          ) : (
            <p className="text-sm">
              <span className={cn('text-lg font-bold', c.texto)}>{money(env.resta)}</span>{' '}
              <span className="text-muted-foreground">restam este mês</span>
            </p>
          )}
        </div>
      </div>

      <Progress value={env.pct * 100} indicatorClassName={c.barra} className="mt-3" />

      {!semOrc && mostrarSemana && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>~{money(env.ritmoSemanal)}/semana</span>
          {env.gastoSemana > 0 ? (
            <span>
              Esta semana: {money(env.gastoSemana)} de ~{money(Math.max(0, env.ritmoSemanal))}
            </span>
          ) : (
            <span>{money(env.gasto)} de {money(env.estabelecido)}</span>
          )}
        </div>
      )}
    </Link>
  )
}
