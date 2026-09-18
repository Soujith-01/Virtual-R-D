import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, GlassCard, Meter, Pill, TEXT_TONES } from './ui'
import { COMPONENT_COLORS, COMPONENT_LABELS, paramValue, riskTone, scoreTone, yieldTone } from '../lib/format'
import { CATALYST_LABELS } from '../lib/constants'
import { getTargetLabel, getTargetUnit, getPredictionKey, getStageLabels } from '../lib/format'

const PARAM_ORDER = [
  // reaction_yield
  'temperature', 'pressure', 'catalyst', 'concentration', 'reaction_time',
  // solar_efficiency
  'cell_thickness_nm', 'doping_concentration', 'annealing_temperature_c',
  // plant_growth
  'co2_concentration_ppm', 'nutrient_concentration_mm', 'water_supply_ml_day',
  // battery_performance
  'electrolyte_concentration_m', 'charging_rate_c', 'discharge_rate_c', 'cycle_count',
  // water_purification
  'coagulant_dose_mg_l', 'ph', 'contact_time_min', 'mixing_speed_rpm',
  // shared across domains (no duplicates)
  'light_intensity_lux', 'operating_temperature_c', 'temperature_c',
]

export default function ExperimentCard({ experiment, selected, recommended, onSimulate, index = 0, domainId = 'reaction-yield', predictionKey = 'predicted_yield' }) {
  const [showReasoning, setShowReasoning] = useState(false)
  const tone = scoreTone(experiment.score)

  // Get the prediction value
  const predValue = experiment[predictionKey] || experiment.predicted_yield || experiment.predicted_efficiency ||
    experiment.predicted_biomass_yield || experiment.predicted_capacity_retention || experiment.predicted_turbidity_removal || 0

  // Get target label and unit
  const targetLabel = getTargetLabel(domainId, true)
  const targetUnit = getTargetUnit(domainId)

  // Get stage labels for this domain
  const stageLabels = getStageLabels(domainId)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <GlassCard
        hover
        strong={selected}
        className={`relative h-full overflow-hidden p-4 ${
          selected ? '!border-cyan-300/55 accent-glow' : ''
        }`}
      >
        {recommended && (
          <span className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-r from-cyan-400 to-sky-500 px-2.5 py-1 text-[10px] font-bold tracking-wide text-lab-950">
            RECOMMENDED
          </span>
        )}

        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="mono text-sm font-semibold text-slate-100">{experiment.id}</span>
              <Pill tone={tone}>score {experiment.score?.toFixed(1) || '—'}</Pill>
              <Pill tone={riskTone(experiment.risk?.level)}>{experiment.risk?.level || 'unknown'} risk</Pill>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              rank #{experiment.rank} · origin: {experiment.origin} ·{' '}
              {experiment.catalyst ? CATALYST_LABELS[experiment.catalyst] ?? experiment.catalyst : ''}
              {experiment.operating_temperature_c && ` · ${experiment.operating_temperature_c}°C`}
            </div>
          </div>
        </div>

        {/* predicted value */}
        <div className="mt-3 rounded-xl border border-white/5 bg-white/2 p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="label-caps text-slate-500">Predicted {targetLabel}</div>
              <div className="mono text-2xl font-semibold">
                <span className={TEXT_TONES[yieldTone(predValue)]}>
                  {predValue.toFixed(1)}
                </span>
                <span className="ml-1 text-sm text-slate-500">{targetUnit}</span>
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <div className="mono">±{experiment.uncertainty_std?.toFixed(2) || '—'} sd</div>
              <div className="mono">
                {(experiment.interval_low || 0).toFixed(1)}–{(experiment.interval_high || 0).toFixed(1)}{targetUnit}
              </div>
              <div>conf {experiment.estimated_confidence?.toFixed(2) || '—'}</div>
            </div>
          </div>
          <Meter className="mt-2" value={predValue} tone={yieldTone(predValue)} />
        </div>

        {/* parameters */}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {PARAM_ORDER.map((key) => {
            if (experiment[key] === undefined || experiment[key] === null) return null
            return (
              <div key={key}>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  {key.replace(/_/g, ' ')}
                </dt>
                <dd className="mono text-xs text-slate-200">{paramValue(key, experiment[key], domainId)}</dd>
              </div>
            )
          })}
        </dl>

        {/* score composition */}
        <div className="mt-3">
          <div className="label-caps mb-1.5 text-slate-500">Score composition</div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            {Object.keys(COMPONENT_LABELS).map((component) => {
              const share = (experiment.contributions?.[component] || 0) / (experiment.score || 1)
              if (share <= 0) return null
              return (
                <div
                  key={component}
                  title={`${COMPONENT_LABELS[component]}: ${experiment.contributions[component]} pts`}
                  style={{ width: `${share * 100}%`, background: COMPONENT_COLORS[component] }}
                  className="h-full"
                />
              )
            })}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-slate-500">
            {Object.keys(COMPONENT_LABELS).map((component) => (
              <span key={component} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: COMPONENT_COLORS[component] }}
                />
                {COMPONENT_LABELS[component]}{' '}
                <span className="mono text-slate-400">
                  {experiment.contributions?.[component]?.toFixed(1) ?? '0.0'}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 !py-2 text-xs" onClick={() => onSimulate(experiment)}>
            Select & simulate
          </Button>
          <Button variant="ghost" className="!px-3 !py-2 text-xs" onClick={() => setShowReasoning(!showReasoning)}>
            {showReasoning ? 'Hide' : 'Why?'}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showReasoning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-[11px] leading-relaxed">
                <p className="text-slate-300">
                  <span className="label-caps mr-1 text-cyan-300/80">Reason</span>
                  {experiment.reason}
                </p>
                {experiment.rationale && <p className="text-slate-400">{experiment.rationale}</p>}
                {experiment.risk?.factors?.length > 0 && (
                  <p className="text-amber-200/80">
                    <span className="label-caps mr-1">Risk factors</span>
                    {experiment.risk.factors.join(' · ')}
                  </p>
                )}
                {experiment.constraint_violations?.length > 0 && (
                  <p className="text-rose-300">
                    <span className="label-caps mr-1">Constraints</span>
                    {experiment.constraint_violations.join(' · ')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  )
}
