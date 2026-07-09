import { describe, it, expect } from 'vitest'
import { insightsDoMes, type Dados } from './calc'
import type { Categoria, Lancamento } from '@/types/db'

function cat(id: string, nome: string): Categoria {
  return {
    id,
    workspace_id: 'w1',
    nome,
    grupo: null,
    tipo_reserva: 'gasto',
    dono_id: null,
    cor: null,
    icone: null,
    ativo: true,
    criado_em: '2026-01-01',
  } as Categoria
}

function lanc(categoria_id: string, data: string, valor: number): Lancamento {
  return {
    id: Math.random().toString(36).slice(2),
    workspace_id: 'w1',
    descricao: 'x',
    valor,
    data,
    tipo: 'despesa',
    conta_id: null,
    categoria_id,
    dono_id: null,
    meta_id: null,
    parcela_atual: null,
    parcela_total: null,
    valor_total: null,
    data_primeira_parcela: null,
    recorrente: false,
    frequencia: 'mensal',
    status: 'pago',
    pago: true,
    privado: false,
    grupo_id: null,
    observacao: null,
    criado_em: data,
    atualizado_em: data,
  }
}

function dados(categorias: Categoria[], lancamentos: Lancamento[]): Dados {
  return { pessoas: [], categorias, contas: [], metas: [], desejos: [], orcamentos: [], lancamentos, rendas: [] }
}

describe('insightsDoMes', () => {
  it('alerta quando a categoria passa 25% acima da média dos 3 meses', () => {
    const mercado = cat('m', 'Mercado')
    const lancs = [
      lanc('m', '2025-12-10', 100),
      lanc('m', '2026-01-10', 100),
      lanc('m', '2026-02-10', 100),
      lanc('m', '2026-03-10', 200), // média 100 → +100%
    ]
    const ins = insightsDoMes(dados([mercado], lancs), '2026-03-01')
    expect(ins).toHaveLength(1)
    expect(ins[0].severidade).toBe('alerta')
    expect(ins[0].texto).toContain('Mercado')
    expect(ins[0].texto).toContain('100%')
  })

  it('reforço positivo quando gasta bem abaixo da média', () => {
    const roupas = cat('r', 'Roupas')
    const lancs = [
      lanc('r', '2025-12-10', 300),
      lanc('r', '2026-01-10', 300),
      lanc('r', '2026-02-10', 300),
      lanc('r', '2026-03-10', 100), // média 300 → economizou 200
    ]
    const ins = insightsDoMes(dados([roupas], lancs), '2026-03-01')
    expect(ins).toHaveLength(1)
    expect(ins[0].severidade).toBe('positivo')
  })

  it('ignora variações abaixo do piso (ruído)', () => {
    const cafe = cat('c', 'Café')
    const lancs = [
      lanc('c', '2025-12-10', 40),
      lanc('c', '2026-01-10', 40),
      lanc('c', '2026-02-10', 40),
      lanc('c', '2026-03-10', 80), // média 40 < piso 50 → sem insight
    ]
    expect(insightsDoMes(dados([cafe], lancs), '2026-03-01')).toHaveLength(0)
  })

  it('prioriza alertas e limita a 3 insights', () => {
    const cats = ['a', 'b', 'c', 'd'].map((id) => cat(id, `Cat${id}`))
    const lancs: Lancamento[] = []
    for (const c of cats) {
      for (const m of ['2025-12', '2026-01', '2026-02']) lancs.push(lanc(c.id, `${m}-10`, 100))
      lancs.push(lanc(c.id, '2026-03-10', 300)) // todas +200%
    }
    const ins = insightsDoMes(dados(cats, lancs), '2026-03-01')
    expect(ins).toHaveLength(3)
    expect(ins.every((i) => i.severidade === 'alerta')).toBe(true)
  })
})
