import { CalendarClock, CalendarRange, Layers } from 'lucide-react'
import type { EscopoSerie } from '@/hooks/useMutations'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Pergunta o escopo ao editar/excluir um lançamento que faz parte de uma série
 * (parcelas ou recorrência): só esta, esta e as próximas, ou todas.
 */
export function EscopoSerieDialog({
  open,
  onClose,
  onEscolher,
  titulo,
  descricao,
  destrutivo = false,
}: {
  open: boolean
  onClose: () => void
  onEscolher: (escopo: EscopoSerie) => void
  titulo: string
  descricao?: string
  destrutivo?: boolean
}) {
  const opcoes: { escopo: EscopoSerie; label: string; sub: string; icon: typeof CalendarClock }[] = [
    { escopo: 'uma', label: 'Só esta', sub: 'Mantém as outras como estão', icon: CalendarClock },
    { escopo: 'futuras', label: 'Esta e as próximas', sub: 'Não mexe nos meses já passados', icon: CalendarRange },
    { escopo: 'todas', label: 'Todas da série', sub: 'Aplica em todos os meses', icon: Layers },
  ]
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {descricao && <p className="-mt-1 text-sm text-muted-foreground">{descricao}</p>}
        <div className="flex flex-col gap-2 pt-1" role="radiogroup" aria-label={titulo}>
          {opcoes.map((o) => {
            const Icon = o.icon
            return (
              <button
                key={o.escopo}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => onEscolher(o.escopo)}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50',
                  destrutivo && o.escopo !== 'uma' && 'border-destructive/30 hover:border-destructive/50'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.sub}</span>
                </span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
