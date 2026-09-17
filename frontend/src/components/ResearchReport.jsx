import { motion } from 'framer-motion'
import { Button, GlassCard, KeyValue, Meter, Pill, SectionTitle, TEXT_TONES } from './ui'
import { KnowledgePanel, ModelPanel } from './KnowledgePanel'
import { AnchorComparisonChart } from './Charts'
import { CATALYST_LABELS, PARAM_META } from '../lib/constants'
import { num, paramValue, riskTone, scoreTone, yieldTone } from '../lib/format'

function download(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const PIPELINE_LABELS = {
  objective: 'Objective interpretation',
  variables: 'Variable identification',
  knowledge: 'Knowledge retrieval',
  generate: 'Candidate generation',
  predict: 'ML prediction',
  compare: 'Outcome comparison',
  rank: 'Ranking',
  explain: 'Report generation',
  next: 'Next experiment',
  simulate: 'Virtual experiment',
}

export default function ResearchReport({ research, onSimulate, onReset }) {
  if (!research) return null

  const best = research.recommended_experiment
  const objective = research.research_objective || {}
  const explanation = research.explanation || {}
  const next = research.next_suggested_experiment || {}
  const model = research.model || {}

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 pb-20">
      {/* ------------------------------- header ------------------------------- */}
      <GlassCard strong className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-caps text-cyan-400/80">Step 05 · AI research report</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
              {research.research_question}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="cyan">{research.run_id || 'unsaved run'}</Pill>
              <Pill tone="slate">{num(research.elapsed_ms, 0)} ms pipeline</Pill>
              <Pill tone="violet">
                {explanation.used_external_llm ? `LLM · ${explanation.generated_by}` : 'template reasoning'}
              </Pill>
              <Pill tone="emerald">{research.candidate_experiments?.length ?? 0} candidates</Pill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => download(`virtual-rd-lab-${research.run_id || 'run'}.json`, research)}>
              ⭳ Export JSON
            </Button>
            <Button onClick={onReset}>New research</Button>
          </div>
        </div>
      </GlassCard>

      {/* --------------------------- objective + best --------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Objective" title="What the agent optimised for" />
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{objective.text}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(objective.priorities || []).map((priority) => (
              <Pill key={priority} tone="cyan">
                {priority.replace(/_/g, ' ')}
              </Pill>
            ))}
          </div>

          <div className="mt-5">
            <div className="label-caps mb-2 text-slate-500">Scoring weights</div>
            <div className="space-y-2">
              {Object.entries(objective.weights || {}).map(([key, weight]) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px]">
                    <span className="capitalize text-slate-400">{key}</span>
                    <span className="mono text-cyan-200">{(weight * 100).toFixed(1)}%</span>
                  </div>
                  <Meter className="mt-1" value={weight * 100} tone="cyan" height="h-1" />
                </div>
              ))}
            </div>
          </div>

          {research.identified_variables?.length > 0 && (
            <div className="mt-5 border-t border-white/5 pt-4">
              <div className="label-caps mb-2 text-slate-500">Identified variables</div>
              <ul className="space-y-1.5">
                {research.identified_variables.map((variable) => (
                  <li key={`${variable.variable}-${variable.role}`} className="text-[11px] text-slate-300">
                    <span className="mono text-cyan-200">{variable.variable}</span>
                    <span className="text-slate-500"> · {variable.role} </span>
                    <span className="text-slate-400">{variable.unit}</span>
                    {variable.optimal_range?.length === 2 && (
                      <span className="text-slate-500">
                        {' '}
                        (design range {num(variable.optimal_range[0], 2)}–{num(variable.optimal_range[1], 2)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>

        {/* best candidate */}
        <GlassCard strong className="relative overflow-hidden p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <SectionTitle
            eyebrow="Recommendation"
            title="Best candidate experiment"
            right={<Pill tone={scoreTone(best.score)}>score {best.score.toFixed(1)} / 100</Pill>}
          />

          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <div className="label-caps text-slate-500">Predicted yield</div>
              <div className="flex items-baseline">
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mono text-5xl font-bold ${TEXT_TONES[yieldTone(best.predicted_yield)]}`}
                >
                  {num(best.predicted_yield, 1)}
                </motion.span>
                <span className="ml-1 text-lg text-slate-400">%</span>
              </div>
              <div className="mono mt-1 text-[11px] text-slate-500">
                approx. interval {num(best.interval_low, 1)}–{num(best.interval_high, 1)}% · ±
                {num(best.uncertainty_std, 2)} sd
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill tone={riskTone(best.risk?.level)}>{best.risk?.level} risk</Pill>
              <Pill tone="slate">{CATALYST_LABELS[best.catalyst] ?? best.catalyst}</Pill>
              <Pill tone="cyan">{num(best.reaction_time, 0)} min hold</Pill>
              <Pill tone={best.estimated_confidence >= 0.8 ? 'emerald' : 'amber'}>
                confidence {best.estimated_confidence.toFixed(2)}
              </Pill>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PARAM_META.map((meta) => (
              <div key={meta.key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2">
                <div className="label-caps text-slate-500">{meta.label}</div>
                <div className="mono mt-1 text-sm text-slate-100">{paramValue(meta.key, best[meta.key])}</div>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-xl border-l-2 border-cyan-400/50 bg-cyan-400/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
            {best.reason}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onSimulate(best)}>⚗ Run in virtual reactor</Button>
            <Button variant="ghost" onClick={() => onSimulate(next)} disabled={!next?.temperature}>
              ▶ Try the next experiment
            </Button>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-amber-200/70">
            Confidence and intervals are model-derived uncertainty proxies, not statistical guarantees.
          </p>
        </GlassCard>
      </div>

      {/* ------------------------------- ranking ------------------------------- */}
      <GlassCard className="p-5">
        <SectionTitle
          eyebrow="Ranking"
          title="Full shortlist with transparent scores"
          description="Same objective, same model, five different trade-offs. Select any row to inspect or simulate it."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="label-caps text-slate-500">
                <th className="pb-2">#</th>
                <th className="pb-2">ID</th>
                <th className="pb-2">Temp</th>
                <th className="pb-2">Pressure</th>
                <th className="pb-2">Catalyst</th>
                <th className="pb-2">Conc.</th>
                <th className="pb-2">Time</th>
                <th className="pb-2">Yield</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Risk</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(research.candidate_experiments || []).map((row) => (
                <tr key={row.id} className="text-slate-300 hover:bg-white/2">
                  <td className="mono py-2 text-slate-500">{row.rank}</td>
                  <td className="mono py-2 text-slate-100">{row.id}</td>
                  <td className="mono py-2">{num(row.temperature, 0)}°C</td>
                  <td className="mono py-2">{num(row.pressure, 1)} bar</td>
                  <td className="py-2">{row.catalyst}</td>
                  <td className="mono py-2">{num(row.concentration, 2)} M</td>
                  <td className="mono py-2">{num(row.reaction_time, 0)} min</td>
                  <td className={`mono py-2 ${TEXT_TONES[yieldTone(row.predicted_yield)]}`}>
                    {num(row.predicted_yield, 1)}%
                  </td>
                  <td className="mono py-2 text-cyan-200">{num(row.score, 1)}</td>
                  <td className="py-2">
                    <Pill tone={riskTone(row.risk?.level)}>{row.risk?.level}</Pill>
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="subtle" className="!px-2 !py-1 text-[11px]" onClick={() => onSimulate(row)}>
                      simulate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* --------------------- explanation + factors/knowledge --------------------- */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="AI explanation"
            title="Why this experiment"
            right={
              <Pill tone={explanation.used_external_llm ? 'amber' : 'slate'}>
                {explanation.generated_by}
              </Pill>
            }
          />
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {explanation.explanation}
          </p>

          {explanation.highlights?.length > 0 && (
            <div className="mt-5">
              <div className="label-caps mb-2 text-slate-500">Highlights</div>
              <ul className="space-y-1.5">
                {explanation.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-[11px] leading-relaxed text-slate-300">
                    <span className="text-cyan-400">▸</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.caveats?.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
              <div className="label-caps mb-1.5 text-amber-300/90">Caveats</div>
              <ul className="space-y-1">
                {explanation.caveats.map((caveat) => (
                  <li key={caveat} className="text-[11px] leading-relaxed text-amber-100/85">
                    · {caveat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.llm_error && (
            <p className="mt-3 text-[10px] text-slate-500">
              External LLM unavailable ({explanation.llm_error}) - deterministic template used instead.
            </p>
          )}
        </GlassCard>

        <div className="space-y-5">
          <ModelPanel model={model} factorContributions={research.simulation?.factor_contributions} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <KnowledgePanel knowledge={research.retrieved_knowledge} knowledgeBase={research.knowledge_base} />
        {research.comparison ? <AnchorComparisonChart comparison={research.comparison} /> : <div />}
      </div>

      {/* --------------------------- next experiment --------------------------- */}
      <GlassCard strong className="p-6">
        <SectionTitle
          eyebrow="Step 06"
          title="Next suggested experiment"
          description="The follow-up the agent would run next, with the variables it changed and the expected effect on the objective."
          right={next.probe_type ? <Pill tone="violet">{next.probe_type}</Pill> : null}
        />

        {next.error ? (
          <p className="mt-4 text-xs text-amber-200/80">{next.rationale}</p>
        ) : (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {PARAM_META.map((meta) => (
                    <div key={meta.key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2">
                      <div className="label-caps text-slate-500">{meta.label}</div>
                      <div className="mono mt-1 text-sm text-slate-100">{paramValue(meta.key, next[meta.key])}</div>
                    </div>
                  ))}
                </div>

                {next.changed_variables?.length > 0 && (
                  <div className="mt-4">
                    <div className="label-caps mb-2 text-slate-500">Changed variables</div>
                    <div className="flex flex-wrap gap-2">
                      {next.changed_variables.map((change) => (
                        <Pill key={change.variable} tone="cyan">
                          {change.variable.replace('_', ' ')}: {String(change.from)} → {String(change.to)}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <KeyValue label="Predicted yield">
                  <span className={`mono ${TEXT_TONES[yieldTone(next.predicted_yield)]}`}>
                    {num(next.predicted_yield, 1)}%
                  </span>
                </KeyValue>
                <KeyValue label="Score">
                  <span className="mono text-cyan-200">
                    {num(next.score, 1)}
                    <span className="ml-1 text-[10px] text-slate-500">
                      ({next.score_delta >= 0 ? '+' : ''}
                      {num(next.score_delta, 1)})
                    </span>
                  </span>
                </KeyValue>
                <KeyValue label="Yield change">
                  <span className="mono text-slate-200">
                    {next.yield_delta >= 0 ? '+' : ''}
                    {num(next.yield_delta, 1)} pts
                  </span>
                </KeyValue>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <p className="rounded-xl border-l-2 border-violet-400/50 bg-violet-400/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                {next.rationale}
              </p>
              {next.hypothesis && (
                <p className="rounded-xl border-l-2 border-cyan-400/50 bg-cyan-400/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                  <span className="label-caps mr-1 text-cyan-300/80">Hypothesis</span>
                  {next.hypothesis}
                </p>
              )}
            </div>

            <div className="mt-4">
              <Button onClick={() => onSimulate(next)}>⚗ Simulate this probe</Button>
            </div>
          </>
        )}
      </GlassCard>

      {/* ------------------------------- trace -------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Audit"
            title="Agent trace"
            description="Real measured stage timings from the backend, in order."
          />
          <ol className="mt-4 space-y-2">
            {(research.agent_trace || []).map((entry, index) => (
              <li key={`${entry.step}-${index}`} className="flex items-start gap-3">
                <span className="mono mt-0.5 w-14 shrink-0 text-[10px] text-cyan-400/70">
                  {num(entry.at_ms, 0)} ms
                </span>
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    entry.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px] leading-relaxed">
                  <span className="font-medium text-slate-200">
                    {PIPELINE_LABELS[entry.step] || entry.label}
                  </span>
                  <span className="text-slate-500"> — {entry.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="Provenance" title="Disclaimers and limits" />
          <ul className="mt-4 space-y-2">
            {(research.disclaimers || []).map((disclaimer) => (
              <li key={disclaimer} className="flex gap-2 text-[11px] leading-relaxed text-amber-100/80">
                <span className="text-amber-300">⚠</span>
                {disclaimer}
              </li>
            ))}
          </ul>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-4 sm:grid-cols-3">
            <KeyValue label="Model">{model.type}</KeyValue>
            <KeyValue label="Dataset">
              <span className="mono text-amber-200/80">{model.dataset_provenance}</span>
            </KeyValue>
            <KeyValue label="Features">{(model.features || []).length}</KeyValue>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
