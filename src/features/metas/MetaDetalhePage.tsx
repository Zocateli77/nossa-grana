import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2, TrendingUp, CalendarClock, Target } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useSalvarLancamento, useExcluirMeta } from '@/hooks/useMutations'
import { progressoMeta } from '@/lib/calc'
import { money, mesCurto, dataCurta } from '@/lib/format'
import { iso } from '@/lib/dates'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/MoneyInput'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function MetaDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dados, isLoading } = useDados()
  const excluir = useExcluirMeta()
  const [aporte, setAporte] = useState(false)

  if (isLoading) return <Carregando />
  const meta = dados.metas.find((m) => m.id === id)
  if (!meta) return null
  const p = progressoMeta(meta, dados.lancamentos)

  return (
    <div>
      <header className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/metas')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-extrabold tracking-tight truncate flex-1">{meta.nome}</h1>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { await excluir.mutateAsync(meta.id); navigate('/metas') }}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </header>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <CategoriaIcon icone={meta.icone ?? 'target'} cor={meta.cor} className="h-12 w-12" size={24} />
          <div>
            <p className="text-3xl font-extrabold">{Math.round(p.pct * 100)}%</p>
            <p className="text-xs text-muted-foreground">{money(meta.valor_atual)} de {money(meta.valor_alvo)}</p>
          </div>
        </div>
        <Progress value={p.pct * 100} indicatorClassName="bg-primary" className="h-3" />
        {meta.descricao && <p className="mt-3 text-sm text-muted-foreground">{meta.descricao}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3 my-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Faltam</div>
          <p className="text-lg font-bold mt-1">{money(p.falta)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Prazo</div>
          <p className="text-lg font-bold mt-1">{meta.data_alvo ? mesCurto(meta.data_alvo) : '—'}</p>
        </Card>
      </div>

      {p.ritmoNecessario != null && p.falta > 0 && (
        <Card className="p-4 mb-4 bg-secondary/50 border-primary/20">
          <p className="text-sm">
            Para bater {meta.data_alvo ? `até ${mesCurto(meta.data_alvo)}` : 'a meta'}, aporte{' '}
            <b className="text-primary">{money(p.ritmoNecessario)}/mês</b>
            {p.mesesRestantes ? ` (${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês' : 'meses'}).` : '.'}
          </p>
        </Card>
      )}

      <Button className="w-full mb-4" size="lg" onClick={() => setAporte(true)}><Plus className="h-4 w-4" /> Registrar aporte</Button>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Histórico de aportes</h2>
      {p.aportes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum aporte ainda.</p>
      ) : (
        <Card className="divide-y overflow-hidden">
          {p.aportes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3">
              <TrendingUp className="h-5 w-5 text-success shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{a.descricao}</p>
                <p className="text-xs text-muted-foreground">{dataCurta(a.data)}</p>
              </div>
              <span className="font-semibold tabular-nums text-success">{money(a.valor)}</span>
            </div>
          ))}
        </Card>
      )}

      {aporte && <AporteDialog metaId={meta.id} metaNome={meta.nome} onClose={() => setAporte(false)} />}
    </div>
  )
}

function AporteDialog({ metaId, metaNome, onClose }: { metaId: string; metaNome: string; onClose: () => void }) {
  const { dados } = useDados()
  const salvar = useSalvarLancamento()
  const catInvest = dados.categorias.find((c) => c.tipo_reserva === 'investimento')
  const [valor, setValor] = useState(0)
  const [contaId, setContaId] = useState(dados.contas.find((c) => c.tipo === 'dinheiro')?.id ?? dados.contas[0]?.id ?? '')

  async function onSave() {
    if (valor <= 0) return
    await salvar.mutateAsync({
      descricao: `Aporte — ${metaNome}`,
      valor,
      data: iso(new Date()),
      tipo: 'investimento',
      conta_id: contaId || null,
      categoria_id: catInvest?.id ?? null,
      meta_id: metaId,
      pago: true,
      frequencia: 'mensal',
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar aporte</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Valor</Label><MoneyInput value={valor} onChange={setValor} autoFocus /></div>
          <div className="space-y-1.5">
            <Label>De qual conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{dados.contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={onSave} disabled={salvar.isPending || valor <= 0}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Aportar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
