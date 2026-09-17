import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GlassCard, Button, Pill } from './ui'
import { EXPERIMENT_TEMPLATES } from '../lib/constants'

const ACCENT = {
  cyan: {
    border: 'border-cyan-300/30 hover:border-cyan-300/60',
    glow: 'bg-cyan-400/8',
    hoverGlow: 'group-hover:bg-cyan-400/18',
    badge: 'bg-cyan-400/15 text-cyan-200 border-cyan-300/25',
    icon: 'border-cyan-300/30 bg-cyan-400/10',
    btn: '',
    tag: 'border-cyan-400/20 text-cyan-300/80',
    dot: 'bg-cyan-400',
  },
  amber: {
    border: 'border-amber-300/25 hover:border-amber-300/50',
    glow: 'bg-amber-400/6',
    hoverGlow: 'group-hover:bg-amber-400/14',
    badge: 'bg-amber-400/10 text-amber-200 border-amber-300/20',
    icon: 'border-amber-300/30 bg-amber-400/10',
    btn: '!border-amber-300/25 !text-amber-100 hover:!bg-amber-400/10',
    tag: 'border-amber-400/20 text-amber-300/80',
    dot: 'bg-amber-400',
  },
  emerald: {
    border: 'border-emerald-300/25 hover:border-emerald-300/50',
    glow: 'bg-emerald-400/6',
    hoverGlow: 'group-hover:bg-emerald-400/14',
    badge: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/20',
    icon: 'border-emerald-300/30 bg-emerald-400/10',
    btn: '!border-emerald-300/25 !text-emerald-100 hover:!bg-emerald-400/10',
    tag: 'border-emerald-400/20 text-emerald-300/80',
    dot: 'bg-emerald-400',
  },
  violet: {
    border: 'border-violet-300/25 hover:border-violet-300/50',
    glow: 'bg-violet-400/6',
    hoverGlow: 'group-hover:bg-violet-400/14',
    badge: 'bg-violet-400/10 text-violet-200 border-violet-300/20',
    icon: 'border-violet-300/30 bg-violet-400/10',
    btn: '!border-violet-300/25 !text-violet-100 hover:!bg-violet-400/10',
    tag: 'border-violet-400/20 text-violet-300/80',
    dot: 'bg-violet-400',
  },
  sky: {
    border: 'border-sky-300/25 hover:border-sky-300/50',
    glow: 'bg-sky-400/6',
    hoverGlow: 'group-hover:bg-sky-400/14',
    badge: 'bg-sky-400/10 text-sky-200 border-sky-300/20',
    icon: 'border-sky-300/30 bg-sky-400/10',
    btn: '!border-sky-300/25 !text-sky-100 hover:!bg-sky-400/10',
    tag: 'border-sky-400/20 text-sky-300/80',
    dot: 'bg-sky-400',
  },
  slate: {
    border: 'border-slate-500/25 hover:border-slate-400/40',
    glow: 'bg-slate-500/5',
    hoverGlow: 'group-hover:bg-slate-400/10',
    badge: 'bg-slate-500/10 text-slate-300 border-slate-400/20',
    icon: 'border-slate-500/30 bg-slate-500/10',
    btn: '!border-slate-400/25 !text-slate-200 hover:!bg-slate-400/10',
    tag: 'border-slate-400/20 text-slate-400',
    dot: 'bg-slate-400',
  },
}

function PrototypePanel({ template, onClose }) {
  const a = ACCENT[template.accentColor]
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
            <div className="label-caps text-slate-500 mb-1">Prototype Template</div>
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
            <p className="text-xs text-slate-300">{template.target}</p>
          </div>
          <div>
            <div className="label-caps text-slate-500 mb-1.5">Prediction Model</div>
            <p className="text-xs text-amber-200/80">{template.model}</p>
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

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-[11px] leading-relaxed text-amber-100/85">
          <strong className="text-amber-200">How to extend this platform to {template.domain}:</strong>
          {' '}Collect domain-specific experimental data, train a surrogate model on it, and replace{' '}
          <span className="mono">experiment_model.pkl</span> with the new model. The AI workflow, ranking,
          simulation, and frontend remain unchanged.
        </div>
      </div>
    </motion.div>
  )
}

function TemplateCard({ template, index, onSelect, onShowPrototype }) {
  const a = ACCENT[template.accentColor]
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
                Live model
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
          <div className="mt-5">
            {isLive && (
              <Button className="w-full !py-2.5 text-xs" id={`btn-select-${template.id}`}>
                Select &amp; Generate Candidates →
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
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

export default function ChooseExperiment({ onSelect, onBack }) {
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
              <div className="label-caps text-cyan-400/80">Step 02 · AI-Assisted R&amp;D</div>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-50">
                Choose Your Experiment
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Select an experiment domain below. The AI will generate 5 candidate experimental
                conditions, predict outcomes, and rank them by a transparent scoring model.
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-amber-200/70">
                <strong>Note:</strong> Only <strong>Reaction Yield Optimization</strong> uses the
                trained Random Forest model. Other templates are prototype placeholders that demonstrate
                how the platform can be extended to new domains.
              </p>
            </div>
            <Button variant="ghost" onClick={onBack} className="shrink-0 !py-2 text-xs">
              ← Back to overview
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      {/* live experiments */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="label-caps text-cyan-400/80">Fully supported</div>
          <div className="h-px flex-1 bg-cyan-300/10" />
          <Pill tone="emerald" dot>Live model available</Pill>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              onSelect={onSelect}
              onShowPrototype={handleShowPrototype}
            />
          ))}
        </div>
      </div>

      {/* prototype experiments */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="label-caps text-slate-500">Prototype templates — no trained model</div>
          <div className="h-px flex-1 bg-white/5" />
          <Pill tone="amber">Demo scenarios</Pill>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {protoTemplates.map((template, index) => (
            <div key={template.id} className="space-y-0">
              <TemplateCard
                template={template}
                index={index + liveTemplates.length}
                onSelect={onSelect}
                onShowPrototype={handleShowPrototype}
              />
              <AnimatePresence>
                {expandedPrototype === template.id && (
                  <PrototypePanel
                    template={template}
                    onClose={() => setExpandedPrototype(null)}
                  />
                )}
              </AnimatePresence>
            </div>
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
              index={index + liveTemplates.length + protoTemplates.length}
              onSelect={onSelect}
              onShowPrototype={handleShowPrototype}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
