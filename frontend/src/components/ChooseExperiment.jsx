import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GlassCard, Button, Pill } from './ui'
import { EXPERIMENT_TEMPLATES, ACCENT_COLORS } from '../lib/constants'

function ModelPanel({ template, onClose }) {
  const a = ACCENT_COLORS[template.accentColor]
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className={`mt-4 rounded-xl border ${a.border.split(' ')[0]} bg-lab-900/80 p-5 space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label-caps text-slate-500 mb-1">Model Information</div>
            <p className="text-sm leading-relaxed text-slate-300">
              {template.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-slate-300 text-lg leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="label-caps text-slate-500 mb-1.5">Domain</div>
            <p className="text-xs text-slate-300">{template.domain}</p>
          </div>
          <div>
            <div className="label-caps text-slate-500 mb-1.5">Target Variable</div>
            <p className="text-xs text-cyan-200">{template.target}</p>
          </div>
          <div>
            <div className="label-caps text-slate-500 mb-1.5">Prediction Model</div>
            <p className="text-xs text-emerald-200/80">{template.model}</p>
          </div>
        </div>

        <div>
          <div className="label-caps text-slate-500 mb-2">Variables in this domain</div>
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map((v) => (
              <span key={v} className={`rounded-lg border px-2.5 py-1 text-[11px] ${a.badge}`}>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-[11px] leading-relaxed text-cyan-100/85">
          <strong className="text-cyan-200">How it works:</strong>{" "}
          Each domain has its own trained predictive surrogate model. The AI generates candidate experiments,{" "}
          predicts outcomes using the domain-specific model, and ranks them by your research objective.
        </div>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-[11px] leading-relaxed text-amber-100/85">
          <strong className="text-amber-200">Prototype notice:</strong>{" "}
          Models are trained on synthetic prototype datasets for demonstration. Predictions are AI-generated
          hypotheses for experimental prioritization — not validated scientific results.
        </div>
      </div>
    </motion.div>
  )
}

function TemplateCard({ template, index, onSelect, onShowPrototype, onFindPapers }) {
  const a = ACCENT_COLORS[template.accentColor]
  const isLive = template.status === 'live'
  const isPrototype = template.status === 'prototype'
  const isCustom = template.status === 'custom'

  const handleClick = () => {
    if (isLive || isCustom) {
      onSelect(template)
    } else {
      onShowPrototype(template.id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <GlassCard
        hover
        className={`group relative h-full cursor-pointer overflow-hidden border p-6 transition-all ${a.border}`}
        onClick={handleClick}
      >
        {/* glow orb */}
        <div className={`absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl transition-all duration-300 ${a.glow} ${a.hoverGlow}`} />

        <div className="relative">
          {/* status badge */}
          <div className="mb-4 flex items-center justify-between">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${a.icon}`}>
              {template.icon}
            </span>
            {isLive && (
              <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${a.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${a.dot} animate-pulse`} />
                Model-backed
              </span>
            )}
            {isPrototype && (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${a.badge}`}>
                Prototype template
              </span>
            )}
            {isCustom && (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${a.badge}`}>
                Custom
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-100">{template.label}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{template.tagline}</p>

          {/* domain + target chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] ${a.tag}`}>
              {template.domain}
            </span>
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] ${a.tag}`}>
              Target: {template.target.split('(')[0].trim()}
            </span>
          </div>

          {/* variables list */}
          <div className="mt-4 space-y-1">
            {template.variables.slice(0, 3).map((v) => (
              <div key={v} className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className={`h-1 w-1 rounded-full ${a.dot} opacity-60`} />
                {v}
              </div>
            ))}
            {template.variables.length > 3 && (
              <div className="text-[11px] text-slate-600">+{template.variables.length - 3} more</div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-5 space-y-1.5">
            {isLive && (
              <Button className="w-full !py-2.5 text-xs" id={`btn-select-${template.id}`}>
                Select & Generate Candidates →
              </Button>
            )}
            {isPrototype && (
              <Button variant="ghost" className={`w-full !py-2.5 text-xs ${a.btn}`} id={`btn-info-${template.id}`}>
                Learn how to extend →
              </Button>
            )}
            {isCustom && (
              <Button variant="ghost" className={`w-full !py-2.5 text-xs ${a.btn}`} id={`btn-select-${template.id}`}>
                Enter custom objective →
              </Button>
            )}
            {onFindPapers && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onFindPapers(`${template.label} machine learning optimization`)
                }}
                className="w-full text-center text-[11px] text-cyan-300 hover:text-cyan-100 hover:underline py-0.5 font-medium transition"
              >
                Find Relevant Papers →
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

export default function ChooseExperiment({ onSelect, onBack, onFindPapers }) {
  const [expandedPrototype, setExpandedPrototype] = useState(null)

  const handleShowPrototype = (templateId) => {
    setExpandedPrototype((prev) => (prev === templateId ? null : templateId))
  }

  const liveTemplates = EXPERIMENT_TEMPLATES.filter((t) => t.status === 'live')
  const protoTemplates = EXPERIMENT_TEMPLATES.filter((t) => t.status === 'prototype')
  const customTemplates = EXPERIMENT_TEMPLATES.filter((t) => t.status === 'custom')

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-16">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <GlassCard strong className="p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="label-caps text-cyan-400/80">Step 02 · AI-Assisted R&D</div>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-50">
                Choose Your Experiment
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Select an experiment domain below. The AI will generate candidate experimental
                conditions, predict outcomes using a domain-specific ML model, and rank them by a
                transparent scoring function.
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-cyan-200/70">
                <strong>All domains below use trained ML models:</strong> Each has its own
                predictive surrogate engine trained on synthetic prototype data for demonstration.
              </p>
            </div>
            <Button variant="ghost" onClick={onBack} className="shrink-0 !py-2 text-xs">
              ← Back to overview
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      {/* AI model experiments */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="label-caps text-cyan-400/80">MODEL-BACKED EXPERIMENT DOMAINS</div>
          <div className="h-px flex-1 bg-cyan-300/10" />
          <Pill tone="emerald" dot>All domains have trained ML models</Pill>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              onSelect={onSelect}
              onShowPrototype={handleShowPrototype}
              onFindPapers={onFindPapers}
            />
          ))}
        </div>
      </div>

      {/* custom research */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="label-caps text-slate-500">Open research</div>
          <div className="h-px flex-1 bg-white/5" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index + liveTemplates.length}
              onSelect={onSelect}
              onShowPrototype={handleShowPrototype}
            />
          ))}
        </div>
      </div>

      {/* Model info disclaimer */}
      <div className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-300 text-lg">⚠</span>
          <div>
            <div className="text-sm font-medium text-amber-100">Prototype Models — Synthetic Demonstration Data</div>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
              All models are trained on synthetic prototype datasets for demonstration purposes only.
              Predictions are AI-generated hypotheses to prioritize experiments — not validated laboratory
              measurements. Replace with real experimental data and retrain for production use.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
