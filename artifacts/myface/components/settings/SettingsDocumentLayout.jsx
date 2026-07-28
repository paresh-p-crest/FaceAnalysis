import { SettingsNavSidebar } from './SettingsNavSidebar'

export function SettingsDocumentLayout({ activeId, onSelect, children }) {
  return (
    <div className="report-view-layout report-view-layout--with-sidebar h-full min-h-[28rem]">
      <aside className="report-view-sidebar">
        <SettingsNavSidebar activeId={activeId} onSelect={onSelect} />
      </aside>
      <main className="report-view-canvas min-w-0">
        <div className="report-view-page">{children}</div>
      </main>
    </div>
  )
}
