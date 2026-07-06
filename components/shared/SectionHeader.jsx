export default function SectionHeader({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand" />
        </div>
      )}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {badge && (
        <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand border border-brand/20">
          {badge}
        </span>
      )}
    </div>
  )
}
