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
  const order = ['queued', 'cv', 'narratives', 'parsing', 'projected_after', 'done']
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

/** Coarse admin progress percent across PIPELINE_UI_STAGES (done=1, active=0.5). */
export function pipelineProgressPercent(pipeline, workflowStatus) {
  if (!pipeline) return 0
  const stages = PIPELINE_UI_STAGES
  let acc = 0
  for (const stage of stages) {
    const st = stageStatusForUi(pipeline, stage.id, workflowStatus)
    if (st === 'done') acc += 1
    else if (st === 'active') acc += 0.5
  }
  return Math.round((acc / stages.length) * 100)
}
