import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, ErrorBanner, GlassCard, Meter, Pill, Spinner } from './ui'
import VirtualReactor from './VirtualReactor'
import { PARAM_META, STAGE_META } from '../lib/constants'
import { confidenceTone, num, paramValue, yieldTone } from '../lib/format'
import { predict, simulate, runResearch } from '../api/client'

/* ─────────────────────────────── constants ──────────────────────────────── */

const STEPS = [
  { id: 'design', label: 'Design', number: 1 },
  { id: 'review', label: 'Review', number: 2 },
  { id: 'simulation', label: 'Run Simulation', number: 3 },
  { id: 'result', label: 'Result', number: 4 },
]

const DEFAULT_PARAMS = {
  temperature: 90,
  pressure: 2,
  catalyst: 'B',
  concentration: 0.2,
  reaction_time: 45,
}

const PARAM_TOOLTIPS = {
  temperature: 'The heat applied to the reactor vessel. Higher temperatures generally speed up reactions but may reduce selectivity.',
  pressure: 'The pressure maintained inside the reactor. Affects reaction equilibrium and boiling points.',
  catalyst: 'A substance that accelerates the reaction without being consumed. Different catalysts favor different reaction pathways.',
  concentration: 'The initial molar concentration of the reagent. Higher concentration typically increases reaction rate.',
  reaction_time: 'How long the reactor holds at the target temperature and pressure. Longer times allow more complete conversion.',
}

const CATALYST_FULL = {
  A: 'Catalyst A',
  B: 'Catalyst B',
  C: 'Catalyst C',
  D: 'Catalyst D',
  None: 'No Catalyst',
}

/* ────────────────────────────── sub-components ──────────────────────────── */

function StepIndicator({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex
        const upcoming = index > currentIndex
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ${
                active ? 'bg-cyan-400/15' : ''
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-300'
                    : active
                      ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'border-slate-600 bg-slate-800/50 text-slate-500'
                }`}
              >
                {done ? '✓' : step.number}
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                  active ? 'text-cyan-200' : done ? 'text-emerald-300/80' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-px w-8 sm:w-12 transition-colors duration-500 ${done ? 'bg-emerald-400/50' : 'bg-slate-700'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Tooltip({ text }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-block ml-1.5">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-700/80 text-[9px] text-slate-400 transition hover:border-cyan-400/50 hover:text-cyan-300"
        aria-label="More information"
      >
        ?
      </button>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-cyan-300/20 bg-lab-900/95 px-3 py-2.5 text-[11px] leading-relaxed text-slate-300 shadow-xl backdrop-blur"
          >
            {text}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-lab-900/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

function ParamRow({ meta, value, onChange }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/2 p-4 transition hover:border-cyan-300/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-slate-200">{meta.label}</span>
          {meta.unit && (
            <span className="ml-1.5 rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
              {meta.unit}
            </span>
          )}
          <Tooltip text={PARAM_TOOLTIPS[meta.key]} />
        </div>
        <span className="mono text-base font-semibold text-cyan-100">
          {meta.options ? CATALYST_FULL[value] ?? value : `${num(value, meta.decimals ?? 0)}${meta.unit ? ' ' + meta.unit : ''}`}
        </span>
      </div>

      {meta.options ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                value === option
                  ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-cyan-300/30 hover:text-slate-200'
              }`}
            >
              {CATALYST_FULL[option] ?? option}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <input
            type="range"
            min={meta.min}
            max={meta.max}
            step={meta.step}
            value={value}
            onChange={(e) => onChange(meta.key === 'concentration' || meta.key === 'pressure' ? Number(e.target.value) : Number(e.target.value))}
            className="w-full accent-cyan-400"
            style={{ accentColor: '#22d3ee' }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-600">
            <span>{meta.min}{meta.unit ? ' ' + meta.unit : ''}</span>
            <span>{meta.max}{meta.unit ? ' ' + meta.unit : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ConditionBadge({ label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
      <div className="label-caps text-slate-500">{label}</div>
      <div className="mono mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  )
}

/* ─────────────────────────── Step 1: Design ─────────────────────────────── */

function DesignStep({ name, setName, goal, setGoal, params, setParams, onNext }) {
  const canProceed = name.trim().length > 0 && goal.trim().length > 2

  return (
    <motion.div
      key="design"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* header */}
      <GlassCard strong className="p-6">
        <div className="label-caps text-cyan-400/80">Step 1 of 4</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
          Manual Experiment Design
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Define your experiment below. You choose the parameters — the AI will predict the outcome and run a virtual simulation.
        </p>
      </GlassCard>

      {/* identity */}
      <GlassCard className="p-6 space-y-5">
        <h3 className="text-base font-semibold text-slate-200 border-b border-white/8 pb-3">
          Experiment Identity
        </h3>

        <div>
          <label htmlFor="exp-name" className="flex items-center text-sm font-medium text-slate-300 mb-2">
            Experiment Name
            <Tooltip text="A short descriptive name for this experiment run. Helps you identify it in the results." />
          </label>
          <input
            id="exp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. High-temp Catalyst B screening"
            className="w-full rounded-xl border border-cyan-300/20 bg-lab-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        <div>
          <label htmlFor="exp-goal" className="flex items-center text-sm font-medium text-slate-300 mb-2">
            Research Goal
            <Tooltip text="What are you trying to achieve with this experiment? This helps the AI analysis provide relevant insights." />
          </label>
          <textarea
            id="exp-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="e.g. Investigate whether high temperature combined with Catalyst B improves yield beyond 85%."
            className="w-full resize-none rounded-xl border border-cyan-300/20 bg-lab-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
          />
          <div className="mt-1 text-right text-[10px] text-slate-600 mono">{goal.length}/400</div>
        </div>
      </GlassCard>

      {/* parameters */}
      <GlassCard className="p-6">
        <h3 className="text-base font-semibold text-slate-200 border-b border-white/8 pb-3 mb-5">
          Experimental Parameters
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {PARAM_META.map((meta) => (
            <ParamRow
              key={meta.key}
              meta={meta}
              value={params[meta.key]}
              onChange={(val) => setParams((prev) => ({ ...prev, [meta.key]: val }))}
            />
          ))}
        </div>
      </GlassCard>

      <div className="flex items-center gap-4">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="!px-8 !py-3 text-base"
          id="btn-review-experiment"
        >
          Review Experiment →
        </Button>
        {!canProceed && (
          <span className="text-xs text-slate-500">Please enter an experiment name and research goal to continue.</span>
        )}
      </div>
    </motion.div>
  )
}

/* ─────────────────────────── Step 2: Review ─────────────────────────────── */

function ReviewStep({ name, goal, params, prediction, predicting, predictError, onBack, onRun, onRetryPredict }) {
  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* header */}
      <GlassCard strong className="p-6">
        <div className="label-caps text-cyan-400/80">Step 2 of 4</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Experiment Summary</h2>
        <p className="mt-2 text-sm text-slate-400">
          Review your experiment design. The AI model predicts the expected yield below.
        </p>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {/* conditions */}
        <GlassCard className="p-6 space-y-5">
          <div>
            <div className="label-caps text-slate-500 mb-1">Experiment Name</div>
            <div className="text-lg font-semibold text-slate-100">{name}</div>
          </div>
          <div>
            <div className="label-caps text-slate-500 mb-1">Research Goal</div>
            <div className="text-sm leading-relaxed text-slate-300">{goal}</div>
          </div>
          <div>
            <div className="label-caps text-slate-500 mb-3">Selected Parameters</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ConditionBadge label="Temperature" value={`${num(params.temperature, 0)} °C`} />
              <ConditionBadge label="Pressure" value={`${num(params.pressure, 1)} bar`} />
              <ConditionBadge label="Catalyst" value={CATALYST_FULL[params.catalyst] ?? params.catalyst} />
              <ConditionBadge label="Concentration" value={`${num(params.concentration, 2)} M`} />
              <ConditionBadge label="Reaction Time" value={`${num(params.reaction_time, 0)} min`} />
            </div>
          </div>
        </GlassCard>

        {/* prediction */}
        <div className="space-y-4">
          <GlassCard strong className="p-6">
            <div className="label-caps text-cyan-400/80 mb-4">AI Predicted Yield</div>

            {predicting && (
              <div className="flex items-center gap-3 py-4 text-sm text-slate-400">
                <Spinner />
                Querying the Random Forest model…
              </div>
            )}

            {predictError && !predicting && (
              <div className="space-y-3">
                <ErrorBanner message={predictError} onRetry={onRetryPredict} onDismiss={onRetryPredict} />
              </div>
            )}

            {prediction && !predicting && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="relative">
                  <div className="absolute -inset-2 rounded-2xl bg-cyan-400/5 blur-xl" />
                  <div className="relative flex items-end gap-3">
                    <span className={`mono text-6xl font-bold leading-none ${prediction.predicted_yield >= 85 ? 'text-emerald-300' : prediction.predicted_yield >= 70 ? 'text-cyan-300' : prediction.predicted_yield >= 50 ? 'text-amber-300' : 'text-rose-300'}`}
                      style={{ textShadow: '0 0 30px currentColor' }}>
                      {num(prediction.predicted_yield, 1)}
                    </span>
                    <span className="mb-2 text-2xl text-slate-400">%</span>
                  </div>
                </div>

                <Meter
                  className="mt-4"
                  value={prediction.predicted_yield}
                  tone={yieldTone(prediction.predicted_yield)}
                  height="h-2.5"
                  glow
                />

                <div className="mono mt-2 flex justify-between text-[10px] text-slate-500">
                  <span>Interval {num(prediction.interval_low, 1)}%</span>
                  <span>±{num(prediction.uncertainty_std, 2)} sd</span>
                  <span>{num(prediction.interval_high, 1)}%</span>
                </div>

                <div className="mt-4 flex gap-2">
                  <Pill tone={confidenceTone(prediction.confidence)}>
                    Confidence {(prediction.confidence * 100).toFixed(0)}%
                  </Pill>
                  <Pill tone="slate">Random Forest · 300 trees</Pill>
                </div>

                <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/80">
                  <strong className="text-amber-200">Model prediction — prototype dataset.</strong>{' '}
                  This is a machine-learning estimate, not a measured laboratory result. The model was trained on synthetic data for demonstration purposes.
                </p>
              </motion.div>
            )}
          </GlassCard>

          {prediction && (
            <GlassCard className="p-4">
              <div className="label-caps text-slate-500 mb-2">Model Information</div>
              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Algorithm</span>
                  <span className="text-slate-300">Random Forest Regressor</span>
                </div>
                <div className="flex justify-between">
                  <span>Training data</span>
                  <span className="mono text-amber-200/80">synthetic_prototype_v1</span>
                </div>
                <div className="flex justify-between">
                  <span>Target variable</span>
                  <span className="text-slate-300">Yield (%)</span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack} id="btn-edit-parameters">
          ← Edit Parameters
        </Button>
        <Button
          onClick={onRun}
          disabled={!prediction || predicting}
          className="!px-8 !py-3 text-base"
          id="btn-run-virtual-experiment"
        >
          ⚗ Run Virtual Experiment
        </Button>
        {(!prediction || predicting) && !predictError && (
          <span className="text-xs text-slate-500">Waiting for AI prediction…</span>
        )}
      </div>
    </motion.div>
  )
}

/* ─────────────────────────── Step 3: Simulation ─────────────────────────── */

function SimulationStep({ name, params, prediction, simulation, simulating, simError, onComplete, onSkip }) {
  if (simulating && !simulation) {
    return (
      <motion.div
        key="sim-loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-5"
      >
        <GlassCard strong className="p-6">
          <div className="label-caps text-cyan-400/80">Step 3 of 4</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Virtual Simulation</h2>
        </GlassCard>
        <GlassCard className="flex items-center justify-center gap-4 p-16 text-slate-400">
          <Spinner className="h-6 w-6" />
          <span className="text-sm">Preparing the virtual reactor for <strong className="text-slate-200">{name}</strong>…</span>
        </GlassCard>
        {simError && <ErrorBanner message={simError} />}
      </motion.div>
    )
  }

  if (!simulation) return null

  return (
    <motion.div
      key="simulation"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* header */}
      <GlassCard strong className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-caps text-cyan-400/80">Step 3 of 4</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-50">Virtual Simulation Running</h2>
            <p className="mt-1 text-sm text-slate-400">
              "{name}" — watch the virtual reactor work through each stage.
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80 max-w-sm">
            This is a virtual simulation for demonstration only — not a laboratory control system.
          </div>
        </div>
      </GlassCard>

      {/* current experiment summary */}
      <GlassCard className="p-5">
        <div className="label-caps text-slate-500 mb-3">Current Experiment</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <ConditionBadge label="Temperature" value={`${num(params.temperature, 0)} °C`} />
          <ConditionBadge label="Pressure" value={`${num(params.pressure, 1)} bar`} />
          <ConditionBadge label="Catalyst" value={CATALYST_FULL[params.catalyst] ?? params.catalyst} />
          <ConditionBadge label="Concentration" value={`${num(params.concentration, 2)} M`} />
          <ConditionBadge label="Reaction Time" value={`${num(params.reaction_time, 0)} min`} />
        </div>
      </GlassCard>

      {/* existing reactor visual — preserved as-is */}
      <VirtualReactor
        simulation={simulation}
        title={`Virtual Reactor · ${name}`}
        mode="manual"
        onComplete={onComplete}
        onExit={onSkip}
      />
    </motion.div>
  )
}

/* ─────────────────────────── Step 4: Result ─────────────────────────────── */

function ResultStep({ name, goal, params, prediction, simulation, onRunAnother, onSwitchToAI }) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)

  const predictedYield = simulation?.predicted_yield ?? prediction?.predicted_yield ?? 0
  const factors = simulation?.factor_contributions ?? {}

  const fetchAnalysis = async () => {
    setShowAnalysis(true)
    if (analysis) return // already loaded
    setAnalysisLoading(true)
    setAnalysisError(null)
    try {
      const result = await runResearch({
        research_question: goal || `Optimize reaction yield for: T=${num(params.temperature, 0)}°C, P=${num(params.pressure, 1)} bar, Catalyst ${params.catalyst}`,
        num_experiments: 1,
        include_simulation: false,
        include_comparison: false,
      })
      setAnalysis(result)
    } catch (err) {
      setAnalysisError(err.friendlyMessage || 'Could not load AI analysis.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const topFactors = Object.entries(factors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const next = analysis?.next_suggested_experiment

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* header */}
      <GlassCard strong className="relative overflow-hidden p-7">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-400/8 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="label-caps text-cyan-400/80">Step 4 of 4</div>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-50">Experiment Result</h2>
          <p className="mt-2 text-sm text-slate-400">"{name}" has completed the virtual simulation.</p>

          {/* big yield number */}
          <div className="mt-6 flex items-end gap-4">
            <div>
              <div className="label-caps text-slate-400 mb-2">Predicted Yield</div>
              <div className="flex items-baseline gap-2">
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
                  className={`mono text-7xl font-bold leading-none ${predictedYield >= 85 ? 'text-emerald-300' : predictedYield >= 70 ? 'text-cyan-300' : predictedYield >= 50 ? 'text-amber-300' : 'text-rose-300'}`}
                  style={{ textShadow: '0 0 40px currentColor' }}
                >
                  {num(predictedYield, 1)}
                </motion.span>
                <span className="mb-3 text-3xl text-slate-400">%</span>
              </div>
              <Meter
                className="mt-3 max-w-[300px]"
                value={predictedYield}
                tone={yieldTone(predictedYield)}
                height="h-3"
                glow
              />
            </div>
            <div className="mb-3 space-y-2">
              <Pill tone="emerald" dot>Simulation Complete</Pill>
              {simulation?.safety?.within_comfortable_window && (
                <Pill tone="cyan">Within configured parameter range</Pill>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* experiment conditions */}
        <GlassCard className="p-6">
          <div className="label-caps text-slate-500 mb-4">Experiment Conditions</div>
          <div className="grid grid-cols-2 gap-3">
            <ConditionBadge label="Temperature" value={`${num(params.temperature, 0)} °C`} />
            <ConditionBadge label="Pressure" value={`${num(params.pressure, 1)} bar`} />
            <ConditionBadge label="Catalyst" value={CATALYST_FULL[params.catalyst] ?? params.catalyst} />
            <ConditionBadge label="Concentration" value={`${num(params.concentration, 2)} M`} />
            <ConditionBadge label="Reaction Time" value={`${num(params.reaction_time, 0)} min`} />
          </div>
        </GlassCard>

        {/* model prediction info */}
        <GlassCard className="p-6 space-y-4">
          <div>
            <div className="label-caps text-slate-500 mb-2">Model Prediction</div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Predicted using the trained <strong className="text-slate-100">Random Forest</strong> model
              ({prediction?.model?.metrics ? `R² ${num(prediction.model.metrics.r2, 3)}` : '300 trees'}).
            </p>
          </div>

          {topFactors.length > 0 && (
            <div>
              <div className="label-caps text-slate-500 mb-2">Key Contributing Factors</div>
              <div className="space-y-2">
                {topFactors.map(([factor, contribution]) => (
                  <div key={factor}>
                    <div className="flex justify-between text-[11px]">
                      <span className="capitalize text-slate-400">{factor.replace('_', ' ')}</span>
                      <span className="mono text-cyan-300">{num(contribution * 100, 1)}%</span>
                    </div>
                    <Meter className="mt-1" value={contribution * 100} tone="cyan" height="h-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/80">
            <strong className="text-amber-200">Important:</strong> This is a virtual simulation for demonstration and is not a measured laboratory result. The underlying dataset is synthetic (synthetic_prototype_v1).
          </div>
        </GlassCard>
      </div>

      {/* AI Analysis expandable */}
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="label-caps text-slate-500 mb-1">AI Analysis</div>
            <p className="text-sm text-slate-400">
              Get AI-generated insights about your experiment and suggested next steps.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={fetchAnalysis}
            loading={analysisLoading}
            id="btn-view-ai-analysis"
          >
            {showAnalysis ? '▾ Analysis Open' : '✦ View AI Analysis'}
          </Button>
        </div>

        <AnimatePresence>
          {showAnalysis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-white/8 pt-5 space-y-5">
                {analysisLoading && (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Spinner />
                    Running AI analysis pipeline…
                  </div>
                )}

                {analysisError && (
                  <ErrorBanner message={analysisError} onDismiss={() => setAnalysisError(null)} />
                )}

                {analysis && !analysisLoading && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <div className="label-caps text-cyan-400/70 mb-2">Research Objective</div>
                        <p className="text-sm leading-relaxed text-slate-300">
                          {analysis.research_objective?.text || goal}
                        </p>
                      </div>

                      <div>
                        <div className="label-caps text-cyan-400/70 mb-2">Selected Conditions</div>
                        <div className="grid grid-cols-2 gap-2">
                          {PARAM_META.map((meta) => (
                            <div key={meta.key} className="rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                              <div className="label-caps text-slate-600">{meta.label}</div>
                              <div className="mono text-xs text-slate-200">{paramValue(meta.key, params[meta.key])}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="label-caps text-cyan-400/70 mb-2">Predicted Outcome</div>
                        <div className="mono text-xl font-semibold text-cyan-200">
                          {num(predictedYield, 1)}% yield
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {analysis.explanation?.explanation && (
                        <div>
                          <div className="label-caps text-cyan-400/70 mb-2">Why These Conditions Were Selected</div>
                          <p className="text-xs leading-relaxed text-slate-300 rounded-xl border-l-2 border-cyan-400/40 bg-cyan-400/5 px-3 py-2.5">
                            {analysis.explanation.explanation}
                          </p>
                        </div>
                      )}

                      {next && !next.error && next.temperature && (
                        <div>
                          <div className="label-caps text-cyan-400/70 mb-2">Next Suggested Experiment</div>
                          <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {PARAM_META.map((meta) => (
                                <div key={meta.key} className="rounded-lg border border-white/5 bg-white/2 px-2 py-1.5">
                                  <div className="label-caps text-slate-600">{meta.label}</div>
                                  <div className="mono text-xs text-violet-200">{paramValue(meta.key, next[meta.key])}</div>
                                </div>
                              ))}
                            </div>
                            {next.rationale && (
                              <p className="text-[11px] leading-relaxed text-slate-400 border-t border-white/5 pt-2">
                                {next.rationale}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fallback when no analysis yet but panel is open */}
                {!analysis && !analysisLoading && !analysisError && (
                  <div className="text-center py-4 text-sm text-slate-500">
                    Click "View AI Analysis" to generate insights.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onRunAnother} className="!px-6 !py-3" id="btn-run-another">
          + Run Another Experiment
        </Button>
        <Button variant="ghost" onClick={onSwitchToAI} className="!px-6 !py-3" id="btn-switch-to-ai">
          ✦ Try AI-Assisted Mode →
        </Button>
      </div>
    </motion.div>
  )
}

/* ──────────────────────────── Main component ────────────────────────────── */

export default function ManualWorkspace({ onSwitchToAI }) {
  const [manualStep, setManualStep] = useState('design')

  // form state
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [params, setParams] = useState(DEFAULT_PARAMS)

  // API results
  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState(null)

  const [simulation, setSimulation] = useState(null)
  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState(null)

  /* ── Step 1 → 2: fetch prediction ── */
  const handleDesignNext = async () => {
    setManualStep('review')
    if (prediction) {
      // re-fetch if params may have changed
      const existing = prediction.experiment
      const unchanged =
        existing &&
        existing.temperature === params.temperature &&
        existing.pressure === params.pressure &&
        existing.catalyst === params.catalyst &&
        existing.concentration === params.concentration &&
        existing.reaction_time === params.reaction_time
      if (unchanged) return
    }
    setPrediction(null)
    setPredicting(true)
    setPredictError(null)
    try {
      const result = await predict({
        temperature: Number(params.temperature),
        pressure: Number(params.pressure),
        catalyst: params.catalyst,
        concentration: Number(params.concentration),
        reaction_time: Number(params.reaction_time),
      })
      setPrediction(result)
    } catch (err) {
      setPredictError(err.friendlyMessage || 'Prediction failed. Please try again.')
    } finally {
      setPredicting(false)
    }
  }

  const handleRetryPredict = () => {
    setPredictError(null)
    handleDesignNext()
  }

  /* ── Step 2 → 3: run simulation ── */
  const handleRunSimulation = async () => {
    setSimulation(null)
    setSimulating(true)
    setSimError(null)
    setManualStep('simulation')
    try {
      const result = await simulate({
        temperature: Number(params.temperature),
        pressure: Number(params.pressure),
        catalyst: params.catalyst,
        concentration: Number(params.concentration),
        reaction_time: Number(params.reaction_time),
        speed: 1,
      })
      setSimulation(result)
    } catch (err) {
      setSimError(err.friendlyMessage || 'The virtual simulation failed.')
    } finally {
      setSimulating(false)
    }
  }

  /* ── Step 3 → 4: simulation complete ── */
  const handleSimulationComplete = () => {
    setTimeout(() => setManualStep('result'), 800)
  }

  /* ── Reset to design ── */
  const handleRunAnother = () => {
    setName('')
    setGoal('')
    setParams(DEFAULT_PARAMS)
    setPrediction(null)
    setSimulation(null)
    setSimError(null)
    setPredictError(null)
    setManualStep('design')
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16">
      {/* progress indicator */}
      <div className="mb-6 flex justify-center">
        <StepIndicator currentStep={manualStep} />
      </div>

      <AnimatePresence mode="wait">
        {manualStep === 'design' && (
          <DesignStep
            key="design"
            name={name}
            setName={setName}
            goal={goal}
            setGoal={setGoal}
            params={params}
            setParams={setParams}
            onNext={handleDesignNext}
          />
        )}

        {manualStep === 'review' && (
          <ReviewStep
            key="review"
            name={name}
            goal={goal}
            params={params}
            prediction={prediction}
            predicting={predicting}
            predictError={predictError}
            onBack={() => setManualStep('design')}
            onRun={handleRunSimulation}
            onRetryPredict={handleRetryPredict}
          />
        )}

        {manualStep === 'simulation' && (
          <SimulationStep
            key="simulation"
            name={name}
            params={params}
            prediction={prediction}
            simulation={simulation}
            simulating={simulating}
            simError={simError}
            onComplete={handleSimulationComplete}
            onSkip={() => setManualStep('result')}
          />
        )}

        {manualStep === 'result' && (
          <ResultStep
            key="result"
            name={name}
            goal={goal}
            params={params}
            prediction={prediction}
            simulation={simulation}
            onRunAnother={handleRunAnother}
            onSwitchToAI={onSwitchToAI}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
