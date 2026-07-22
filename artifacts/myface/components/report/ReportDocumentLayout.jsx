import { ReportNavSidebar } from './ReportNavSidebar'
import { REPORT_NAV_GROUPS } from './reportNavConfig'

export function ReportDocumentLayout({
  activeId,
  onSelect,
  groups = REPORT_NAV_GROUPS,
  tNamespace = 'Report',
  titleKey = 'nav.report',
  defaultOpenGroupId = 'introduction',
  sidebarFooter = null,
  rightRail = null,
  immersive = false,
  canvasClassName = '',
  children,
}) {
  const showRightRail = !immersive && activeId === 'protocol' && rightRail
  const showSidebar = !immersive

  return (
    <div
      className={`qoves-report-layout ${immersive ? 'qoves-report-layout--immersive' : ''} ${showRightRail ? 'qoves-report-layout--with-rail' : ''} ${showSidebar ? 'qoves-report-layout--with-sidebar' : ''}`}
    >
      {showSidebar && (
        <aside className="qoves-report-sidebar">
          <ReportNavSidebar
            activeId={activeId}
            onSelect={onSelect}
            groups={groups}
            tNamespace={tNamespace}
            titleKey={titleKey}
            defaultOpenGroupId={defaultOpenGroupId}
            footerAction={sidebarFooter}
          />
        </aside>
      )}

      <main className={`qoves-report-canvas min-w-0 ${canvasClassName} ${immersive ? 'qoves-report-canvas--immersive' : ''} ${activeId === 'protocol' ? 'qoves-report-canvas--protocol' : ''}`.trim()}>
        <div
          className={`qoves-report-page ${
            immersive
              ? 'qoves-report-page--immersive'
              : activeId === 'protocol'
                ? 'qoves-report-page--protocol'
                : ''
          }`}
        >
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
