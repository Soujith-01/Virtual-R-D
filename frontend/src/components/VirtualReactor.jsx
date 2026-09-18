import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, GlassCard, Meter, Pill, SectionTitle } from './ui'
import { num, paramValue, riskTone, yieldTone, getStageLabels, getStageIcon, getPredictionKey, getTargetLabel, getTargetUnit } from '../lib/format'
import { DOMAINS } from '../lib/constants'
import { ACCENT_COLORS } from '../lib/constants'

const STAGE_ORDER_MAP = {
  'reaction-yield': ['INITIALIZING', 'HEATING', 'STABILIZING', 'REACTION', 'ANALYZING', 'COMPLETE'],
  'solar-efficiency': ['INITIALIZE', 'SET_ENVIRONMENT', 'APPLY_LIGHT', 'MEASURE_OUTPUT', 'ANALYZE', 'COMPLETE'],
  'plant-growth': ['PREPARE_ENVIRONMENT', 'SET_LIGHT', 'SET_CO2', 'APPLY_NUTRIENTS', 'WATERING', 'GROWTH_SIMULATION', 'ANALYZE', 'COMPLETE'],
  'battery-performance': ['INITIALIZE_CELL', 'SET_TEMPERATURE', 'CHARGE', 'REST', 'DISCHARGE', 'CYCLE_ANALYSIS', 'COMPLETE'],
  'water-purification': ['PREPARE_SAMPLE', 'ADD_COAGULANT', 'ADJUST_PH', 'MIX', 'CONTACT_PERIOD', 'MEASURE_TURBIDITY', 'ANALYZE', 'COMPLETE'],
}

const STAGE_LIQUID = {
  INITIALIZING: 'from-slate-500/70 to-slate-400/50',
  HEATING: 'from-amber-500/70 to-orange-400/60',
  STABILIZING: 'from-violet-500/70 to-fuchsia-400/60',
  REACTION: 'from-cyan-400/80 to-sky-500/70',
  ANALYZING: 'from-sky-500/70 to-blue-500/60',
  COMPLETE: 'from-emerald-400/75 to-teal-500/65',
  INITIALIZE: 'from-slate-500/70 to-slate-400/50',
  SET_ENVIRONMENT: 'from-amber-500/70 to-orange-400/60',
  APPLY_LIGHT: 'from-yellow-500/70 to-amber-400/60',
  MEASURE_OUTPUT: 'from-cyan-400/80 to-sky-500/70',
  PREPARE_ENVIRONMENT: 'from-slate-500/70 to-slate-400/50',
  SET_LIGHT: 'from-yellow-500/70 to-amber-400/60',
  SET_CO2: 'from-emerald-500/70 to-green-400/60',
  APPLY_NUTRIENTS: 'from-green-500/70 to-emerald-400/60',
  WATERING: 'from-blue-500/70 to-sky-400/60',
  GROWTH_SIMULATION: 'from-emerald-500/70 to-green-400/60',
  INITIALIZE_CELL: 'from-slate-500/70 to-slate-400/50',
  SET_TEMPERATURE: 'from-amber-500/70 to-orange-400/60',
  CHARGE: 'from-yellow-500/70 to-amber-400/60',
  REST: 'from-violet-500/70 to-fuchsia-400/60',
  DISCHARGE: 'from-red-500/70 to-rose-400/60',
  CYCLE_ANALYSIS: 'from-violet-500/70 to-fuchsia-400/60',
  PREPARE_SAMPLE: 'from-slate-500/70 to-slate-400/50',
  ADD_COAGULANT: 'from-blue-500/70 to-sky-400/60',
  ADJUST_PH: 'from-cyan-500/70 to-blue-400/60',
  MIX: 'from-sky-500/70 to-blue-400/60',
  CONTACT_PERIOD: 'from-blue-500/70 to-sky-400/60',
  MEASURE_TURBIDITY: 'from-cyan-500/70 to-blue-400/60',
}

const STAGE_RING = {
  INITIALIZING: 'border-slate-400/40',
  HEATING: 'border-amber-400/60',
  STABILIZING: 'border-violet-400/60',
  REACTION: 'border-cyan-300/80',
  ANALYZING: 'border-sky-400/60',
  COMPLETE: 'border-emerald-400/70',
  INITIALIZE: 'border-slate-400/40',
  SET_ENVIRONMENT: 'border-amber-400/60',
  APPLY_LIGHT: 'border-yellow-400/60',
  MEASURE_OUTPUT: 'border-cyan-300/80',
  PREPARE_ENVIRONMENT: 'border-slate-400/40',
  SET_LIGHT: 'border-yellow-400/60',
  SET_CO2: 'border-emerald-400/60',
  APPLY_NUTRIENTS: 'border-green-400/60',
  WATERING: 'border-blue-400/60',
  GROWTH_SIMULATION: 'border-emerald-400/60',
  INITIALIZE_CELL: 'border-slate-400/40',
  SET_TEMPERATURE: 'border-amber-400/60',
  CHARGE: 'border-yellow-400/60',
  REST: 'border-violet-400/60',
  DISCHARGE: 'border-red-400/60',
  CYCLE_ANALYSIS: 'border-violet-400/60',
  PREPARE_SAMPLE: 'border-slate-400/40',
  ADD_COAGULANT: 'border-blue-400/60',
  ADJUST_PH: 'border-cyan-400/60',
  MIX: 'border-sky-400/60',
  CONTACT_PERIOD: 'border-blue-400/60',
  MEASURE_TURBIDITY: 'border-cyan-400/60',
}

function Gauge({ label, value, unit, max, tone = 'cyan', digits = 0 }) {
  const ratio = Math.max(0, Math.min(1, value / (max || 1)))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const colors = { cyan: '#38e2f5', amber: '#fbbf24', violet: '#a78bfa', emerald: '#34d399', sky: '#38bdf8', yellow: '#f59e0b', green: '#22c55e', red: '#f43f5e', rose: '#f43f5e', blue: '#3b82f6' }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="86" height="86" viewBox="0 0 86 86" className="-rotate-90">
          <circle cx="43" cy="43" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="7" />
          <motion.circle
            cx="43"
            cy="43"
            r={radius}
            fill="none"
            stroke={colors[tone]}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - ratio) }}
            transition={{ duration: 0.2, ease: 'linear' }}
            style={{ filter: `drop-shadow(0 0 6px ${colors[tone]}80)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="mono text-[15px] font-semibold text-slate-100">{num(value, digits)}</div>
            <div className="text-[9px] text-slate-500">{unit}</div>
          </div>
        </div>
      </div>
      <div className="label-caps mt-1 text-slate-500">{label}</div>
    </div>
  )
}

export default function VirtualReactor({ simulation, onComplete, onExit, title = 'Virtual experiment', domainId = 'reaction-yield' }) {
  const domain = DOMAINS[domainId] || DOMAINS['reaction-yield']
  const accentColor = domain?.accentColor || 'cyan'
  const accent = ACCENT_COLORS[accentColor] || ACCENT_COLORS.cyan

  const frames = simulation?.frames || []
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const completedRef = useRef(false)
  const logRef = useRef(null)

  const interval = Math.max((simulation?.frame_interval_ms || 200) / speed, 30)

  useEffect(() => {
    setIndex(0)
    setPlaying(true)
    completedRef.current = false
  }, [simulation])

  useEffect(() => {
    if (!playing || !frames.length) return undefined
    if (index >= frames.length - 1) return undefined

    const timer = setTimeout(() => setIndex((value) => Math.min(value + 1, frames.length - 1)), interval)
    return () => clearTimeout(timer)
  }, [playing, index, frames.length, interval])

  useEffect(() => {
    if (!frames.length || completedRef.current) return
    if (index >= frames.length - 1) {
      completedRef.current = true
      setPlaying(false)
      onComplete?.()
    }
  }, [index, frames.length, onComplete])

  const frame = frames[index] || frames[0] || {}
  const stageOrder = STAGE_ORDER_MAP[domainId] || STAGE_ORDER_MAP['reaction-yield']
  const stageLabels = getStageLabels(domainId)

  const logs = useMemo(() => {
    if (!simulation?.stages) return []
    const entries = []
    simulation.stages.forEach((stage) => {
      if (frame.t_ms >= stage.start_ms) {
        const stageInfo = stageLabels.find(s => s.key === stage.stage)
        entries.push({ kind: 'stage', text: `${stageInfo?.label ?? stage.stage}` })
        ;(stage.log || []).forEach((line) => entries.push({ kind: 'line', text: line }))
      }
    })
    return entries.slice(-9)
  }, [simulation, frame.t_ms, stageLabels])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs.length])

  if (!simulation) return null

  const stage = frame.stage || stageOrder[0]
  const stageIndex = stageOrder.indexOf(stage)
  const experiment = simulation.experiment
  const targetUnit = getTargetUnit(domainId)
  const targetLabel = getTargetLabel(domainId, true)
  const predictionKey = getPredictionKey(domainId)

  // Get simulated value based on domain
  const simulatedValue = frame[`${targetLabel.toLowerCase().replace(/\s+/g, '_')}_value`] ||
    frame.yield_so_far ||
    frame.biomass ||
    frame.capacity ||
    frame.removal ||
    0

  // Get the appropriate simulated value for display
  const displaySimulatedValue = simulation.observed_target !== undefined
    ? simulation.observed_target
    : simulation.observed_yield ||
    simulatedValue

  // Determine liquid level based on progress
  const liquidLevel =
    stage === 'ANALYZING' || stage === 'COMPLETE' || stage?.includes('ANALYZE') || stage?.includes('COMPLETE')
      ? 46
      : Math.min(58, (frame.progress / 18) * 58)

  // Get gauge values based on domain
  const gaugeConfigs = getGaugeConfigs(domainId, frame, experiment, simulation)

  return (
    <section className="space-y-4">
      <GlassCard className="p-5" style={{ borderColor: 'rgba(103, 232, 249, 0.2)' }}>
        <SectionTitle
          eyebrow="Step 04"
          title={title}
          description="A staged virtual run of the selected experiment. This is a visual simulation for demonstration — not a laboratory control system, and not a measured laboratory result."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="cyan" dot={playing}>
                {stageLabels.find(s => s.key === stage)?.label ?? stage}
              </Pill>
              <Pill tone="slate">{num(frame.progress, 0)}% progress</Pill>
              <Pill tone={riskTone(simulation.safety?.within_comfortable_window ? 'low' : 'high')}>
                {simulation.safety?.within_comfortable_window ? 'Within parameter range' : 'Outside parameter range'}
              </Pill>
            </div>
          }
        />
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {/* ------------------------------ vessel / visualization ------------------------------ */}
        <GlassCard strong className="relative overflow-hidden p-6">
          <div className="flex items-start justify-between">
            <div className="text-xs text-slate-400">Experiment status</div>
            <span className="mono text-[10px] text-slate-500">
              {num(frame.t_ms || 0, 0)} / {num(simulation.total_duration_ms || 13000, 0)} ms elapsed
            </span>
          </div>

          {/* Main visualization area */}
          <div className="relative mx-auto mt-6 w-full max-w-[300px]">
            {/* background glow */}
            <div
              className={`absolute -inset-3 rounded-[999px] border-2 ${STAGE_RING[stage] || 'border-cyan-300/40'} blur-[1px]`}
              style={{ transition: 'border-color 500ms ease' }}
            />

            {/* Main vessel/container */}
            <div className="relative h-[280px] w-full max-w-[280px] overflow-hidden rounded-t-2xl rounded-b-[999px] border-2 border-cyan-200/25 bg-lab-900/60 backdrop-blur">
              {/* scan line */}
              {playing && (
                <div className="absolute inset-x-0 top-0 h-12 animate-lab-scan bg-gradient-to-b from-transparent via-cyan-300/12 to-transparent" />
              )}

              {/* Content area based on domain */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  {/* Stage icon */}
                  <div className="text-6xl mb-2">
                    {getStageIcon(stage, domainId)}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 w-48 mx-auto">
                    <Meter
                      value={frame.progress}
                      max={100}
                      tone="cyan"
                      height="h-2"
                      glow
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {num(frame.progress, 0)}% complete
                  </div>
                </div>
              </div>
            </div>

            {/* base */}
            <div className="mx-auto h-3 w-full max-w-[300px] -translate-x-[15px] rounded-b-xl border border-cyan-200/20 bg-lab-800/70" />
          </div>

          {/* simulated progress */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="label-caps text-slate-500">
                Simulated {targetLabel}
              </span>
              <span className="mono text-sm text-cyan-200">
                {num(displaySimulatedValue, 1)}
                <span className="ml-1 text-[10px] text-slate-500">
                  {targetUnit} vs. predicted {num(simulation[predictionKey] || simulation.predicted_yield || simulation.predicted_target || 0, 1)}{targetUnit}
                </span>
              </span>
            </div>
            <Meter
              className="mt-2"
              value={displaySimulatedValue}
              max={Math.max(simulation[predictionKey] || simulation.predicted_yield || simulation.predicted_target || 1, 1)}
              tone={yieldTone(displaySimulatedValue)}
              height="h-2.5"
              glow
            />
          </div>

          {/* controls */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button className="!py-2 text-xs" onClick={() => setPlaying((value) => !value)}>
              {playing ? '❙❙ Pause' : '▶ Play'}
            </Button>
            <Button
              variant="ghost"
              className="!py-2 text-xs"
              onClick={() => {
                setIndex(0)
                completedRef.current = false
                setPlaying(true)
              }}
            >
              ↺ Restart
            </Button>
            <div className="flex gap-1">
              {[1, 2, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  className={`mono rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                    speed === value ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {value}×
                </button>
              ))}
            </div>
            <Button variant="subtle" className="!py-2 text-xs" onClick={onExit}>
              Skip to report →
            </Button>
          </div>
        </GlassCard>

        {/* ------------------------------ telemetry ------------------------------ */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {gaugeConfigs.map((gauge) => (
                <Gauge
                  key={gauge.label}
                  label={gauge.label}
                  value={gauge.value}
                  unit={gauge.unit}
                  max={gauge.max}
                  tone={gauge.tone}
                  digits={gauge.digits}
                />
              ))}
            </div>
          </GlassCard>

          {/* stage timeline */}
          <GlassCard className="p-5">
            <div className="label-caps mb-3 text-slate-500">Experiment Stages</div>
            <ol className="space-y-2">
              {simulation.stages.map((stageEntry) => {
                const position = stageOrder.indexOf(stageEntry.stage)
                const done = position < stageIndex
                const active = position === stageIndex
                const stageInfo = stageLabels.find(s => s.key === stageEntry.stage)
                return (
                  <li
                    key={stageEntry.stage}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                      active
                        ? 'border-cyan-300/45 bg-cyan-400/10'
                        : done
                          ? 'border-emerald-400/20 bg-emerald-400/5'
                          : 'border-white/5'
                    }`}
                  >
                    <span className="text-sm">{getStageIcon(stageEntry.stage, domainId)}</span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-medium ${
                          active ? 'text-cyan-100' : done ? 'text-emerald-200/90' : 'text-slate-400'
                        }`}
                      >
                        {stageInfo?.label ?? stageEntry.stage}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">{stageEntry.description}</div>
                    </div>
                    {active && (
                      <div className="w-24">
                        <Meter value={frame.stage_progress} tone="cyan" height="h-1" />
                      </div>
                    )}
                    {done && <span className="text-[10px] text-emerald-300">✓</span>}
                  </li>
                )
              })}
            </ol>
          </GlassCard>

          {/* log console */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="label-caps text-slate-500">Experiment Log</div>
              <span className="mono text-[10px] text-slate-500">{num(frame.progress, 0)}% overall</span>
            </div>
            <div ref={logRef} className="mono mt-3 h-[130px] overflow-y-auto rounded-xl bg-lab-950/70 p-3 text-[11px] leading-relaxed">
              <AnimatePresence initial={false}>
                {logs.map((entry, position) => (
                  <motion.div
                    key={`${entry.text}-${position}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={entry.kind === 'stage' ? 'mt-1 font-semibold text-cyan-300' : 'text-slate-400'}
                  >
                    {entry.kind === 'stage' ? `── ${entry.text} ──` : `  ${entry.text}`}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {simulation.safety?.flags?.length > 0 && (
              <p className="mt-2 text-[10px] leading-relaxed text-amber-200/75">
                {simulation.safety.flags.join(' · ')}
              </p>
            )}
          </GlassCard>
        </div>
      </div>

      {/* -------------------------- predicted vs simulated -------------------------- */}
      <GlassCard className="p-5">
        <SectionTitle
          eyebrow="Outcome"
          title={`Model prediction vs simulated result`}
          description="The prediction came from the trained Random Forest model. The simulated value uses a separate surrogate inside the virtual experiment — the difference is informative, not an error."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(experiment).slice(0, 4).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2.5">
              <div className="label-caps text-slate-500">{paramValue(key, value, domainId)}</div>
              <div className="mono mt-1 text-sm text-slate-200">{paramValue(key, value, domainId)}</div>
            </div>
          ))}
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/5 px-3 py-2.5">
            <div className="label-caps text-cyan-300/80">Predicted / Simulated</div>
            <div className="mono mt-1 text-sm text-cyan-100">
              {num(simulation[predictionKey] || simulation.predicted_yield || simulation.predicted_target || 0, 1)}{targetUnit} / {num(displaySimulatedValue, 1)}{targetUnit}
            </div>
            <div className="mono text-[10px] text-slate-400">
              {simulation.prediction_error !== undefined ? (simulation.prediction_error >= 0 ? '+' : '') + num(simulation.prediction_error, 2) : ''} percentage points difference
            </div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">{simulation.summary}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-amber-200/60">
          Virtual simulation for demonstration only — not a measured laboratory result.
        </p>
      </GlassCard>
    </section>
  )
}

function getGaugeConfigs(domainId, frame, experiment, simulation) {
  const configs = []

  switch (domainId) {
    case 'reaction-yield':
      configs.push(
        { label: 'Temp', value: frame.temperature || 0, unit: '°C', max: 170, tone: 'amber', digits: 0 },
        { label: 'Pressure', value: frame.pressure || 0, unit: 'bar', max: 10, tone: 'sky', digits: 1 },
        { label: 'Elapsed', value: frame.reaction_time_elapsed || 0, unit: 'min', max: experiment.reaction_time || 1, tone: 'violet', digits: 0 },
        { label: 'Progress', value: frame.yield_so_far || 0, unit: '%', max: Math.max(simulation.predicted_yield || 1, 1), tone: 'cyan', digits: 0 }
      )
      break
    case 'solar-efficiency':
      configs.push(
        { label: 'Light', value: frame.light_intensity || 0, unit: 'lux', max: 120000, tone: 'yellow', digits: 0 },
        { label: 'Cell Temp', value: frame.cell_temperature || 25, unit: '°C', max: 100, tone: 'amber', digits: 0 },
        { label: 'Output', value: frame.output_power || 0, unit: '%', max: 25, tone: 'cyan', digits: 1 },
        { label: 'Progress', value: frame.progress || 0, unit: '%', max: 100, tone: 'sky', digits: 0 }
      )
      break
    case 'plant-growth':
      configs.push(
        { label: frame.light_intensity !== undefined ? 'Light' : 'Temp', value: frame.light_intensity || frame.temperature || 0, unit: frame.light_intensity !== undefined ? 'lux' : '°C', max: frame.light_intensity !== undefined ? 80000 : 50, tone: 'yellow', digits: 0 },
        { label: 'CO₂', value: frame.co2_concentration || 400, unit: 'ppm', max: 1200, tone: 'emerald', digits: 0 },
        { label: 'Water', value: frame.water_supply || 0, unit: 'ml/day', max: 500, tone: 'sky', digits: 0 },
        { label: 'Biomass', value: frame.biomass || 0, unit: 'g', max: 200, tone: 'green', digits: 1 }
      )
      break
    case 'battery-performance':
      configs.push(
        { label: 'Temp', value: frame.temperature || 25, unit: '°C', max: 60, tone: 'amber', digits: 0 },
        { label: 'Charge', value: frame.charge_rate || 0, unit: 'C', max: 3, tone: 'yellow', digits: 1 },
        { label: 'Voltage', value: frame.voltage || 3.0, unit: 'V', max: 5, tone: 'sky', digits: 2 },
        { label: 'Capacity', value: frame.capacity || 0, unit: '%', max: 100, tone: 'cyan', digits: 0 }
      )
      break
    case 'water-purification':
      configs.push(
        { label: 'Turbidity', value: frame.turbidity || 100, unit: 'NTU', max: 100, tone: 'cyan', digits: 0 },
        { label: 'Dose', value: frame.coagulant_dose || 0, unit: 'mg/L', max: 100, tone: 'blue', digits: 1 },
        { label: 'pH', value: frame.ph || 7, unit: '', max: 14, tone: 'violet', digits: 1 },
        { label: 'Removal', value: frame.removal || 0, unit: '%', max: 100, tone: 'emerald', digits: 0 }
      )
      break
    default:
      configs.push(
        { label: 'Temp', value: frame.temperature || 0, unit: '°C', max: 170, tone: 'amber', digits: 0 },
        { label: 'Pressure', value: frame.pressure || 0, unit: 'bar', max: 10, tone: 'sky', digits: 1 },
        { label: 'Elapsed', value: frame.reaction_time_elapsed || 0, unit: 'min', max: experiment.reaction_time || 1, tone: 'violet', digits: 0 },
        { label: 'Progress', value: frame.yield_so_far || 0, unit: '%', max: Math.max(simulation.predicted_yield || 1, 1), tone: 'cyan', digits: 0 }
      )
  }

  return configs
}
