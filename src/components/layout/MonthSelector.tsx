import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/contexts/AppContext'
import { navegarMes, mesAtualRef } from '@/lib/dates'
import { mesExtenso } from '@/lib/format'
import { cn } from '@/lib/utils'

export function MonthSelector({ className }: { className?: string }) {
  const { mesRef, setMesRef } = useApp()
  const ehAtual = mesRef === mesAtualRef()
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setMesRef(navegarMes(mesRef, -1))} aria-label="Mês anterior">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <button
        type="button"
        onClick={() => setMesRef(mesAtualRef())}
        className="min-h-11 min-w-[8.5rem] rounded-xl px-3 py-2 text-center font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={ehAtual ? mesExtenso(mesRef) : `Ir para o mês atual (${mesExtenso(mesRef)})`}
      >
        {mesExtenso(mesRef)}
        {!ehAtual && <span className="block text-xs font-normal text-muted-foreground">tocar p/ mês atual</span>}
      </button>
      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setMesRef(navegarMes(mesRef, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
