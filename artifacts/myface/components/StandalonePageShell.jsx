/** Fixed full-viewport shell — same navbar clear + mint gap + report gutters as ReportModal. */
export function StandalonePageShell({
  children,
  className = '',
  scrollable = false,
  compactTop = false,
}) {
  const mods = [
    scrollable ? 'standalone-page-shell--scroll' : '',
    compactTop ? 'standalone-page-shell--compact-top' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`standalone-page-shell ${mods} ${className}`.trim()}>
      <div className="standalone-page-shell__navbar-clear" aria-hidden />
      <div className="standalone-page-shell__top-gap" aria-hidden />
      <div className="standalone-page-shell__body">
        <div className="standalone-page-shell__inner report-shell-inner">{children}</div>
      </div>
    </div>
  )
}
