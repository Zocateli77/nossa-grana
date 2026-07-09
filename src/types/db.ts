export type TipoLancamento = 'despesa' | 'investimento' | 'imposto' | 'emprestimo' | 'receita'
export type TipoReserva = 'gasto' | 'investimento' | 'imposto' | 'mesada'
export type TipoConta = 'cartao_credito' | 'conta' | 'dinheiro' | 'emprestimo'
export type Frequencia = 'mensal' | 'semanal' | 'anual'
export type StatusLancamento = 'pago' | 'previsto' | 'quitado'
export type TipoValorOrcamento = 'fixo' | 'percentual'
export type StatusDesejo = 'desejo' | 'avaliando' | 'planejado' | 'pronto' | 'comprado' | 'arquivado'
export type PrioridadeDesejo = 'baixa' | 'media' | 'alta'
export type PapelWorkspace = 'dono' | 'membro'
export type StatusConvite = 'pendente' | 'aceito' | 'revogado'
export type AiActionStatus = 'pending' | 'confirmed' | 'rejected' | 'failed'
export type AiConversationStatus = 'aberta' | 'arquivada'
export type AiMemoryStatus = 'aprovada' | 'arquivada'

export interface Workspace {
  id: string
  nome: string
  criado_por: string | null
  criado_em: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  papel: PapelWorkspace
  criado_em: string
}

export interface Profile {
  user_id: string
  active_workspace_id: string | null
  nome: string | null
  email: string | null
  /** null = onboarding ainda não visto; timestamp = concluído/dispensado */
  onboarding_em: string | null
  criado_em: string
}

export interface Convite {
  id: string
  workspace_id: string
  email: string
  token: string
  papel: PapelWorkspace
  status: StatusConvite
  convidado_por: string | null
  criado_em: string
}

export interface AiConversation {
  id: string
  workspace_id: string
  user_id: string | null
  titulo: string | null
  status: AiConversationStatus
  criado_em: string
  atualizado_em: string
}

export interface AiMessage {
  id: string
  workspace_id: string
  conversation_id: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  input_tokens: number
  output_tokens: number
  action_draft_id: string | null
  criado_em: string
}

export interface AiMemory {
  id: string
  workspace_id: string
  key: string
  value: string
  status: AiMemoryStatus
  approved_by: string | null
  criado_em: string
  atualizado_em: string
}

export interface AiActionDraftRecord {
  id: string
  workspace_id: string
  conversation_id: string | null
  created_by: string | null
  type: 'orcamento.upsert' | 'lancamento.insert' | 'meta.update' | 'desejo.upsert' | 'conta.upsert'
  title: string
  summary: string
  payload: Record<string, unknown>
  impact: Record<string, unknown> | null
  status: AiActionStatus
  confirmed_by: string | null
  confirmed_at: string | null
  result: Record<string, unknown> | null
  error: string | null
  criado_em: string
  atualizado_em: string
}

export interface AiUsageEventRecord {
  id: string
  workspace_id: string
  conversation_id: string | null
  message_id: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  criado_em: string
}

export interface EmailReportRun {
  id: string
  workspace_id: string
  run_key: string
  report_date: string
  status: 'pending' | 'sent' | 'failed'
  recipients: string[]
  ai_notes: string[]
  provider_message_id: string | null
  error: string | null
  criado_em: string
  sent_at: string | null
}

export interface ReportPreferences {
  workspace_id: string
  enabled: boolean
  send_day: number
  send_hour: number
  provider: 'resend'
  recipients_mode: 'members' | 'custom'
  recipients: string[]
  criado_em: string
  atualizado_em: string
}

export interface Pessoa {
  id: string
  workspace_id: string
  nome: string
  cor: string | null
  criado_em: string
}

export interface Categoria {
  id: string
  workspace_id: string
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
  workspace_id: string
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
  workspace_id: string
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
  workspace_id: string
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
  workspace_id: string
  mes_referencia: string
  valor: number
  recorrente: boolean
  observacao: string | null
  criado_em: string
}

export interface Lancamento {
  id: string
  workspace_id: string
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
  /** liga as ocorrências de uma mesma série (parcelas ou recorrência mensal) */
  grupo_id: string | null
  observacao: string | null
  criado_em: string
  atualizado_em: string
}

export type NovoLancamento = Omit<Lancamento, 'id' | 'criado_em' | 'atualizado_em' | 'workspace_id'> & { workspace_id?: string }

export interface Desejo {
  id: string
  workspace_id: string
  nome: string
  descricao: string | null
  status: StatusDesejo
  valor_total: number
  parcela_total: number
  mes_inicio: string | null
  categoria_id: string | null
  conta_id: string | null
  dono_id: string | null
  prioridade: PrioridadeDesejo
  lancamento_grupo_id: string | null
  comprado_em: string | null
  criado_em: string
  atualizado_em: string
}

export type NovoDesejo = Omit<Desejo, 'id' | 'criado_em' | 'atualizado_em' | 'workspace_id'> & { workspace_id?: string }
