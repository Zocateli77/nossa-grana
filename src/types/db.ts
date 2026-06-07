export type TipoLancamento = 'despesa' | 'investimento' | 'imposto' | 'emprestimo' | 'receita'
export type TipoReserva = 'gasto' | 'investimento' | 'imposto' | 'mesada'
export type TipoConta = 'cartao_credito' | 'conta' | 'dinheiro' | 'emprestimo'
export type Frequencia = 'mensal' | 'semanal' | 'anual'
export type StatusLancamento = 'pago' | 'previsto' | 'quitado'
export type TipoValorOrcamento = 'fixo' | 'percentual'

export interface Pessoa {
  id: string
  nome: string
  cor: string | null
  criado_em: string
}

export interface Categoria {
  id: string
  nome: string
  grupo: string | null
  tipo_reserva: TipoReserva
  dono_id: string | null
  cor: string | null
  icone: string | null
  ativo: boolean
  criado_em: string
}

export interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  dono_id: string | null
  dia_fechamento: number | null
  dia_vencimento: number | null
  limite: number | null
  cor: string | null
  ativo: boolean
  criado_em: string
}

export interface Meta {
  id: string
  nome: string
  tipo: string
  valor_alvo: number
  valor_atual: number
  data_alvo: string | null
  cor: string | null
  icone: string | null
  descricao: string | null
  concluida: boolean
  criado_em: string
}

export interface Orcamento {
  id: string
  categoria_id: string
  mes_referencia: string
  valor_estabelecido: number
  tipo_valor: TipoValorOrcamento
  percentual: number | null
  recorrente: boolean
  observacao: string | null
}

export interface Renda {
  id: string
  mes_referencia: string
  valor: number
  recorrente: boolean
  observacao: string | null
  criado_em: string
}

export interface Lancamento {
  id: string
  descricao: string
  valor: number
  data: string
  tipo: TipoLancamento
  conta_id: string | null
  categoria_id: string | null
  dono_id: string | null
  meta_id: string | null
  parcela_atual: number | null
  parcela_total: number | null
  valor_total: number | null
  data_primeira_parcela: string | null
  recorrente: boolean
  frequencia: Frequencia
  status: StatusLancamento
  pago: boolean
  privado: boolean
  observacao: string | null
  criado_em: string
  atualizado_em: string
}

export type NovoLancamento = Omit<Lancamento, 'id' | 'criado_em' | 'atualizado_em'>
