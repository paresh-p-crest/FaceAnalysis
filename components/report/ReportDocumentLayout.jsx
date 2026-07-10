import { ReportNavSidebar } from './ReportNavSidebar'

export function ReportDocumentLayout({
  activeId,
  onSelect,
  showAiVisuals = true,
  showAssistant = true,
  clientName,
  assessmentId,
  rightRail = null,
  immersive = false,
  children,
}) {
  const showRightRail = !immersive && activeId === 'protocol' && rightRail

  return (
    <div className={`qoves-report-layout ${immersive ? 'qoves-report-layout--immersive' : ''} ${showRightRail ? 'qoves-report-layout--with-rail' : ''}`}>
      {!immersive && (
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
      )}

      <main className={`qoves-report-canvas min-w-0 ${immersive ? 'qoves-report-canvas--immersive' : ''}`}>
        <div className={`qoves-report-page ${immersive ? 'qoves-report-page--immersive' : 'qoves-overview-document'}`}>
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
