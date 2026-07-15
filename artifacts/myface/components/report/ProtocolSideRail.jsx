import { getClientName } from '../../utils/qovesProtocolModel'

function tagList(answers) {
  const tags = []
  if (answers?.gender) tags.push(String(answers.gender))
  if (answers?.age) tags.push(`${answers.age}y`)
  if (answers?.ethnicity) tags.push(String(answers.ethnicity))
  if (answers?.hadSurgery === 'no') tags.push('No Previous Surgeries')
  return tags
}

export function ProtocolSideRail({ photo, answers, user = null, assessmentId, onViewProtocol }) {
  const clientName = getClientName(answers, user)
  const displayId = assessmentId ? `#${String(assessmentId).slice(-5).toUpperCase()}` : '#—'
  const tags = tagList(answers)

  return (
    <div className="space-y-6 sticky top-6">
      <div>
        <p className="qoves-report-mono-label mb-3">User Profile</p>
        <div className="flex items-center gap-3 mb-3">
          {photo ? (
            <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover border border-surface-border" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-surface-raised border border-surface-border" />
          )}
          <div>
            <p className="text-sm font-bold text-ink">{clientName}</p>
            <p className="text-xs text-ink-muted">Protocol ID: {displayId}</p>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-surface-raised border border-surface-border text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-4">
        <p className="qoves-report-mono-label mb-2">Next Steps</p>
        <p className="text-sm font-semibold text-ink mb-3">Non-Surgical Protocol</p>
        <button
          type="button"
          onClick={onViewProtocol}
          className="w-full text-left text-xs font-bold text-brand hover:text-brand-dark flex items-center justify-between"
        >
          View Report
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  )
}
