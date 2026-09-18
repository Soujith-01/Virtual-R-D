import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Button, Pill, ErrorBanner } from './ui'
import { DOMAINS } from '../lib/constants'
import { loginUser, registerUser } from '../api/client'

const DOMAIN_OPTIONS = [
  'Reaction Yield Optimization',
  'Solar Panel Efficiency',
  'Plant Biomass Optimization',
  'Battery Performance & Retention',
  'Water Purification Turbidity',
  'Other / Interdisciplinary R&D',
]

export function LoginPage({ onLoginSuccess, onNavigateToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [noticeType, setNoticeType] = useState(null) // 'pending', 'rejected', 'suspended'

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    setError(null)
    setNoticeType(null)

    try {
      const res = await loginUser({ email: email.trim(), password })
      onLoginSuccess(res)
    } catch (err) {
      const msg = err.friendlyMessage || err.message || 'Login failed.'
      const lower = msg.toLowerCase()
      if (lower.includes('waiting for administrator approval') || lower.includes('pending')) {
        setNoticeType('pending')
      } else if (lower.includes('not approved') || lower.includes('rejected')) {
        setNoticeType('rejected')
      } else if (lower.includes('suspended')) {
        setNoticeType('suspended')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-12">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-sky-500/10 to-violet-500/5 blur-3xl pointer-events-none rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassCard strong className="p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-2xl">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-xl shadow-cyan-500/25 border border-cyan-400/30">
              <span className="text-2xl">🧪</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">NUCLEUS AI</h1>
            <p className="mt-1.5 text-xs text-cyan-300 font-medium tracking-wide uppercase">
              AI-Powered Experimental Discovery
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Secure authentication for verified research personnel.
            </p>
          </div>

          {/* Pending Approval Notice */}
          <AnimatePresence>
            {noticeType === 'pending' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200 text-xs leading-relaxed space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-300 text-sm">
                    <span>⏳</span>
                    <span>Account Pending Approval</span>
                  </div>
                  <p>
                    Your account is waiting for administrator approval. Once an administrator reviews and approves your registration, you will receive access to the R&D platform.
                  </p>
                </div>
              </motion.div>
            )}

            {noticeType === 'rejected' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200 text-xs leading-relaxed space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-rose-300 text-sm">
                    <span>🚫</span>
                    <span>Registration Not Approved</span>
                  </div>
                  <p>Your registration was not approved by the administrator.</p>
                </div>
              </motion.div>
            )}

            {noticeType === 'suspended' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200 text-xs leading-relaxed space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-rose-300 text-sm">
                    <span>🔒</span>
                    <span>Account Suspended</span>
                  </div>
                  <p>Your account has been suspended. Contact the administrator.</p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@institution.org"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              />
            </div>

            <div className="pt-2">
              <Button
                id="btn-login-submit"
                type="submit"
                loading={loading}
                className="w-full !py-3.5 text-sm font-semibold tracking-wide shadow-lg shadow-cyan-500/20"
              >
                LOGIN →
              </Button>
            </div>
          </form>

          {/* Quick Demo Fill */}
          <div className="mt-4 text-center">
            <button
              type="button"
              id="btn-quick-fill-admin"
              onClick={() => {
                setEmail('admin@nucleus.ai')
                setPassword('AdminNucleus2026!')
              }}
              className="text-[11px] text-cyan-400/80 hover:text-cyan-300 underline underline-offset-2 transition"
            >
              🔑 Quick Fill Default Admin Credentials
            </button>
          </div>

          {/* Registration Prompt */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400">
              Not registered?{' '}
              <button
                type="button"
                id="link-register"
                onClick={onNavigateToRegister}
                className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline transition ml-1"
              >
                Create Researcher Account
              </button>
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}

export function RegisterPage({ onRegisterSuccess, onNavigateToLogin }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organization, setOrganization] = useState('')
  const [researchDomain, setResearchDomain] = useState(DOMAIN_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [registeredPending, setRegisteredPending] = useState(false)

  const handleSubmit = async (e) => {
    e?.preventDefault()

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await registerUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        organization: organization.trim(),
        research_domain: researchDomain,
      })

      setRegisteredPending(true)
      if (onRegisterSuccess) onRegisterSuccess(res)
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  if (registeredPending) {
    return (
      <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <GlassCard strong className="p-8 sm:p-10 border border-amber-400/30 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-300 text-3xl">
              ⏳
            </div>
            <div className="label-caps text-amber-400/90 mb-1">Status: Pending Review</div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 mb-3">
              REGISTRATION PENDING
            </h2>
            <p className="text-xs leading-relaxed text-slate-300 mb-4">
              Registration submitted successfully.
              <br />
              <strong className="text-amber-200">Your account is awaiting admin approval.</strong>
            </p>
            <div className="rounded-xl border border-white/5 bg-white/3 p-4 text-[11px] text-slate-400 text-left space-y-1.5 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="text-slate-200 font-medium">{fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-200 font-medium">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organization:</span>
                <span className="text-slate-200 font-medium">{organization || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Domain:</span>
                <span className="text-cyan-200 font-medium">{researchDomain}</span>
              </div>
            </div>
            <Button
              id="btn-return-login"
              onClick={onNavigateToLogin}
              className="w-full !py-3"
            >
              Return to Login →
            </Button>
          </GlassCard>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-500/10 via-sky-500/10 to-violet-500/5 blur-3xl pointer-events-none rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-lg"
      >
        <GlassCard strong className="p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-xl shadow-cyan-500/25 border border-cyan-400/30">
              <span className="text-xl">🧬</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Researcher Registration</h1>
            <p className="mt-1 text-xs text-cyan-300 font-medium tracking-wide uppercase">
              Join the Nucleus AI Discovery Network
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              Accounts require administrator approval prior to platform access.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5"
              >
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                id="reg-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jane Doe"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@university.edu"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Password *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 chars"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Research Organization / Institution
              </label>
              <input
                id="reg-org"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Stanford Chemical Labs / Max Planck"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Primary Research Domain
              </label>
              <select
                id="reg-domain"
                value={researchDomain}
                onChange={(e) => setResearchDomain(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-lab-900 px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
              >
                {DOMAIN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-lab-900 text-slate-200">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3">
              <Button
                id="btn-register-submit"
                type="submit"
                loading={loading}
                className="w-full !py-3.5 text-sm font-semibold tracking-wide shadow-lg shadow-cyan-500/20"
              >
                SUBMIT REGISTRATION →
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                id="link-login"
                onClick={onNavigateToLogin}
                className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline transition ml-1"
              >
                Sign In
              </button>
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
