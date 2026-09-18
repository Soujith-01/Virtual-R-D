import { motion } from 'framer-motion'
import { Button, GlassCard, KeyValue, Meter, Pill, SectionTitle, TEXT_TONES } from './ui'
import { KnowledgePanel, ModelPanel } from './KnowledgePanel'
import { DOMAINS, CATALYST_LABELS, PARAM_META } from '../lib/constants'
import {
  AnchorComparisonChart,
  ObjectiveWeightsChart,
  PredictionVsSimulationChart,
  OptimizationTraceChart,
  TrialLineageTimeline,
  YieldComparisonChart,
  ScoreBreakdownChart,
} from './Charts'
import {
  num,
  paramValue,
  riskTone,
  scoreTone,
  yieldTone,
  getPredictionKey,
  getTargetLabel,
  getTargetUnit,
} from '../lib/format'

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

export default function ResearchReport({ research, onSimulate, onReset, activeResearchPapers = [] }) {
  if (!research) {
    return (
      <GlassCard className="p-10 text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="text-4xl">📄</div>
        <div className="text-lg font-semibold text-slate-100">No Research Report Available</div>
        <p className="text-xs leading-relaxed text-slate-400">
          Run an AI experimental discovery pipeline or select an experiment template to generate a full research report with model predictions and recommendations.
        </p>
        <div className="pt-2">
          <Button onClick={onReset}>
            🔬 Start New Experiment
          </Button>
        </div>
      </GlassCard>
    )
  }

  const best = research.recommended_experiment || {}
  const objective = research.research_objective || {}
  const explanation = research.explanation || {}
  const next = research.next_suggested_experiment || {}
  const model = research.model || {}
  const domainId = research.domain || 'reaction-yield'
  const domain = DOMAINS[domainId] || DOMAINS[domainId.replace(/_/g, '-')] || DOMAINS['reaction-yield']

  const predKey = getPredictionKey(domainId)
  const targetLabel = getTargetLabel(domainId, true)
  const targetUnit = getTargetUnit(domainId)

  // Extract actual prediction value from domain-specific key
  const getPredValue = (exp) => {
    if (!exp) return 0
    return (
      exp[predKey] ??
      exp.predicted_yield ??
      exp.predicted_efficiency ??
      exp.predicted_biomass_yield ??
      exp.predicted_capacity_retention ??
      exp.predicted_turbidity_removal ??
      0
    )
  }

  const getPredValueForDisplay = (exp) => {
    const val = getPredValue(exp)
    return num(val, 1)
  }

  const relevantPapersList =
    research.relevant_papers && research.relevant_papers.length > 0
      ? research.relevant_papers
      : activeResearchPapers && activeResearchPapers.length > 0
      ? activeResearchPapers
      : (research.retrieved_knowledge || []).filter((k) => k.is_paper)

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-5 pb-20">
      {/* ------------------------------- header ------------------------------- */}
      <GlassCard strong className="p-6 border-cyan-500/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-caps text-cyan-400/80">Step 05 · Autonomous Scientific Decision Report</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
              {research.research_question}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="cyan">{research.run_id || 'RUN-01'}</Pill>
              <Pill tone="slate">{num(research.elapsed_ms, 0)} ms execution</Pill>
              <Pill tone="violet">
                {explanation.used_external_llm ? `LLM · ${explanation.generated_by}` : 'Deterministic Reasoning'}
              </Pill>
              <Pill tone="emerald">{research.candidate_experiments?.length ?? 0} candidates shortlisted</Pill>
              <Pill tone="amber">{domain?.label || 'Reaction Yield'}</Pill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => download(`nucleus-ai-${research.run_id || 'run'}.json`, research)}>
              ⭳ Export Data (JSON)
            </Button>
            <Button onClick={onReset}>New Investigation</Button>
          </div>
        </div>
      </GlassCard>

      {/* ---------------------- 1. Top Recommendation Hero ------------------- */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Dominant Recommended Experiment Card */}
        <GlassCard strong className="relative overflow-hidden p-6 border-cyan-400/30 bg-slate-950/80">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle
              eyebrow="Primary Recommendation"
              title={`Optimal Candidate: ${best.id || 'EXP-01'}`}
              right={<Pill tone={scoreTone(best.score)}>score {best.score?.toFixed(1) || '—'} / 100</Pill>}
            />
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-[1.1fr_0.9fr] items-start">
            {/* Predicted Outcome Large Glow */}
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-5">
              <div className="label-caps text-slate-400">Predicted {targetLabel}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mono text-5xl font-extrabold ${TEXT_TONES[yieldTone(getPredValue(best))]}`}
                >
                  {getPredValueForDisplay(best)}
                </motion.span>
                <span className="text-xl font-semibold text-slate-400">{targetUnit}</span>
              </div>
              <div className="mono mt-2 text-xs text-slate-400 space-y-0.5">
                <div>Interval: <span className="text-slate-200">{num(best.interval_low || 0, 1)} – {num(best.interval_high || 0, 1)}{targetUnit}</span></div>
                <div>Uncertainty proxy: <span className="text-cyan-300">±{num(best.uncertainty_std || 0, 2)} σ</span></div>
              </div>
            </div>

            {/* Badges & Confidence */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Pill tone={riskTone(best.risk?.level)}>{best.risk?.level || 'Low'} Risk</Pill>
                {best.catalyst && (
                  <Pill tone="slate">{CATALYST_LABELS[best.catalyst] ?? best.catalyst}</Pill>
                )}
                {(best.reaction_time || best.contact_time_min) && (
                  <Pill tone="cyan">
                    {best.reaction_time ? `${num(best.reaction_time, 0)} min` : `${num(best.contact_time_min, 0)} min`}
                  </Pill>
                )}
                <Pill tone={best.estimated_confidence >= 0.8 ? 'emerald' : 'amber'}>
                  confidence {best.estimated_confidence?.toFixed(2) || '0.90'}
                </Pill>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-xs text-slate-300">
                <div className="label-caps text-slate-500 mb-1">Objective Rank</div>
                <div className="text-sm font-semibold text-cyan-300">
                  Rank #{best.rank || 1} of {research.candidate_experiments?.length || 5} candidates
                </div>
              </div>
            </div>
          </div>

          {/* Key Parameters Grid */}
          <div className="mt-5">
            <div className="label-caps text-slate-500 mb-2">Recommended Parameter Set</div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {(domain?.featureKeys || PARAM_META.map((m) => m.key)).map((key) => (
                <div key={key} className="rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2.5">
                  <div className="label-caps text-slate-500 text-[10px]">
                    {domain?.featureLabels?.[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
                  <div className="mono mt-1 text-sm font-semibold text-slate-100">
                    {paramValue(key, best?.[key], domainId)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selection Rationale */}
          {best.reason && (
            <div className="mt-4 rounded-xl border-l-2 border-cyan-400 bg-cyan-950/20 px-4 py-3 text-xs leading-relaxed text-slate-200">
              <span className="font-semibold text-cyan-300 mr-1.5">Selection Rationale:</span>
              {best.reason}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => onSimulate(best)} className="!py-2.5 !px-5 text-xs font-semibold">
              ⚗ Run in Virtual Reactor Simulation
            </Button>
            {next && (next.temperature || next.cell_thickness_nm || next.light_intensity_lux) && (
              <Button variant="ghost" onClick={() => onSimulate(next)} className="!py-2.5 text-xs font-semibold">
                ▶ Simulate Next Probe ({next.id || 'NEXT-01'})
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Objective Weights Chart (Requirement A) */}
        <ObjectiveWeightsChart
          weights={objective.weights || {}}
          title="Multi-Objective Weights"
        />
      </div>

      {/* ------------------- 2. Trial Lineage Timeline (Requirement E) -------- */}
      <TrialLineageTimeline research={research} domainId={domainId} />

      {/* ------------------- 3. Prediction vs Simulation (Requirement C) ------ */}
      {research.simulation && (
        <PredictionVsSimulationChart
          simulation={research.simulation}
          targetLabel={targetLabel}
          targetUnit={targetUnit}
        />
      )}

      {/* ------------------- 4. Optimization Search Trace (Requirement D) ---- */}
      {research.search && (
        <OptimizationTraceChart search={research.search} />
      )}

      {/* ------------------- 5. Candidate Shortlist & Score Breakdown --------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <YieldComparisonChart
          experiments={research.candidate_experiments || []}
          selectedId={best.id}
          predictionKey={predKey}
          targetUnit={targetUnit}
        />
        <ScoreBreakdownChart experiments={research.candidate_experiments || []} />
      </div>

      {/* ------------------- 6. Candidate Shortlist Table --------------------- */}
      <GlassCard className="p-5">
        <SectionTitle
          eyebrow="Ranked Candidates"
          title="Evaluated Shortlist & Parameter Matrix"
          description="Multi-objective Pareto shortlist. Every row represents an empirically ranked candidate experiment."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="label-caps text-slate-500 border-b border-white/5">
                <th className="pb-2.5">#</th>
                <th className="pb-2.5">ID</th>
                {(domain?.featureKeys || []).slice(0, 5).map((key) => (
                  <th key={key} className="pb-2.5">
                    {domain?.featureLabels?.[key] || key.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="pb-2.5">{targetLabel}</th>
                <th className="pb-2.5">Score</th>
                <th className="pb-2.5">Risk</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(research.candidate_experiments || []).map((row) => (
                <tr key={row.id} className="text-slate-300 hover:bg-white/2 transition">
                  <td className="mono py-2.5 text-slate-500">{row.rank}</td>
                  <td className="mono py-2.5 text-slate-100 font-semibold">{row.id}</td>
                  {(domain?.featureKeys || []).slice(0, 5).map((key) => (
                    <td key={key} className="mono py-2.5 text-slate-300">
                      {paramValue(key, row[key], domainId)}
                    </td>
                  ))}
                  <td className={`mono py-2.5 font-bold ${TEXT_TONES[yieldTone(getPredValue(row))]}`}>
                    {getPredValueForDisplay(row)}{targetUnit}
                  </td>
                  <td className="mono py-2.5 text-cyan-300 font-semibold">{num(row.score, 1)}</td>
                  <td className="py-2.5">
                    <Pill tone={riskTone(row.risk?.level)}>{row.risk?.level}</Pill>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button variant="subtle" className="!px-3 !py-1 text-[11px]" onClick={() => onSimulate(row)}>
                      Simulate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ------------------- 7. AI Explanation & Model Panels ---------------- */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Agent Reasoning"
            title="Scientific Explanation & Rationale"
            right={
              <Pill tone={explanation.used_external_llm ? 'amber' : 'slate'}>
                {explanation.generated_by}
              </Pill>
            }
          />
          <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-slate-300">
            {explanation.explanation}
          </p>

          {explanation.highlights?.length > 0 && (
            <div className="mt-5">
              <div className="label-caps mb-2 text-slate-500">Key Highlights</div>
              <ul className="space-y-1.5">
                {explanation.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                    <span className="text-cyan-400">▸</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.caveats?.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3.5">
              <div className="label-caps mb-1.5 text-amber-300/90">Boundary Caveats</div>
              <ul className="space-y-1">
                {explanation.caveats.map((caveat) => (
                  <li key={caveat} className="text-[11px] leading-relaxed text-amber-100/85">
                    · {caveat}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>

        <div className="space-y-6">
          <ModelPanel model={model} factorContributions={research.simulation?.factor_contributions} />
        </div>
      </div>

      {/* ------------------- 8. Knowledge & Baselines ------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <KnowledgePanel knowledge={research.retrieved_knowledge} knowledgeBase={research.knowledge_base} />
        {research.comparison ? <AnchorComparisonChart comparison={research.comparison} /> : <div />}
      </div>

      {/* ------------------- 9. Relevant Research Papers --------------------- */}
      <GlassCard strong className="p-6">
        <SectionTitle
          eyebrow="Scientific Literature"
          title="Relevant Research Papers"
          description="Peer-reviewed publications injected into the RAG retriever and model reasoning for this experimental campaign."
          right={
            <Pill tone="cyan" dot>
              {relevantPapersList.length} Injected Paper{relevantPapersList.length === 1 ? '' : 's'}
            </Pill>
          }
        />
        {relevantPapersList.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {relevantPapersList.map((paper, idx) => {
              const authors = Array.isArray(paper.authors) ? paper.authors : []
              const authorsDisplay =
                authors.slice(0, 3).join(', ') + (authors.length > 3 ? ` +${authors.length - 3} more` : '')
              const isOA = paper.is_open_access || paper.isOpenAccess
              const paperUrl = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '')

              return (
                <div
                  key={paper.paper_id || idx}
                  className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4 space-y-2.5 transition hover:border-cyan-500/40"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-cyan-200 font-mono text-[11px]">
                      {paper.year || 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isOA ? 'Open Access' : 'Publisher'} · {paper.source || 'Semantic Scholar'}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 leading-snug">{paper.title}</h4>
                  {authorsDisplay && (
                    <div className="text-xs text-slate-400">
                      Authors: <span className="text-slate-300">{authorsDisplay}</span>
                    </div>
                  )}
                  {paper.doi && (
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <span>DOI:</span>
                      <a
                        href={`https://doi.org/${paper.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline truncate max-w-sm"
                      >
                        {paper.doi}
                      </a>
                    </div>
                  )}
                  {paper.abstract && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {paper.abstract}
                    </p>
                  )}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-cyan-300 text-[11px] font-medium">
                      {isOA ? 'Full-text research context' : 'Abstract-based research context'}
                    </span>
                    {paperUrl && (
                      <a
                        href={paperUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-300 hover:text-cyan-200 font-medium flex items-center gap-1"
                      >
                        View Paper ↗
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/2 p-4 text-xs text-slate-400">
            No external research papers were attached to this session. Default knowledge base was utilized.
          </div>
        )}
      </GlassCard>

      {/* ------------------- 10. Next Suggested Experiment Probe ------------- */}
      <GlassCard strong className="p-6">
        <SectionTitle
          eyebrow="Step 06 · Active Learning Probe"
          title="Next Suggested Experiment"
          description="Autonomous follow-up hypothesis with parameter perturbations and expected impact on target outcome."
          right={next.probe_type ? <Pill tone="violet">{next.probe_type}</Pill> : null}
        />

        {next.error ? (
          <p className="mt-4 text-xs text-amber-200/80">{next.rationale}</p>
        ) : (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {(domain?.featureKeys || []).map((key) => (
                    <div key={key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2">
                      <div className="label-caps text-slate-500 text-[10px]">
                        {domain?.featureLabels?.[key] || key.replace(/_/g, ' ')}
                      </div>
                      <div className="mono mt-1 text-sm font-semibold text-slate-100">
                        {paramValue(key, next[key], domainId)}
                      </div>
                    </div>
                  ))}
                </div>

                {next.changed_variables?.length > 0 && (
                  <div className="mt-4">
                    <div className="label-caps mb-2 text-slate-500">Perturbed Variables</div>
                    <div className="flex flex-wrap gap-2">
                      {next.changed_variables.map((change) => (
                        <Pill key={change.variable} tone="cyan">
                          {change.variable.replace(/_/g, ' ')}: {String(change.from)} → {String(change.to)}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <KeyValue label={`Predicted ${targetLabel}`}>
                  <span className={`mono font-bold ${TEXT_TONES[yieldTone(getPredValue(next))]}`}>
                    {getPredValueForDisplay(next)}
                    <span className="text-xs text-slate-500 ml-0.5">{targetUnit}</span>
                  </span>
                </KeyValue>
                <KeyValue label="Score">
                  <span className="mono font-semibold text-cyan-200">
                    {num(next.score, 1)}
                    <span className="ml-1 text-[10px] text-slate-500">
                      ({next.score_delta >= 0 ? '+' : ''}
                      {num(next.score_delta, 1)})
                    </span>
                  </span>
                </KeyValue>
                <KeyValue label="Target Change">
                  <span className="mono font-semibold text-slate-200">
                    {next.yield_delta >= 0 ? '+' : ''}
                    {num(next.yield_delta, 1)} pts
                  </span>
                </KeyValue>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <p className="rounded-xl border-l-2 border-violet-400/50 bg-violet-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300">
                {next.rationale}
              </p>
              {next.hypothesis && (
                <p className="rounded-xl border-l-2 border-cyan-400/50 bg-cyan-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300">
                  <span className="label-caps mr-1 text-cyan-300/80 font-bold">Hypothesis:</span>
                  {next.hypothesis}
                </p>
              )}
            </div>

            <div className="mt-4">
              <Button onClick={() => onSimulate(next)} className="!py-2.5 !px-5 text-xs font-semibold">
                ⚗ Simulate Follow-Up Probe
              </Button>
            </div>
          </>
        )}
      </GlassCard>

      {/* ------------------- 11. Trace & Disclaimers ------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Audit"
            title="Agent Execution Trace"
            description="Real measured stage timings from the backend."
          />
          <ol className="mt-4 space-y-2">
            {(research.agent_trace || []).map((entry, index) => (
              <li key={`${entry.step}-${index}`} className="flex items-start gap-3">
                <span className="mono mt-0.5 w-14 shrink-0 text-[10px] text-cyan-400/80">
                  {num(entry.at_ms, 0)} ms
                </span>
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    entry.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs leading-relaxed">
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
          <SectionTitle eyebrow="Provenance" title="Disclaimers and Limits" />
          <ul className="mt-4 space-y-2">
            {(research.disclaimers || []).map((disclaimer) => (
              <li key={disclaimer} className="flex gap-2 text-xs leading-relaxed text-amber-100/80">
                <span className="text-amber-300 shrink-0">⚠</span>
                {disclaimer}
              </li>
            ))}
          </ul>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-4 sm:grid-cols-3 text-xs">
            <KeyValue label="Surrogate">{model.type?.includes('Random') ? 'AI Predictive Surrogate' : (model.type || 'AI Surrogate Model')}</KeyValue>
            <KeyValue label="Domain">{domain.label}</KeyValue>
            <KeyValue label="Dataset">
              <span className="mono text-amber-200/80">{model.dataset_provenance || 'synthetic_prototype_v1'}</span>
            </KeyValue>
            <KeyValue label="Features">{(model.features || []).length || domain?.featureKeys?.length || 5}</KeyValue>
            <KeyValue label="Target">{targetLabel}</KeyValue>
            <KeyValue label="Status">
              <span className="text-emerald-300 font-semibold">{model.status || 'READY'}</span>
            </KeyValue>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
