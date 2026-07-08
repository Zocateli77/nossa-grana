import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')

function varsFor(selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))
  assert.ok(match, `Missing ${selector} block`)
  return Object.fromEntries(
    [...match[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()])
  )
}

function hslToRgb(token) {
  const [h, s, l] = token
    .replaceAll('%', '')
    .split(/\s+/)
    .map(Number)
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x]
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255))
}

function luminance([r, g, b]) {
  const linear = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a, b) {
  const l1 = luminance(hslToRgb(a))
  const l2 = luminance(hslToRgb(b))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const dark = varsFor('.dark')

assert.ok(
  contrast(dark['warning-foreground'], dark.card) >= 4.5,
  `Dark warning text contrast on card is ${contrast(dark['warning-foreground'], dark.card).toFixed(2)}`
)

assert.ok(
  contrast(dark['warning-foreground'], dark.background) >= 4.5,
  `Dark warning text contrast on background is ${contrast(dark['warning-foreground'], dark.background).toFixed(2)}`
)
