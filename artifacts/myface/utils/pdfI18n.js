import enMessages from '../messages/en.json'

/** Build a Pdf namespace translator from next-intl messages or fall back to en.json. */
export function createPdfTranslator(messages = null) {
  const pdf = messages?.Pdf || enMessages.Pdf || {}
  return (key, params = {}) => {
    let text = pdf[key] ?? key
    Object.entries(params).forEach(([name, value]) => {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    })
    return text
  }
}

/** Report namespace translator (executiveSummary, nav, etc.) for PDF/dashboard helpers. */
export function createReportTranslator(messages = null) {
  const report = messages?.Report || enMessages.Report || {}
  const resolve = (key) => {
    const parts = key.split('.')
    let node = report
    for (const part of parts) {
      node = node?.[part]
    }
    return typeof node === 'string' ? node : null
  }
  const t = (key, params = {}) => {
    let text = resolve(key)
    if (text == null) return key
    Object.entries(params).forEach(([name, value]) => {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    })
    return text
  }
  t.has = (key) => resolve(key) != null
  return t
}

/** CvReport.labels translator for PDF (mirrors next-intl CvReport namespace). */
export function createCvReportTranslator(messages = null) {
  const labels = messages?.CvReport?.labels || enMessages.CvReport?.labels || {}
  const t = (key) => {
    const k = key.startsWith('labels.') ? key.slice(7) : key
    if (labels[k] != null) return labels[k]
    throw new Error(`missing CvReport label: ${k}`)
  }
  t.has = (key) => {
    const k = key.startsWith('labels.') ? key.slice(7) : key
    return labels[k] != null
  }
  return t
}

export const defaultPdfT = createPdfTranslator()
