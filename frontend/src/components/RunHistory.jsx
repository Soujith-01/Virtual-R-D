import { GlassCard, Pill, SectionTitle } from './ui'
import { num } from '../lib/format'

export default function RunHistory({ runs = [], available, onOpen, className = '' }) {
  if (!available || !runs.length) return null

  return (
    <GlassCard className={`p-5 ${className}`}>
      <SectionTitle
        eyebrow="Persistence"
        title="Recent research runs"
        description="Stored in SQLite. Selecting a run reloads its full report."
        right={<Pill tone="slate">{runs.length} saved</Pill>}
      />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => (
          <li key={run.run_id}>
            <button
              type="button"
              onClick={() => onOpen(run.run_id)}
              className="w-full rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-left transition hover:border-cyan-300/35"
            >
              <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-200">
                {run.research_question}
              </p>
              <div className="mono mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                <span className="text-cyan-300/80">{num(run.predicted_yield, 1)}%</span>
                <span>score {num(run.recommended_score, 1)}</span>
                <span className="ml-auto">
                  {run.created_at ? new Date(run.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
