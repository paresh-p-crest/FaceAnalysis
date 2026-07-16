import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  CreditCard,
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  Users,
  DollarSign,
} from 'lucide-react'
import {
  deleteAllAssessments,
  deleteAllPayments,
  deleteAssessment,
  deleteAdminUser,
  fetchAdminPricing,
  fetchAssessment,
  isBackendApiEnabled,
  updateAdminPricing,
  updateAssessmentStatus,
} from '../utils/apiClient'
import { ADMIN_TABS, adminTabToPath, persistAdminTab } from '../utils/adminPanel'
import { isAdminResourceLoading, resourcesForAdminTab } from '../utils/adminWorkspace'
import { formatHistoryDate } from '../utils/historyStorage'
import { isReportApproved, normalizeReportStatus, REPORT_WORKFLOW_STATUSES } from '../utils/reportWorkflow'
import ConfirmDialog from './ConfirmDialog'
import { useApp } from './providers/AppProvider'

const TAB_META = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  users: { label: 'Users', icon: Users },
  review: { label: 'Review reports', icon: FileText },
  payments: { label: 'Payments', icon: CreditCard },
  settings: { label: 'Pricing', icon: DollarSign },
}

const STATUS_STYLE = {
  draft: 'bg-surface-warm text-ink-muted border-surface-border',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  created: 'bg-surface-warm text-ink-muted border-surface-border',
}

function StatusBadge({ status }) {
  const display = normalizeReportStatus(status)
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_STYLE[display] || STATUS_STYLE.created}`}>
      {display.replace('_', ' ')}
    </span>
  )
}

/** Admin-only live pipeline indicator (hidden from clients). */
function PipelineBadge({ pipeline }) {
  if (!pipeline) return null
  const status = pipeline.status || 'queued'
  const style =
    status === 'failed'
      ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'ready'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-sky-50 text-sky-700 border-sky-200'
  const label = status === 'running' && pipeline.stage ? `running · ${pipeline.stage}` : status
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${style}`}>
      {label}
    </span>
  )
}

function money(amountCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountCents || 0) / 100)
}

function displayName(item) {
  const full = [item?.firstName, item?.lastName].filter(Boolean).join(' ').trim()
  return full || item?.email || 'Unknown user'
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-8 text-center">
      <p className="font-display text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  )
}

export default function AdminPanelPage({ user, onSettings, onViewCloudItem, activeTab }) {
  const router = useRouter()
  const { adminWorkspace, loadAdminTab, refreshAdminTab, patchAdminWorkspace } = useApp()
  const { assessments, payments, users, loading: resourceLoading, error: workspaceError } = adminWorkspace
  const [deletingId, setDeletingId] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [adminMode, setAdminMode] = useState('production')
  const [resetting, setResetting] = useState('')
  const [error, setError] = useState('')
  const [reportFilter, setReportFilter] = useState('all')
  const [pricing, setPricing] = useState({ amountCents: 50, currency: 'usd', name: '', description: '' })
  const [priceInput, setPriceInput] = useState('0.50')
  const [pricingSaving, setPricingSaving] = useState(false)
  const [pricingMessage, setPricingMessage] = useState('')
  const [confirmState, setConfirmState] = useState(null)

  const canLoad = !!user && user.role === 'admin' && isBackendApiEnabled()
  const tabResources = resourcesForAdminTab(activeTab)
  const loading = isAdminResourceLoading(resourceLoading, tabResources)

  const changeTab = (tab) => {
    if (!ADMIN_TABS.includes(tab)) return
    persistAdminTab(tab)
    router.push(adminTabToPath(tab))
  }

  useEffect(() => {
    if (activeTab && ADMIN_TABS.includes(activeTab)) {
      persistAdminTab(activeTab)
    }
  }, [activeTab])

  useEffect(() => {
    if (!canLoad || !activeTab) return
    loadAdminTab(activeTab)
  }, [activeTab, canLoad, loadAdminTab])

  useEffect(() => {
    if (workspaceError) setError(workspaceError)
  }, [workspaceError])

  const handleRefresh = () => {
    if (!canLoad || !activeTab) return
    refreshAdminTab(activeTab)
  }

  useEffect(() => {
    if (activeTab !== 'settings' || !canLoad) return
    fetchAdminPricing()
      .then((product) => {
        setPricing(product)
        setPriceInput(((product.amountCents || 50) / 100).toFixed(2))
      })
      .catch((err) => setPricingMessage(err.message || 'Could not load pricing'))
  }, [activeTab, canLoad])

  const handleSavePricing = async () => {
    const dollars = Number.parseFloat(priceInput)
    if (!Number.isFinite(dollars) || dollars < 0.01) {
      setPricingMessage('Enter a valid price of at least $0.01')
      return
    }
    setPricingSaving(true)
    setPricingMessage('')
    try {
      const product = await updateAdminPricing({
        amountCents: Math.round(dollars * 100),
        currency: pricing.currency || 'usd',
        productName: pricing.name || undefined,
        productDescription: pricing.description || undefined,
      })
      setPricing(product)
      setPriceInput(((product.amountCents || 1) / 100).toFixed(2))
      setPricingMessage('Premium report price saved.')
    } catch (err) {
      setPricingMessage(err.message || 'Could not save pricing')
    } finally {
      setPricingSaving(false)
    }
  }

  const userById = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users])

  const visibleAssessments = assessments

  const reportCountByUser = useMemo(() => {
    const counts = {}
    visibleAssessments.forEach((item) => {
      const uid = item.userId
      if (!uid) return
      counts[uid] = (counts[uid] || 0) + 1
    })
    return counts
  }, [visibleAssessments])

  const reportStats = useMemo(() => {
    const stats = { total: visibleAssessments.length, pending_review: 0, approved: 0 }
    visibleAssessments.forEach((item) => {
      const status = normalizeReportStatus(item.status)
      stats[status] += 1
    })
    return stats
  }, [visibleAssessments])

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return visibleAssessments
    return visibleAssessments.filter((item) => normalizeReportStatus(item.status) === reportFilter)
  }, [visibleAssessments, reportFilter])

  const pendingReviewCount = reportStats.pending_review

  const paidCount = payments.filter((payment) =>
    ['paid', 'complete', 'completed'].includes(String(payment.status).toLowerCase())
  ).length

  const clientUsers = users.filter((item) => item.role !== 'admin')

  const handleStatusChange = async (assessmentId, status) => {
    setUpdatingId(assessmentId)
    setError('')
    try {
      const updated = await updateAssessmentStatus(assessmentId, status)
      patchAdminWorkspace({
        assessments: assessments.map((item) => (item.id === assessmentId ? { ...item, ...updated, id: assessmentId } : item)),
      })
    } catch (err) {
      setError(err.message || 'Could not update status')
    } finally {
      setUpdatingId('')
    }
  }

  const handleDeleteAssessment = (assessmentId) => {
    setConfirmState({
      title: 'Delete report?',
      message: 'This report and its assistant conversation will be permanently removed from MongoDB.',
      confirmLabel: 'Delete report',
      danger: true,
      onConfirm: async () => {
        setDeletingId(assessmentId)
        setError('')
        try {
          await deleteAssessment(assessmentId)
          patchAdminWorkspace({
            assessments: assessments.filter((item) => item.id !== assessmentId),
          })
        } catch (err) {
          setError(err.message || 'Could not delete report')
        } finally {
          setDeletingId('')
          setConfirmState(null)
        }
      },
    })
  }

  const handleDeleteUser = (targetUser) => {
    if (targetUser.id === user?.id) {
      setError('You cannot delete your own admin account.')
      return
    }
    setConfirmState({
      title: 'Delete user account?',
      message: `Delete ${displayName(targetUser)} (${targetUser.email}) and all linked reports, conversations, and payments? This cannot be undone.`,
      confirmLabel: 'Delete user',
      danger: true,
      onConfirm: async () => {
        setDeletingId(targetUser.id)
        setError('')
        try {
          await deleteAdminUser(targetUser.id)
          patchAdminWorkspace({
            users: users.filter((item) => item.id !== targetUser.id),
            assessments: assessments.filter((item) => item.userId !== targetUser.id),
            payments: payments.filter((item) => item.userId !== targetUser.id),
          })
        } catch (err) {
          setError(err.message || 'Could not delete user')
        } finally {
          setDeletingId('')
          setConfirmState(null)
        }
      },
    })
  }

  const handleApprove = (assessment) => {
    setConfirmState({
      title: 'Approve report?',
      message: 'This releases the full report and PDF download to the client. This action cannot be undone.',
      confirmLabel: 'Approve',
      onConfirm: async () => {
        setConfirmState(null)
        await handleStatusChange(assessment.id, 'approved')
      },
    })
  }

  const handleResetReports = () => {
    if (adminMode !== 'testing') return
    setConfirmState({
      title: 'Reset all reports?',
      message: 'Testing mode: delete ALL reports and assistant conversations from MongoDB.',
      confirmLabel: 'Reset reports',
      danger: true,
      onConfirm: async () => {
        setResetting('reports')
        try {
          await deleteAllAssessments()
          patchAdminWorkspace({ assessments: [] })
        } catch (err) {
          setError(err.message || 'Could not reset report history')
        } finally {
          setResetting('')
          setConfirmState(null)
        }
      },
    })
  }

  const handleResetPayments = () => {
    if (adminMode !== 'testing') return
    setConfirmState({
      title: 'Reset all payments?',
      message: 'Testing mode: delete ALL payment records from MongoDB.',
      confirmLabel: 'Reset payments',
      danger: true,
      onConfirm: async () => {
        setResetting('payments')
        try {
          await deleteAllPayments()
          patchAdminWorkspace({ payments: [] })
        } catch (err) {
          setError(err.message || 'Could not reset payment history')
        } finally {
          setResetting('')
          setConfirmState(null)
        }
      },
    })
  }

  const renderClientCell = (assessment) => {
    const owner = assessment.userId ? userById[assessment.userId] : null
    if (owner) {
      return (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{displayName(owner)}</p>
          <p className="text-xs text-ink-muted truncate">{owner.email}</p>
        </div>
      )
    }
    return <span className="text-xs text-amber-700">Unlinked report</span>
  }

  const handleOpenAssessment = async (assessment) => {
    setOpeningId(assessment.id)
    setError('')
    try {
      const full = await fetchAssessment(assessment.id)
      onViewCloudItem?.(full)
    } catch (err) {
      setError(err.message || 'Could not open report')
    } finally {
      setOpeningId('')
    }
  }

  const renderReportRow = (assessment, { showStatus = false } = {}) => {
    const score = assessment.analysis?.cvReport?.overall?.score ?? assessment.analysis?.metrics?.harmonyScore ?? '—'
    const normalizedStatus = normalizeReportStatus(assessment.status)
    return (
      <div key={assessment.id} className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <div className="grid lg:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {renderClientCell(assessment)}
              {showStatus && <StatusBadge status={assessment.status} />}
              <PipelineBadge pipeline={assessment.pipeline} />
            </div>
            <p className="text-[11px] text-ink-muted mt-2">
              ID …{assessment.id.slice(-8)} · {formatHistoryDate(assessment.createdAt)} · score {score}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {normalizedStatus === 'pending_review' && (
              <button
                onClick={() => handleApprove(assessment)}
                disabled={updatingId === assessment.id}
                className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
            )}
            <button
              onClick={() => handleOpenAssessment(assessment)}
              disabled={openingId === assessment.id}
              className="px-3 py-2 rounded-xl bg-white dark:bg-surface-card border border-surface-border text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
            >
              {openingId === assessment.id ? 'Opening…' : 'Open'}
            </button>
            <button
              onClick={() => handleDeleteAssessment(assessment.id)}
              disabled={deletingId === assessment.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {deletingId === assessment.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 pb-8 site-navbar-offset animate-fade-up font-sans bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">Admin Panel</h1>
              <p className="text-sm text-ink-muted">Users, review reports, and payments</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onSettings} className="btn-ghost text-sm">API settings</button>
            <button
              onClick={handleRefresh}
              disabled={loading || !canLoad}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-surface-border bg-white dark:bg-surface-card text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 overflow-x-auto">
          <div className="inline-flex min-w-full sm:min-w-0 rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-1 shadow-card gap-1">
            {ADMIN_TABS.map((tab) => {
              const Icon = TAB_META[tab].icon
              const count = tab === 'review' ? pendingReviewCount : tab === 'users' ? clientUsers.length : null
              return (
                <button
                  key={tab}
                  onClick={() => changeTab(tab)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'bg-brand text-white shadow-brand'
                      : 'text-ink-secondary hover:text-brand hover:bg-brand-50/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {TAB_META[tab].label}
                  {count != null && count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <section className="mb-6 bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-brand" />
                <h2 className="font-display text-lg font-semibold text-ink">Environment mode</h2>
              </div>
              <p className="text-xs text-ink-muted">Production hides destructive QA tools. Testing mode enables data reset.</p>
            </div>
            <div className="flex rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-1">
              {['production', 'testing'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAdminMode(mode)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    adminMode === mode
                      ? mode === 'testing'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-white dark:bg-surface-card text-brand border border-surface-border shadow-soft'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {adminMode === 'testing' && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap gap-2">
              <button onClick={handleResetReports} disabled={!!resetting} className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 disabled:opacity-50">
                Reset reports
              </button>
              <button onClick={handleResetPayments} disabled={!!resetting} className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 disabled:opacity-50">
                Reset payments
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title="Backend API required" text="Set NEXT_PUBLIC_API_URL to use the admin panel." />
        ) : !user || user.role !== 'admin' ? (
          <EmptyState title="Admin access required" text="Sign in with an admin account to manage clients and reports." />
        ) : loading && assessments.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-muted">Loading admin workspace...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    ['Users', clientUsers.length, Users],
                    ['Reports', reportStats.total, FileText],
                    ['Pending review', reportStats.pending_review, ShieldCheck],
                    ['Approved', reportStats.approved, BarChart3],
                    ['Payments', paidCount, CreditCard],
                  ].map(([label, value, Icon]) => (
                    <div key={label} className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                      <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
                        <Icon className="w-4 h-4 text-brand" />
                        {label}
                      </div>
                      <p className="font-display text-3xl font-semibold text-ink">{value}</p>
                    </div>
                  ))}
                </div>
                {reportStats.pending_review > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-amber-800 font-medium">{reportStats.pending_review} report(s) waiting for review</p>
                    <button onClick={() => changeTab('review')} className="btn-primary text-sm">Review reports</button>
                  </div>
                )}
                <div className="grid lg:grid-cols-2 gap-4">
                  <section className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                    <h2 className="font-display text-lg font-semibold text-ink mb-4">Recent clients</h2>
                    <div className="space-y-3">
                      {clientUsers.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{displayName(item)}</p>
                            <p className="text-xs text-ink-muted truncate">{item.email}</p>
                          </div>
                          <span className="text-xs text-ink-muted">{reportCountByUser[item.id] || 0} reports</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                    <h2 className="font-display text-lg font-semibold text-ink mb-4">Latest reports</h2>
                    <div className="space-y-3">
                      {visibleAssessments.slice(0, 5).map((assessment) => renderReportRow(assessment, { showStatus: true }))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <section className="bg-white dark:bg-surface-card rounded-2xl shadow-card border border-surface-border overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">Registered users</h2>
                    <p className="text-xs text-ink-muted">{users.length} accounts in MongoDB `myface.users`</p>
                  </div>
                </div>
                {users.length === 0 ? (
                  <div className="p-8"><EmptyState title="No users yet" text="Client registrations will appear here." /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-warm dark:bg-surface-raised text-left text-xs text-ink-muted">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Name</th>
                          <th className="px-5 py-3 font-semibold">Email</th>
                          <th className="px-5 py-3 font-semibold">Role</th>
                          <th className="px-5 py-3 font-semibold">Reports</th>
                          <th className="px-5 py-3 font-semibold">Joined</th>
                          <th className="px-5 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((item) => (
                          <tr key={item.id} className="border-t border-surface-border">
                            <td className="px-5 py-3 font-medium text-ink">{displayName(item)}</td>
                            <td className="px-5 py-3 text-ink-secondary">{item.email}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${
                                item.role === 'admin'
                                  ? 'bg-brand-50 text-brand border-brand/20'
                                  : 'bg-surface-warm text-ink-muted border-surface-border'
                              }`}>
                                {item.role || 'user'}
                              </span>
                            </td>
                            <td className="px-5 py-3">{reportCountByUser[item.id] || 0}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatHistoryDate(item.createdAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {item.role !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUser(item)}
                                  disabled={deletingId === item.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'review' && (
              <section className="space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">Review reports</h2>
                  <p className="text-xs text-ink-muted">Click Open to edit AI narrative, save, then approve for the client.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['all', ...REPORT_WORKFLOW_STATUSES.map((s) => s.value)].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReportFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize ${
                        reportFilter === filter
                          ? 'bg-brand text-white border-brand'
                          : 'bg-white dark:bg-surface-card border-surface-border text-ink-secondary'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {filteredReports.length === 0 ? (
                  <EmptyState title="No reports" text="No assessments match this filter." />
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((assessment) => renderReportRow(assessment, { showStatus: reportFilter === 'all' }))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'payments' && (
              <section className="bg-white dark:bg-surface-card rounded-2xl shadow-card border border-surface-border overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border">
                  <h2 className="font-display text-lg font-semibold text-ink">Payment records</h2>
                  <p className="text-xs text-ink-muted">Stripe and PayPal checkout history</p>
                </div>
                {payments.length === 0 ? (
                  <div className="p-8"><EmptyState title="No payments yet" text="Completed checkouts will appear here." /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-warm dark:bg-surface-raised text-left text-xs text-ink-muted">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Client</th>
                          <th className="px-5 py-3 font-semibold">Provider</th>
                          <th className="px-5 py-3 font-semibold">Amount</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                          <th className="px-5 py-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-t border-surface-border">
                            <td className="px-5 py-3">
                              <p className="font-medium text-ink">{displayName(userById[payment.userId])}</p>
                              <p className="text-xs text-ink-muted">{userById[payment.userId]?.email || payment.userId || '—'}</p>
                            </td>
                            <td className="px-5 py-3 capitalize">{payment.provider}</td>
                            <td className="px-5 py-3 font-display font-semibold text-brand">{money(payment.amountCents, payment.currency)}</td>
                            <td className="px-5 py-3"><StatusBadge status={payment.status} /></td>
                            <td className="px-5 py-3 text-ink-muted">{formatHistoryDate(payment.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-card border border-surface-border max-w-xl">
                <h2 className="font-display text-lg font-semibold text-ink mb-1">Premium report price</h2>
                <p className="text-xs text-ink-muted mb-5">Used for Stripe and PayPal checkout. Default is $0.50 for testing.</p>
                <label className="block text-xs font-semibold text-ink-secondary mb-2">Price (USD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-raised px-4 py-3 text-sm text-ink mb-4"
                />
                <p className="text-xs text-ink-muted mb-4">
                  Checkout charge: <span className="font-semibold text-brand">{money(Math.round((Number.parseFloat(priceInput) || 0) * 100), pricing.currency || 'usd')}</span>
                </p>
                {pricingMessage && (
                  <div className="mb-4 rounded-xl border border-surface-border bg-surface-warm px-3 py-2 text-xs text-ink-secondary">
                    {pricingMessage}
                  </div>
                )}
                <button
                  onClick={handleSavePricing}
                  disabled={pricingSaving}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {pricingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save price
                </button>
              </section>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        danger={confirmState?.danger}
        loading={!!deletingId || !!resetting}
        onConfirm={() => confirmState?.onConfirm?.()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
