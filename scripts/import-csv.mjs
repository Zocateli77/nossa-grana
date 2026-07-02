// Parser do CSV de julho (Windows-1252 / latin1, delimitado por ';', 3 blocos lado a lado).
// Exporta parseFinanceCsv() + helpers de categorização (mapeamento das Seções 8.4 e 8.5).
import { readFileSync } from 'node:fs'

const norm = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function parseValor(raw) {
  if (!raw) return null
  const cleaned = String(raw)
    .replace(/r\$/i, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}

function parseParcela(raw) {
  if (!raw) return { atual: null, total: null }
  const m = norm(raw).match(/(\d+)\s*de\s*(\d+)/)
  if (!m) return { atual: null, total: null }
  return { atual: parseInt(m[1], 10), total: parseInt(m[2], 10) }
}

// CSV "Forma de pgto" -> nome canônico da conta no seed
const CONTA_MAP = {
  'cartao - amazon': 'Cartão Amazon',
  'cartao - mercado pago': 'Cartão Mercado Pago',
  'cartao compartilhado': 'Cartão Compartilhado',
  'cartao compartilhado': 'Cartão Compartilhado',
  'emprestimo': 'Empréstimo',
  'conta pessoa a': 'Conta Pessoa A',
  'inter - pessoa a': 'Conta Pessoa A',
  'nubank - pessoa a': 'Nubank - Pessoa A',
  'nubank - pessoa b': 'Nubank - Pessoa B',
  'nubank - pessoa c': 'Nubank - Pessoa C',
  'nubank - pessoa b': 'Nubank - Pessoa B',
  'nubank - pessoa a': 'Nubank - Pessoa A',
  'nubank - pessoa c': 'Nubank - Pessoa C',
  'pix/dinheiro': 'Pix/Dinheiro',
}
export function mapConta(raw) {
  return CONTA_MAP[norm(raw)] ?? (raw ? raw.trim() : null)
}

// Derivação de tipo + categoria (8.4 + 8.5). Retorna { tipo, categoria }.
export function categorizar(descricao) {
  const d = norm(descricao)

  // --- tipo especial (e categoria associada) ---
  if (/emprestimo/.test(d)) return { tipo: 'emprestimo', categoria: 'Empréstimo' }
  if (/\biof\b|imposto/.test(d)) return { tipo: 'imposto', categoria: 'Impostos' }
  if (/previdencia/.test(d)) return { tipo: 'investimento', categoria: 'Previdência' }
  if (/caixinha/.test(d)) return { tipo: 'investimento', categoria: 'Investimento' }
  if (/investimento/.test(d)) return { tipo: 'investimento', categoria: 'Investimento' }

  // --- despesas: lista ordenada (específico antes de genérico) ---
  const regras = [
    [/areia|petshop|pet\b|pet -|gatos/, 'Pets'],
    [/manicure|corte/, 'Cuidados Pessoais'],
    [/shein/, 'Roupas'],
    [/hbl|penoni|sierve|drogasil|cirurgica|panaceia|mounjaro|nutricion|terapia|academia|muay|natacao/, 'Saúde'],
    [/globoplay|hbo|canva|chat gpt|chatgpt|claude|prime canais|amazon prime|google one/, 'Assinaturas'],
    [/aluguel|condominio|\bluz\b|internet|\bagua\b|\bcama\b/, 'Moradia'],
    [/\bpos\b|graduacao|auvp|ebac|ingles|no code|clube do livro|kindle|contador|livraria|kiwify|protocolo/, 'Educação'],
    [/aniversario|bazar|jr vaz|localiza|lazer/, 'Lazer'],
    [/acougue|marmita|bahamas|supermercado|delicias|indiana|snack|mercado bh|pula pula/, 'Mercado'],
  ]
  for (const [re, cat] of regras) if (re.test(d)) return { tipo: 'despesa', categoria: cat }

  // --- ambíguos -> revisar ---
  if (/mercado livre|mercado pago|amazon br|amazon mktplace|amazonmktplc|pix credito|jim com|pagtrust|tudodebic|trscomerc/.test(d))
    return { tipo: 'despesa', categoria: 'A classificar' }

  if (/mercado/.test(d)) return { tipo: 'despesa', categoria: 'Mercado' }
  return { tipo: 'despesa', categoria: 'A classificar' }
}

export function donoPorDescricao(descricao) {
  const d = norm(descricao)
  if (/pessoa b|pessoa b/.test(d)) return 'Pessoa B'
  if (/pessoa a|pessoa a/.test(d)) return 'Pessoa A'
  if (/pessoa c|pessoa c/.test(d)) return 'Pessoa C'
  return null
}

// Liga aportes de investimento a metas pelo texto.
export function metaPorDescricao(descricao) {
  const d = norm(descricao)
  if (/caixinha/.test(d)) return 'Reserva de Emergência'
  if (/\binvestimento\b/.test(d)) return 'Carteira de Investimentos'
  return null
}

export function parseFinanceCsv(filePath) {
  const raw = readFileSync(filePath, 'latin1')
  const linhas = raw.split(/\r?\n/)
  const transacoes = []
  const totaisConta = []
  const orcamentosReais = []
  let salario = null

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';')
    if (cols.length < 5) continue

    // --- bloco esquerdo: lançamentos (cols 0-4) ---
    const desc = (cols[0] ?? '').trim()
    const valor = parseValor(cols[1])
    if (desc && valor != null) {
      const { tipo, categoria } = categorizar(desc)
      const { atual, total } = parseParcela(cols[3])
      transacoes.push({
        descricao: desc,
        valor,
        contaNome: mapConta(cols[2]),
        parcelaAtual: atual,
        parcelaTotal: total,
        observacao: (cols[4] ?? '').trim() || null,
        tipo,
        categoria,
        donoNome: donoPorDescricao(desc),
        metaNome: tipo === 'investimento' ? metaPorDescricao(desc) : null,
      })
    }

    // --- bloco do meio: totais por conta (cols 7-8) ---
    const contaNome = (cols[7] ?? '').trim()
    const totalConta = parseValor(cols[8])
    if (contaNome && totalConta != null) {
      const n = norm(contaNome)
      if (n === 'salario') salario = totalConta
      else if (n !== 'total') totaisConta.push({ nome: mapConta(contaNome), total: totalConta })
    }

    // --- bloco direito: orçamentos reais (cols 11-13) ---
    const orcNome = (cols[11] ?? '').trim()
    const estab = parseValor(cols[12])
    if (orcNome && estab != null) {
      orcamentosReais.push({
        categoria: orcNome,
        estabelecido: estab,
        gasto: parseValor(cols[13]),
      })
    }
  }

  return { transacoes, totaisConta, orcamentosReais, salario }
}
