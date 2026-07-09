import { describe, it, expect } from 'vitest'
import { cicloFatura, faturaDe, faturaAberta, faturaAPagar, mesRefFaturaAberta } from './calc'
import type { Conta, Lancamento } from '@/types/db'

function cartao(over: Partial<Conta> = {}): Conta {
  return {
    id: 'c1',
    workspace_id: 'w1',
    nome: 'Nubank',
    tipo: 'cartao_credito',
    dono_id: null,
    dia_fechamento: 28,
    dia_vencimento: 5,
    limite: 1000,
    cor: null,
    ativo: true,
    criado_em: '2026-01-01',
    ...over,
  }
}

function lanc(data: string, valor: number, over: Partial<Lancamento> = {}): Lancamento {
  return {
    id: Math.random().toString(36).slice(2),
    workspace_id: 'w1',
    descricao: 'compra',
    valor,
    data,
    tipo: 'despesa',
    conta_id: 'c1',
    categoria_id: null,
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
    ...over,
  }
}

describe('cicloFatura', () => {
  it('fechamento 28 / vencimento 5 → cobre 01→28 e vence no mês seguinte', () => {
    const c = cicloFatura(cartao(), '2026-03-01')!
    expect(c.inicioISO).toBe('2026-03-01') // dia após fechamento anterior (28/fev)
    expect(c.fimISO).toBe('2026-03-28')
    expect(c.vencimentoISO).toBe('2026-04-05') // venc 5 < fech 28 → mês seguinte
  })

  it('vencimento maior que fechamento vence no mesmo mês', () => {
    const c = cicloFatura(cartao({ dia_fechamento: 5, dia_vencimento: 15 }), '2026-03-01')!
    expect(c.fimISO).toBe('2026-03-05')
    expect(c.vencimentoISO).toBe('2026-03-15')
    expect(c.inicioISO).toBe('2026-02-06') // dia após fechamento de 05/fev
  })

  it('fechamento 31 em fevereiro faz clamp para o último dia do mês', () => {
    const c = cicloFatura(cartao({ dia_fechamento: 31, dia_vencimento: 10 }), '2026-02-01')!
    expect(c.fimISO).toBe('2026-02-28') // 2026 não é bissexto
    expect(c.inicioISO).toBe('2026-02-01') // dia após 31/jan
    expect(c.vencimentoISO).toBe('2026-03-10')
  })

  it('retorna null para conta que não é cartão de crédito', () => {
    expect(cicloFatura(cartao({ tipo: 'conta' }), '2026-03-01')).toBeNull()
    expect(cicloFatura(cartao({ dia_fechamento: null }), '2026-03-01')).toBeNull()
  })
})

describe('faturaDe', () => {
  const lancs = [
    lanc('2026-02-28', 100), // fatura anterior (fecha 28/fev) — fora
    lanc('2026-03-01', 50), // dentro
    lanc('2026-03-15', 30), // dentro
    lanc('2026-03-28', 20), // dentro (dia do fechamento, inclusive)
    lanc('2026-03-29', 999, { conta_id: 'c1' }), // já é da próxima fatura — fora
    lanc('2026-03-10', 500, { conta_id: 'outra' }), // outro cartão — fora
  ]

  it('soma apenas os itens dentro do ciclo', () => {
    const f = faturaDe(lancs, cartao(), '2026-03-01', new Date(2026, 2, 20))!
    expect(f.total).toBe(100) // 50 + 30 + 20
    expect(f.itens).toHaveLength(3)
  })

  it('estado aberta enquanto hoje ≤ fechamento', () => {
    const f = faturaDe(lancs, cartao(), '2026-03-01', new Date(2026, 2, 20))!
    expect(f.estado).toBe('aberta')
  })

  it('estado fechada após o fechamento', () => {
    const f = faturaDe(lancs, cartao(), '2026-03-01', new Date(2026, 2, 29))!
    expect(f.estado).toBe('fechada')
  })

  it('estado futura antes do início do ciclo', () => {
    const f = faturaDe(lancs, cartao(), '2026-03-01', new Date(2026, 1, 15))!
    expect(f.estado).toBe('futura')
  })

  it('usoLimite = total / limite', () => {
    const f = faturaDe(lancs, cartao({ limite: 200 }), '2026-03-01', new Date(2026, 2, 20))!
    expect(f.usoLimite).toBe(0.5) // 100 / 200
  })

  it('usoLimite null quando não há limite', () => {
    const f = faturaDe(lancs, cartao({ limite: null }), '2026-03-01', new Date(2026, 2, 20))!
    expect(f.usoLimite).toBeNull()
  })

  it('marca vencida quando fechada e vencimento no passado', () => {
    const f = faturaDe(lancs, cartao(), '2026-03-01', new Date(2026, 3, 10))! // 10/abr > venc 05/abr
    expect(f.estado).toBe('fechada')
    expect(f.vencida).toBe(true)
    expect(f.diasAteVencimento).toBeLessThan(0)
  })
})

describe('mesRefFaturaAberta', () => {
  it('antes do fechamento → competência do mês corrente', () => {
    expect(mesRefFaturaAberta(cartao(), new Date(2026, 2, 10))).toBe('2026-03-01')
  })
  it('depois do fechamento → competência do mês seguinte', () => {
    expect(mesRefFaturaAberta(cartao(), new Date(2026, 2, 29))).toBe('2026-04-01')
  })
})

describe('faturaAberta / faturaAPagar', () => {
  const lancs = [
    lanc('2026-02-15', 200), // ciclo que fecha 28/fev (a pagar)
    lanc('2026-03-10', 80), // ciclo aberto (fecha 28/mar)
  ]

  it('faturaAberta acumula o ciclo corrente', () => {
    const f = faturaAberta(lancs, cartao(), new Date(2026, 2, 15))!
    expect(f.ciclo.mesRef).toBe('2026-03-01')
    expect(f.total).toBe(80)
    expect(f.estado).toBe('aberta')
  })

  it('faturaAPagar retorna o ciclo anterior já fechado', () => {
    const f = faturaAPagar(lancs, cartao(), new Date(2026, 2, 15))!
    expect(f.ciclo.mesRef).toBe('2026-02-01')
    expect(f.total).toBe(200)
    expect(f.estado).toBe('fechada')
  })

  it('faturaAPagar é null quando não há fatura fechada com valor', () => {
    const soAberta = [lanc('2026-03-10', 80)]
    expect(faturaAPagar(soAberta, cartao(), new Date(2026, 2, 15))).toBeNull()
  })
})
