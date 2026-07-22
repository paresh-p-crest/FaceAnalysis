import { SettingsNavSidebar } from './SettingsNavSidebar'

export function SettingsDocumentLayout({ activeId, onSelect, children }) {
  return (
    <div className="qoves-report-layout qoves-report-layout--with-sidebar h-full min-h-[28rem]">
      <aside className="qoves-report-sidebar">
        <SettingsNavSidebar activeId={activeId} onSelect={onSelect} />
      </aside>
      <main className="qoves-report-canvas min-w-0">
        <div className="qoves-report-page">{children}</div>
      </main>
    </div>
  )
}
