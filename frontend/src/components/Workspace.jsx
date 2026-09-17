import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button, Chip, GlassCard, KeyValue, Meter, Pill, SectionTitle, ErrorBanner } from './ui'
import { EXAMPLE_OBJECTIVES, PARAM_META } from '../lib/constants'
import { confidenceTone, num, paramValue, yieldTone } from '../lib/format'
import { predict } from '../api/client'

const DEFAULT_PARAMS = {
  temperature: 90,
  pressure: 2,
  catalyst: 'B',
  concentration: 0.2,
  reaction_time: 45,
}

export default function Workspace({ initialQuestion, designSpace, onSubmit, onSimulate, busy, template, onChooseTemplate }) {
  const [question, setQuestion] = useState(initialQuestion || EXAMPLE_OBJECTIVES[0].objective)
  const [count, setCount] = useState(5)
  const [useConstraints, setUseConstraints] = useState(false)
  const [maxTime, setMaxTime] = useState(90)
  const [maxTemp, setMaxTemp] = useState(120)

  const [params, setParams] = useState(DEFAULT_PARAMS)
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
      setPrediction(await predict(params))
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

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 px-5 pb-16 lg:grid-cols-[1.25fr_0.75fr]">
      {/* ------------------------------ objective ------------------------------ */}
      <div className="space-y-5">
        {/* template context banner */}
        {template && (
          <GlassCard className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{template.label}</span>
                    {isLive && (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                        Live model
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
                  Change template
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
            <span className="mono">{question.length}/500</span>
          </div>

          <div className="mt-4">
            <div className="label-caps mb-2 text-slate-500">
              {template?.objectives ? 'Suggested objectives for this template' : 'Example objectives'}
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
                      min={10}
                      max={180}
                      step={5}
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
                      min={60}
                      max={160}
                      step={5}
                      value={maxTemp}
                      onChange={(event) => setMaxTemp(Number(event.target.value))}
                      className="flex-1 accent-cyan-400"
                    />
                    <span className="mono w-14 text-right text-cyan-200">{maxTemp} °C</span>
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
                      {num(variable.min, variable.name === 'concentration' ? 2 : 0)} –{' '}
                      {num(variable.max, variable.name === 'concentration' ? 2 : 0)}
                    </td>
                    <td className="mono py-2 text-emerald-300/80">
                      {num(variable.comfortable_window?.[0], variable.name === 'concentration' ? 2 : 0)} –{' '}
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
            Target: <span className="mono text-cyan-200">yield</span> in %, bounded to 0–100.
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
            {PARAM_META.map((meta) => (
              <div key={meta.key}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{meta.label}</span>
                  <span className="mono text-cyan-200">{paramValue(meta.key, params[meta.key])}</span>
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
                    value={params[meta.key]}
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
              Predict yield
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
                  <div className="label-caps text-cyan-300/80">Predicted yield</div>
                  <div className="mono text-3xl font-semibold text-cyan-200">
                    {num(prediction.predicted_yield, 1)}
                    <span className="ml-1 text-sm text-slate-400">%</span>
                  </div>
                </div>
                <Pill tone={confidenceTone(prediction.confidence)}>
                  confidence {prediction.confidence.toFixed(3)}
                </Pill>
              </div>

              <div className="mt-3">
                <Meter
                  value={prediction.predicted_yield}
                  tone={yieldTone(prediction.predicted_yield)}
                  height="h-2"
                  glow
                />
                <div className="mono mt-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>interval {num(prediction.interval_low, 1)}%</span>
                  <span>± {num(prediction.uncertainty_std, 2)} sd (tree spread)</span>
                  <span>{num(prediction.interval_high, 1)}%</span>
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
            <KeyValue label="Target">Yield (%)</KeyValue>
            <KeyValue label="Training rows">
              {num(designSpace?.training_rows ?? 0, 0) || '—'}
            </KeyValue>
            <KeyValue label="Data provenance">
              <span className="mono text-amber-200/80">synthetic_prototype_v1</span>
            </KeyValue>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Replace <span className="mono">backend/training/dataset.csv</span> with validated in-house
            measurements and retrain to make these numbers defensible. The API, scoring and UI stay
            unchanged.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
