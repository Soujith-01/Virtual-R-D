import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button, Chip, GlassCard, KeyValue, Meter, Pill, SectionTitle, ErrorBanner } from './ui'
import { EXAMPLE_OBJECTIVES, ACCENT_COLORS } from '../lib/constants'
import { confidenceTone, num, paramValue, yieldTone, getPredictionKey, getTargetLabel, getTargetUnitForDomain } from '../lib/format'
import { predict } from '../api/client'

const DEFAULT_PARAMS = {
  temperature: 90,
  pressure: 2,
  catalyst: 'B',
  concentration: 0.2,
  reaction_time: 45,
}

export default function Workspace({
  initialQuestion,
  designSpace,
  onSubmit,
  onSimulate,
  busy,
  template,
  domain,
  onChooseTemplate,
  activeResearchPapers = [],
  onFindPapers,
  onTogglePaperInResearch,
}) {
  const [question, setQuestion] = useState(initialQuestion || EXAMPLE_OBJECTIVES[0].objective)
  const [count, setCount] = useState(5)
  const [useConstraints, setUseConstraints] = useState(false)
  const [maxTime, setMaxTime] = useState(90)
  const [maxTemp, setMaxTemp] = useState(120)
  const [showSourcesModal, setShowSourcesModal] = useState(false)

  // Use domain-specific params or fall back to reaction yield defaults
  const [params, setParams] = useState(() => {
    if (domain && domain.featureKeys) {
      const initial = {}
      for (const key of domain.featureKeys) {
        if (key === 'temperature' || key === 'operating_temperature_c' || key === 'temperature_c') {
          initial[key] = 25
        } else if (key === 'pressure') {
          initial[key] = 2
        } else if (key === 'catalyst') {
          initial[key] = 'B'
        } else if (key === 'concentration' || key === 'electrolyte_concentration_m' || key === 'nutrient_concentration_mm') {
          initial[key] = 0.2
        } else if (key === 'reaction_time' || key === 'contact_time_min') {
          initial[key] = 45
        } else {
          initial[key] = 50
        }
      }
      return initial
    }
    return DEFAULT_PARAMS
  })

  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState(null)

  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion)
  }, [initialQuestion])

  const runPrediction = async () => {
    setPredicting(true)
    setPredictError(null)
    try {
      const domainId = template?.id || 'reaction-yield'
      const payload = {
        ...params,
        domain: domainId,
      }
      const result = await predict(payload)
      setPrediction(result)
    } catch (error) {
      setPredictError(error.friendlyMessage || 'Prediction failed.')
      setPrediction(null)
    } finally {
      setPredicting(false)
    }
  }

  const submit = () => {
    const constraints = useConstraints
      ? { reaction_time: Number(maxTime), temperature: Number(maxTemp) }
      : null
    onSubmit(question.trim(), count, constraints)
  }

  const isCustom = template?.status === 'custom'
  const isLive = template?.status === 'live'

  // Get domain accent color
  const accentColor = template?.accentColor || 'cyan'
  const accent = ACCENT_COLORS[accentColor] || ACCENT_COLORS.cyan

  // Get feature keys for the domain
  const featureKeys = domain?.featureKeys || ['temperature', 'pressure', 'catalyst', 'concentration', 'reaction_time']
  const targetLabel = getTargetLabel(template?.id || 'reaction-yield', true)
  const predictionKey = getPredictionKey(template?.id || 'reaction-yield')

  // Generate parameter controls dynamically based on domain
  const paramControls = featureKeys.map((key) => {
    // Determine the display label and unit
    const domainInfo = DOMAINS_MAP[template?.id]
    const label = domainInfo?.featureLabels?.[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    const unit = domainInfo?.units?.[key] || ''

    // Check if it's a categorical option
    const options = domainInfo?.categoricalOptions?.[key]

    // Determine range if numeric
    const min = domainInfo?.ranges?.[key]?.[0]
    const max = domainInfo?.ranges?.[key]?.[1]
    const step = domainInfo?.steps?.[key] || (key.includes('concentration') ? 0.01 : key.includes('time') ? 5 : 1)

    return { key, label, unit, options, min, max, step }
  })

  // Domain ranges for constraint sliders
  const tempRange = domain?.ranges?.temperature_c || domain?.ranges?.operating_temperature_c || [15, 40]
  const timeRange = domain?.ranges?.reaction_time || domain?.ranges?.contact_time_min || [5, 180]

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 px-5 pb-16 lg:grid-cols-[1.25fr_0.75fr]">
      {/* ------------------------------ objective ------------------------------ */}
      <div className="space-y-5">
        {/* template context banner */}
        {template && (
          <GlassCard className="p-4" style={{ borderColor: 'rgba(103, 232, 249, 0.2)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{template.label}</span>
                    {isLive && (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        AI Model-backed
                      </span>
                    )}
                    {isCustom && (
                      <span className="rounded-full border border-slate-400/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {template.domain} · Target: {template.target.split('(')[0].trim()}
                  </div>
                </div>
              </div>
              {onChooseTemplate && (
                <Button variant="ghost" className="!py-1.5 !px-3 text-xs" onClick={onChooseTemplate}>
                  Change domain
                </Button>
              )}
            </div>
            {isCustom && (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/85">
                <strong className="text-amber-200">Note:</strong> Custom research uses the reaction yield
                model (Random Forest, trained on synthetic_prototype_v1). Predictions are only valid for
                reaction-yield optimization — not for other scientific domains.
              </div>
            )}
          </GlassCard>
        )}

        <GlassCard strong className="p-6">
          <SectionTitle
            eyebrow={isLive ? `Step 03 · ${template?.label}` : 'Step 02'}
            title="Research workspace"
            description="State the objective in plain language. The agent parses it into explicit optimisation priorities and scoring weights before anything is generated."
          />

          <label className="label-caps mt-6 block text-slate-400" htmlFor="objective">
            Research objective
          </label>
          <textarea
            id="objective"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Maximize reaction yield while minimizing reaction time."
            className="mt-2 w-full resize-none rounded-xl border border-cyan-300/20 bg-lab-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Free text · the objective drives the scoring weights</span>
            <div className="flex items-center gap-3">
              <span className="mono">{question.length}/500</span>
              {onFindPapers && (
                <button
                  type="button"
                  onClick={() => onFindPapers(question)}
                  className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Find Papers for This Research →</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="label-caps mb-2 text-slate-500">
              {template?.objectives ? 'Suggested objectives for this domain' : 'Example objectives'}
            </div>
            <div className="flex flex-wrap gap-2">
              {(template?.objectives || EXAMPLE_OBJECTIVES).map((example) => (
                <Chip
                  key={example.label}
                  active={question.trim() === example.objective}
                  onClick={() => setQuestion(example.objective)}
                  className="!px-3 !py-2"
                >
                  <span className="block text-[11px] font-semibold text-cyan-100">{example.label}</span>
                  {example.hint && (
                    <span className="block text-[10px] font-normal text-slate-400">{example.hint}</span>
                  )}
                </Chip>
              ))}
            </div>
          </div>

          {/* ===== Literature Context Panel ===== */}
          <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📚</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Literature Context
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-200 font-mono">
                  {activeResearchPapers.length} Selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                {activeResearchPapers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSourcesModal(true)}
                    className="text-xs text-slate-300 hover:text-cyan-300 underline font-medium"
                  >
                    View Sources ({activeResearchPapers.length})
                  </button>
                )}
                {onFindPapers && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFindPapers(question)}
                      className="text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded-lg px-2.5 py-1 transition font-medium"
                    >
                      Find Papers +
                    </button>
                    <button
                      type="button"
                      onClick={() => onFindPapers('')}
                      className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 rounded-lg px-2.5 py-1 transition font-medium"
                    >
                      📤 Upload File
                    </button>
                  </div>
                )}
              </div>
            </div>

            {activeResearchPapers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400">
                  Papers actively feeding into RAG knowledge retrieval and LLM hypothesis scoring:
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeResearchPapers.map((paper) => (
                    <div
                      key={paper.paper_id}
                      className="flex items-center gap-2 bg-slate-900/80 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    >
                      <span className="max-w-[240px] truncate font-medium">{paper.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-cyan-300 font-mono">
                        {paper.year || 'Paper'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {paper.is_open_access ? 'Full-text' : 'Abstract-based'}
                      </span>
                      {onTogglePaperInResearch && (
                        <button
                          type="button"
                          onClick={() => onTogglePaperInResearch(paper)}
                          className="text-slate-400 hover:text-rose-400 text-xs ml-1"
                          title="Remove from research context"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-400 bg-white/5 rounded-lg p-2.5">
                <span>No research papers selected yet. Attach papers to ground experimental reasoning in peer-reviewed science.</span>
                {onFindPapers && (
                  <button
                    type="button"
                    onClick={() => onFindPapers(question)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold whitespace-nowrap ml-2"
                  >
                    Find Relevant Papers →
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="label-caps text-slate-400">Candidate experiments</div>
              <div className="mt-2 flex gap-1.5">
                {[3, 5, 8].map((value) => (
                  <Chip key={value} active={count === value} onClick={() => setCount(value)}>
                    <span className="mono">{value}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="label-caps text-slate-400">Hard constraints</span>
                <button
                  type="button"
                  onClick={() => setUseConstraints((value) => !value)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                    useConstraints ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {useConstraints ? 'ON' : 'OFF'}
                </button>
              </div>
              {useConstraints ? (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="w-24">max time</span>
                    <input
                      type="range"
                      min={timeRange[0]}
                      max={timeRange[1]}
                      step={stepForKey(domain, 'reaction_time') || 5}
                      value={maxTime}
                      onChange={(event) => setMaxTime(Number(event.target.value))}
                      className="flex-1 accent-cyan-400"
                    />
                    <span className="mono w-14 text-right text-cyan-200">{maxTime} min</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="w-24">max temp</span>
                    <input
                      type="range"
                      min={tempRange[0]}
                      max={tempRange[1]}
                      step={stepForKey(domain, 'temperature') || 1}
                      value={maxTemp}
                      onChange={(event) => setMaxTemp(Number(event.target.value))}
                      className="flex-1 accent-cyan-400"
                    />
                    <span className="mono w-14 text-right text-cyan-200">{maxTemp}°C</span>
                  </label>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  Off — any condition inside the validated design space may be proposed.
                </p>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button onClick={submit} loading={busy} disabled={question.trim().length < 3 || busy} className="!px-6 !py-3">
              Generate experiments →
            </Button>
            <span className="text-[11px] text-slate-500">
              Runs 10 pipeline stages: knowledge → generation → prediction → ranking → simulation → report
            </span>
          </div>
        </GlassCard>

        {/* ------------------------------ design space ------------------------------ */}
        <GlassCard className="p-6">
          <SectionTitle
            eyebrow="Reference"
            title="Experimental design space"
            description="The backend publishes the trained ranges; the UI never invents its own."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="label-caps text-slate-500">
                  <th className="pb-2">Variable</th>
                  <th className="pb-2">Supported</th>
                  <th className="pb-2">Comfortable</th>
                  <th className="pb-2">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(designSpace?.numeric_variables || []).map((variable) => (
                  <tr key={variable.name} className="text-slate-300">
                    <td className="py-2 font-medium capitalize">{variable.name.replace('_', ' ')}</td>
                    <td className="mono py-2 text-slate-400">
                      {num(variable.min, variable.name === 'concentration' ? 2 : 0)} –{" "}
                      {num(variable.max, variable.name === 'concentration' ? 2 : 0)}
                    </td>
                    <td className="mono py-2 text-emerald-300/80">
                      {num(variable.comfortable_window?.[0], variable.name === 'concentration' ? 2 : 0)} –{" "}
                      {num(variable.comfortable_window?.[1], variable.name === 'concentration' ? 2 : 0)}
                    </td>
                    <td className="py-2 text-slate-500">{variable.unit}</td>
                  </tr>
                ))}
                <tr className="text-slate-300">
                  <td className="py-2 font-medium">Catalyst</td>
                  <td className="py-2 text-slate-400" colSpan={3}>
                    {(designSpace?.categorical_variables?.[0]?.options || ['A', 'B', 'C', 'D', 'None']).join(' · ')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Target: <span className="mono text-cyan-200">{targetLabel}</span> in {getTargetUnitForDomain(template?.id || 'reaction-yield')}.
          </p>
        </GlassCard>
      </div>

      {/* ------------------------------ micro lab ------------------------------ */}
      <div className="space-y-5">
        <GlassCard strong className="p-6">
          <SectionTitle
            eyebrow="Step 02b"
            title="Single-point ML probe"
            description="Query the trained model directly with one set of conditions."
          />

          <div className="mt-5 space-y-4">
            {paramControls.map((meta) => (
              <div key={meta.key}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{meta.label}</span>
                  <span className="mono text-cyan-200">{paramValue(meta.key, params[meta.key], template?.id)}</span>
                </div>
                {meta.options ? (
                  <div className="mt-2 flex gap-1.5">
                    {meta.options.map((option) => (
                      <Chip
                        key={option}
                        active={params[meta.key] === option}
                        onClick={() => setParams((previous) => ({ ...previous, [meta.key]: option }))}
                      >
                        <span className="mono">{option}</span>
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <input
                    type="range"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={params[meta.key] || 0}
                    onChange={(event) =>
                      setParams((previous) => ({ ...previous, [meta.key]: Number(event.target.value) }))
                    }
                    className="mt-2 w-full accent-cyan-400"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={runPrediction} loading={predicting} className="flex-1">
              Predict {targetLabel}
            </Button>
            <Button variant="ghost" onClick={() => onSimulate?.(params)}>
              Simulate
            </Button>
          </div>

          <ErrorBanner className="mt-4" message={predictError} onDismiss={() => setPredictError(null)} />

          {prediction && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4"
            >
              <div className="flex items-end justify-between">
                <div>
                  <div className="label-caps text-cyan-300/80">Predicted {targetLabel}</div>
                  <div className="mono text-3xl font-semibold text-cyan-200">
                    {num(prediction[predictionKey] || prediction.predicted_yield || 0, 1)}
                    <span className="ml-1 text-sm text-slate-400">{getTargetUnitForDomain(template?.id || 'reaction-yield')}</span>
                  </div>
                </div>
                <Pill tone={confidenceTone(prediction.confidence)}>
                  confidence {prediction.confidence?.toFixed(3) || '—'}
                </Pill>
              </div>

              <div className="mt-3">
                <Meter
                  value={prediction[predictionKey] || prediction.predicted_yield || 0}
                  tone={yieldTone(prediction[predictionKey] || prediction.predicted_yield || 0)}
                  height="h-2"
                  glow
                />
                <div className="mono mt-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>interval {num(prediction.interval_low || 0, 1)}{getTargetUnitForDomain(template?.id || 'reaction-yield')}</span>
                  <span>± {num(prediction.uncertainty_std || 0, 2)} sd (tree spread)</span>
                  <span>{num(prediction.interval_high || 0, 1)}{getTargetUnitForDomain(template?.id || 'reaction-yield')}</span>
                </div>
              </div>

              <p className="mt-3 border-t border-white/5 pt-3 text-[10px] leading-relaxed text-amber-200/70">
                {prediction.confidence_label}. {prediction.confidence_basis}
              </p>
            </motion.div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle
            eyebrow="Model card"
            title="Prediction model"
            description="What produced the numbers you are looking at."
          />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <KeyValue label="Regressor">Random Forest · 300 trees</KeyValue>
            <KeyValue label="Target">{targetLabel}</KeyValue>
            <KeyValue label="Model domain">{template?.label || 'Reaction Yield'}</KeyValue>
            <KeyValue label="Data provenance">
              <span className="mono text-amber-200/80">synthetic_prototype_v1</span>
            </KeyValue>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            This is a prototype model trained on synthetic demonstration data. Replace with validated
            experimental data and retrain to make these numbers defensible for real-world use.
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">
            ⚠️ Predictions are AI-generated hypotheses for experimental prioritization — not validated results.
          </p>
        </GlassCard>
      </div>

      {/* Sources modal */}
      {showSourcesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h3 className="text-base font-bold text-slate-100">Attached Research Sources</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSourcesModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {activeResearchPapers.map((p, idx) => (
                <div key={p.paper_id || idx} className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">{p.title}</div>
                  <div className="text-slate-400">
                    {Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : ''} ({p.year || 'N/A'})
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    <span className="text-cyan-300 font-mono">
                      {p.is_open_access ? 'Full-text research context' : 'Abstract-based research context'}
                    </span>
                    {p.doi && (
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                        DOI ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 text-right">
              <Button variant="secondary" size="sm" onClick={() => setShowSourcesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Domain configuration map for feature labels and ranges
const DOMAINS_MAP = {
  'reaction-yield': {
    featureLabels: {
      temperature: 'Temperature',
      pressure: 'Pressure',
      catalyst: 'Catalyst',
      concentration: 'Concentration',
      reaction_time: 'Reaction Time',
    },
    units: { temperature: '°C', pressure: 'bar', catalyst: '', concentration: 'M', reaction_time: 'min' },
    ranges: {
      temperature: [40, 160],
      pressure: [1, 10],
      concentration: [0.05, 0.5],
      reaction_time: [5, 180],
    },
    categoricalOptions: { catalyst: ['A', 'B', 'C', 'D', 'None'] },
    steps: { temperature: 5, pressure: 0.5, concentration: 0.01, reaction_time: 5 },
  },
  'solar-efficiency': {
    featureLabels: {
      cell_thickness_nm: 'Cell Thickness',
      doping_concentration: 'Doping Concentration',
      annealing_temperature_c: 'Annealing Temperature',
      light_intensity_lux: 'Light Intensity',
      operating_temperature_c: 'Operating Temperature',
    },
    units: {
      cell_thickness_nm: 'nm',
      doping_concentration: 'cm⁻³',
      annealing_temperature_c: '°C',
      light_intensity_lux: 'lux',
      operating_temperature_c: '°C',
    },
    ranges: {
      cell_thickness_nm: [50, 300],
      doping_concentration: [1e15, 1e18],
      annealing_temperature_c: [500, 900],
      light_intensity_lux: [20000, 120000],
      operating_temperature_c: [15, 75],
    },
    steps: {
      cell_thickness_nm: 10,
      doping_concentration: 1e15,
      annealing_temperature_c: 25,
      light_intensity_lux: 10000,
      operating_temperature_c: 5,
    },
  },
  'plant-growth': {
    featureLabels: {
      light_intensity_lux: 'Light Intensity',
      co2_concentration_ppm: 'CO₂ Concentration',
      nutrient_concentration_mm: 'Nutrient Concentration',
      temperature_c: 'Temperature',
      water_supply_ml_day: 'Water Supply',
    },
    units: {
      light_intensity_lux: 'lux',
      co2_concentration_ppm: 'ppm',
      nutrient_concentration_mm: 'mM',
      temperature_c: '°C',
      water_supply_ml_day: 'ml/day',
    },
    ranges: {
      light_intensity_lux: [5000, 80000],
      co2_concentration_ppm: [400, 1200],
      nutrient_concentration_mm: [0.5, 10],
      temperature_c: [15, 40],
      water_supply_ml_day: [50, 500],
    },
    steps: {
      light_intensity_lux: 5000,
      co2_concentration_ppm: 50,
      nutrient_concentration_mm: 0.5,
      temperature_c: 1,
      water_supply_ml_day: 25,
    },
  },
  'battery-performance': {
    featureLabels: {
      electrolyte_concentration_m: 'Electrolyte Concentration',
      charging_rate_c: 'Charging Rate',
      operating_temperature_c: 'Operating Temperature',
      discharge_rate_c: 'Discharge Rate',
      cycle_count: 'Cycle Count',
    },
    units: {
      electrolyte_concentration_m: 'M',
      charging_rate_c: 'C',
      operating_temperature_c: '°C',
      discharge_rate_c: 'C',
      cycle_count: 'cycles',
    },
    ranges: {
      electrolyte_concentration_m: [0.5, 2.5],
      charging_rate_c: [0.2, 3],
      operating_temperature_c: [0, 50],
      discharge_rate_c: [0.2, 3],
      cycle_count: [10, 500],
    },
    steps: {
      electrolyte_concentration_m: 0.1,
      charging_rate_c: 0.1,
      operating_temperature_c: 2,
      discharge_rate_c: 0.1,
      cycle_count: 25,
    },
  },
  'water-purification': {
    featureLabels: {
      coagulant_dose_mg_l: 'Coagulant Dose',
      ph: 'pH',
      contact_time_min: 'Contact Time',
      temperature_c: 'Temperature',
      mixing_speed_rpm: 'Mixing Speed',
    },
    units: {
      coagulant_dose_mg_l: 'mg/L',
      ph: '',
      contact_time_min: 'min',
      temperature_c: '°C',
      mixing_speed_rpm: 'rpm',
    },
    ranges: {
      coagulant_dose_mg_l: [5, 100],
      ph: [4, 10],
      contact_time_min: [5, 120],
      temperature_c: [5, 40],
      mixing_speed_rpm: [50, 300],
    },
    steps: {
      coagulant_dose_mg_l: 5,
      ph: 0.5,
      contact_time_min: 5,
      temperature_c: 2,
      mixing_speed_rpm: 10,
    },
  },
}

function stepForKey(domain, key) {
  const domainInfo = DOMAINS_MAP[domain?.id]
  if (domainInfo?.steps?.[key]) return domainInfo.steps[key]
  if (key.includes('concentration')) return 0.01
  if (key.includes('time') || key.includes('contact')) return 5
  if (key.includes('temperature')) return 1
  return 1
}
