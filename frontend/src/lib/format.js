export const CATALYST_LABELS = {
  A: 'Catalyst A',
  B: 'Catalyst B',
  C: 'Catalyst C',
  D: 'Catalyst D',
  None: 'Uncatalysed',
}

export const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

export function num(value, digits = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toFixed(digits)
}

export function paramValue(key, value) {
  switch (key) {
    case 'temperature':
      return `${num(value, 0)} °C`
    case 'pressure':
      return `${num(value, 1)} bar`
    case 'catalyst':
      return CATALYST_LABELS[value] ?? String(value)
    case 'concentration':
      return `${num(value, 2)} M`
    case 'reaction_time':
      return `${num(value, 0)} min`
    default:
      return String(value)
  }
}

export function shortParam(key, value) {
  switch (key) {
    case 'temperature':
      return `${num(value, 0)}°C`
    case 'pressure':
      return `${num(value, 1)} bar`
    case 'catalyst':
      return CATALYST_LABELS[value] ?? String(value)
    case 'concentration':
      return `${num(value, 2)} M`
    case 'reaction_time':
      return `${num(value, 0)} min`
    default:
      return String(value)
  }
}

export function riskTone(level) {
  if (level === 'low') return 'emerald'
  if (level === 'moderate') return 'amber'
  return 'rose'
}

export function scoreTone(score) {
  if (score >= 80) return 'emerald'
  if (score >= 65) return 'cyan'
  if (score >= 50) return 'amber'
  return 'rose'
}

export function yieldTone(value) {
  if (value >= 85) return 'emerald'
  if (value >= 70) return 'cyan'
  if (value >= 50) return 'amber'
  return 'rose'
}

export function confidenceTone(value) {
  if (value >= 0.85) return 'emerald'
  if (value >= 0.65) return 'cyan'
  if (value >= 0.45) return 'amber'
  return 'rose'
}

export const COMPONENT_LABELS = {
  yield: 'Predicted yield',
  time: 'Time efficiency',
  temperature: 'Mild temperature',
  pressure: 'Low pressure',
  risk: 'Robustness',
}

export const COMPONENT_COLORS = {
  yield: '#38e2f5',
  time: '#22d3ee',
  temperature: '#a78bfa',
  pressure: '#60a5fa',
  risk: '#34d399',
}

export function truncate(text, max = 160) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}
