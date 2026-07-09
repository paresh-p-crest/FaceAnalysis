import { ReportNavSidebar } from './ReportNavSidebar'

export function ReportDocumentLayout({
  activeId,
  onSelect,
  showAiVisuals = true,
  showAssistant = true,
  clientName,
  assessmentId,
  rightRail = null,
  children,
}) {
  const showRightRail = activeId === 'protocol' && rightRail

  return (
    <div className={`qoves-report-layout ${showRightRail ? 'qoves-report-layout--with-rail' : ''}`}>
      <aside className="qoves-report-sidebar">
        <ReportNavSidebar
          activeId={activeId}
          onSelect={onSelect}
          showAiVisuals={showAiVisuals}
          showAssistant={showAssistant}
          clientName={clientName}
          assessmentId={assessmentId}
        />
      </aside>

      <main className="qoves-report-canvas min-w-0">
        <div className="qoves-report-page qoves-overview-document">
          {children}
        </div>
      </main>

      {showRightRail && (
        <aside className="qoves-report-rail hidden xl:block">
          {rightRail}
        </aside>
      )}
    </div>
  )
}
