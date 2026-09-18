import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard, Pill, SectionTitle } from './ui'
import { COMPONENT_COLORS, COMPONENT_LABELS, num } from '../lib/format'

const AXIS = {
  stroke: 'rgba(148, 163, 184, 0.45)',
  tick: { fill: '#cbd5e1', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 },
  tickLine: false,
}
const GRID_COLOR = 'rgba(127, 243, 255, 0.1)'

function DarkTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl border border-cyan-500/30 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-xl">
      <div className="mono mb-1.5 font-semibold text-cyan-300 border-b border-white/10 pb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="flex items-center justify-between gap-3 py-0.5 text-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill }} />
            <span className="text-slate-400">{entry.name}</span>
          </div>
          <span className="mono font-semibold text-slate-100">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ----------------------- A. Objective Weights Chart ----------------------- */

export function ObjectiveWeightsChart({ weights = {}, title = 'Objective Weights Allocation' }) {
  const entries = Object.entries(weights)
  if (!entries.length) return null

  const WEIGHT_PALETTE = {
    yield: '#38e2f5',
    efficiency: '#38e2f5',
    biomass: '#38e2f5',
    capacity: '#38e2f5',
    turbidity: '#38e2f5',
    time: '#818cf8',
    temperature: '#f59e0b',
    pressure: '#a855f7',
    risk: '#f43f5e',
  }

  const data = entries.map(([key, weight]) => {
    const rawVal = Number(weight) || 0
    const pct = rawVal <= 1 ? rawVal * 100 : rawVal
    const cleanKey = key.replace(/_/g, ' ')
    const toneKey = Object.keys(WEIGHT_PALETTE).find((k) => key.toLowerCase().includes(k)) || 'yield'
    return {
      key,
      name: cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1),
      weight: Number(pct.toFixed(1)),
      color: WEIGHT_PALETTE[toneKey] || '#22d3ee',
    }
  })

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Multi-Objective Allocation"
        title={title}
        description="Actual mathematical weights derived from your scientific objective. Sum of active priority components."
      />
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} {...AXIS} unit="%" />
            <YAxis dataKey="name" type="category" {...AXIS} width={90} />
            <Tooltip content={<DarkTooltip unit="%" />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Bar dataKey="weight" name="Objective Weight" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {data.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-white/5">
        {data.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-slate-400">{item.name}:</span>
            <span className="mono font-semibold text-cyan-200">{item.weight}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

/* ----------------------- B. Candidate Comparison Chart -------------------- */

export function YieldComparisonChart({ experiments = [], selectedId, onSelect, predictionKey = 'predicted_yield', targetUnit = '%' }) {
  if (!experiments.length) return null

  const data = experiments.map((experiment) => {
    const predValue =
      experiment[predictionKey] ??
      experiment.predicted_yield ??
      experiment.predicted_efficiency ??
      experiment.predicted_biomass_yield ??
      experiment.predicted_capacity_retention ??
      experiment.predicted_turbidity_removal ??
      0
    return {
      name: experiment.id,
      predicted_yield: Number(Number(predValue).toFixed(1)),
      score: Number((experiment.score || 0).toFixed(1)),
      uncertainty_std: Number((experiment.uncertainty_std || 0).toFixed(2)),
      low: Number((experiment.interval_low || 0).toFixed(1)),
      high: Number((experiment.interval_high || 0).toFixed(1)),
      confidence: Number((experiment.estimated_confidence ?? experiment.confidence ?? 0).toFixed(2)),
      selected: experiment.id === selectedId,
    }
  })

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Shortlist Comparison"
        title="Candidate Experiments vs Predicted Outcome"
        description="Predicted target values from the surrogate model alongside overall multi-objective scores. Higher predicted target does not always mean top rank if risk or resource constraints are violated."
      />
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
            <defs>
              <linearGradient id="candidateYieldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38e2f5" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0891b2" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} unit={targetUnit} />
            <Tooltip
              content={
                <DarkTooltipWithUncertainty
                  targetUnit={targetUnit}
                />
              }
              cursor={{ fill: 'rgba(127,243,255,0.05)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <ReferenceLine y={50} stroke="rgba(251,191,36,0.3)" strokeDasharray="4 4" />
            <Bar
              dataKey="predicted_yield"
              name={`Predicted Target (${targetUnit})`}
              fill="url(#candidateYieldFill)"
              radius={[6, 6, 0, 0]}
              maxBarSize={52}
              onClick={(entry) => onSelect?.(entry.name)}
            >
              {data.map((item) => (
                <Cell
                  key={item.name}
                  fillOpacity={selectedId && !item.selected ? 0.45 : 1}
                  stroke={item.selected ? '#7ff3ff' : 'transparent'}
                  strokeWidth={item.selected ? 2 : 0}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="score"
              name="Objective Score"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#03070f', stroke: '#34d399', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-[10px] text-slate-400">
        <span>Click any bar to inspect candidate conditions</span>
        <span className="mono">Dashed line: 50% baseline reference</span>
      </div>
    </GlassCard>
  )
}

function DarkTooltipWithUncertainty({ active, payload, label, targetUnit = '%' }) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload || {}
  return (
    <div className="glass-strong rounded-xl border border-cyan-500/30 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-xl">
      <div className="mono mb-1.5 font-semibold text-cyan-300 border-b border-white/10 pb-1">{label}</div>
      <div className="space-y-1 text-slate-200">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Predicted Target:</span>
          <span className="mono font-semibold text-cyan-300">{item.predicted_yield}{targetUnit}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Objective Score:</span>
          <span className="mono font-semibold text-emerald-300">{item.score} / 100</span>
        </div>
        {item.uncertainty_std > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Uncertainty (±1σ):</span>
            <span className="mono text-slate-300">±{item.uncertainty_std}</span>
          </div>
        )}
        {item.low > 0 && item.high > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Interval Range:</span>
            <span className="mono text-slate-400">{item.low} – {item.high}{targetUnit}</span>
          </div>
        )}
        {item.confidence > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Model Confidence:</span>
            <span className="mono text-cyan-200">{item.confidence}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------------- C. Prediction vs Simulation Chart ----------------- */

export function PredictionVsSimulationChart({ simulation, targetLabel = 'Yield', targetUnit = '%' }) {
  if (!simulation) return null

  const pred = simulation.predicted_yield ?? simulation.predicted_target ?? 0
  const obs = simulation.observed_yield ?? simulation.observed_target ?? 0
  const error = simulation.prediction_error ?? Math.abs(pred - obs)

  const data = [
    {
      name: 'Predicted',
      value: Number(Number(pred).toFixed(1)),
      fill: '#38bdf8',
      type: 'Surrogate ML Model',
    },
    {
      name: 'Simulated / Observed',
      value: Number(Number(obs).toFixed(1)),
      fill: '#34d399',
      type: 'Virtual Reactor Engine',
    },
  ]

  return (
    <GlassCard strong className="p-5 border-cyan-500/30">
      <SectionTitle
        eyebrow="Verification"
        title="Prediction vs Virtual Simulation"
        description="Direct visual evidence comparing the surrogate model's pre-experiment prediction against the dynamic reactor simulation."
        right={
          <Pill tone={error < 5 ? 'emerald' : error < 12 ? 'cyan' : 'amber'}>
            Δ error: {num(error, 1)} pts
          </Pill>
        }
      />

      <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_0.8fr] items-center">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis domain={[0, 100]} {...AXIS} unit={targetUnit} />
              <Tooltip content={<DarkTooltip unit={targetUnit} />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
              <Bar dataKey="value" name={targetLabel} radius={[6, 6, 0, 0]} maxBarSize={60}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 rounded-xl border border-white/5 bg-white/2 p-4">
          <div>
            <div className="label-caps text-slate-500">Predicted {targetLabel}</div>
            <div className="mono text-2xl font-bold text-sky-300">
              {num(pred, 1)}
              <span className="text-sm font-normal text-slate-400 ml-0.5">{targetUnit}</span>
            </div>
          </div>
          <div>
            <div className="label-caps text-slate-500">Simulated / Observed {targetLabel}</div>
            <div className="mono text-2xl font-bold text-emerald-300">
              {num(obs, 1)}
              <span className="text-sm font-normal text-slate-400 ml-0.5">{targetUnit}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400">Residual Error:</span>
            <span className="mono font-semibold text-cyan-200">{num(error, 2)}</span>
          </div>
          {simulation.safety?.level && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Process Safety:</span>
              <Pill tone={simulation.safety.level === 'SAFE' ? 'emerald' : 'amber'}>
                {simulation.safety.level}
              </Pill>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

/* ----------------------- D. Optimization / Search Trace Chart -------------- */

export function OptimizationTraceChart({ search }) {
  if (!search) return null
  const trace = search.trace || []
  if (!trace.length) return null

  const data = trace.map((item, idx) => ({
    stage: item.stage || `Stage ${idx + 1}`,
    candidates: item.candidates || 0,
    best_score: Number((item.best_score || 0).toFixed(1)),
    best_yield: Number((item.best_yield || 0).toFixed(1)),
  }))

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Active Search & Optimization"
        title="Optimization Trace & Neighborhood Refinement"
        description="Visual record of the model-guided search progression through design space exploring initial candidates, shrinking search radii, and shortlisting diverse optima."
        right={
          search.pool_evaluated ? (
            <Pill tone="cyan">{search.pool_evaluated} candidates evaluated</Pill>
          ) : null
        }
      />

      <div className="mt-4 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 20, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="stage" {...AXIS} />
            <YAxis yAxisId="left" domain={[0, 'auto']} {...AXIS} name="Candidates" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...AXIS} unit=" pts" />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar
              yAxisId="left"
              dataKey="candidates"
              name="Candidates Evaluated"
              fill="#6366f1"
              opacity={0.7}
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="best_score"
              name="Best Stage Score"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#03070f', stroke: '#22d3ee', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-300">Method:</span>
        <span className="truncate max-w-md">{search.method || 'Random Forest surrogate + objective-weighted scoring'}</span>
        {search.shortlist_size && (
          <span className="mono ml-auto text-cyan-300">Final shortlist: {search.shortlist_size}</span>
        )}
      </div>
    </GlassCard>
  )
}

/* ----------------------- E. Trial Lineage Timeline ------------------------ */

export function TrialLineageTimeline({ research, domainId = 'reaction-yield' }) {
  if (!research) return null

  const best = research.recommended_experiment || {}
  const next = research.next_suggested_experiment || {}
  const runId = research.run_id || 'TRIAL-01'
  const paperCount = research.relevant_papers?.length || (research.retrieved_knowledge || []).filter(k => k.is_paper).length

  const steps = [
    {
      step: '01',
      title: 'Trial 1 (Exploration)',
      subtitle: `Run ${runId}`,
      detail: `${research.candidate_experiments?.length || 5} candidates generated & ranked`,
      status: 'complete',
      tone: 'border-cyan-400/40 text-cyan-300',
    },
    {
      step: '02',
      title: 'Candidate Selected',
      subtitle: best.id || 'EXP-01',
      detail: `Score ${num(best.score, 1)} · predicted ${(best.predicted_yield ?? best.predicted_efficiency ?? 0).toFixed(1)}%`,
      status: 'complete',
      tone: 'border-emerald-400/40 text-emerald-300',
    },
    {
      step: '03',
      title: 'Human Review & RAG Grounding',
      subtitle: 'Scientist Audit',
      detail: paperCount > 0 ? `${paperCount} research papers attached to reasoning` : 'Knowledge base verified',
      status: 'complete',
      tone: 'border-sky-400/40 text-sky-300',
    },
    {
      step: '04',
      title: 'Scientist Directive',
      subtitle: 'Simulation & Probe',
      detail: research.simulation ? 'Virtual reactor execution completed' : 'Directive formulated',
      status: 'complete',
      tone: 'border-violet-400/40 text-violet-300',
    },
    {
      step: '05',
      title: 'Trial 2 (Follow-up Probe)',
      subtitle: next.probe_type || 'Active Learning',
      detail: next.rationale || 'Next suggested experiment generated with target delta',
      status: 'active',
      tone: 'border-amber-400/50 text-amber-300',
    },
  ]

  return (
    <GlassCard strong className="p-5 border-cyan-500/25">
      <SectionTitle
        eyebrow="Experimental Campaign Lineage"
        title="Scientific Decision Loop & Trial Provenance"
        description="Chronological audit trace showing how initial candidate screening progresses to human review, literature grounding, and automated active-learning next trial formulation."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((item, idx) => (
          <div
            key={item.step}
            className={`relative rounded-xl border ${item.tone} bg-slate-900/60 p-3.5 transition hover:bg-slate-900/90 flex flex-col justify-between`}
          >
            {idx < steps.length - 1 && (
              <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 text-xs">
                →
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="mono font-semibold">STAGE {item.step}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-100">{item.title}</h4>
              <div className="text-[11px] font-semibold text-cyan-300 mt-0.5">{item.subtitle}</div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400 border-t border-white/5 pt-2">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

/* ------------------------- score composition ---------------------------- */

export function ScoreBreakdownChart({ experiments = [] }) {
  if (!experiments.length) return null

  const data = experiments.map((experiment) => {
    const row = { name: experiment.id }
    Object.keys(COMPONENT_LABELS).forEach((component) => {
      row[component] = Number((experiment.contributions?.[component] || 0).toFixed(2))
    })
    return row
  })

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Transparency"
        title="How Each Score Was Built"
        description="Stacked weighted contributions across design variables and risk penalty. Weights adapt dynamically to your research query."
      />
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {Object.keys(COMPONENT_LABELS).map((component) => (
              <Bar
                key={component}
                dataKey={component}
                name={COMPONENT_LABELS[component]}
                stackId="score"
                fill={COMPONENT_COLORS[component]}
                maxBarSize={52}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone="slate">score = Σ weightᵢ × componentᵢ</Pill>
        <Pill tone="cyan">max 100</Pill>
        <Pill tone="amber">risk component = 100 − risk penalty</Pill>
      </div>
    </GlassCard>
  )
}

/* ---------------------------- vs baselines ------------------------------ */

export function AnchorComparisonChart({ comparison = [] }) {
  if (!comparison.length) return null

  const data = comparison.map((item) => ({
    name: item.label,
    predicted_yield: Number((item.predicted_yield || item.predicted_value || 0).toFixed(1)),
    score: Number((item.score || 0).toFixed(1)),
    isRecommendation: item.label === 'AI recommendation',
  }))

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Benchmarking"
        title="AI Recommendation vs Standard Baselines"
        description="Identical surrogate model and objective function applied to industry baseline and harsh control conditions for empirical verification."
      />
      <div className="mt-4 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} unit="%" />
            <Tooltip content={<DarkTooltip unit="%" />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="predicted_yield" name="Predicted Target (%)" radius={[6, 6, 0, 0]} maxBarSize={60}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.isRecommendation ? '#38e2f5' : 'rgba(148,163,184,0.45)'} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="score"
              name="Objective Score"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#03070f', stroke: '#34d399', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {comparison.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-white/2 p-3">
            <div className="text-[11px] font-semibold text-slate-200">{item.label}</div>
            <div className="mono mt-1 text-lg text-cyan-200">{num(item.predicted_yield, 1)}%</div>
            <div className="text-[10px] text-slate-500">
              score {num(item.score, 1)} · {item.risk?.level || 'unknown'} risk
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{item.note}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
