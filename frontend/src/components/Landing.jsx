import { motion } from 'framer-motion'
import { Button, GlassCard, Pill, SectionTitle } from './ui'
import { num } from '../lib/format'

const WORKFLOW_STAGES = [
  { step: '01', title: 'Research Goal', icon: '🎯', desc: 'Multi-objective parsing' },
  { step: '02', title: 'Knowledge', icon: '📚', desc: 'RAG & paper literature' },
  { step: '03', title: 'AI Hypothesis', icon: '💡', desc: 'Design space sampling' },
  { step: '04', title: 'Experiment', icon: '🧪', desc: 'Candidate condition shortlist' },
  { step: '05', title: 'Prediction', icon: '🌲', desc: 'Surrogate model inference' },
  { step: '06', title: 'Simulation', icon: '⚗️', desc: 'Virtual reactor execution' },
  { step: '07', title: 'Optimization', icon: '⚡', desc: 'Neighborhood search' },
  { step: '08', title: 'Human Review', icon: '👨‍🔬', desc: 'Scientist audit & approval' },
  { step: '09', title: 'Next Trial', icon: '🧭', desc: 'Active learning probe' },
]

const FEATURES = [
  {
    icon: '🧠',
    title: 'Grounded Knowledge Retrieval',
    body: 'Sentence-level RAG retrieval over process chemistry & peer-reviewed research papers. Exposes transparent source citations.',
  },
  {
    icon: '🌲',
    title: 'Trained Surrogate Model',
    body: 'Trained predictive surrogate models forecast outcomes with empirical error bars, replacing guesswork with ranked hypotheses.',
  },
  {
    icon: '⚖️',
    title: 'Multi-Objective Ranking',
    body: 'Transparent weighted scores balancing target yields, operational time, temperature, pressure, and calibrated safety penalties.',
  },
  {
    icon: '🔬',
    title: 'Virtual Reactor Simulation',
    body: 'Staged dynamic simulation previews chemical kinetics, thermodynamic curves, and sensor telemetry before booking bench time.',
  },
]

export default function Landing({ onStartManual, onStartAI, onStart, onDemo, health, loadingDemo }) {
  const metrics = health?.model_metrics || {}

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-16 space-y-8">
      {/* -------------------------------- hero -------------------------------- */}
      <section className="relative grid items-center gap-8 pt-8 pb-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="cyan" dot>
              AI-Driven Virtual Experimentation Platform
            </Pill>
            <Pill tone="slate">Decision Support System</Pill>
          </div>

          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
            <span className="text-glow tracking-wide">NUCLEUS AI</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              R&amp;D LAB
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-base text-cyan-100/90 leading-relaxed">
            Accelerate experimental discovery through model-guided hypothesis generation, virtual reactor simulation,
            and grounded scientific literature synthesis before committing to expensive physical bench runs.
          </p>

          {/* Compact Scientific Disclaimer */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80 max-w-xl">
            <span className="text-amber-400 shrink-0">⚠️</span>
            <span>
              <strong>Scientific prototype:</strong> Predictions are AI surrogate hypotheses for experimental prioritization, not certified physical bench measurements.
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onStartAI || onStart} className="!py-3 !px-6 text-sm" id="btn-hero-start-ai">
              ✦ Launch AI Discovery
            </Button>
            <Button variant="ghost" onClick={onStartManual || onStart} className="!py-3 !px-6 text-sm" id="btn-hero-start-manual">
              ✎ Manual Experiment
            </Button>
            <Button
              variant="secondary"
              onClick={onDemo}
              loading={loadingDemo}
              className="!py-3 !px-4 text-sm"
              id="btn-hero-demo"
            >
              ▶ Run Demo
            </Button>
          </div>
        </motion.div>

        {/* Right column: live model telemetry & stats */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="space-y-3"
        >
          <GlassCard strong className="p-5 border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {health?.model_loaded ? 'Surrogate ML Model Online' : 'Model Standby'}
                </h3>
              </div>
              <Pill tone="emerald">Active</Pill>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'R² Accuracy', value: metrics.r2, digits: 3, tone: 'text-cyan-300' },
                { label: 'Mean Abs Error', value: metrics.mae, digits: 2, tone: 'text-sky-300' },
                { label: 'Root MSE', value: metrics.rmse, digits: 2, tone: 'text-violet-300' },
                {
                  label: 'RAG Passages',
                  value: health?.knowledge_base?.chunks ?? 0,
                  digits: 0,
                  tone: 'text-emerald-300',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/5 bg-white/2 p-3">
                  <div className="label-caps text-slate-500 text-[10px]">{item.label}</div>
                  <div className={`mono mt-1 text-lg font-bold ${item.tone}`}>
                    {typeof item.value === 'number' ? num(item.value, item.digits) : '—'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-400 border-t border-white/5 pt-3">
              <Pill tone="slate">AI Surrogate Engine</Pill>
              <Pill tone="slate">5 Scientific Domains</Pill>
              <Pill tone="slate">Active Literature RAG</Pill>
              <Pill tone="cyan">Multi-Objective Pareto</Pill>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* -------------------- Research Workflow Flowchart -------------------- */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <GlassCard strong className="p-5 border-cyan-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <div className="label-caps text-cyan-400/80">Autonomous Closed-Loop Process</div>
                <h2 className="text-base font-bold text-slate-100">End-to-End Scientific R&amp;D Workflow</h2>
              </div>
              <Pill tone="cyan" dot>9-Stage Discovery Architecture</Pill>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
              {WORKFLOW_STAGES.map((wf, idx) => (
                <div
                  key={wf.step}
                  className="relative rounded-xl border border-white/5 bg-slate-900/60 p-3 text-center transition hover:border-cyan-400/30 hover:bg-slate-900/90"
                >
                  <div className="text-xl mb-1">{wf.icon}</div>
                  <div className="mono text-[10px] font-semibold text-cyan-400">{wf.step}</div>
                  <div className="text-xs font-bold text-slate-200 truncate">{wf.title}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{wf.desc}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* ─────────────────── Mode Selection ─────────────────── */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="label-caps text-cyan-400/80">Experiment Modes</div>
              <h2 className="text-lg font-bold text-slate-100">Choose Your Investigation Pathway</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Manual R&D Card */}
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <GlassCard
                hover
                className="group relative h-full cursor-pointer overflow-hidden border border-cyan-300/20 p-6 transition-all hover:border-cyan-300/40"
                onClick={onStartManual || onStart}
              >
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-xl">✎</span>
                      <div>
                        <div className="label-caps text-cyan-400/80">Pathway 01</div>
                        <h3 className="text-base font-bold text-slate-100">Manual Laboratory R&amp;D</h3>
                      </div>
                    </div>
                    <Pill tone="cyan">Hands-On</Pill>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-400">
                    Directly define target reaction parameters — temperature, pressure, catalyst selection, concentration, and run duration. Test virtually before booking physical equipment.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">✓</span> Custom Parameter Control
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">✓</span> Surrogate Model Prediction
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">✓</span> Staged Reactor Simulation
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">✓</span> Apparatus Instrumentation
                    </div>
                  </div>

                  <div className="pt-3">
                    <Button onClick={onStartManual || onStart} className="w-full !py-2.5 text-xs font-semibold" id="btn-start-manual">
                      Launch Manual Experiment →
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* AI-Assisted R&D Card */}
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <GlassCard
                hover
                className="group relative h-full cursor-pointer overflow-hidden border border-indigo-400/20 p-6 transition-all hover:border-indigo-400/40"
                onClick={onStartAI || onStart}
              >
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/10 text-xl">✦</span>
                      <div>
                        <div className="label-caps text-indigo-300/80">Pathway 02</div>
                        <h3 className="text-base font-bold text-slate-100">AI-Guided Optimization</h3>
                      </div>
                    </div>
                    <Pill tone="violet">Automated</Pill>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-400">
                    State your research goal in natural language. The autonomous agent generates candidate shortlists, ranks trade-offs, retrieves peer-reviewed papers, and designs follow-up trials.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-400">✓</span> 5 Pre-Built Scientific Domains
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-400">✓</span> Multi-Objective Pareto Scoring
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-400">✓</span> RAG Literature Grounding
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-400">✓</span> Automated Next-Trial Probes
                    </div>
                  </div>

                  <div className="pt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={onStartAI || onStart}
                      className="flex-1 !py-2.5 !border-indigo-400/30 !text-indigo-200 hover:!bg-indigo-400/10 text-xs font-semibold"
                      id="btn-start-ai"
                    >
                      Browse Domains &amp; Templates →
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onDemo}
                      loading={loadingDemo}
                      className="!py-2.5 !px-4 !border-indigo-400/20 !text-slate-300 hover:!bg-indigo-400/5 text-xs font-semibold"
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

      {/* ------------------------------ Features Grid ------------------------------ */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
          >
            <GlassCard hover className="h-full p-4 border-white/5">
              <div className="text-lg">{feature.icon}</div>
              <h3 className="mt-2 text-xs font-bold text-slate-100">{feature.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{feature.body}</p>
            </GlassCard>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
