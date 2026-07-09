import { z } from 'zod'

export const AI_BUDGET_USD = 5
export const AI_WARNING_THRESHOLD = 0.75

export type AiModel = 'gpt-5.4-mini' | 'gpt-5.4-nano' | 'gpt-5.5'

const MODEL_PRICING_USD_PER_1M: Record<AiModel, { input: number; output: number }> = {
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.5': { input: 5, output: 30 },
}

export interface AiUsageEvent {
  model: AiModel
  inputTokens: number
  outputTokens: number
}

export interface AiUsageCost {
  model: AiModel
  inputTokens: number
  outputTokens: number
  usd: number
}

export function estimateAiUsage(event: AiUsageEvent): AiUsageCost {
  const pricing = MODEL_PRICING_USD_PER_1M[event.model]
  const usd = (event.inputTokens / 1_000_000) * pricing.input + (event.outputTokens / 1_000_000) * pricing.output
  return { ...event, usd: roundMoney(usd) }
}

export function summarizeAiUsage(events: AiUsageEvent[], budgetUsd = AI_BUDGET_USD) {
  const spentUsd = roundMoney(events.reduce((sum, event) => sum + estimateAiUsage(event).usd, 0))
  return {
    budgetUsd,
    spentUsd,
    remainingUsd: roundMoney(Math.max(0, budgetUsd - spentUsd)),
    warning: spentUsd >= budgetUsd * AI_WARNING_THRESHOLD,
    blocked: false,
  }
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar em YYYY-MM-DD')
const nullableId = z.string().min(1).nullable()

const actionBaseSchema = z.object({
  title: z.string().min(3),
  summary: z.string().min(3),
  impact: z
    .object({
      before: z.record(z.unknown()).optional(),
      after: z.record(z.unknown()).optional(),
      explanation: z.string().optional(),
    })
    .optional(),
})

const orcamentoPayloadSchema = z.object({
  categoria_id: z.string().min(1),
  mes_referencia: dateSchema,
  valor_estabelecido: z.number().finite().min(0),
  tipo_valor: z.enum(['fixo', 'percentual']).default('fixo'),
  percentual: z.number().finite().min(0).max(100).nullable().optional(),
  recorrente: z.boolean().default(true),
  observacao: z.string().nullable().optional(),
})

const lancamentoPayloadSchema = z.object({
  descricao: z.string().min(1),
  valor: z.number().finite().positive('valor deve ser maior que zero'),
  data: dateSchema,
  tipo: z.enum(['despesa', 'investimento', 'imposto', 'emprestimo', 'receita']),
  conta_id: nullableId,
  categoria_id: nullableId,
  dono_id: nullableId,
  meta_id: nullableId,
  parcela_atual: z.number().int().positive().nullable().optional(),
  parcela_total: z.number().int().positive().nullable().optional(),
  valor_total: z.number().finite().positive().nullable().optional(),
  data_primeira_parcela: dateSchema.nullable().optional(),
  recorrente: z.boolean().default(false),
  frequencia: z.enum(['mensal', 'semanal', 'anual']).default('mensal'),
  status: z.enum(['pago', 'previsto', 'quitado']).default('previsto'),
  pago: z.boolean().default(false),
  privado: z.boolean().default(false),
  observacao: z.string().nullable().optional(),
})

const metaPayloadSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1).optional(),
  valor_alvo: z.number().finite().min(0).optional(),
  valor_atual: z.number().finite().min(0).optional(),
  data_alvo: dateSchema.nullable().optional(),
  cor: z.string().nullable().optional(),
  icone: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  concluida: z.boolean().optional(),
})

const desejoPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().min(1),
  descricao: z.string().nullable().optional(),
  status: z.enum(['desejo', 'avaliando', 'planejado', 'pronto', 'comprado', 'arquivado']).default('desejo'),
  valor_total: z.number().finite().min(0),
  parcela_total: z.number().int().positive().default(1),
  mes_inicio: dateSchema.nullable().optional(),
  categoria_id: nullableId.optional(),
  conta_id: nullableId.optional(),
  dono_id: nullableId.optional(),
  prioridade: z.enum(['baixa', 'media', 'alta']).default('media'),
})

const contaPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().min(1),
  tipo: z.enum(['cartao_credito', 'conta', 'dinheiro', 'emprestimo']),
  dono_id: nullableId.optional(),
  dia_fechamento: z.number().int().min(1).max(31).nullable().optional(),
  dia_vencimento: z.number().int().min(1).max(31).nullable().optional(),
  limite: z.number().finite().min(0).nullable().optional(),
  cor: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
})

const draftSchemas = {
  'orcamento.upsert': actionBaseSchema.extend({ type: z.literal('orcamento.upsert'), payload: orcamentoPayloadSchema }),
  'lancamento.insert': actionBaseSchema.extend({ type: z.literal('lancamento.insert'), payload: lancamentoPayloadSchema }),
  'meta.update': actionBaseSchema.extend({ type: z.literal('meta.update'), payload: metaPayloadSchema }),
  'desejo.upsert': actionBaseSchema.extend({ type: z.literal('desejo.upsert'), payload: desejoPayloadSchema }),
  'conta.upsert': actionBaseSchema.extend({ type: z.literal('conta.upsert'), payload: contaPayloadSchema }),
}

export type AiActionType = keyof typeof draftSchemas

export type AiActionDraft =
  | z.infer<(typeof draftSchemas)['orcamento.upsert']>
  | z.infer<(typeof draftSchemas)['lancamento.insert']>
  | z.infer<(typeof draftSchemas)['meta.update']>
  | z.infer<(typeof draftSchemas)['desejo.upsert']>
  | z.infer<(typeof draftSchemas)['conta.upsert']>

export interface SupabaseOperation {
  table: 'orcamentos' | 'lancamentos' | 'metas' | 'desejos' | 'contas'
  method: 'insert' | 'update' | 'upsert'
  values: Record<string, unknown>
  match?: Record<string, string>
  onConflict?: string
}

export function normalizeAiActionDraft(input: unknown): AiActionDraft {
  const type = readActionType(input)
  const schema = draftSchemas[type]
  if (!schema) throw new Error('Acao da IA nao suportada.')
  return schema.parse(input) as AiActionDraft
}

export function buildActionOperations(draft: AiActionDraft): SupabaseOperation[] {
  switch (draft.type) {
    case 'orcamento.upsert':
      return [
        {
          table: 'orcamentos',
          method: 'upsert',
          onConflict: 'workspace_id,categoria_id,mes_referencia',
          values: stripUndefined(draft.payload),
        },
      ]
    case 'lancamento.insert':
      return [{ table: 'lancamentos', method: 'insert', values: stripUndefined(draft.payload) }]
    case 'meta.update': {
      const { id, ...values } = draft.payload
      return [{ table: 'metas', method: 'update', match: { id }, values: stripUndefined(values) }]
    }
    case 'desejo.upsert': {
      const { id, ...values } = draft.payload
      return id
        ? [{ table: 'desejos', method: 'update', match: { id }, values: stripUndefined(values) }]
        : [{ table: 'desejos', method: 'insert', values: stripUndefined(values) }]
    }
    case 'conta.upsert': {
      const { id, ...values } = draft.payload
      return id
        ? [{ table: 'contas', method: 'update', match: { id }, values: stripUndefined(values) }]
        : [{ table: 'contas', method: 'insert', values: stripUndefined(values) }]
    }
  }
}

export const AI_ACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'actions', 'memories'],
  properties: {
    message: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['type', 'title', 'summary', 'payload'],
        properties: {
          type: { enum: Object.keys(draftSchemas) },
          title: { type: 'string' },
          summary: { type: 'string' },
          payload: { type: 'object' },
          impact: { type: 'object' },
        },
      },
    },
    memories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'value'],
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
  },
} as const

function readActionType(input: unknown): AiActionType {
  if (!input || typeof input !== 'object' || !('type' in input)) throw new Error('Acao da IA sem tipo.')
  return String((input as { type: unknown }).type) as AiActionType
}

function stripUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}
