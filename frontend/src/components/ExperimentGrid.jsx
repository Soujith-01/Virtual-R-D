import ExperimentCard from './ExperimentCard'
import { GlassCard, Pill, SectionTitle } from './ui'
import { getPredictionKey, getTargetLabel, getTargetUnit } from '../lib/format'

export default function ExperimentGrid({
  experiments = [],
  selectedId,
  recommendedId,
  onSimulate,
  objective,
  search,
  knowledgeCount,
  children,
  domain,
}) {
  const domainId = domain?.id || 'reaction-yield'
  const predKey = getPredictionKey(domainId)
  const targetLabel = getTargetLabel(domainId, true)
  const targetUnit = getTargetUnit(domainId)

  return (
    <section className="space-y-4">
      <GlassCard className="p-5">
        <SectionTitle
          eyebrow="Step 03"
          title="Candidate experiment dashboard"
          description={`Every candidate was proposed by the model-guided search, predicted by the ${domain?.label || 'AI surrogate model'}, and scored against the objective. Nothing here is ranked on yield alone.`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              {search?.pool_evaluated && (
                <Pill tone="slate">
                  {search.pool_evaluated} conditions evaluated
                </Pill>
              )}
              {knowledgeCount > 0 && <Pill tone="violet">{knowledgeCount} knowledge passages</Pill>}
              <Pill tone="cyan">{experiments.length} shortlisted</Pill>
            </div>
          }
        />

        {objective && (
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {Object.entries(objective.weights || {}).map(([key, weight]) => (
              <div key={key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2">
                <div className="label-caps text-slate-500">{key.replace(/_/g, ' ')} weight</div>
                <div className="mono mt-0.5 text-sm font-semibold text-cyan-200">
                  {(weight * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {objective?.notes?.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
            {objective.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        )}
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {experiments.map((experiment, index) => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            index={index}
            selected={selectedId === experiment.id}
            recommended={recommendedId === experiment.id}
            onSimulate={onSimulate}
            domainId={domainId}
            predictionKey={predKey}
          />
        ))}
      </div>

      {children}
    </section>
  )
}
