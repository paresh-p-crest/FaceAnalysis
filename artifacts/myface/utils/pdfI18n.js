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

export const defaultPdfT = createPdfTranslator()
