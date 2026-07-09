import { AI_ACTION_JSON_SCHEMA, estimateAiUsage, type AiModel, type AiUsageCost } from '../../src/lib/aiActions'
import { buildAiFooterNotes, type EmailReportForAi } from '../../src/lib/aiEmail'
import { OPENAI_CHEAP_MODEL, OPENAI_CHAT_MODEL, optionalEnv } from './env'

export interface FinancialAiStructuredResponse {
  message: string
  actions: unknown[]
  memories: { key: string; value: string }[]
}

export interface OpenAiJsonResult<T> {
  result: T
  usage: AiUsageCost
  skipped: boolean
}

const KNOWN_MODELS: AiModel[] = ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5']

export async function askFinancialConcierge(input: {
  message: string
  snapshot: unknown
  memories: { key: string; value: string }[]
}): Promise<OpenAiJsonResult<FinancialAiStructuredResponse>> {
  const model = knownModel(OPENAI_CHAT_MODEL)
  const apiKey = optionalEnv('OPENAI_API_KEY')
  if (!apiKey) {
    return {
      result: {
        message:
          'Estou pronta para analisar suas financas, mas o backend ainda esta sem OPENAI_API_KEY. Quando a chave estiver no Vercel, eu respondo usando seus dados e preparo acoes para confirmacao.',
        actions: [],
        memories: [],
      },
      usage: estimateAiUsage({ model, inputTokens: 0, outputTokens: 0 }),
      skipped: true,
    }
  }

  const system = [
    'Voce e a IA concierge financeira do app Nossa Grana.',
    'Use todos os dados do workspace recebidos no snapshot, inclusive lancamentos privados.',
    'Nunca gere SQL, nunca altere o banco diretamente e nunca diga que algo foi salvo.',
    'Qualquer alteracao deve virar uma action estruturada, que sera validada e confirmada pelo usuario antes de aplicar.',
    'Se a pergunta for de diagnostico, responda de forma direta, com numeros e sugestoes praticas.',
    'Se houver uma acao clara e segura, inclua no maximo 3 action drafts.',
  ].join('\n')

  const user = JSON.stringify({
    pergunta: input.message,
    memorias_aprovadas: input.memories,
    snapshot_financeiro: input.snapshot,
  })

  return callResponsesJson<FinancialAiStructuredResponse>({
    apiKey,
    model,
    name: 'financial_concierge_response',
    schema: AI_ACTION_JSON_SCHEMA,
    system,
    user,
    maxOutputTokens: 1800,
  })
}

export async function writeReportFooterWithAi(report: EmailReportForAi): Promise<OpenAiJsonResult<{ notes: string[] }>> {
  const model = knownModel(OPENAI_CHEAP_MODEL)
  const apiKey = optionalEnv('OPENAI_API_KEY')
  const fallback = { notes: buildAiFooterNotes(report) }

  if (!apiKey) {
    return {
      result: fallback,
      usage: estimateAiUsage({ model, inputTokens: 0, outputTokens: 0 }),
      skipped: true,
    }
  }

  try {
    return await callResponsesJson<{ notes: string[] }>({
      apiKey,
      model,
      name: 'weekly_report_ai_notes',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['notes'],
        properties: {
          notes: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
      system:
        'Escreva exatamente 3 notas curtas em portugues do Brasil para um rodape de relatorio financeiro de casal: alerta principal, sugestao pratica e pergunta para discutir. Nao use markdown.',
      user: JSON.stringify(report),
      maxOutputTokens: 500,
    })
  } catch {
    return {
      result: fallback,
      usage: estimateAiUsage({ model, inputTokens: 0, outputTokens: 0 }),
      skipped: true,
    }
  }
}

async function callResponsesJson<T>(input: {
  apiKey: string
  model: AiModel
  name: string
  schema: unknown
  system: string
  user: string
  maxOutputTokens: number
}): Promise<OpenAiJsonResult<T>> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: input.system }] },
        { role: 'user', content: [{ type: 'input_text', text: input.user }] },
      ],
      max_output_tokens: input.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: input.name,
          strict: true,
          schema: input.schema,
        },
      },
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || response.statusText
    throw new Error(`OpenAI falhou: ${detail}`)
  }

  const outputText = extractOutputText(data)
  if (!outputText) throw new Error('OpenAI nao retornou JSON estruturado.')

  const parsed = JSON.parse(outputText) as T
  const inputTokens = Number(data?.usage?.input_tokens ?? data?.usage?.prompt_tokens ?? 0)
  const outputTokens = Number(data?.usage?.output_tokens ?? data?.usage?.completion_tokens ?? 0)

  return {
    result: parsed,
    usage: estimateAiUsage({ model: input.model, inputTokens, outputTokens }),
    skipped: false,
  }
}

function extractOutputText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  if (typeof record.output_text === 'string') return record.output_text
  const output = Array.isArray(record.output) ? record.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as Record<string, unknown>).text
      if (typeof text === 'string') return text
    }
  }
  return ''
}

function knownModel(model: string): AiModel {
  return KNOWN_MODELS.includes(model as AiModel) ? (model as AiModel) : 'gpt-5.4-mini'
}
