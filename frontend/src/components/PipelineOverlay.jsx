import { AnimatePresence, motion } from 'framer-motion'
import { PIPELINE_STEPS } from '../lib/constants'
import { Spinner } from './ui'

/**
 * Full-screen progress overlay shown while the agent pipeline runs.
 *
 * The stage list advances on a fixed cadence while the request is in flight, so
 * a fast backend still reads as a ten-step pipeline. The *real* per-step timings
 * measured by the backend are shown in the report's agent trace, not here.
 */
export default function PipelineOverlay({ visible, activeStage, question }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-lab-950/82 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            className="glass-strong w-[min(92vw,650px)] rounded-2xl p-7"
          >
            <div className="flex items-center gap-3">
              <Spinner className="!h-5 !w-5" />
              <div>
                <div className="label-caps text-cyan-400/80">AI research agent running</div>
                <h2 className="text-lg font-semibold text-slate-100">Working the pipeline</h2>
              </div>
            </div>

            {question && (
              <p className="mono mt-4 rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100/85">
                “{question}”
              </p>
            )}

            <ol className="mt-5 space-y-1.5">
              {PIPELINE_STEPS.map((step, index) => {
                const done = index < activeStage
                const active = index === activeStage
                return (
                  <li
                    key={step.key}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                      active ? 'bg-cyan-400/10' : ''
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                        done
                          ? 'border-emerald-400/60 bg-emerald-400/20 text-emerald-300'
                          : active
                            ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-200'
                            : 'border-slate-100/15 text-transparent'
                      }`}
                    >
                      {done ? '✓' : active ? '•' : ''}
                    </span>
                    <span
                      className={`text-xs ${done ? 'text-slate-400' : active ? 'font-medium text-cyan-100' : 'text-slate-600'}`}
                    >
                      {step.label}
                    </span>
                    {active && (
                      <span className="ml-auto flex gap-1">
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="h-1 w-1 rounded-full bg-cyan-300"
                            animate={{ opacity: [0.25, 1, 0.25] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.16 }}
                          />
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>

            <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
              Stage timing is measured by the backend and reported in the run's agent trace. No
              results are pre-computed or cached.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
