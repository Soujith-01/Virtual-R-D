import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Button, Pill, SectionTitle, ErrorBanner } from './ui'
import {
  getAdminUsers,
  approveUser,
  rejectUser,
  suspendUser,
  reactivateUser,
  deleteUser,
} from '../api/client'

export default function AdminDashboard({ currentUser, onLogout, onNavigateToApp }) {
  const [users, setUsers] = useState([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, suspended: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionInProgress, setActionInProgress] = useState(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await getAdminUsers({
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchQuery.trim() || undefined,
      })
      setUsers(res.users || [])
      setCounts(res.counts || { total: 0, pending: 0, approved: 0, suspended: 0, rejected: 0 })
      setError(null)
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load user management data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [filterStatus])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const notify = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const handleApprove = async (userId, name) => {
    try {
      setActionInProgress(userId)
      await approveUser(userId)
      notify(`Approved ${name || 'researcher'} for platform access.`)
      await fetchUsers()
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to approve user.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleReject = async (userId, name) => {
    try {
      setActionInProgress(userId)
      await rejectUser(userId)
      notify(`Rejected ${name || 'user'} registration.`)
      await fetchUsers()
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to reject user.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleSuspend = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to suspend access for ${name}?`)) return
    try {
      setActionInProgress(userId)
      await suspendUser(userId)
      notify(`Suspended account for ${name}.`)
      await fetchUsers()
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to suspend user.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleReactivate = async (userId, name) => {
    try {
      setActionInProgress(userId)
      await reactivateUser(userId)
      notify(`Reactivated account for ${name}.`)
      await fetchUsers()
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to reactivate user.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Permanently delete account for ${name}? This action cannot be undone.`)) return
    try {
      setActionInProgress(userId)
      await deleteUser(userId)
      notify(`Deleted account for ${name}.`)
      await fetchUsers()
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to delete user.')
    } finally {
      setActionInProgress(null)
    }
  }

  const pendingUsers = users.filter((u) => u.status === 'pending')

  const formatDate = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return isoStr
    }
  }

  const getStatusPill = (status) => {
    switch (status) {
      case 'approved':
        return <Pill tone="emerald" dot>Approved</Pill>
      case 'pending':
        return <Pill tone="amber" dot>Pending</Pill>
      case 'suspended':
        return <Pill tone="rose" dot>Suspended</Pill>
      case 'rejected':
        return <Pill tone="slate">Rejected</Pill>
      default:
        return <Pill tone="slate">{status}</Pill>
    }
  }

  return (
    <div className="mx-auto max-w-[1550px] px-5 py-8 space-y-8">
      {/* Top Header */}
      <GlassCard strong className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-xl shadow-cyan-500/20 border border-cyan-400/30">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <div className="label-caps text-cyan-400/90">Administration Panel</div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-100">
                Nucleus AI Administration
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Researcher verification, role-based authorization, and account approval workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              id="btn-goto-rd"
              variant="ghost"
              onClick={onNavigateToApp}
              className="!border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 text-xs !py-2.5"
            >
              ⚗ Enter R&D Lab →
            </Button>
            <Button
              id="btn-admin-logout"
              variant="subtle"
              onClick={onLogout}
              className="text-xs !py-2.5 text-rose-300 hover:bg-rose-500/10"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Notifications */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-200 flex items-center justify-between"
          >
            <span>✓ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-100">×</button>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL USERS', value: counts.total, icon: '👥', tone: 'text-slate-100', border: 'border-white/10' },
          { label: 'PENDING APPROVAL', value: counts.pending, icon: '⏳', tone: 'text-amber-300', border: 'border-amber-400/25 bg-amber-400/5' },
          { label: 'APPROVED RESEARCHERS', value: counts.approved, icon: '✓', tone: 'text-emerald-300', border: 'border-emerald-400/25 bg-emerald-400/5' },
          { label: 'SUSPENDED ACCOUNTS', value: counts.suspended, icon: '🔒', tone: 'text-rose-300', border: 'border-rose-400/25 bg-rose-400/5' },
        ].map((stat) => (
          <GlassCard key={stat.label} className={`p-5 ${stat.border}`}>
            <div className="flex items-center justify-between">
              <span className="label-caps text-slate-400">{stat.label}</span>
              <span className="text-base">{stat.icon}</span>
            </div>
            <div className={`mono mt-2 text-3xl font-bold ${stat.tone}`}>
              {stat.value}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Pending Queue Highlight */}
      {counts.pending > 0 && (
        <GlassCard strong className="p-6 border border-amber-400/30">
          <SectionTitle
            eyebrow="Action Required"
            title={`Pending Researcher Registrations (${counts.pending})`}
            description="These verified researchers have applied for access and are awaiting your authorization."
          />
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 text-sm">{user.full_name}</span>
                    <Pill tone="amber" dot>Pending</Pill>
                  </div>
                  <div className="text-xs text-cyan-300 font-mono mt-0.5">{user.email}</div>
                  <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                    <div><span className="text-slate-500">Org:</span> {user.organization || 'Independent Researcher'}</div>
                    <div><span className="text-slate-500">Domain:</span> {user.research_domain || 'General R&D'}</div>
                    <div><span className="text-slate-500">Applied:</span> {formatDate(user.created_at)}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <Button
                    id={`btn-approve-${user.id}`}
                    onClick={() => handleApprove(user.id, user.full_name)}
                    loading={actionInProgress === user.id}
                    className="flex-1 !py-2 text-xs !bg-emerald-500 hover:!bg-emerald-400 text-slate-950 font-bold"
                  >
                    ✓ Approve
                  </Button>
                  <Button
                    id={`btn-reject-${user.id}`}
                    variant="subtle"
                    onClick={() => handleReject(user.id, user.full_name)}
                    loading={actionInProgress === user.id}
                    className="!py-2 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Main User Management Table */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle
            eyebrow="Directory"
            title="User Management Table"
            description="Manage researcher permissions, role assignments, and account statuses."
          />

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                id="admin-search-input"
                type="text"
                placeholder="Search name, email, org..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/2 p-1 text-xs">
              {['all', 'pending', 'approved', 'rejected', 'suspended'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab)}
                  className={`capitalize px-2.5 py-1 rounded-lg font-medium transition ${
                    filterStatus === tab
                      ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 bg-white/2">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Domain</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id
                  return (
                    <tr key={u.id} className="hover:bg-white/2 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {u.full_name}
                          {isSelf && <span className="text-[10px] text-cyan-400 font-mono">(You)</span>}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {u.organization || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-cyan-200/90">{u.research_domain || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-mono text-[11px] font-semibold uppercase ${
                          u.role === 'admin' ? 'text-amber-300' : 'text-slate-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusPill(u.status)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {u.status === 'pending' && (
                          <>
                            <Button
                              id={`table-approve-${u.id}`}
                              onClick={() => handleApprove(u.id, u.full_name)}
                              loading={actionInProgress === u.id}
                              className="!py-1 !px-2.5 text-[11px] !bg-emerald-500 hover:!bg-emerald-400 text-slate-950 font-bold"
                            >
                              Approve
                            </Button>
                            <Button
                              id={`table-reject-${u.id}`}
                              variant="subtle"
                              onClick={() => handleReject(u.id, u.full_name)}
                              loading={actionInProgress === u.id}
                              className="!py-1 !px-2.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {u.status === 'approved' && !isSelf && (
                          <button
                            id={`table-suspend-${u.id}`}
                            onClick={() => handleSuspend(u.id, u.full_name)}
                            disabled={actionInProgress === u.id}
                            className="rounded-lg border border-rose-400/25 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/10 transition"
                          >
                            Suspend
                          </button>
                        )}

                        {u.status === 'suspended' && (
                          <button
                            id={`table-reactivate-${u.id}`}
                            onClick={() => handleReactivate(u.id, u.full_name)}
                            disabled={actionInProgress === u.id}
                            className="rounded-lg border border-emerald-400/25 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/10 transition"
                          >
                            Reactivate
                          </button>
                        )}

                        {u.status === 'rejected' && (
                          <button
                            id={`table-approve-${u.id}`}
                            onClick={() => handleApprove(u.id, u.full_name)}
                            disabled={actionInProgress === u.id}
                            className="rounded-lg border border-emerald-400/25 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/10 transition"
                          >
                            Approve
                          </button>
                        )}

                        {!isSelf && (
                          <button
                            id={`table-delete-${u.id}`}
                            onClick={() => handleDelete(u.id, u.full_name)}
                            disabled={actionInProgress === u.id}
                            className="rounded-lg border border-white/5 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-400 hover:border-rose-400/20 transition"
                            title="Delete user"
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
