import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { Conta } from '@/types/db'
import { useSalvarConta } from '@/hooks/useMutations'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'

/** Normaliza um dia do mês digitado (1-31) ou null. */
function diaValido(v: string): number | null {
  const n = parseInt(v, 10)
  if (Number.isNaN(n)) return null
  return Math.min(31, Math.max(1, n))
}

export function CartaoConfigDialog({ conta }: { conta: Conta }) {
  const salvar = useSalvarConta()
  const [open, setOpen] = useState(false)
  const [fechamento, setFechamento] = useState(conta.dia_fechamento?.toString() ?? '')
  const [vencimento, setVencimento] = useState(conta.dia_vencimento?.toString() ?? '')
  const [limite, setLimite] = useState(conta.limite ?? 0)
  const [erro, setErro] = useState<string | null>(null)

  async function submit() {
    setErro(null)
    try {
      await salvar.mutateAsync({
        id: conta.id,
        dia_fechamento: fechamento ? diaValido(fechamento) : null,
        dia_vencimento: vencimento ? diaValido(vencimento) : null,
        limite: limite > 0 ? limite : null,
      })
      setOpen(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" /> Configurar fatura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar {conta.nome}</DialogTitle>
          <DialogDescription>
            Informe o fechamento e o vencimento da fatura para acompanhar quanto vence e quando.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dia_fechamento">Dia do fechamento</Label>
              <Input
                id="dia_fechamento"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="ex: 28"
                value={fechamento}
                onChange={(e) => setFechamento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dia_vencimento">Dia do vencimento</Label>
              <Input
                id="dia_vencimento"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="ex: 5"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limite">Limite (opcional)</Label>
            <MoneyInput id="limite" value={limite} onChange={setLimite} />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button onClick={submit} disabled={salvar.isPending} aria-busy={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
