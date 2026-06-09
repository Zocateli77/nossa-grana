import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, MoreVertical, Pencil, Copy, Trash2, Lock, ReceiptText, Repeat, X, HandCoins, PencilLine } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useApp } from '@/contexts/AppContext'
import { useExcluirSerie, useSalvarLancamento, useQuitarDivida, type EscopoSerie } from '@/hooks/useMutations'
import { byId, lancsDoMes, ehParcelado, parcelasFaltam, statusPadrao } from '@/lib/calc'
import { iso } from '@/lib/dates'
import { money, dataCurta } from '@/lib/format'
import type { Lancamento, StatusLancamento, TipoLancamento } from '@/types/db'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { EscopoSerieDialog } from '@/components/EscopoSerieDialog'
import { Carregando, Vazio } from '@/components/Estados'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const TIPO_FILTROS: { v: 'todos' | TipoLancamento; label: string }[] = [
  { v: 'todos', label: 'Tudo' },
  { v: 'despesa', label: 'Despesas' },
  { v: 'investimento', label: 'Investim.' },
  { v: 'imposto', label: 'Impostos' },
  { v: 'emprestimo', label: 'Empréstimo' },
  { v: 'receita', label: 'Receitas' },
]

const STATUS: { v: StatusLancamento; label: string }[] = [
  { v: 'pago', label: 'Pago' },
  { v: 'previsto', label: 'Previsto' },
  { v: 'quitado', label: 'Quitado' },
]

export function LancamentosPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { mesRef } = useApp()
  const { dados, isLoading } = useDados()
  const excluir = useExcluirSerie()
  const salvar = useSalvarLancamento()
  const quitar = useQuitarDivida()

  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState<'todos' | TipoLancamento>('todos')
  const [fConta, setFConta] = useState('todas')
  const [fCategoria, setFCategoria] = useState(searchParams.get('categoria') ?? 'todas')
  const [fDono, setFDono] = useState('todos')
  const [todosMeses, setTodosMeses] = useState(false)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [acao, setAcao] = useState<Lancamento | null>(null)
  const [excluirSerieAlvo, setExcluirSerieAlvo] = useState<Lancamento | null>(null)

  // categoria vinda da URL (ao clicar num envelope)
  useEffect(() => {
    const cat = searchParams.get('categoria')
    if (cat) setFCategoria(cat)
  }, [searchParams])

  const contasMap = useMemo(() => byId(dados.contas), [dados.contas])
  const catMap = useMemo(() => byId(dados.categorias), [dados.categorias])
  const pessoasMap = useMemo(() => byId(dados.pessoas), [dados.pessoas])

  const lista = useMemo(() => {
    let arr = todosMeses ? dados.lancamentos : lancsDoMes(dados.lancamentos, mesRef)
    if (fTipo !== 'todos') arr = arr.filter((l) => l.tipo === fTipo)
    if (fConta !== 'todas') arr = arr.filter((l) => l.conta_id === fConta)
    if (fCategoria !== 'todas') arr = arr.filter((l) => l.categoria_id === fCategoria)
    if (fDono !== 'todos') arr = arr.filter((l) => l.dono_id === fDono)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      arr = arr.filter((l) => l.descricao.toLowerCase().includes(q) || (l.observacao ?? '').toLowerCase().includes(q))
    }
    return [...arr].sort((a, b) => (a.data === b.data ? (a.criado_em < b.criado_em ? 1 : -1) : a.data < b.data ? 1 : -1))
  }, [dados.lancamentos, mesRef, todosMeses, fTipo, fConta, fCategoria, fDono, busca])

  const total = lista.reduce((s, l) => s + Number(l.valor), 0)
  const categoriaFiltrada = fCategoria !== 'todas' ? catMap.get(fCategoria) : undefined

  function limparCategoria() {
    setFCategoria('todas')
    if (searchParams.get('categoria')) {
      searchParams.delete('categoria')
      setSearchParams(searchParams, { replace: true })
    }
  }

  async function duplicar(l: Lancamento) {
    const { id, criado_em, atualizado_em, ...resto } = l
    const hoje = iso(new Date())
    // duplicata é um lançamento avulso — não herda a série nem o parcelamento
    await salvar.mutateAsync({
      ...resto,
      data: hoje,
      status: statusPadrao(hoje, l.tipo),
      descricao: l.descricao,
      grupo_id: null,
      recorrente: false,
      parcela_atual: null,
      parcela_total: null,
      valor_total: null,
      data_primeira_parcela: null,
    })
    setAcao(null)
  }

  async function fazerQuitar(l: Lancamento) {
    await quitar.mutateAsync(l)
    setAcao(null)
  }

  async function fazerExcluir(l: Lancamento) {
    if (l.grupo_id) {
      setAcao(null)
      setExcluirSerieAlvo(l)
      return
    }
    await excluir.mutateAsync({ lancamento: l, escopo: 'uma' })
    setAcao(null)
  }

  async function aplicarExclusao(escopo: EscopoSerie) {
    if (!excluirSerieAlvo) return
    await excluir.mutateAsync({ lancamento: excluirSerieAlvo, escopo })
    setExcluirSerieAlvo(null)
  }

  if (isLoading) return <Carregando />

  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Extrato</h1>
        {!todosMeses && <MonthSelector />}
      </header>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="pl-9" />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setModoEdicao((v) => !v)}
          className={cn(modoEdicao && 'border-primary text-primary bg-primary/10')}
          title="Modo edição"
        >
          <PencilLine className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setMostrarFiltros((v) => !v)} className={cn(mostrarFiltros && 'border-primary text-primary')}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
        {TIPO_FILTROS.map((t) => (
          <button
            key={t.v}
            onClick={() => setFTipo(t.v)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
              fTipo === t.v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mostrarFiltros && (
        <div className="grid grid-cols-2 gap-2 mb-3 rounded-2xl border p-3">
          <Select value={fConta} onValueChange={setFConta}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {dados.contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {dados.categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fDono} onValueChange={setFDono}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas pessoas</SelectItem>
              {dados.pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={todosMeses ? 'default' : 'outline'} onClick={() => setTodosMeses((v) => !v)}>
            {todosMeses ? 'Todos os meses' : 'Só este mês'}
          </Button>
        </div>
      )}

      {/* chip de categoria ativa (vindo do envelope) */}
      {categoriaFiltrada && (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">
            <CategoriaIcon icone={categoriaFiltrada.icone} cor={categoriaFiltrada.cor} className="h-5 w-5" size={12} />
            {categoriaFiltrada.nome}
            <button onClick={limparCategoria} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-2">
        <span>{lista.length} lançamento{lista.length !== 1 ? 's' : ''}{modoEdicao && ' · modo edição'}</span>
        <span>Total: <b className="text-foreground">{money(total)}</b></span>
      </div>

      {lista.length === 0 ? (
        <Vazio icon={ReceiptText} titulo="Nada por aqui" descricao="Nenhum lançamento com esses filtros." acao={<Button onClick={() => navigate('/lancamentos/novo')}>Lançar agora</Button>} />
      ) : (
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {lista.map((l) => {
            const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
            const conta = l.conta_id ? contasMap.get(l.conta_id) : undefined
            const dono = l.dono_id ? pessoasMap.get(l.dono_id) : undefined

            if (modoEdicao) {
              return (
                <div key={l.id} className="flex items-center gap-3 p-3">
                  <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9 shrink-0" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{l.privado ? 'Gasto livre' : l.descricao}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <select
                        className="h-8 rounded-lg border bg-card px-2 text-xs max-w-[150px]"
                        value={l.categoria_id ?? ''}
                        onChange={(e) => salvar.mutate({ id: l.id, categoria_id: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <select
                        className="h-8 rounded-lg border bg-card px-2 text-xs"
                        value={l.status ?? 'pago'}
                        onChange={(e) => salvar.mutate({ id: l.id, status: e.target.value as StatusLancamento })}
                      >
                        {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{money(l.valor)}</span>
                </div>
              )
            }

            return (
              <button key={l.id} onClick={() => setAcao(l)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/40 transition-colors">
                <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-10 w-10" size={18} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-medium truncate', l.status === 'quitado' && 'line-through text-muted-foreground')}>
                      {l.privado ? 'Gasto livre' : l.descricao}
                    </span>
                    {l.privado && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    {l.recorrente && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                    {l.status === 'previsto' && <Badge variant="muted" className="shrink-0">previsto</Badge>}
                    {l.status === 'quitado' && <Badge variant="success" className="shrink-0">quitado</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{dataCurta(l.data)}</span>
                    {conta && <>· <span className="truncate">{conta.nome}</span></>}
                    {dono && dono.nome !== 'Compartilhado' && <>· <span>{dono.nome}</span></>}
                    {l.parcela_total && l.parcela_total > 1 && (
                      <Badge variant="muted" className="ml-0.5">{l.parcela_atual}/{l.parcela_total}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('font-semibold tabular-nums', l.tipo === 'receita' ? 'text-success' : l.tipo === 'investimento' ? 'text-primary' : '')}>
                    {money(l.valor)}
                  </span>
                  <MoreVertical className="inline-block h-4 w-4 text-muted-foreground ml-1 align-middle" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sheet de ações */}
      <Sheet open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {acao && (
            <>
              <SheetHeader>
                <SheetTitle>{acao.privado ? 'Gasto livre' : acao.descricao}</SheetTitle>
              </SheetHeader>
              <p className="text-sm text-muted-foreground mb-3">{money(acao.valor)} · {dataCurta(acao.data)}</p>
              <div className="flex flex-col gap-1 pb-2">
                <SheetClose asChild>
                  <Button variant="ghost" className="justify-start gap-3" onClick={() => navigate(`/lancamentos/${acao.id}/editar`)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                </SheetClose>
                {ehParcelado(acao) && acao.status !== 'quitado' && parcelasFaltam(acao) > 0 && (
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 text-primary hover:text-primary"
                    disabled={quitar.isPending}
                    onClick={() => fazerQuitar(acao)}
                  >
                    <HandCoins className="h-4 w-4" /> Quitar/Adiantar · paga {money(parcelasFaltam(acao) * Number(acao.valor))}
                  </Button>
                )}
                <Button variant="ghost" className="justify-start gap-3" onClick={() => duplicar(acao)}>
                  <Copy className="h-4 w-4" /> Duplicar (hoje)
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-3 text-destructive hover:text-destructive"
                  onClick={() => fazerExcluir(acao)}
                >
                  <Trash2 className="h-4 w-4" /> {acao.grupo_id ? 'Excluir…' : 'Excluir'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EscopoSerieDialog
        open={!!excluirSerieAlvo}
        onClose={() => setExcluirSerieAlvo(null)}
        onEscolher={aplicarExclusao}
        titulo="Excluir lançamento da série"
        descricao="Este lançamento se repete em outros meses. O que você quer excluir?"
        destrutivo
      />
    </div>
  )
}
