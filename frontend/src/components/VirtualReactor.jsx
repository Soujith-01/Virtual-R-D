import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, GlassCard, Meter, Pill, SectionTitle } from './ui'
import { STAGE_META, STAGE_ORDER } from '../lib/constants'
import { num, paramValue, riskTone, yieldTone } from '../lib/format'

const STAGE_LIQUID = {
  INITIALIZING: 'from-slate-500/70 to-slate-400/50',
  HEATING: 'from-amber-500/70 to-orange-400/60',
  STABILIZING: 'from-violet-500/70 to-fuchsia-400/60',
  REACTION: 'from-cyan-400/80 to-sky-500/70',
  ANALYZING: 'from-sky-500/70 to-blue-500/60',
  COMPLETE: 'from-emerald-400/75 to-teal-500/65',
}

const STAGE_RING = {
  INITIALIZING: 'border-slate-400/40',
  HEATING: 'border-amber-400/60',
  STABILIZING: 'border-violet-400/60',
  REACTION: 'border-cyan-300/80',
  ANALYZING: 'border-sky-400/60',
  COMPLETE: 'border-emerald-400/70',
}

function Gauge({ label, value, unit, max, tone = 'cyan', digits = 0 }) {
  const ratio = Math.max(0, Math.min(1, value / (max || 1)))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const colors = { cyan: '#38e2f5', amber: '#fbbf24', violet: '#a78bfa', emerald: '#34d399', sky: '#38bdf8' }

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

export default function VirtualReactor({ simulation, onComplete, onExit, title = 'Virtual reactor', mode = 'ai' }) {
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

  const logs = useMemo(() => {
    if (!simulation?.stages) return []
    const entries = []
    simulation.stages.forEach((stage) => {
      if (frame.t_ms >= stage.start_ms) {
        entries.push({ kind: 'stage', text: `${STAGE_META[stage.stage]?.label ?? stage.stage}` })
        ;(stage.log || []).forEach((line) => entries.push({ kind: 'line', text: line }))
      }
    })
    return entries.slice(-9)
  }, [simulation, frame.t_ms])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs.length])

  if (!simulation) return null

  const stage = frame.stage || 'INITIALIZING'
  const stageIndex = STAGE_ORDER.indexOf(stage)
  const experiment = simulation.experiment
  const liquidLevel =
    stage === 'ANALYZING' || stage === 'COMPLETE'
      ? 46
      : Math.min(58, (frame.progress / 18) * 58)

  return (
    <section className="space-y-4">
      <GlassCard className="p-5">
        <SectionTitle
          eyebrow={mode === 'manual' ? 'Step 3 of 4' : 'Step 04'}
          title={title}
          description="A staged virtual run of the selected experiment. This is a visual simulation for demonstration — not a laboratory control system, and not a measured laboratory result."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="cyan" dot={playing}>
                {STAGE_META[stage]?.label ?? stage}
              </Pill>
              <Pill tone="slate">{num(frame.progress, 0)}% progress</Pill>
              <Pill tone={riskTone(simulation.safety?.within_comfortable_window ? 'low' : 'high')}>
                {simulation.safety?.within_comfortable_window ? 'Within configured parameter range' : 'Outside parameter range'}
              </Pill>
            </div>
          }
        />
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {/* ------------------------------ vessel ------------------------------ */}
        <GlassCard strong className="relative overflow-hidden p-6">
          <div className="flex items-start justify-between">
            <div className="text-xs text-slate-400">Reactor status</div>
            <span className="mono text-[10px] text-slate-500">
              {num(frame.reaction_time_elapsed, 1)} / {num(experiment.reaction_time, 0)} min elapsed
            </span>
          </div>

          <div className="relative mx-auto mt-6 w-[240px]">
            {/* jacket glow */}
            <div
              className={`absolute -inset-3 rounded-[999px] border-2 ${STAGE_RING[stage]} blur-[1px]`}
              style={{ transition: 'border-color 500ms ease' }}
            />

            {/* vessel */}
            <div className="relative h-[300px] w-[240px] overflow-hidden rounded-t-2xl rounded-b-[999px] border-2 border-cyan-200/25 bg-lab-900/60 backdrop-blur">
              {/* scan line */}
              {playing && (
                <div className="absolute inset-x-0 top-0 h-12 animate-lab-scan bg-gradient-to-b from-transparent via-cyan-300/12 to-transparent" />
              )}

              {/* liquid */}
              <div
                className={`reactor-liquid absolute inset-x-0 bottom-0 bg-gradient-to-t ${STAGE_LIQUID[stage]}`}
                style={{ height: `${liquidLevel}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-2 bg-white/25 blur-[2px]" />
              </div>

              {/* bubbles */}
              {stage === 'REACTION' &&
                playing &&
                Array.from({ length: 12 }).map((_, bubble) => (
                  <span
                    key={bubble}
                    className="absolute rounded-full bg-cyan-100/45"
                    style={{
                      left: `${8 + ((bubble * 37) % 84)}%`,
                      bottom: `${8 + ((bubble * 19) % 40)}%`,
                      width: `${3 + (bubble % 4)}px`,
                      height: `${3 + (bubble % 4)}px`,
                      animation: `lab-bubble ${2 + (bubble % 5) * 0.32}s linear ${bubble * 0.14}s infinite`,
                    }}
                  />
                ))}

              {/* readouts */}
              <div className="absolute left-3 top-3 space-y-1">
                <div className="mono rounded-md bg-lab-950/70 px-2 py-0.5 text-[10px] text-cyan-200">
                  {num(frame.temperature, 1)} °C
                </div>
                <div className="mono rounded-md bg-lab-950/70 px-2 py-0.5 text-[10px] text-sky-200">
                  {num(frame.pressure, 2)} bar
                </div>
              </div>
            </div>

            {/* base */}
            <div className="mx-auto h-3 w-[270px] -translate-x-[15px] rounded-b-xl border border-cyan-200/20 bg-lab-800/70" />
          </div>

          {/* simulated progress */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="label-caps text-slate-500">
                Simulated Progress
              </span>
              <span className="mono text-sm text-cyan-200">
                {num(frame.yield_so_far, 1)}%
                <span className="ml-1 text-[10px] text-slate-500">
                  vs. predicted {num(simulation.predicted_yield, 1)}%
                </span>
              </span>
            </div>
            <Meter
              className="mt-2"
              value={frame.yield_so_far}
              max={Math.max(simulation.predicted_yield, 1)}
              tone={yieldTone(frame.yield_so_far)}
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
              {mode === 'manual' ? 'Skip to result →' : 'Skip to report →'}
            </Button>
          </div>
        </GlassCard>

        {/* ------------------------------ telemetry ------------------------------ */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="grid grid-cols-4 gap-2">
              <Gauge label="Temp" value={frame.temperature || 0} unit="°C" max={170} tone="amber" digits={0} />
              <Gauge label="Pressure" value={frame.pressure || 0} unit="bar" max={10} tone="sky" digits={1} />
              <Gauge
                label="Elapsed"
                value={frame.reaction_time_elapsed || 0}
                unit="min"
                max={experiment.reaction_time || 1}
                tone="violet"
                digits={0}
              />
              <Gauge
                label="Progress"
                value={frame.yield_so_far || 0}
                unit="%"
                max={Math.max(simulation.predicted_yield, 1)}
                tone="cyan"
                digits={0}
              />
            </div>
          </GlassCard>

          {/* stage timeline */}
          <GlassCard className="p-5">
            <div className="label-caps mb-3 text-slate-500">Simulation Stages</div>
            <ol className="space-y-2">
              {simulation.stages.map((stageEntry) => {
                const position = STAGE_ORDER.indexOf(stageEntry.stage)
                const done = position < stageIndex
                const active = position === stageIndex
                const meta = STAGE_META[stageEntry.stage] || {}
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
                    <span className="text-sm">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-medium ${
                          active ? 'text-cyan-100' : done ? 'text-emerald-200/90' : 'text-slate-400'
                        }`}
                      >
                        {meta.label ?? stageEntry.stage}
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
              <div className="label-caps text-slate-500">Simulation Log</div>
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
          title="Model prediction vs simulated result"
          description="The prediction came from the trained Random Forest model. The simulated value uses a separate surrogate inside the virtual reactor — the difference is informative, not an error."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Temperature / Pressure', value: `${num(experiment.temperature, 0)} °C · ${num(experiment.pressure, 1)} bar` },
            { label: 'Concentration / Catalyst', value: `${paramValue('concentration', experiment.concentration)} · ${paramValue('catalyst', experiment.catalyst)}` },
            { label: 'Reaction Time', value: paramValue('reaction_time', experiment.reaction_time) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2.5">
              <div className="label-caps text-slate-500">{item.label}</div>
              <div className="mono mt-1 text-sm text-slate-200">{item.value}</div>
            </div>
          ))}
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/5 px-3 py-2.5">
            <div className="label-caps text-cyan-300/80">Predicted / Simulated</div>
            <div className="mono mt-1 text-sm text-cyan-100">
              {num(simulation.predicted_yield, 1)}% / {num(simulation.observed_yield, 1)}%
            </div>
            <div className="mono text-[10px] text-slate-400">
              {simulation.prediction_error >= 0 ? '+' : ''}
              {num(simulation.prediction_error, 2)} percentage points difference
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
