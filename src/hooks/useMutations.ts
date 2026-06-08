import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Categoria, Lancamento, Meta, NovoLancamento, Orcamento, Renda, TipoValorOrcamento } from '@/types/db'
import { parcelasFaltam } from '@/lib/calc'
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
        .upsert(input, { onConflict: 'categoria_id,mes_referencia' })
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
        .upsert(input, { onConflict: 'mes_referencia' })
        .select()
        .single()
      if (error) throw error
      return data as Renda
    },
    onSuccess: () => invalidate(['rendas']),
  })
}

/** Quita/adianta uma dívida parcelada: marca 'quitado' e lança o pagamento do restante hoje. */
export function useQuitarDivida() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (l: Lancamento) => {
      const faltam = parcelasFaltam(l)
      const restante = Math.round(faltam * Number(l.valor) * 100) / 100
      // 1) marca o lançamento original como quitado
      const up = await supabase.from('lancamentos').update({ status: 'quitado' }).eq('id', l.id)
      if (up.error) throw up.error
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
