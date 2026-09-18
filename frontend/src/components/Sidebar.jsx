import { AnimatePresence, motion } from 'framer-motion'
import { GlassCard, Button, Pill } from './ui'
import { DOMAINS } from '../lib/constants'
import { getTargetLabel } from '../lib/format'

const STEPS = [
  { key: 'landing', label: 'Overview' },
  { key: 'papers', label: 'Research Papers' },
  { key: 'choose', label: 'Choose Experiment' },
  { key: 'workspace', label: 'Research Workspace' },
  { key: 'experiments', label: 'Candidate Experiments' },
  { key: 'apparatus', label: 'Lab Apparatus' },
  { key: 'simulation', label: 'Virtual Experiment' },
  { key: 'report', label: 'Research Report' },
]

export default function Sidebar({
  step,
  mode,
  health,
  selectedTemplate,
  onReset,
  onNavigate,
  onSwitchMode,
  currentUser,
  onLogout,
}) {
  const domain = selectedTemplate ? DOMAINS[selectedTemplate.id] : null
  const domainLabel = domain?.label || ''
  const domainIcon = domain?.icon || ''
  const isAdmin = currentUser?.role === 'admin'


  return (
    <aside className="relative z-20 w-20 lg:w-72 shrink-0">
      {/* ===== branding ===== */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-4 lg:px-5 lg:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg shadow-cyan-500/20">
            <span className="text-lg">🧪</span>
          </div>
          <div className="hidden lg:block">
            <div className="text-sm font-semibold tracking-tight text-slate-100">Nucleus AI</div>
            <div className="text-[10px] text-slate-500">R&D Lab</div>
          </div>
        </div>
        <div className="flex lg:hidden gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300"
            aria-label="Menu"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>
      </div>

      {/* ===== navigation ===== */}
      <nav className="flex lg:flex-col gap-1 px-3 py-4 lg:px-5 lg:gap-1.5">
        <AnimatePresence>
          {STEPS.map((item) => {
            const isActive = step === item.key
            const showLabel = typeof window !== 'undefined' && window.innerWidth >= 1024

            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isActive ? 1 : 0.4, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-cyan-400/10 text-cyan-100'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                  title={!showLabel ? item.label : undefined}
                >
                  {/* icon */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition">
                    {item.key === 'landing' && '🏠'}
                    {item.key === 'papers' && '📚'}
                    {item.key === 'choose' && '🔬'}
                    {item.key === 'workspace' && '📝'}
                    {item.key === 'experiments' && '📊'}
                    {item.key === 'apparatus' && '🛠️'}
                    {item.key === 'simulation' && '⚗️'}
                    {item.key === 'report' && '📄'}
                  </span>

                  {/* label (desktop) */}
                  {showLabel && (
                    <span className="flex-1 text-left">{item.label}</span>
                  )}

                  {/* active indicator */}
                  {isActive && (
                    <span className="absolute right-3 flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>
              </motion.div>
            )
          })}

          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="pt-2 border-t border-white/5"
            >
              <button
                type="button"
                id="sidebar-nav-admin"
                onClick={() => onNavigate('admin')}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  step === 'admin'
                    ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
                    : 'text-amber-300/80 hover:bg-amber-400/10 hover:text-amber-200'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base">
                  🛡️
                </span>
                {typeof window !== 'undefined' && window.innerWidth >= 1024 && (
                  <span className="flex-1 text-left font-semibold">Admin Panel</span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ===== domain indicator (desktop) ===== */}
      <div className="hidden lg:block border-t border-white/5 px-5 py-4">
        {domain && (
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{domainIcon}</span>
              <div>
                <div className="text-xs font-medium text-cyan-100">{domainLabel}</div>
                <div className="text-[10px] text-slate-500">
                  Model-backed · AI R&D
                </div>
              </div>
            </div>
          </div>
        )}

        {/* model status */}
        {health?.model_loaded && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            Model ready
          </div>
        )}

        {!health?.model_loaded && health?.status !== 'ok' && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-300">
            <span className="flex h-2 w-2 rounded-full bg-amber-400" />
            Model loading
          </div>
        )}
      </div>

      {/* ===== user identity & status ===== */}
      {currentUser && (
        <div className="hidden lg:block border-t border-white/5 px-5 py-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/2 p-3">
            <div className="flex items-center justify-between">
              <span className="label-caps text-[10px] text-cyan-400/90 font-mono font-bold">
                {currentUser.role === 'admin' ? 'ADMINISTRATOR' : 'RESEARCHER'}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                APPROVED
              </span>
            </div>
            <div className="mt-1 font-semibold text-slate-100 text-xs truncate">
              {currentUser.full_name}
            </div>
            {currentUser.organization && (
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {currentUser.organization}
              </div>
            )}
            {currentUser.research_domain && (
              <div className="text-[10px] text-cyan-300/80 truncate mt-0.5">
                {currentUser.research_domain}
              </div>
            )}
          </div>

          {onLogout && (
            <button
              type="button"
              id="btn-sidebar-logout"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-xs text-rose-300/90 hover:bg-rose-500/10 hover:border-rose-400/30 transition"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          )}
        </div>
      )}

      {/* ===== mode switch (mobile) ===== */}
      <div className="lg:hidden border-t border-white/5 px-3 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSwitchMode('ai')}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              mode === 'ai'
                ? 'bg-cyan-400/20 text-cyan-100'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            AI Mode
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('manual')}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              mode === 'manual'
                ? 'bg-cyan-400/20 text-cyan-100'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {/* ===== mobile menu button (triggers off-canvas) ===== */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <button
          type="button"
          onClick={onReset}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg shadow-cyan-500/30"
          aria-label="Back to overview"
        >
          <span className="text-lg">🏠</span>
        </button>
      </div>

      {/* ===== spacer for fixed mobile button ===== */}
      <div className="h-20 lg:h-0" />
    </aside>
  )
}
