export default function InfoCard({ icon: Icon, title, text, variant = 'default' }) {
  const styles = {
    default: 'bg-surface-warm border-surface-border',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-brand-50 border-brand/20',
  }

  const iconColors = {
    default: 'text-ink-muted',
    info: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-brand',
  }

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${styles[variant]}`}>
      {Icon && <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColors[variant]}`} />}
      <div>
        {title && <p className="text-sm font-medium text-ink mb-1">{title}</p>}
        <p className="text-xs text-ink-secondary leading-relaxed">{text}</p>
      </div>
    </div>
  )
}
