import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Categoria, Conta, Desejo, Lancamento, Meta, NovoDesejo, NovoLancamento, Orcamento, Renda, TipoValorOrcamento } from '@/types/db'
import { expandirSerie, parcelasFaltam, type BaseSerie } from '@/lib/calc'
import { iso } from '@/lib/dates'

function useInvalidate() {
  const qc = useQueryClient()
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
}

export function useSalvarLancamento() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<NovoLancamento> & { id?: string }) => {
      const { id, ...payload } = input
      if (id) {
        const { data, error } = await supabase.from('lancamentos').update(payload).eq('id', id).select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.from('lancamentos').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

export function useSalvarDesejo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<NovoDesejo> & { id?: string }) => {
      const { id, ...payload } = input
      if (id) {
        const { data, error } = await supabase.from('desejos').update(payload).eq('id', id).select().single()
        if (error) throw error
        return data as Desejo
      }
      const { data, error } = await supabase.from('desejos').insert(payload).select().single()
      if (error) throw error
      return data as Desejo
    },
    onSuccess: () => invalidate(['desejos']),
  })
}

export function useExcluirDesejo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('desejos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(['desejos']),
  })
}

export interface ConfirmarCompraDesejoInput {
  desejo: Desejo
  data: string
  conta_id: string | null
  categoria_id: string | null
  dono_id: string | null
  valor_total: number
  parcela_total: number
  observacao: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function useConfirmarCompraDesejo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: ConfirmarCompraDesejoInput) => {
      const parcelas = Math.max(1, Number(input.parcela_total) || 1)
      const valorParcela = round2(Number(input.valor_total) / parcelas)
      const grupoId = crypto.randomUUID()
      const base: BaseSerie = {
        descricao: input.desejo.nome.trim(),
        valor: valorParcela,
        data: input.data,
        tipo: 'despesa',
        conta_id: input.conta_id,
        categoria_id: input.categoria_id,
        dono_id: input.dono_id,
        meta_id: null,
        parcela_atual: parcelas > 1 ? 1 : null,
        parcela_total: parcelas > 1 ? parcelas : null,
        valor_total: parcelas > 1 ? round2(Number(input.valor_total)) : null,
        data_primeira_parcela: parcelas > 1 ? input.data : null,
        recorrente: false,
        frequencia: 'mensal',
        privado: false,
        observacao: input.observacao,
      }
      const rows = expandirSerie(base, grupoId)
      const ins = await supabase.from('lancamentos').insert(rows).select()
      if (ins.error) throw ins.error

      const upd = await supabase
        .from('desejos')
        .update({
          status: 'comprado',
          comprado_em: new Date().toISOString(),
          lancamento_grupo_id: parcelas > 1 ? grupoId : null,
        })
        .eq('id', input.desejo.id)
        .select()
        .single()

      if (upd.error) {
        const ids = ((ins.data ?? []) as Lancamento[]).map((l) => l.id)
        if (ids.length) await supabase.from('lancamentos').delete().in('id', ids)
        throw upd.error
      }

      return { desejo: upd.data as Desejo, lancamentos: (ins.data ?? []) as Lancamento[] }
    },
    onSuccess: () => invalidate(['desejos', 'lancamentos', 'metas']),
  })
}

export function useExcluirLancamento() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

/** Reinsere um lançamento excluído (para o "Desfazer"), preservando o id. */
export function useReinserirLancamento() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (l: Lancamento) => {
      const { error } = await supabase.from('lancamentos').insert(l)
      if (error) throw error
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

export function useMarcarLancamentosComoPagos() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return []
      const { error } = await supabase.from('lancamentos').update({ status: 'pago' }).in('id', ids)
      if (error) throw error
      return ids
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

export function useSalvarLancamentosEmMassa() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (rows: Partial<NovoLancamento>[]) => {
      const { data, error } = await supabase.from('lancamentos').insert(rows).select()
      if (error) throw error
      return data as Lancamento[]
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

export type EscopoSerie = 'uma' | 'futuras' | 'todas'

/** Edita uma série de lançamentos no escopo escolhido (só esta / esta e futuras / todas). */
export function useEditarSerie() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({
      lancamento,
      escopo,
      patch,
    }: {
      lancamento: Lancamento
      escopo: EscopoSerie
      patch: Partial<NovoLancamento>
    }) => {
      if (escopo === 'uma' || !lancamento.grupo_id) {
        const { error } = await supabase.from('lancamentos').update(patch).eq('id', lancamento.id)
        if (error) throw error
        return
      }
      let q = supabase.from('lancamentos').update(patch).eq('grupo_id', lancamento.grupo_id)
      if (escopo === 'futuras') q = q.gte('data', lancamento.data)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

/** Exclui uma série de lançamentos no escopo escolhido. */
export function useExcluirSerie() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ lancamento, escopo }: { lancamento: Lancamento; escopo: EscopoSerie }) => {
      if (escopo === 'uma' || !lancamento.grupo_id) {
        const { error } = await supabase.from('lancamentos').delete().eq('id', lancamento.id)
        if (error) throw error
        return
      }
      if (escopo === 'todas') {
        const { error } = await supabase.from('lancamentos').delete().eq('grupo_id', lancamento.grupo_id)
        if (error) throw error
        return
      }
      // futuras: apaga desta data em diante e desativa a recorrência nas anteriores
      // (assim a janela rolante não recria os meses encerrados).
      const del = await supabase
        .from('lancamentos')
        .delete()
        .eq('grupo_id', lancamento.grupo_id)
        .gte('data', lancamento.data)
      if (del.error) throw del.error
      const up = await supabase.from('lancamentos').update({ recorrente: false }).eq('grupo_id', lancamento.grupo_id)
      if (up.error) throw up.error
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

/** Insere as linhas que faltam para manter a janela rolante de recorrências (top-up). */
export function useReabastecerRecorrencias() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (rows: Partial<NovoLancamento>[]) => {
      if (rows.length === 0) return [] as Lancamento[]
      const { data, error } = await supabase.from('lancamentos').insert(rows).select()
      if (error) throw error
      return data as Lancamento[]
    },
    onSuccess: (data) => {
      if (data && data.length) invalidate(['lancamentos', 'metas'])
    },
  })
}

export function useSalvarOrcamento() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: {
      categoria_id: string
      mes_referencia: string
      valor_estabelecido: number
      tipo_valor?: TipoValorOrcamento
      percentual?: number | null
      recorrente?: boolean
    }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .upsert(input, { onConflict: 'workspace_id,categoria_id,mes_referencia' })
        .select()
        .single()
      if (error) throw error
      return data as Orcamento
    },
    onSuccess: () => invalidate(['orcamentos']),
  })
}

export function useSalvarOrcamentosPercentuais() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (
      rows: {
        categoria_id: string
        mes_referencia: string
        valor_estabelecido: number
        tipo_valor: 'percentual'
        percentual: number
        recorrente?: boolean
      }[]
    ) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .upsert(rows, { onConflict: 'categoria_id,mes_referencia' })
        .select()
      if (error) throw error
      return data as Orcamento[]
    },
    onSuccess: () => invalidate(['orcamentos']),
  })
}

export function useSalvarRenda() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { mes_referencia: string; valor: number; recorrente?: boolean }) => {
      const { data, error } = await supabase
        .from('rendas')
        .upsert(input, { onConflict: 'workspace_id,mes_referencia' })
        .select()
        .single()
      if (error) throw error
      return data as Renda
    },
    onSuccess: () => invalidate(['rendas']),
  })
}

/** Quita/adianta uma dívida parcelada: marca as parcelas em aberto como 'quitado' e lança o pagamento do restante hoje. */
export function useQuitarDivida() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (l: Lancamento) => {
      let ids: string[]
      let restante: number
      let faltam: number
      if (l.grupo_id) {
        // parcelas-irmãs ainda em aberto, desta em diante (já materializadas no banco)
        const { data, error } = await supabase
          .from('lancamentos')
          .select('id, valor')
          .eq('grupo_id', l.grupo_id)
          .neq('status', 'quitado')
          .gte('data', l.data)
        if (error) throw error
        const rows = (data ?? []) as { id: string; valor: number }[]
        ids = rows.map((r) => r.id)
        restante = rows.reduce((s, r) => s + Number(r.valor), 0)
        faltam = rows.length
      } else {
        // legado: linha única ainda não materializada
        faltam = parcelasFaltam(l)
        restante = faltam * Number(l.valor)
        ids = [l.id]
      }
      restante = Math.round(restante * 100) / 100

      // 1) marca as parcelas em aberto como quitado
      if (ids.length) {
        const up = await supabase.from('lancamentos').update({ status: 'quitado' }).in('id', ids)
        if (up.error) throw up.error
      }
      // 2) lança o pagamento do valor restante (se houver)
      if (restante > 0) {
        const ins = await supabase.from('lancamentos').insert({
          descricao: `Quitação — ${l.descricao}`,
          valor: restante,
          data: iso(new Date()),
          tipo: 'emprestimo',
          conta_id: l.conta_id,
          categoria_id: l.categoria_id,
          dono_id: l.dono_id,
          status: 'pago',
          frequencia: 'mensal',
          observacao: `Adiantamento de ${faltam} parcela(s) de ${l.descricao}`,
        })
        if (ins.error) throw ins.error
      }
      return { restante, faltam }
    },
    onSuccess: () => invalidate(['lancamentos', 'metas']),
  })
}

export function useSalvarCategoria() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<Categoria> & { id?: string }) => {
      const { id, ...payload } = input
      if (id) {
        const { data, error } = await supabase.from('categorias').update(payload).eq('id', id).select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.from('categorias').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(['categorias']),
  })
}

/** Marca um lançamento previsto como pago (com atualização otimista). */
export function useMarcarPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').update({ status: 'pago', pago: true }).eq('id', id)
      if (error) throw error
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['lancamentos'] })
      const prev = qc.getQueryData<Lancamento[]>(['lancamentos'])
      qc.setQueryData<Lancamento[]>(['lancamentos'], (old) =>
        old?.map((l) => (l.id === id ? { ...l, status: 'pago', pago: true } : l))
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lancamentos'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  })
}

export function useSalvarConta() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<Conta> & { id?: string }) => {
      const { id, ...payload } = input
      if (id) {
        const { data, error } = await supabase.from('contas').update(payload).eq('id', id).select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.from('contas').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(['contas']),
  })
}

export function useSalvarMeta() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<Meta> & { id?: string }) => {
      const { id, ...payload } = input
      if (id) {
        const { data, error } = await supabase.from('metas').update(payload).eq('id', id).select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.from('metas').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(['metas']),
  })
}

export function useExcluirMeta() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('metas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(['metas']),
  })
}
