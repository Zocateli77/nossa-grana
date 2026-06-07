import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Categoria, Conta, Lancamento, Meta, Orcamento, Pessoa } from '@/types/db'
import type { Dados } from '@/lib/calc'

async function fetchAll<T>(table: string, order?: { col: string; asc?: boolean }): Promise<T[]> {
  let q = supabase.from(table).select('*')
  if (order) q = q.order(order.col, { ascending: order.asc ?? true })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as T[]
}

export const usePessoas = () => useQuery({ queryKey: ['pessoas'], queryFn: () => fetchAll<Pessoa>('pessoas', { col: 'nome' }) })
export const useCategorias = () =>
  useQuery({ queryKey: ['categorias'], queryFn: () => fetchAll<Categoria>('categorias', { col: 'nome' }) })
export const useContas = () => useQuery({ queryKey: ['contas'], queryFn: () => fetchAll<Conta>('contas', { col: 'nome' }) })
export const useMetas = () => useQuery({ queryKey: ['metas'], queryFn: () => fetchAll<Meta>('metas', { col: 'criado_em' }) })
export const useOrcamentos = () =>
  useQuery({ queryKey: ['orcamentos'], queryFn: () => fetchAll<Orcamento>('orcamentos') })
export const useLancamentos = () =>
  useQuery({ queryKey: ['lancamentos'], queryFn: () => fetchAll<Lancamento>('lancamentos', { col: 'data', asc: false }) })

export interface UseDadosResult {
  dados: Dados
  isLoading: boolean
  isError: boolean
  error: unknown
}

/** Busca tudo de uma vez e monta o bundle Dados consumido pelo calc.ts. */
export function useDados(): UseDadosResult {
  const pessoas = usePessoas()
  const categorias = useCategorias()
  const contas = useContas()
  const metas = useMetas()
  const orcamentos = useOrcamentos()
  const lancamentos = useLancamentos()

  const queries = [pessoas, categorias, contas, metas, orcamentos, lancamentos]

  return {
    dados: {
      pessoas: pessoas.data ?? [],
      categorias: categorias.data ?? [],
      contas: contas.data ?? [],
      metas: metas.data ?? [],
      orcamentos: orcamentos.data ?? [],
      lancamentos: lancamentos.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    error: queries.find((q) => q.error)?.error,
  }
}
