import { useState } from 'react'
import { Button } from './ui'
import { num } from '../lib/format'

/** Steps shown in the AI-Assisted breadcrumb trail. */
const AI_STEPS = [
  { key: 'landing', label: 'Overview', nav: 'landing', icon: '🏠' },
  { key: 'choose', label: 'Choose Experiment', nav: 'choose', icon: '🧪' },
  { key: 'workspace', label: 'AI Generates', nav: 'workspace', icon: '⚡' },
  { key: 'experiments', label: 'Compare & Rank', nav: 'experiments', icon: '📊' },
  { key: 'simulation', label: 'Virtual Experiment', nav: 'simulation', icon: '⚗️' },
  { key: 'report', label: 'Research Report', nav: 'report', icon: '📄' },
]

const MANUAL_STEPS = [
  { key: 'landing', label: 'Overview', nav: 'landing', icon: '🏠' },
  { key: 'workspace', label: 'Manual R&D', nav: 'workspace', icon: '🎛️' },
]

const AI_STEP_INDEX = Object.fromEntries(AI_STEPS.map((s, i) => [s.key, i]))
const MANUAL_STEP_INDEX = Object.fromEntries(MANUAL_STEPS.map((s, i) => [s.key, i]))

export default function Sidebar({ step, mode = 'ai', health, selectedTemplate, onReset, onNavigate, onSwitchMode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const metrics = health?.model_metrics || {}
  const knowledge = health?.knowledge_base || {}

  const steps = mode === 'manual' ? MANUAL_STEPS : AI_STEPS
  const stepIndex = mode === 'manual' ? (MANUAL_STEP_INDEX[step] ?? 0) : (AI_STEP_INDEX[step] ?? 0)

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between gap-6 overflow-y-auto p-5">
      {/* Top Header & Brand */}
      <div className="space-y-6">
        <button type="button" onClick={onReset} className="group flex items-center gap-3 text-left w-full">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-400/10">
            <span className="absolute inset-0 rounded-xl bg-cyan-400/10 blur-md transition group-hover:bg-cyan-400/20" />
            <span className="relative text-lg">⚗</span>
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-[0.16em] text-slate-100">
              NUCLEUS AI
            </span>
            <span className="block text-[10px] tracking-wide text-cyan-300/70">
              AI-Powered Experimental Discovery
            </span>
          </span>
        </button>

        {/* Mode Switcher */}
        {step !== 'landing' && (
          <div className="rounded-xl border border-white/8 bg-white/3 p-1.5 space-y-1">
            <div className="px-2 py-1 text-[9px] font-semibold tracking-wider text-slate-500 uppercase">
              R&amp;D Mode
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => { onSwitchMode?.('ai'); setMobileOpen(false) }}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition text-center ${
                  mode === 'ai' ? 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI-Assisted
              </button>
              <button
                type="button"
                onClick={() => { onSwitchMode?.('manual'); setMobileOpen(false) }}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition text-center ${
                  mode === 'manual' ? 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manual
              </button>
            </div>
          </div>
        )}

        {/* Navigation Pages / Steps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            <span>Pages &amp; Workflow</span>
            <span className="text-cyan-400/60 font-mono text-[9px]">{stepIndex + 1}/{steps.length}</span>
          </div>

          <nav className="space-y-1">
            {steps.map((s, index) => {
              const done = stepIndex > index
              const active = stepIndex === index
              const reachable = index <= stepIndex

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    if (reachable) {
                      onNavigate?.(s.nav)
                      setMobileOpen(false)
                    }
                  }}
                  disabled={!reachable}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                    active
                      ? 'bg-cyan-400/15 text-cyan-100 border border-cyan-300/25 shadow-lg shadow-cyan-950/40'
                      : done
                        ? 'text-emerald-300/90 hover:bg-white/5 cursor-pointer border border-transparent'
                        : 'text-slate-600 cursor-not-allowed border border-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm">{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`font-mono text-[9px] ${active ? 'text-cyan-300' : 'text-slate-600'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {done && <span className="text-[10px] text-emerald-400">✓</span>}
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Selected Template Badge */}
        {mode === 'ai' && selectedTemplate && step !== 'landing' && step !== 'choose' && (
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3 space-y-1">
            <div className="text-[9px] font-semibold uppercase text-cyan-400/70 tracking-wider">Active Domain</div>
            <div className="text-xs font-medium text-cyan-100 flex items-center gap-1.5 truncate">
              <span>{selectedTemplate.icon}</span>
              <span className="truncate">{selectedTemplate.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Metrics & Actions */}
      <div className="space-y-4 pt-4 border-t border-white/8">
        <div className="space-y-2">
          <div className="text-[9px] font-semibold uppercase text-slate-500 tracking-wider px-1">Engine Status</div>
          {health ? (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-white/5 bg-white/2 p-2 text-center">
                <div className="text-[9px] text-slate-500">Status</div>
                <div className={`text-[11px] font-semibold ${health.model_loaded ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {health.model_loaded ? 'Live ML' : 'Offline'}
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/2 p-2 text-center">
                <div className="text-[9px] text-slate-500">Accuracy (R²)</div>
                <div className="text-[11px] font-semibold text-cyan-300">{num(metrics.r2, 3)}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/2 p-2 text-center">
                <div className="text-[9px] text-slate-500">MAE Score</div>
                <div className="text-[11px] font-semibold text-sky-300">{num(metrics.mae, 2)}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/2 p-2 text-center">
                <div className="text-[9px] text-slate-500">Knowledge</div>
                <div className="text-[11px] font-semibold text-violet-300">{knowledge.chunks ?? 0} KB</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic px-1">Connecting to engine…</div>
          )}
        </div>

        <Button variant="ghost" className="w-full justify-center !py-2 text-xs border border-white/10 hover:border-cyan-300/30" onClick={onReset}>
          ➕ New Research
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-cyan-300/10 bg-lab-950/90 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={onReset} className="flex items-center gap-2">
          <span className="text-lg">⚗</span>
          <span className="text-sm font-bold text-slate-100 tracking-wider">NUCLEUS AI</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-lab-950 border-r border-cyan-300/15" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-cyan-300/10 bg-lab-950/80 backdrop-blur-xl">
        {sidebarContent}
      </aside>
    </>
  )
}
