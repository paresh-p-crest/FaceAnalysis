/**
 * UI fallback wireframe builder — prefers precomputed cvReport.averageness.wireframe.
 */
import { computePrototypicalityReport, prototypicalityRangeLabel } from './prototypicalityEngine'

export { prototypicalityRangeLabel }

export function buildPrototypicalityWireframe(landmarks, averageness) {
  const wf = averageness?.wireframe
  if (wf?.userFeatures?.length) {
    return {
      viewBox: wf.viewBox || '0 0 100 100',
      user: wf.userFeatures,
      average: wf.averageFeatures || [],
    }
  }

  if (!landmarks?.length) return null

  const report = computePrototypicalityReport(landmarks, {}, {})
  if (!report.wireframe) return null

  return {
    viewBox: report.wireframe.viewBox,
    user: report.wireframe.userFeatures,
    average: report.wireframe.averageFeatures,
  }
}
