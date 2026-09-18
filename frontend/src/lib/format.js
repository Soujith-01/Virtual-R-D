import { DOMAINS } from './constants'

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

export function paramValue(key, value, domainId = 'reaction-yield') {
  const domain = DOMAINS[domainId]
  if (!domain) return String(value)

  const units = domain.units || {}
  const unit = units[key] || ''

  switch (key) {
    case 'temperature':
    case 'operating_temperature_c':
    case 'annealing_temperature_c':
    case 'temperature_c':
      return `${num(value, 0)}°C`
    case 'pressure':
      return `${num(value, 1)} bar`
    case 'catalyst':
      return CATALYST_LABELS[value] ?? String(value)
    case 'concentration':
    case 'electrolyte_concentration_m':
    case 'nutrient_concentration_mm':
      return `${num(value, 2)} M`
    case 'reaction_time':
    case 'contact_time_min':
      return `${num(value, 0)} min`
    case 'cell_thickness_nm':
      return `${num(value, 0)} nm`
    case 'doping_concentration':
      return value >= 1e17 ? `${(value / 1e17).toFixed(2)}×10¹⁷ cm⁻³` : `${num(value, 1)} cm⁻³`
    case 'light_intensity_lux':
    case 'light_intensity':
      return `${num(value, 0)} lux`
    case 'co2_concentration_ppm':
      return `${num(value, 0)} ppm`
    case 'water_supply_ml_day':
      return `${num(value, 0)} ml/day`
    case 'charging_rate_c':
    case 'discharge_rate_c':
      return `${num(value, 1)}C`
    case 'cycle_count':
      return `${num(value, 0)} cycles`
    case 'coagulant_dose_mg_l':
      return `${num(value, 1)} mg/L`
    case 'ph':
      return `${num(value, 1)}`
    case 'mixing_speed_rpm':
      return `${num(value, 0)} rpm`
    default:
      if (unit) {
        return `${num(value, 2)} ${unit}`.trim()
      }
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

export function getPredictionKey(domainId) {
  const mapping = {
    'reaction-yield': 'predicted_yield',
    'solar-efficiency': 'predicted_efficiency',
    'plant-growth': 'predicted_biomass_yield',
    'battery-performance': 'predicted_capacity_retention',
    'water-purification': 'predicted_turbidity_removal',
  }
  return mapping[domainId] || 'predicted_yield'
}

export function getTargetLabel(domainId, short = false) {
  const domain = DOMAINS[domainId]
  if (!domain) return 'Target'
  return short ? domain.target.split('(')[0].trim() : domain.target
}

export function getTargetUnit(domainId) {
  const domain = DOMAINS[domainId]
  return domain?.targetUnit || '%'
}

export const getTargetUnitForDomain = getTargetUnit

export function getStageLabels(domainId) {
  const domain = DOMAINS[domainId]
  return domain?.stages || []
}

export function getStageIcon(stageKey, domainId) {
  const stageLabels = getStageLabels(domainId)
  const stage = stageLabels.find(s => s.key === stageKey)
  return stage?.icon || '•'
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
  water: 'Low water usage',
  charging: 'Low charging rate',
  coagulant: 'Low chemical usage',
}

export const COMPONENT_COLORS = {
  yield: '#38e2f5',
  time: '#22d3ee',
  temperature: '#a78bfa',
  pressure: '#60a5fa',
  risk: '#34d399',
  water: '#34d399',
  charging: '#34d399',
  coagulant: '#34d399',
}

export function truncate(text, max = 160) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}
