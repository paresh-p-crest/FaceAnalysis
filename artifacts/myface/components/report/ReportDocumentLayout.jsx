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
      className={`report-view-layout ${immersive ? 'report-view-layout--immersive' : ''} ${showRightRail ? 'report-view-layout--with-rail' : ''} ${showSidebar ? 'report-view-layout--with-sidebar' : ''}`}
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
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('shell.closeReport')}
          >
            <X className="w-5 h-5" />
          </button>
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
