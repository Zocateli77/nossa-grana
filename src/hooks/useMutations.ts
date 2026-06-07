import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Categoria, Lancamento, Meta, NovoLancamento, Orcamento } from '@/types/db'

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
    mutationFn: async (input: { categoria_id: string; mes_referencia: string; valor_estabelecido: number; recorrente?: boolean }) => {
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
