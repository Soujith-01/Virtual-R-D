import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { clamp } from '../lib/format'

/* ---------------------------------- tones --------------------------------- */

const TONES = {
  cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/25',
  sky: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  amber: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  rose: 'text-rose-300 bg-rose-400/10 border-rose-400/25',
  violet: 'text-violet-300 bg-violet-400/10 border-violet-400/25',
  slate: 'text-slate-300 bg-slate-400/10 border-slate-400/20',
}

// Tailwind only generates classes it can see as literal strings, so tone -> class
// lookups must be spelled out rather than interpolated.
const TEXT_TONES = {
  cyan: 'text-cyan-300',
  sky: 'text-sky-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  slate: 'text-slate-300',
}

const BARS = {
  cyan: 'from-cyan-400 to-sky-500',
  sky: 'from-sky-400 to-blue-500',
  emerald: 'from-emerald-400 to-teal-500',
  amber: 'from-amber-400 to-orange-500',
  rose: 'from-rose-400 to-red-500',
  violet: 'from-violet-400 to-fuchsia-500',
  slate: 'from-slate-400 to-slate-500',
}

/* --------------------------------- surfaces -------------------------------- */

export function GlassCard({ children, className = '', strong = false, hover = false, ...rest }) {
  return (
    <div
      className={`${strong ? 'glass-strong' : 'glass'} ${hover ? 'glass-hover' : ''} rounded-2xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Pill({ children, tone = 'cyan', dot = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${TONES[tone] || TONES.cyan} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-lab-pulse" />}
      {children}
    </span>
  )
}

export function SectionTitle({ eyebrow, title, description, right, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && <div className="label-caps text-cyan-400/80">{eyebrow}</div>}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">{description}</p>}
      </div>
      {right}
    </div>
  )
}

/* ------------------------------- data display ------------------------------ */

export function AnimatedNumber({ value, digits = 1, duration = 700, className = '', suffix = '' }) {
  const target = Number(value) || 0
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) {
      setDisplay(target)
      return undefined
    }
    let frame
    const start = performance.now()
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (target - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(step)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return (
    <span className={className}>
      {display.toFixed(digits)}
      {suffix}
    </span>
  )
}

export function Meter({ value = 0, max = 100, tone = 'cyan', className = '', height = 'h-1.5', glow = false }) {
  const width = clamp((Number(value) / (max || 1)) * 100, 0, 100)
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100/8 ${height} ${className}`}>
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${BARS[tone] || BARS.cyan} ${glow ? 'accent-glow' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  )
}

export function Stat({ label, value, unit, hint, tone = 'cyan', digits = 1, animated = true, className = '' }) {
  return (
    <div className={`${className}`}>
      <div className="label-caps text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        {animated && typeof value === 'number' ? (
          <AnimatedNumber
            value={value}
            digits={digits}
            className={`mono text-xl font-semibold ${TEXT_TONES[tone] || TEXT_TONES.cyan}`}
          />
        ) : (
          <span className={`mono text-xl font-semibold ${TEXT_TONES[tone] || TEXT_TONES.cyan}`}>{value}</span>
        )}
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</div>}
    </div>
  )
}

export function KeyValue({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="label-caps text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{children}</div>
    </div>
  )
}

/* --------------------------------- feedback -------------------------------- */

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-cyan-300/30 border-t-cyan-300 animate-lab-spin ${className}`}
    />
  )
}

export function ErrorBanner({ message, onRetry, onDismiss, className = '' }) {
  if (!message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-wrap items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 ${className}`}
    >
      <span className="mt-0.5 text-rose-300">⚠</span>
      <p className="flex-1 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-rose-300/40 px-2.5 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/15"
        >
          Retry
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1 text-xs text-rose-200/70 transition hover:text-rose-100"
        >
          Dismiss
        </button>
      )}
    </motion.div>
  )
}

export function Empty({ title, description, icon = '◇' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-100/10 px-6 py-12 text-center">
      <span className="text-2xl text-cyan-300/60">{icon}</span>
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {description && <p className="max-w-md text-xs text-slate-500">{description}</p>}
    </div>
  )
}

/* --------------------------------- buttons -------------------------------- */

export function Button({ children, variant = 'primary', className = '', disabled, loading, ...rest }) {
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-lab-950 hover:from-cyan-400 hover:to-sky-500 accent-glow font-semibold'
      : variant === 'ghost'
        ? 'border border-cyan-300/25 text-cyan-100 hover:bg-cyan-400/10'
        : variant === 'subtle'
          ? 'text-slate-300 hover:text-slate-100 hover:bg-white/5'
          : ''

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Chip({ children, active = false, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-left text-[11px] font-medium transition ${
        active
          ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
          : 'border-slate-100/10 bg-white/2 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export { TONES, BARS, TEXT_TONES }
