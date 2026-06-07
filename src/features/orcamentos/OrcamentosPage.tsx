import { useMemo, useState } from 'react'
import { Plus, AlertTriangle, Pencil, Loader2, Wallet } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useApp } from '@/contexts/AppContext'
import { useSalvarOrcamento, useSalvarCategoria, useSalvarRenda } from '@/hooks/useMutations'
import { envelope, orcamentoEfetivo, orcamentoRow, rendaEfetiva } from '@/lib/calc'
import { money, pct, mesExtenso } from '@/lib/format'
import type { Categoria } from '@/types/db'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { corEstado } from '@/components/EnvelopeCard'
import { Carregando, SecaoTitulo } from '@/components/Estados'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MoneyInput } from '@/components/MoneyInput'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const GRUPOS: { tipo: string; titulo: string }[] = [
  { tipo: 'gasto', titulo: 'Gastos do dia a dia' },
  { tipo: 'mesada', titulo: 'Mesadas' },
  { tipo: 'investimento', titulo: 'Investimento' },
  { tipo: 'imposto', titulo: 'Impostos' },
]

export function OrcamentosPage() {
  const { mesRef, salarioBase } = useApp()
  const { dados, isLoading } = useDados()
  const [editar, setEditar] = useState<Categoria | null>(null)
  const [novaCat, setNovaCat] = useState(false)
  const [editarRenda, setEditarRenda] = useState(false)

  const renda = useMemo(() => rendaEfetiva(dados.rendas, mesRef, salarioBase), [dados.rendas, mesRef, salarioBase])
  const somaOrcada = useMemo(
    () => dados.categorias.reduce((s, c) => s + orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda), 0),
    [dados, mesRef, renda]
  )

  if (isLoading) return <Carregando />

  const estourouRenda = somaOrcada > renda

  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Envelopes</h1>
        <MonthSelector />
      </header>

      <Card className="p-4 mb-4">
        <button onClick={() => setEditarRenda(true)} className="flex w-full items-center justify-between group">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-primary">
            <Wallet className="h-4 w-4" /> Renda prevista <Pencil className="h-3 w-3" />
          </span>
          <span className="font-bold">{money(renda)}</span>
        </button>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total orçado</span>
          <span className="font-bold">{money(somaOrcada)}</span>
        </div>
        <Progress value={(somaOrcada / Math.max(renda, 1)) * 100} className="my-2" indicatorClassName={estourouRenda ? 'bg-destructive' : 'bg-primary'} />
        <div className="flex items-center justify-end text-xs text-muted-foreground">
          {estourouRenda ? (
            <span className="flex items-center gap-1 text-destructive font-medium"><AlertTriangle className="h-3 w-3" /> {money(somaOrcada - renda)} acima da renda</span>
          ) : (
            <span>Sobra {money(renda - somaOrcada)}</span>
          )}
        </div>
      </Card>

      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={() => setNovaCat(true)}><Plus className="h-4 w-4" /> Nova categoria</Button>
      </div>

      {GRUPOS.map(({ tipo, titulo }) => {
        const cats = dados.categorias.filter((c) => c.ativo && c.tipo_reserva === tipo)
        if (cats.length === 0) return null
        return (
          <div key={tipo}>
            <SecaoTitulo>{titulo}</SecaoTitulo>
            <div className="space-y-2">
              {cats.map((c) => {
                const env = envelope(c, dados, mesRef)
                const cor = corEstado(env.estado)
                const row = orcamentoRow(dados.orcamentos, c.id, mesRef)
                const ehPct = row?.tipo_valor === 'percentual'
                return (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <CategoriaIcon icone={c.icone} cor={c.cor} className="h-9 w-9" size={18} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{c.nome}</span>
                          <button onClick={() => setEditar(c)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {money(env.gasto)} de {money(env.estabelecido)}
                          {env.estabelecido > 0 && <> · {pct(env.pct)}</>}
                        </p>
                      </div>
                    </div>
                    <Progress value={env.pct * 100} className="mt-2" indicatorClassName={cor.barra} />
                    <div className="mt-1 flex justify-between text-xs">
                      {env.estado === 'sem_orcamento' ? (
                        <span className="text-muted-foreground">Sem envelope definido</span>
                      ) : env.estourou ? (
                        <span className="text-destructive font-medium">Estourou {money(env.estourouValor)}</span>
                      ) : (
                        <span className={cor.texto}>Restam {money(env.resta)}</span>
                      )}
                      {ehPct ? (
                        <Badge variant="default">{Number(row?.percentual)}% da renda</Badge>
                      ) : (
                        <Badge variant="muted">{c.grupo}</Badge>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="h-4" />
      {editar && <EditarOrcamentoDialog categoria={editar} onClose={() => setEditar(null)} />}
      {novaCat && <NovaCategoriaDialog onClose={() => setNovaCat(false)} />}
      {editarRenda && <RendaDialog onClose={() => setEditarRenda(false)} />}
    </div>
  )
}

function RendaDialog({ onClose }: { onClose: () => void }) {
  const { mesRef, salarioBase } = useApp()
  const { dados } = useDados()
  const salvar = useSalvarRenda()
  const existente = dados.rendas.find((r) => r.mes_referencia === mesRef)
  const [valor, setValor] = useState(rendaEfetiva(dados.rendas, mesRef, salarioBase))
  const [recorrente, setRecorrente] = useState(existente?.recorrente ?? true)

  async function onSave() {
    await salvar.mutateAsync({ mes_referencia: mesRef, valor, recorrente })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Renda prevista — {mesExtenso(mesRef)}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Quanto você prevê ganhar neste mês</Label>
            <MoneyInput value={valor} onChange={setValor} autoFocus />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label className="text-foreground">Repetir como padrão</Label>
              <p className="text-xs text-muted-foreground">Vale para os próximos meses até você mudar.</p>
            </div>
            <Switch checked={recorrente} onCheckedChange={setRecorrente} />
          </div>
          <Button className="w-full" onClick={onSave} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar renda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditarOrcamentoDialog({ categoria, onClose }: { categoria: Categoria; onClose: () => void }) {
  const { mesRef, salarioBase } = useApp()
  const { dados } = useDados()
  const salvar = useSalvarOrcamento()
  const renda = rendaEfetiva(dados.rendas, mesRef, salarioBase)
  const row = orcamentoRow(dados.orcamentos, categoria.id, mesRef)
  const existente = dados.orcamentos.find((o) => o.categoria_id === categoria.id && o.mes_referencia === mesRef)
  const [modo, setModo] = useState<'fixo' | 'percentual'>(row?.tipo_valor === 'percentual' ? 'percentual' : 'fixo')
  const [valor, setValor] = useState(row?.tipo_valor === 'percentual' ? 0 : Number(row?.valor_estabelecido ?? 0))
  const [percentual, setPercentual] = useState(Number(row?.percentual ?? 10))
  const [recorrente, setRecorrente] = useState(existente?.recorrente ?? true)
  const valorPct = Math.round((percentual / 100) * renda * 100) / 100

  async function onSave() {
    await salvar.mutateAsync({
      categoria_id: categoria.id,
      mes_referencia: mesRef,
      valor_estabelecido: modo === 'fixo' ? valor : valorPct,
      tipo_valor: modo,
      percentual: modo === 'percentual' ? percentual : null,
      recorrente,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CategoriaIcon icone={categoria.icone} cor={categoria.cor} className="h-8 w-8" size={16} /> {categoria.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <ModoBtn ativo={modo === 'fixo'} onClick={() => setModo('fixo')}>Valor fixo</ModoBtn>
            <ModoBtn ativo={modo === 'percentual'} onClick={() => setModo('percentual')}>% da renda</ModoBtn>
          </div>

          {modo === 'fixo' ? (
            <div className="space-y-1.5">
              <Label>Valor do envelope (este mês)</Label>
              <MoneyInput value={valor} onChange={setValor} autoFocus />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Percentual da renda prevista</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={percentual}
                  onChange={(e) => setPercentual(Math.max(0, Math.min(100, +e.target.value)))}
                  className="pr-8 text-lg font-semibold"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                = <b className="text-foreground">{money(valorPct)}</b> ({percentual}% de {money(renda)})
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label className="text-foreground">Repete todo mês</Label>
            <Switch checked={recorrente} onCheckedChange={setRecorrente} />
          </div>
          <Button className="w-full" onClick={onSave} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModoBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        ativo ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
      )}
    >
      {children}
    </button>
  )
}

const ICONES = ['shopping-cart', 'shirt', 'home', 'heart-pulse', 'graduation-cap', 'repeat', 'paw-print', 'party-popper', 'sparkles', 'wallet', 'trending-up', 'piggy-bank', 'landmark', 'credit-card', 'car', 'plane', 'gift', 'coffee']
const CORES = ['#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#3b82f6', '#f472b6']

function NovaCategoriaDialog({ onClose }: { onClose: () => void }) {
  const salvar = useSalvarCategoria()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('gasto')
  const [tipoReserva, setTipoReserva] = useState('gasto')
  const [cor, setCor] = useState(CORES[0])
  const [icone, setIcone] = useState(ICONES[0])

  async function onSave() {
    if (!nome.trim()) return
    await salvar.mutateAsync({ nome: nome.trim(), grupo, tipo_reserva: tipoReserva as any, cor, icone, ativo: true })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Viagem" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipoReserva} onValueChange={(v) => { setTipoReserva(v); setGrupo(v === 'gasto' ? 'gasto' : v) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gasto">Gasto</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
                <SelectItem value="imposto">Imposto</SelectItem>
                <SelectItem value="mesada">Mesada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button key={c} onClick={() => setCor(c)} className="h-7 w-7 rounded-full ring-offset-2 ring-offset-background" style={{ backgroundColor: c, outline: cor === c ? `2px solid ${c}` : 'none' }} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {ICONES.map((i) => (
                <button key={i} onClick={() => setIcone(i)}>
                  <CategoriaIcon icone={i} cor={cor} className={'h-9 w-9 ' + (icone === i ? 'ring-2 ring-primary' : '')} size={18} />
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={onSave} disabled={salvar.isPending || !nome.trim()}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Criar categoria
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
