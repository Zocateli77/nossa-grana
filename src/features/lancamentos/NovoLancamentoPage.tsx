import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Check, Repeat, CreditCard } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useSalvarLancamentosEmMassa, useEditarSerie, type EscopoSerie } from '@/hooks/useMutations'
import { useApp } from '@/contexts/AppContext'
import type { NovoLancamento, TipoLancamento } from '@/types/db'
import { iso, parseISO, addMonths, mesRefDe } from '@/lib/dates'
import { expandirSerie, type BaseSerie } from '@/lib/calc'
import { EscopoSerieDialog } from '@/components/EscopoSerieDialog'
import { money } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoneyInput } from '@/components/MoneyInput'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Carregando } from '@/components/Estados'
import { cn } from '@/lib/utils'

const TIPOS: { v: TipoLancamento; label: string }[] = [
  { v: 'despesa', label: 'Despesa' },
  { v: 'investimento', label: 'Investimento' },
  { v: 'imposto', label: 'Imposto' },
  { v: 'emprestimo', label: 'Empréstimo' },
  { v: 'receita', label: 'Receita' },
]

const LS = { conta: 'ultimaConta', categoria: 'ultimaCategoria', dono: 'ultimoDono' }

export function NovoLancamentoPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editando = Boolean(id)
  const { dados, isLoading } = useDados()
  const salvarEmMassa = useSalvarLancamentosEmMassa()
  const editarSerie = useEditarSerie()
  const { setMesRef } = useApp()
  const [pedirEscopo, setPedirEscopo] = useState(false)

  const [tipo, setTipo] = useState<TipoLancamento>('despesa')
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [contaId, setContaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [donoId, setDonoId] = useState('')
  const [data, setData] = useState(iso(new Date()))
  const [metaId, setMetaId] = useState('')
  const [observacao, setObservacao] = useState('')
  // parcelamento
  const [parcelado, setParcelado] = useState(false)
  const [modo, setModo] = useState<'A' | 'B'>('A')
  const [parcelaAtual, setParcelaAtual] = useState(1)
  const [parcelaTotal, setParcelaTotal] = useState(2)
  const [valorTotal, setValorTotal] = useState(0)
  // recorrência
  const [recorrente, setRecorrente] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregouEdicao, setCarregouEdicao] = useState(false)

  // pré-carrega últimos usados (novo lançamento)
  useEffect(() => {
    if (editando || isLoading) return
    setContaId((c) => c || localStorage.getItem(LS.conta) || dados.contas[0]?.id || '')
    setDonoId((d) => d || localStorage.getItem(LS.dono) || dados.pessoas.find((p) => p.nome === 'Compartilhado')?.id || '')
  }, [isLoading, editando, dados])

  // carrega lançamento em edição
  useEffect(() => {
    if (!editando || carregouEdicao || isLoading) return
    const l = dados.lancamentos.find((x) => x.id === id)
    if (!l) return
    setTipo(l.tipo)
    setValor(Number(l.valor))
    setDescricao(l.descricao)
    setContaId(l.conta_id ?? '')
    setCategoriaId(l.categoria_id ?? '')
    setDonoId(l.dono_id ?? '')
    setData(l.data)
    setMetaId(l.meta_id ?? '')
    setObservacao(l.observacao ?? '')
    setRecorrente(l.recorrente)
    if (l.parcela_total && l.parcela_total > 1) {
      setParcelado(true)
      setParcelaAtual(l.parcela_atual ?? 1)
      setParcelaTotal(l.parcela_total)
    }
    setCarregouEdicao(true)
  }, [editando, isLoading, dados, id, carregouEdicao])

  const categoriasFiltradas = useMemo(() => {
    const ativas = dados.categorias.filter((c) => c.ativo)
    if (tipo === 'despesa') return ativas.filter((c) => c.tipo_reserva === 'gasto' || c.tipo_reserva === 'mesada')
    if (tipo === 'investimento') return ativas.filter((c) => c.tipo_reserva === 'investimento')
    if (tipo === 'imposto') return ativas.filter((c) => c.tipo_reserva === 'imposto')
    if (tipo === 'emprestimo') return ativas.filter((c) => c.grupo === 'divida')
    return ativas
  }, [dados.categorias, tipo])

  const categoriaSel = dados.categorias.find((c) => c.id === categoriaId)
  const ehMesada = categoriaSel?.tipo_reserva === 'mesada'

  // quando muda categoria de mesada, herda o dono e marca privado
  useEffect(() => {
    if (ehMesada && categoriaSel?.dono_id) setDonoId(categoriaSel.dono_id)
  }, [ehMesada, categoriaSel])

  const parcelaCalculada = modo === 'B' && parcelaTotal > 0 ? Math.round((valorTotal / parcelaTotal) * 100) / 100 : valor

  const original = editando ? dados.lancamentos.find((x) => x.id === id) : undefined
  const ehSerie = Boolean(original?.grupo_id)

  if (isLoading) return <Carregando />

  function montarBase(): BaseSerie {
    const valorFinal = parcelado && modo === 'B' ? parcelaCalculada : valor
    const baseMes = parcelado ? iso(addMonths(parseISO(data), -(parcelaAtual - 1))) : null
    return {
      descricao: descricao.trim() || (ehMesada ? 'Gasto livre' : 'Lançamento'),
      valor: valorFinal,
      data,
      tipo,
      conta_id: contaId || null,
      categoria_id: categoriaId || null,
      dono_id: donoId || null,
      meta_id: tipo === 'investimento' && metaId ? metaId : null,
      parcela_atual: parcelado ? parcelaAtual : null,
      parcela_total: parcelado ? parcelaTotal : null,
      valor_total: parcelado ? (modo === 'B' ? valorTotal : Math.round(valorFinal * parcelaTotal * 100) / 100) : null,
      data_primeira_parcela: baseMes,
      recorrente,
      frequencia: 'mensal',
      privado: ehMesada,
      observacao: observacao.trim() || null,
    }
  }

  /** Campos editáveis aplicados numa edição. `incluirData` só faz sentido p/ "só esta". */
  function patchEdicao(incluirData: boolean): Partial<NovoLancamento> {
    const valorFinal = parcelado && modo === 'B' ? parcelaCalculada : valor
    const p: Partial<NovoLancamento> = {
      descricao: descricao.trim() || (ehMesada ? 'Gasto livre' : 'Lançamento'),
      valor: valorFinal,
      tipo,
      conta_id: contaId || null,
      categoria_id: categoriaId || null,
      dono_id: donoId || null,
      meta_id: tipo === 'investimento' && metaId ? metaId : null,
      privado: ehMesada,
      observacao: observacao.trim() || null,
    }
    if (incluirData) p.data = data
    return p
  }

  function validar(): string | null {
    const valorFinal = parcelado && modo === 'B' ? parcelaCalculada : valor
    if (!valorFinal || valorFinal <= 0) return 'Informe um valor.'
    if (!ehMesada && tipo !== 'receita' && !descricao.trim()) return 'Descreva o lançamento.'
    if (tipo !== 'receita' && !categoriaId) return 'Escolha uma categoria.'
    return null
  }

  function finalizar(eContinuar: boolean) {
    if (contaId) localStorage.setItem(LS.conta, contaId)
    if (categoriaId) localStorage.setItem(LS.categoria, categoriaId)
    if (donoId) localStorage.setItem(LS.dono, donoId)
    setMesRef(mesRefDe(data))
    if (eContinuar) {
      setValor(0); setDescricao(''); setValorTotal(0); setParcelado(false); setRecorrente(false); setObservacao('')
      setErro(null)
    } else {
      navigate('/lancamentos')
    }
  }

  async function onSalvar(eContinuar = false) {
    setErro(null)
    const v = validar()
    if (v) return setErro(v)

    // Edição de um item que faz parte de uma série → pergunta o escopo antes
    if (editando && ehSerie) {
      setPedirEscopo(true)
      return
    }

    setSalvando(true)
    try {
      if (editando && original) {
        await editarSerie.mutateAsync({ lancamento: original, escopo: 'uma', patch: patchEdicao(true) })
      } else {
        const rows = expandirSerie(montarBase(), crypto.randomUUID())
        await salvarEmMassa.mutateAsync(rows)
      }
      finalizar(eContinuar)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function aplicarEscopo(escopo: EscopoSerie) {
    if (!original) return
    setPedirEscopo(false)
    setSalvando(true)
    try {
      await editarSerie.mutateAsync({ lancamento: original, escopo, patch: patchEdicao(escopo === 'uma') })
      finalizar(false)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <header className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-extrabold tracking-tight">{editando ? 'Editar lançamento' : 'Novo lançamento'}</h1>
      </header>

      <div className="space-y-5">
        {/* Tipo */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {TIPOS.map((t) => (
            <button
              key={t.v}
              onClick={() => { setTipo(t.v); setCategoriaId('') }}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tipo === t.v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Valor */}
        {!(parcelado && modo === 'B') && (
          <div className="space-y-1.5">
            <Label>{parcelado ? 'Valor da parcela' : 'Valor'}</Label>
            <MoneyInput value={valor} onChange={setValor} autoFocus={!editando} />
          </div>
        )}

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label>Descrição {ehMesada && <span className="text-muted-foreground">(opcional)</span>}</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={ehMesada ? 'Gasto livre' : 'Ex: Mercado da semana'} />
        </div>

        {/* Conta + Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Conta / Cartão</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>
                {dados.contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" />{c.nome}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>
                {categoriasFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor ?? '#999' }} />
                      {c.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pessoa + Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Pessoa</Label>
            <Select value={donoId} onValueChange={setDonoId} disabled={ehMesada}>
              <SelectTrigger><SelectValue placeholder="Quem?" /></SelectTrigger>
              <SelectContent>
                {dados.pessoas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        {/* Meta (só investimento) */}
        {tipo === 'investimento' && dados.metas.length > 0 && (
          <div className="space-y-1.5">
            <Label>Meta vinculada (opcional)</Label>
            <Select value={metaId || 'nenhuma'} onValueChange={(v) => setMetaId(v === 'nenhuma' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem meta</SelectItem>
                {dados.metas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Parcelado */}
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-foreground"><CreditCard className="h-4 w-4" /> Parcelado?</Label>
            <Switch checked={parcelado} onCheckedChange={setParcelado} />
          </div>
          {parcelado && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <ModoBtn ativo={modo === 'A'} onClick={() => setModo('A')}>Sei o valor da parcela</ModoBtn>
                <ModoBtn ativo={modo === 'B'} onClick={() => setModo('B')}>Tenho o total</ModoBtn>
              </div>
              {modo === 'B' && (
                <div className="space-y-1.5">
                  <Label>Valor total</Label>
                  <MoneyInput value={valorTotal} onChange={setValorTotal} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Parcela atual</Label>
                  <Input type="number" min={1} value={parcelaAtual} onChange={(e) => setParcelaAtual(Math.max(1, +e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>De (total)</Label>
                  <Input type="number" min={1} value={parcelaTotal} onChange={(e) => setParcelaTotal(Math.max(1, +e.target.value))} />
                </div>
              </div>
              {modo === 'B' && (
                <p className="text-sm text-muted-foreground">≈ <b className="text-foreground">{money(parcelaCalculada)}</b> por parcela</p>
              )}
            </div>
          )}
        </div>

        {/* Recorrente */}
        <div className="flex items-center justify-between rounded-2xl border p-4">
          <Label className="flex items-center gap-2 text-foreground"><Repeat className="h-4 w-4" /> Repete todo mês?</Label>
          <Switch checked={recorrente} onCheckedChange={setRecorrente} />
        </div>

        {/* Observação */}
        <div className="space-y-1.5">
          <Label>Observação (opcional)</Label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex flex-col gap-2 sticky bottom-20 md:bottom-4">
          <Button size="lg" onClick={() => onSalvar(false)} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {editando ? 'Salvar alterações' : 'Salvar'}
          </Button>
          {!editando && (
            <Button size="lg" variant="outline" onClick={() => onSalvar(true)} disabled={salvando}>
              Salvar e lançar outro
            </Button>
          )}
        </div>
      </div>

      <EscopoSerieDialog
        open={pedirEscopo}
        onClose={() => setPedirEscopo(false)}
        onEscolher={aplicarEscopo}
        titulo="Editar lançamento da série"
        descricao="Este lançamento se repete em outros meses. Onde aplicar as alterações?"
      />
    </div>
  )
}

function ModoBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
        ativo ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
      )}
    >
      {children}
    </button>
  )
}
