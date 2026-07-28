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

export const defaultPdfT = createPdfTranslator()
