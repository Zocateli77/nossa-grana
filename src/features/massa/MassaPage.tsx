import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ClipboardPaste, Check, Loader2, Maximize2, Minimize2, FilePlus2 } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useSalvarLancamentosEmMassa } from '@/hooks/useMutations'
import { expandirSerie, type BaseSerie } from '@/lib/calc'
import type { TipoLancamento } from '@/types/db'
import { iso, parseISO, addMonths } from '@/lib/dates'
import { Carregando } from '@/components/Estados'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Linha {
  descricao: string
  valor: string
  contaId: string
  categoriaId: string
  donoId: string
  metaId: string
  data: string
  parcela: string
  tipo: TipoLancamento
  obs: string
}

const linhaVazia = (data: string): Linha => ({ descricao: '', valor: '', contaId: '', categoriaId: '', donoId: '', metaId: '', data, parcela: '', tipo: 'despesa', obs: '' })
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const parseValor = (s: string) => {
  const n = parseFloat(s.replace(/r\$/i, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

export function MassaPage() {
  const navigate = useNavigate()
  const { dados, isLoading } = useDados()
  const salvar = useSalvarLancamentosEmMassa()
  const hoje = iso(new Date())
  const [linhas, setLinhas] = useState<Linha[]>(() => Array.from({ length: 3 }, () => linhaVazia(hoje)))
  const [colar, setColar] = useState(false)
  const [ampliado, setAmpliado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (isLoading) return <Carregando />

  function set(i: number, campo: keyof Linha, v: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: v } : l)))
  }
  const validas = linhas.filter((l) => l.descricao.trim() && parseValor(l.valor) > 0)

  function acharPorNome<T extends { id: string; nome: string }>(arr: T[], texto: string): string {
    const t = norm(texto)
    if (!t) return ''
    return arr.find((x) => norm(x.nome) === t)?.id ?? arr.find((x) => norm(x.nome).includes(t) || t.includes(norm(x.nome)))?.id ?? ''
  }

  function importarColado(texto: string) {
    const novas: Linha[] = []
    for (const linha of texto.split(/\r?\n/)) {
      if (!linha.trim()) continue
      const cols = linha.split(/\t|;/).map((c) => c.trim())
      const [desc, valor, conta, cat, pessoa, data, parcela, tipo, obs] = cols
      if (!desc) continue
      novas.push({
        descricao: desc,
        valor: valor ?? '',
        contaId: acharPorNome(dados.contas, conta ?? ''),
        categoriaId: acharPorNome(dados.categorias, cat ?? ''),
        donoId: acharPorNome(dados.pessoas, pessoa ?? ''),
        metaId: '',
        data: data && /\d{4}-\d{2}-\d{2}/.test(data) ? data : hoje,
        parcela: parcela ?? '',
        tipo: (['despesa', 'investimento', 'imposto', 'emprestimo', 'receita'].includes(norm(tipo ?? '')) ? norm(tipo ?? '') : 'despesa') as TipoLancamento,
        obs: obs ?? '',
      })
    }
    if (novas.length) setLinhas((ls) => [...ls.filter((l) => l.descricao.trim()), ...novas])
    setColar(false)
  }

  async function salvarTudo() {
    setErro(null)
    if (validas.length === 0) return setErro('Preencha ao menos uma linha (descrição e valor).')
    // Cada linha vira uma série: parcelas (X/Y) são expandidas em meses consecutivos.
    const payloads = validas.flatMap((l) => {
      const m = l.parcela.match(/(\d+)\s*\/\s*(\d+)/)
      const parcelaAtual = m ? +m[1] : null
      const parcelaTotal = m ? +m[2] : null
      const valor = parseValor(l.valor)
      const base: BaseSerie = {
        descricao: l.descricao.trim(),
        valor,
        data: l.data,
        tipo: l.tipo,
        conta_id: l.contaId || null,
        categoria_id: l.categoriaId || null,
        dono_id: l.donoId || null,
        meta_id: l.tipo === 'investimento' && l.metaId ? l.metaId : null,
        parcela_atual: parcelaAtual,
        parcela_total: parcelaTotal,
        valor_total: null,
        data_primeira_parcela: parcelaAtual ? iso(addMonths(parseISO(l.data), -(parcelaAtual - 1))) : null,
        recorrente: false,
        frequencia: 'mensal',
        privado: false,
        observacao: l.obs.trim() || null,
      }
      return expandirSerie(base, crypto.randomUUID())
    })
    try {
      await salvar.mutateAsync(payloads)
      navigate('/lancamentos')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar.')
    }
  }

  const grade = (
    <>
      <div className="overflow-x-auto rounded-2xl border -mx-1 px-1">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {['Descrição', 'Valor', 'Conta', 'Categoria', 'Pessoa', 'Data', 'Parc. X/Y', 'Tipo', 'Meta', 'Obs', ''].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="p-1"><Input className="h-11 min-w-[140px]" value={l.descricao} onChange={(e) => set(i, 'descricao', e.target.value)} /></td>
                <td className="p-1"><Input className="h-11 w-24" value={l.valor} onChange={(e) => set(i, 'valor', e.target.value)} placeholder="0,00" /></td>
                <td className="p-1"><SelectMini value={l.contaId} onChange={(v) => set(i, 'contaId', v)} opcoes={dados.contas} /></td>
                <td className="p-1"><SelectMini value={l.categoriaId} onChange={(v) => set(i, 'categoriaId', v)} opcoes={dados.categorias} /></td>
                <td className="p-1"><SelectMini value={l.donoId} onChange={(v) => set(i, 'donoId', v)} opcoes={dados.pessoas} /></td>
                <td className="p-1"><Input type="date" className="h-11 w-36" value={l.data} onChange={(e) => set(i, 'data', e.target.value)} /></td>
                <td className="p-1"><Input className="h-11 w-16" value={l.parcela} onChange={(e) => set(i, 'parcela', e.target.value)} placeholder="2/4" /></td>
                <td className="p-1">
                  <select className="h-11 rounded-lg border bg-card px-2 text-sm" value={l.tipo} onChange={(e) => set(i, 'tipo', e.target.value)}>
                    {['despesa', 'investimento', 'imposto', 'emprestimo', 'receita'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="p-1">
                  <SelectMini
                    value={l.metaId}
                    onChange={(v) => set(i, 'metaId', v)}
                    opcoes={dados.metas}
                    disabled={l.tipo !== 'investimento'}
                  />
                </td>
                <td className="p-1"><Input className="h-11 min-w-[100px]" value={l.obs} onChange={(e) => set(i, 'obs', e.target.value)} /></td>
                <td className="p-1">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive"
                    aria-label="Remover linha"
                    onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <Button variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, linhaVazia(hoje)])}><Plus className="h-4 w-4" /> Linha</Button>
        <span className="text-xs text-muted-foreground">{validas.length} válida{validas.length !== 1 ? 's' : ''}</span>
      </div>

      {erro && <p className="text-sm text-destructive mt-2" role="alert">{erro}</p>}

      <Button className="w-full mt-4" size="lg" onClick={salvarTudo} disabled={salvar.isPending || validas.length === 0}>
        {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar {validas.length} lançamento{validas.length !== 1 ? 's' : ''}
      </Button>
    </>
  )

  return (
    <div>
      <header className="flex items-center justify-between gap-2 mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Entrada em massa</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/lancamentos/novo')}><FilePlus2 className="h-4 w-4" /> Única</Button>
          <Button variant="outline" size="sm" onClick={() => setAmpliado(true)}><Maximize2 className="h-4 w-4" /> Ampliar</Button>
          <Button variant="outline" size="sm" onClick={() => setColar(true)}><ClipboardPaste className="h-4 w-4" /> Colar</Button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground mb-3">Adicione várias linhas e salve de uma vez. Deslize horizontalmente para ver todas as colunas. Toque em <b>Ampliar</b> para tela cheia; conta/categoria/pessoa também aceitam o nome ao colar da planilha.</p>

      {!ampliado && grade}

      {ampliado && (
        <div className="fixed inset-0 z-[60] bg-background overflow-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 safe-bottom">
            <h2 className="font-bold">Entrada em massa</h2>
            <Button variant="outline" size="sm" onClick={() => setAmpliado(false)}><Minimize2 className="h-4 w-4" /> Reduzir</Button>
          </div>
          <div className="p-4">{grade}</div>
        </div>
      )}

      {colar && <ColarDialog onClose={() => setColar(false)} onImportar={importarColado} />}
    </div>
  )
}

function SelectMini({ value, onChange, opcoes, disabled }: { value: string; onChange: (v: string) => void; opcoes: { id: string; nome: string }[]; disabled?: boolean }) {
  return (
    <select className="h-11 rounded-lg border bg-card px-2 text-sm min-w-[120px] disabled:opacity-40" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">—</option>
      {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
    </select>
  )
}

function ColarDialog({ onClose, onImportar }: { onClose: () => void; onImportar: (t: string) => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Colar da planilha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label className="text-muted-foreground">Uma linha por lançamento. Colunas separadas por TAB ou ";": Descrição, Valor, Conta, Categoria, Pessoa, Data, Parcela(X/Y), Tipo, Obs</Label>
          <textarea
            className="w-full h-40 rounded-xl border bg-card p-3 text-sm font-mono"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Mercado\t150,00\tNubank - Pessoa A\tMercado\tPessoa A\t2026-07-10'}
          />
          <Button className="w-full" onClick={() => onImportar(texto)} disabled={!texto.trim()}>Importar para a grade</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
