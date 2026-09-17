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
  stroke: 'rgba(148, 163, 184, 0.35)',
  tick: { fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
}
const GRID_COLOR = 'rgba(127, 243, 255, 0.08)'

function DarkTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-[11px] shadow-xl">
      <div className="mono mb-1 font-semibold text-cyan-200">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-slate-200">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: entry.color || entry.fill }} />
          <span className="text-slate-400">{entry.name}</span>
          <span className="mono ml-auto">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            {unit && entry.dataKey === 'predicted_yield' ? ' %' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ----------------------- predicted yield vs score ------------------------ */

export function YieldComparisonChart({ experiments = [], selectedId, onSelect }) {
  const data = experiments.map((experiment) => ({
    name: experiment.id,
    predicted_yield: Number(experiment.predicted_yield.toFixed(1)),
    score: Number(experiment.score.toFixed(1)),
    low: Number(experiment.interval_low.toFixed(1)),
    high: Number(experiment.interval_high.toFixed(1)),
    reaction_time: experiment.reaction_time,
    selected: experiment.id === selectedId,
  }))

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Comparison"
        title="Experiment vs predicted yield"
        description="Bars are the model's predicted yield. The line is the objective-weighted score - notice that the highest-yield run is not automatically the best candidate."
      />
      <div className="mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
            <defs>
              <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7ff3ff" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0891b2" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} />
            <Tooltip content={<DarkTooltip unit="%" />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <ReferenceLine y={50} stroke="rgba(251,191,36,0.35)" strokeDasharray="4 4" />
            <Bar
              dataKey="predicted_yield"
              name="Predicted yield (%)"
              fill="url(#yieldFill)"
              radius={[6, 6, 0, 0]}
              maxBarSize={54}
              onClick={(entry) => onSelect?.(entry.name)}
            >
              {data.map((item) => (
                <Cell
                  key={item.name}
                  fillOpacity={selectedId && !item.selected ? 0.45 : 1}
                  stroke={item.selected ? '#7ff3ff' : 'transparent'}
                  strokeWidth={item.selected ? 1.5 : 0}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="score"
              name="Objective score"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#03070f', stroke: '#34d399', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mono mt-2 text-[10px] text-slate-500">
        Dashed line = 50 % yield reference. Y-axis 0–100 for both series.
      </p>
    </GlassCard>
  )
}

/* ------------------------- score composition ---------------------------- */

export function ScoreBreakdownChart({ experiments = [] }) {
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
        title="How each score was built"
        description="Stacked weighted contributions. The weights come from the parsed objective, so changing the research question changes the bars."
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
                maxBarSize={54}
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
    predicted_yield: Number(item.predicted_yield.toFixed(1)),
    score: Number(item.score.toFixed(1)),
    isRecommendation: item.label === 'AI recommendation',
  }))

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Context"
        title="AI recommendation vs reference conditions"
        description="The same model and the same objective score applied to a conventional baseline and a harsh control, so the improvement is visible rather than asserted."
      />
      <div className="mt-4 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} />
            <Tooltip content={<DarkTooltip unit="%" />} cursor={{ fill: 'rgba(127,243,255,0.05)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="predicted_yield" name="Predicted yield (%)" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.isRecommendation ? '#38e2f5' : 'rgba(148,163,184,0.45)'} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="score"
              name="Objective score"
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
              score {num(item.score, 1)} · {item.risk?.level} risk
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
