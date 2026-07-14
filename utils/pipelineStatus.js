/** Pipeline stage labels aligned with backend pipeline_status.STAGE_LABELS */

export const PIPELINE_UI_STAGES = [
  { id: 'cv', label: 'Facial Data Processing' },
  { id: 'parsing', label: 'Aesthetic Assessment' },
  { id: 'narratives', label: 'Protocol Preparation' },
  { id: 'pending_review', label: 'Care Team Review' },
  { id: 'approved', label: 'Report Finalisation' },
]

export function isPipelineProcessing(pipeline) {
  if (!pipeline || typeof pipeline !== 'object') return false
  return pipeline.status === 'queued' || pipeline.status === 'running'
}

export function isPipelineReady(pipeline) {
  return pipeline?.status === 'ready'
}

export function isPipelineFailed(pipeline) {
  return pipeline?.status === 'failed'
}

export function pipelineStageIndex(stageId) {
  const order = ['queued', 'cv', 'narratives', 'parsing', 'done']
  const idx = order.indexOf(stageId)
  return idx >= 0 ? idx : 0
}

export function stageStatusForUi(pipeline, stageId, workflowStatus) {
  if (!pipeline) return 'pending'
  if (pipeline.status === 'failed') {
    const failedAt = pipeline.stage
    if (stageId === failedAt) return 'failed'
    if (pipelineStageIndex(failedAt) > pipelineStageIndex(stageId === 'pending_review' || stageId === 'approved' ? 'done' : stageId)) {
      return 'done'
    }
    return 'pending'
  }
  if (stageId === 'pending_review') {
    if (pipeline.status !== 'ready') return 'pending'
    const norm = String(workflowStatus || '').toLowerCase().replace(/\s+/g, '_')
    if (norm === 'approved' || norm === 'published') return 'done'
    return pipeline.status === 'ready' ? 'active' : 'pending'
  }
  if (stageId === 'approved') {
    const norm = String(workflowStatus || '').toLowerCase().replace(/\s+/g, '_')
    return norm === 'approved' || norm === 'published' ? 'done' : 'pending'
  }
  const current = pipeline.stage || 'queued'
  if (pipeline.status === 'ready') return 'done'
  const curIdx = pipelineStageIndex(current)
  const stageIdx = pipelineStageIndex(stageId)
  if (curIdx > stageIdx) return 'done'
  if (curIdx === stageIdx && pipeline.status === 'running') return 'active'
  if (current === stageId && pipeline.status === 'running') return 'active'
  if (pipeline.status === 'queued' && stageId === 'cv') return 'active'
  return 'pending'
}

export function formatProcessingBadge(pipeline) {
  if (!pipeline) return null
  if (pipeline.status === 'queued' || pipeline.status === 'running') return 'Processing'
  if (pipeline.status === 'failed') return 'Failed'
  return null
}
