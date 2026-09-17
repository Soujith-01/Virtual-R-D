import { motion } from 'framer-motion'
import { Button, GlassCard, Pill, SectionTitle } from './ui'
import { PIPELINE_STEPS } from '../lib/constants'
import { num } from '../lib/format'

const FEATURES = [
  {
    icon: '🧠',
    title: 'Grounded knowledge retrieval',
    body: 'Sentence-level retrieval over a process-chemistry knowledge base, so explanations cite the source notes they actually used.',
  },
  {
    icon: '🌲',
    title: 'Trained surrogate model',
    body: 'A Random Forest regressor predicts reaction yield with a measured error bar, replacing guesswork with a ranked hypothesis.',
  },
  {
    icon: '⚖️',
    title: 'Transparent ranking',
    body: 'Never yield-only. A visible weighted score over yield, time, temperature, pressure and a risk penalty - every weight open to challenge.',
  },
  {
    icon: '🔬',
    title: 'Virtual experiment',
    body: 'A staged reactor simulation previews how the recommended run behaves before anyone books bench time.',
  },
]

export default function Landing({ onStartManual, onStartAI, onStart, onDemo, health, loadingDemo }) {
  const metrics = health?.model_metrics || {}

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-16">
      {/* -------------------------------- hero -------------------------------- */}
      <section className="relative grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="cyan" dot>
              Accelerating scientific discovery through AI-driven virtual experimentation
            </Pill>
            <Pill tone="slate">Reaction yield optimisation</Pill>
          </div>

          <h1 className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-slate-50 sm:text-6xl lg:text-7xl">
            <span className="text-glow">NUCLEUS AI</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
              R&amp;D LAB
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-lg text-cyan-100/80">
            AI-powered experimental discovery platform. Explore experimental possibilities before
            committing to expensive real-world experiments.
          </p>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Choose your mode: design your own experiment manually, or let the AI agent generate and rank
            candidate experiments for you.
          </p>

          <p className="mt-4 max-w-lg text-[11px] leading-relaxed text-amber-200/70">
            <strong className="font-semibold">Scientific disclaimer:</strong> the underlying dataset is
            a simulated prototype (<span className="mono">synthetic_prototype_v1</span>). Predictions
            demonstrate the workflow and do not represent validated real-world chemistry.
          </p>
        </motion.div>

        {/* right column: model + pipeline preview */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="space-y-4"
        >
          <GlassCard strong className="p-5">
            <SectionTitle
              eyebrow="Live model"
              title={health?.model_loaded ? 'Surrogate model online' : 'Model not detected'}
              description="Trained on the synthetic prototype dataset with a held-out test split and 5-fold cross-validation."
            />
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'R²', value: metrics.r2, digits: 3, tone: 'text-cyan-300' },
                { label: 'MAE', value: metrics.mae, digits: 2, tone: 'text-sky-300' },
                { label: 'RMSE', value: metrics.rmse, digits: 2, tone: 'text-violet-300' },
                {
                  label: 'KB chunks',
                  value: health?.knowledge_base?.chunks ?? 0,
                  digits: 0,
                  tone: 'text-emerald-300',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/5 bg-white/2 px-3 py-2.5">
                  <div className="label-caps text-slate-500">{item.label}</div>
                  <div className={`mono mt-1 text-xl font-semibold ${item.tone}`}>
                    {typeof item.value === 'number' ? num(item.value, item.digits) : '—'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <Pill tone="slate">RandomForestRegressor</Pill>
              <Pill tone="slate">5 features</Pill>
              <Pill tone="slate">target: yield %</Pill>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle eyebrow="Agent pipeline" title="What runs on every AI request" />
            <ol className="mt-4 space-y-2">
              {PIPELINE_STEPS.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span className="mono mt-0.5 w-6 shrink-0 text-[11px] text-cyan-400/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-300">
                    <span className="font-medium text-slate-200">{step.label}</span>
                    <span className="text-slate-500"> — {step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </GlassCard>
        </motion.div>
      </section>

      {/* ─────────────────── mode selection ─────────────────── */}
      <section className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <div className="mb-5 text-center">
            <div className="label-caps text-cyan-400/80">Choose your mode</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-100">How would you like to work?</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Manual R&D card */}
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <GlassCard
                hover
                className="group relative h-full cursor-pointer overflow-hidden border border-cyan-300/20 p-7 transition-all hover:border-cyan-300/45"
                onClick={onStartManual || onStart}
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/8 blur-2xl transition group-hover:bg-cyan-400/15" />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-xl">✎</span>
                    <div>
                      <div className="label-caps text-cyan-400/80">Mode 1</div>
                      <div className="text-lg font-bold text-slate-100">Manual R&amp;D</div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">
                    Design your own experiment and test it virtually. You choose every parameter — the AI predicts the outcome and runs a staged virtual simulation.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {['You choose temperature, pressure, catalyst, concentration, time', 'AI model predicts yield', 'Virtual reactor simulation', 'Clear 4-step guided flow'].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="mt-0.5 text-cyan-400">▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Button onClick={onStartManual || onStart} className="w-full !py-3" id="btn-start-manual">
                      Start Manual Experiment →
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* AI-Assisted R&D card */}
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <GlassCard
                hover
                className="group relative h-full cursor-pointer overflow-hidden border border-violet-300/20 p-7 transition-all hover:border-violet-300/40"
                onClick={onStartAI || onStart}
              >
                <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-violet-400/8 blur-2xl transition group-hover:bg-violet-400/15" />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-400/10 text-xl">✦</span>
                    <div>
                      <div className="label-caps text-violet-400/80">Mode 2</div>
                      <div className="text-lg font-bold text-slate-100">AI-Assisted R&amp;D</div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">
                    Let AI generate and rank promising experimental conditions. Choose from 5 domain
                    templates (Reaction Yield, Solar, Plant, Battery, Water) or enter a custom objective.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {['AI generates candidate experiments', 'Ranked by a transparent scoring model', 'Knowledge base grounded explanations', 'Next experiment automatically suggested'].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="mt-0.5 text-violet-400">▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={onStartAI || onStart}
                      className="flex-1 !py-3 !border-violet-300/25 !text-violet-100 hover:!bg-violet-400/10"
                      id="btn-start-ai"
                    >
                      Browse Experiment Templates →
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onDemo}
                      loading={loadingDemo}
                      className="!py-3 !border-violet-300/15 !text-slate-400 hover:!bg-violet-400/5"
                      id="btn-run-demo"
                    >
                      ▶ Demo
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------ features ------------------------------ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.07 }}
          >
            <GlassCard hover className="h-full p-5">
              <div className="text-xl">{feature.icon}</div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{feature.body}</p>
            </GlassCard>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
