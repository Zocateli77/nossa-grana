import { useMemo, useState } from 'react'
import { Archive, CheckCircle2, Gift, Loader2, MoreHorizontal, Pencil, Plus, ShoppingBag } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useDados } from '@/hooks/useDados'
import { useConfirmarCompraDesejo, useSalvarDesejo } from '@/hooks/useMutations'
import { resumoDesejos, viabilidadeDesejo } from '@/lib/calc'
import { iso, mesAtualRef } from '@/lib/dates'
import { money, mesCurto } from '@/lib/format'
import type { Desejo, PrioridadeDesejo, StatusDesejo } from '@/types/db'
import { Carregando, SecaoTitulo, Vazio } from '@/components/Estados'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { AIQuickLink } from '@/components/AIQuickLink'
import { MoneyInput } from '@/components/MoneyInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const COLUNAS: { status: StatusDesejo; titulo: string }[] = [
  { status: 'desejo', titulo: 'Desejos' },
  { status: 'avaliando', titulo: 'Avaliando' },
  { status: 'planejado', titulo: 'Planejado' },
  { status: 'pronto', titulo: 'Pronto pra comprar' },
]

const STATUS_LABEL: Record<StatusDesejo, string> = {
  desejo: 'Desejos',
  avaliando: 'Avaliando',
  planejado: 'Planejado',
  pronto: 'Pronto pra comprar',
  comprado: 'Comprado',
  arquivado: 'Arquivado',
}

const PRIORIDADES: { value: PrioridadeDesejo; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

export function DesejosPage() {
  const { salarioBase } = useApp()
  const { dados, isLoading } = useDados()
  const salvar = useSalvarDesejo()
  const [editando, setEditando] = useState<Desejo | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [confirmando, setConfirmando] = useState<Desejo | null>(null)

  const desejosAtivos = useMemo(
    () => dados.desejos.filter((d) => d.status !== 'comprado' && d.status !== 'arquivado'),
    [dados.desejos]
  )
  const historico = useMemo(
    () => dados.desejos.filter((d) => d.status === 'comprado' || d.status === 'arquivado').slice(0, 8),
    [dados.desejos]
  )

  if (isLoading) return <Carregando />

  const resumo = resumoDesejos(dados.desejos, dados, salarioBase)

  async function mover(desejo: Desejo, status: StatusDesejo) {
    await salvar.mutateAsync({ id: desejo.id, status })
  }

  return (
    <div>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Compras planejadas</p>
          <h1 className="text-xl font-extrabold tracking-tight">Desejos</h1>
        </div>
        <div className="flex items-center gap-2">
          <AIQuickLink prompt="Olhe meus desejos e diga o que cabe agora, o que deve esperar e onde ajustar envelopes." label="IA" />
          <Button size="sm" onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <ResumoCard titulo="Simulado" valor={money(resumo.totalMensalSimulado)} />
        <ResumoCard titulo="Prontos" valor={String(resumo.prontos)} cor="text-success" />
        <ResumoCard titulo="Bloqueados" valor={String(resumo.bloqueados)} cor="text-destructive" />
      </div>

      {desejosAtivos.length === 0 ? (
        <Vazio icon={Gift} titulo="Nenhum desejo ainda" descricao="Cadastre uma compra para simular se ela cabe no mes." acao={<Button onClick={() => setNovoAberto(true)}>Criar desejo</Button>} />
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {COLUNAS.map((col) => {
            const itens = desejosAtivos.filter((d) => d.status === col.status)
            return (
              <section key={col.status} className="w-[19rem] shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{col.titulo}</h2>
                  <Badge variant="muted">{itens.length}</Badge>
                </div>
                <div className="space-y-3">
                  {itens.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sem itens</div>
                  ) : (
                    itens.map((d) => (
                      <DesejoCard
                        key={d.id}
                        desejo={d}
                        dados={dados}
                        salarioBase={salarioBase}
                        onEditar={() => setEditando(d)}
                        onMover={(status) => mover(d, status)}
                        onConfirmar={() => setConfirmando(d)}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {historico.length > 0 && (
        <>
          <SecaoTitulo>Histórico</SecaoTitulo>
          <Card className="divide-y">
            {historico.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                  {d.status === 'comprado' ? <ShoppingBag className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(d.valor_total)}
                    {d.comprado_em ? ` · comprado em ${new Date(d.comprado_em).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
                <Badge variant={d.status === 'comprado' ? 'success' : 'muted'}>{STATUS_LABEL[d.status]}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}

      {(novoAberto || editando) && (
        <DesejoDialog
          desejo={editando}
          dados={dados}
          onClose={() => {
            setNovoAberto(false)
            setEditando(null)
          }}
        />
      )}

      {confirmando && (
        <ConfirmarCompraDialog
          desejo={confirmando}
          dados={dados}
          onClose={() => setConfirmando(null)}
        />
      )}

      <div className="h-4" />
    </div>
  )
}

function ResumoCard({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn('mt-1 text-base font-bold tabular-nums', cor)}>{valor}</p>
    </Card>
  )
}

function DesejoCard({
  desejo,
  dados,
  salarioBase,
  onEditar,
  onMover,
  onConfirmar,
}: {
  desejo: Desejo
  dados: ReturnType<typeof useDados>['dados']
  salarioBase: number
  onEditar: () => void
  onMover: (status: StatusDesejo) => void
  onConfirmar: () => void
}) {
  const v = viabilidadeDesejo(desejo, dados, salarioBase)
  const categoria = desejo.categoria_id ? dados.categorias.find((c) => c.id === desejo.categoria_id) : undefined
  const corBorda = v.estado === 'verde' ? 'border-success/50' : v.estado === 'vermelho' ? 'border-destructive/50' : ''
  const variant = v.estado === 'verde' ? 'success' : v.estado === 'vermelho' ? 'destructive' : 'muted'

  return (
    <Card className={cn('p-4', corBorda)}>
      <div className="flex items-start gap-3">
        <CategoriaIcon icone={categoria?.icone ?? 'gift'} cor={categoria?.cor} className="h-9 w-9" size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{desejo.nome}</p>
            <Badge variant={variant}>{v.estado === 'verde' ? 'Cabe' : v.estado === 'vermelho' ? 'Não cabe' : 'Simular'}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{v.motivo}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted p-2">
          <span className="text-muted-foreground">Mensal</span>
          <p className="font-bold">{money(v.custoMensal)}</p>
        </div>
        <div className="rounded-xl bg-muted p-2">
          <span className="text-muted-foreground">Total</span>
          <p className="font-bold">{money(desejo.valor_total)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {desejo.parcela_total > 1 && <Badge variant="muted">{desejo.parcela_total}x</Badge>}
        {desejo.mes_inicio && <Badge variant="muted">{mesCurto(desejo.mes_inicio)}</Badge>}
        {categoria && <Badge variant="muted">{categoria.nome}</Badge>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEditar}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        <Select value={desejo.status} onValueChange={(s) => onMover(s as StatusDesejo)}>
          <SelectTrigger className="h-9 flex-1 rounded-lg text-xs">
            <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUNAS.map((c) => (
              <SelectItem key={c.status} value={c.status}>{c.titulo}</SelectItem>
            ))}
            <SelectItem value="arquivado">Arquivar</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={v.estado === 'neutro'} onClick={onConfirmar} className="w-full">
          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar compra
        </Button>
      </div>
    </Card>
  )
}

function DesejoDialog({ desejo, dados, onClose }: { desejo: Desejo | null; dados: ReturnType<typeof useDados>['dados']; onClose: () => void }) {
  const salvar = useSalvarDesejo()
  const [nome, setNome] = useState(desejo?.nome ?? '')
  const [descricao, setDescricao] = useState(desejo?.descricao ?? '')
  const [valorTotal, setValorTotal] = useState(Number(desejo?.valor_total ?? 0))
  const [parcelas, setParcelas] = useState(Number(desejo?.parcela_total ?? 1))
  const [mes, setMes] = useState((desejo?.mes_inicio ?? mesAtualRef()).slice(0, 7))
  const [categoriaId, setCategoriaId] = useState(desejo?.categoria_id ?? 'nenhuma')
  const [contaId, setContaId] = useState(desejo?.conta_id ?? 'nenhuma')
  const [donoId, setDonoId] = useState(desejo?.dono_id ?? 'nenhum')
  const [status, setStatus] = useState<StatusDesejo>(desejo?.status ?? 'desejo')
  const [prioridade, setPrioridade] = useState<PrioridadeDesejo>(desejo?.prioridade ?? 'media')
  const [erro, setErro] = useState<string | null>(null)

  async function salvarTudo() {
    if (!nome.trim()) return setErro('Informe o nome do desejo.')
    await salvar.mutateAsync({
      id: desejo?.id,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      valor_total: valorTotal,
      parcela_total: Math.max(1, parcelas),
      mes_inicio: mes ? `${mes}-01` : null,
      categoria_id: categoriaId === 'nenhuma' ? null : categoriaId,
      conta_id: contaId === 'nenhuma' ? null : contaId,
      dono_id: donoId === 'nenhum' ? null : donoId,
      status,
      prioridade,
      lancamento_grupo_id: desejo?.lancamento_grupo_id ?? null,
      comprado_em: desejo?.comprado_em ?? null,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{desejo ? 'Editar desejo' : 'Novo desejo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: PlayStation 5" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Valor total</Label>
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={parcelas} onChange={(e) => setParcelas(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mês início</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Categoria" value={categoriaId} onChange={setCategoriaId} empty="nenhuma" emptyLabel="Sem categoria" items={dados.categorias.map((c) => ({ value: c.id, label: c.nome }))} />
            <SelectField label="Conta/cartao" value={contaId} onChange={setContaId} empty="nenhuma" emptyLabel="Sem conta" items={dados.contas.map((c) => ({ value: c.id, label: c.nome }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Pessoa" value={donoId} onChange={setDonoId} empty="nenhum" emptyLabel="Sem pessoa" items={dados.pessoas.map((p) => ({ value: p.id, label: p.nome }))} />
            <SelectField label="Status" value={status} onChange={(v) => setStatus(v as StatusDesejo)} items={[...COLUNAS.map((c) => ({ value: c.status, label: c.titulo })), { value: 'arquivado', label: 'Arquivado' }]} />
          </div>
          <SelectField label="Prioridade" value={prioridade} onChange={(v) => setPrioridade(v as PrioridadeDesejo)} items={PRIORIDADES} />
          <div className="space-y-1.5">
            <Label>Observacao</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button className="w-full" onClick={salvarTudo} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar desejo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmarCompraDialog({ desejo, dados, onClose }: { desejo: Desejo; dados: ReturnType<typeof useDados>['dados']; onClose: () => void }) {
  const confirmar = useConfirmarCompraDesejo()
  const [data, setData] = useState(desejo.mes_inicio ?? iso(new Date()))
  const [valorTotal, setValorTotal] = useState(Number(desejo.valor_total))
  const [parcelas, setParcelas] = useState(Number(desejo.parcela_total || 1))
  const [categoriaId, setCategoriaId] = useState(desejo.categoria_id ?? 'nenhuma')
  const [contaId, setContaId] = useState(desejo.conta_id ?? 'nenhuma')
  const [donoId, setDonoId] = useState(desejo.dono_id ?? 'nenhum')
  const [observacao, setObservacao] = useState(desejo.descricao ?? '')
  const [erro, setErro] = useState<string | null>(null)

  async function confirmarCompra() {
    if (valorTotal <= 0) return setErro('Informe o valor da compra.')
    if (categoriaId === 'nenhuma') return setErro('Escolha uma categoria.')
    await confirmar.mutateAsync({
      desejo,
      data,
      valor_total: valorTotal,
      parcela_total: Math.max(1, parcelas),
      categoria_id: categoriaId,
      conta_id: contaId === 'nenhuma' ? null : contaId,
      dono_id: donoId === 'nenhum' ? null : donoId,
      observacao: observacao.trim() || null,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmar compra</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{desejo.nome}</p>
          <div className="space-y-1.5">
            <Label>Data da compra</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor total</Label>
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={parcelas} onChange={(e) => setParcelas(Math.max(1, Number(e.target.value)))} />
            </div>
            <SelectField label="Categoria" value={categoriaId} onChange={setCategoriaId} empty="nenhuma" emptyLabel="Escolher" items={dados.categorias.map((c) => ({ value: c.id, label: c.nome }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Conta/cartao" value={contaId} onChange={setContaId} empty="nenhuma" emptyLabel="Sem conta" items={dados.contas.map((c) => ({ value: c.id, label: c.nome }))} />
            <SelectField label="Pessoa" value={donoId} onChange={setDonoId} empty="nenhum" emptyLabel="Sem pessoa" items={dados.pessoas.map((p) => ({ value: p.id, label: p.nome }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Observacao</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button className="w-full" onClick={confirmarCompra} disabled={confirmar.isPending}>
            {confirmar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            Criar lancamento e arquivar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SelectField({
  label,
  value,
  onChange,
  items,
  empty,
  emptyLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
  empty?: string
  emptyLabel?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {empty && <SelectItem value={empty}>{emptyLabel ?? empty}</SelectItem>}
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
