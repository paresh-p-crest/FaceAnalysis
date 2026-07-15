export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-warm border border-surface-border flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-ink-faint" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-muted max-w-sm leading-relaxed mb-6">{description}</p>
      {action}
    </div>
  )
}
