import { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard, Meter, Pill, SectionTitle } from './ui'
import { num, truncate } from '../lib/format'

/* --------------------------- retrieved knowledge --------------------------- */

export function KnowledgePanel({ knowledge = [], knowledgeBase, defaultOpen = false }) {
  const [openId, setOpenId] = useState(defaultOpen ? knowledge[0]?.chunk_id : null)

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Retrieval"
        title="Retrieved scientific knowledge"
        description="Passages the agent selected by semantic similarity. The report is grounded in these excerpts and names its sources - nothing is invented."
        right={
          <div className="flex flex-wrap gap-2">
            {knowledgeBase?.embedding_backend && <Pill tone="violet">{knowledgeBase.embedding_backend.split(' ')[0]}</Pill>}
            {knowledgeBase?.search_backend && <Pill tone="slate">{knowledgeBase.search_backend} search</Pill>}
          </div>
        }
      />

      {knowledge.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          No knowledge passages were retrieved. Add documents to{' '}
          <span className="mono">backend/rag/documents/</span> and rebuild the index.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {knowledge.map((item, index) => (
            <li key={item.chunk_id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === item.chunk_id ? null : item.chunk_id)}
                className="w-full rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-left transition hover:border-cyan-300/30"
              >
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-cyan-400/70">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="mono truncate text-[11px] text-cyan-100">{item.source}</span>
                  <span className="mono ml-auto shrink-0 text-[10px] text-slate-500">
                    cos {item.similarity.toFixed(3)}
                  </span>
                </div>
                {openId !== item.chunk_id && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{truncate(item.text, 150)}</p>
                )}
              </button>

              {openId === item.chunk_id && (
                <motion.blockquote
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-1 overflow-hidden rounded-xl border-l-2 border-cyan-400/50 bg-cyan-400/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300"
                >
                  {item.text}
                </motion.blockquote>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-amber-200/70">
        Knowledge base provenance: authored prototype process notes created for this demo. They are
        not publications, have no authors or DOIs, and must not be cited as scientific literature.
      </p>
    </GlassCard>
  )
}

/* -------------------------------- model card ------------------------------- */

const FEATURE_LABELS = {
  temperature: 'Temperature',
  pressure: 'Pressure',
  catalyst: 'Catalyst type',
  concentration: 'Concentration',
  reaction_time: 'Reaction time',
  yield: 'Yield',
}

export function ModelPanel({ model, factorContributions }) {
  const importance = model?.feature_importance || {}
  const entries = Object.entries(importance).sort((a, b) => b[1] - a[1])
  const maxImportance = Math.max(...entries.map(([, value]) => value), 0.0001)

  return (
    <GlassCard className="p-5">
      <SectionTitle
        eyebrow="Important factors"
        title="What the model actually relies on"
        description="Grouped feature importance of the trained Random Forest, measured on the held-out test split."
      />

      <div className="mt-4 space-y-2.5">
        {entries.map(([name, value]) => (
          <div key={name}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">{FEATURE_LABELS[name] || name}</span>
              <span className="mono text-cyan-200">{(value * 100).toFixed(1)}%</span>
            </div>
            <Meter className="mt-1" value={(value / maxImportance) * 100} tone="cyan" height="h-1.5" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
        {[
          { label: 'R² (test)', value: model?.metrics?.r2, digits: 4 },
          { label: 'MAE', value: model?.metrics?.mae, digits: 3 },
          { label: 'RMSE', value: model?.metrics?.rmse, digits: 3 },
        ].map((item) => (
          <div key={item.label}>
            <div className="label-caps text-slate-500">{item.label}</div>
            <div className="mono mt-1 text-sm text-slate-100">{num(item.value, item.digits)}</div>
          </div>
        ))}
      </div>

      {model?.cv_r2_mean != null && (
        <p className="mt-3 text-[10px] text-slate-500">
          5-fold CV R² {num(model.cv_r2_mean, 4)} · {model.dataset_provenance} · trained{' '}
          {model.trained_at ? new Date(model.trained_at).toLocaleString() : '—'}
        </p>
      )}

      {factorContributions && (
        <>
          <div className="label-caps mt-5 text-slate-500">
            Simulator factor scores for the recommended run
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            {Object.entries(factorContributions).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-white/5 bg-white/2 px-2.5 py-1.5">
                <div className="text-[10px] capitalize text-slate-500">{key.replace(/_/g, ' ')}</div>
                <div className="mono text-slate-200">{(value * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  )
}
