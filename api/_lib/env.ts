export function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Variavel ${name} nao configurada.`)
  return value
}

export function optionalEnv(name: string) {
  return process.env[name] || ''
}

export function serverSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini'
export const OPENAI_CHEAP_MODEL = process.env.OPENAI_CHEAP_MODEL || 'gpt-5.4-nano'
