'use client'

import { ReportNavSidebar } from './ReportNavSidebar'
import { REPORT_NAV_GROUPS } from './reportNavConfig'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
  layoutClassName = '',
  onClose = null,
  isAdmin = false,
  children,
}) {
  const t = useTranslations(tNamespace)
  const showRightRail = !immersive && activeId === 'protocol' && rightRail
  const showSidebar = !immersive
  const showSidebarClose = Boolean(onClose && isAdmin && activeId === 'protocol')
  const showCanvasClose = Boolean(onClose && isAdmin && activeId !== 'protocol')

  return (
    <div
      className={`report-view-layout ${immersive ? 'report-view-layout--immersive' : ''} ${showRightRail ? 'report-view-layout--with-rail' : ''} ${showSidebar ? 'report-view-layout--with-sidebar' : ''} ${layoutClassName}`.trim()}
    >
      {showSidebar && (
        <aside className="report-view-sidebar">
          <ReportNavSidebar
            activeId={activeId}
            onSelect={onSelect}
            groups={groups}
            tNamespace={tNamespace}
            titleKey={titleKey}
            defaultOpenGroupId={defaultOpenGroupId}
            footerAction={sidebarFooter}
            onClose={onClose}
            showHeaderClose={showSidebarClose}
          />
        </aside>
      )}

      <main className={`report-view-canvas min-w-0 relative ${canvasClassName} ${immersive ? 'report-view-canvas--immersive' : ''} ${activeId === 'protocol' ? 'report-view-canvas--protocol' : ''}`.trim()}>
        {showCanvasClose ? (
          <div className="report-view-close-bar">
            <button
              type="button"
              onClick={onClose}
              className="report-view-close-btn"
              aria-label={t('shell.closeReport')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : null}
        <div
          className={`report-view-page ${
            immersive
              ? 'report-view-page--immersive'
              : activeId === 'protocol'
                ? 'report-view-page--protocol'
                : ''
          }`}
        >
          {children}
        </div>
      </main>

      {showRightRail && (
        <aside className="report-view-rail hidden xl:block">
          {rightRail}
        </aside>
      )}
    </div>
  )
}
