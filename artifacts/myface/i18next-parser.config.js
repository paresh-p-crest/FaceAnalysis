/** @type {import('i18next-parser').UserConfig} */
export default {
  contextSeparator: '_',
  createOldCatalogs: false,
  defaultNamespace: 'translation',
  defaultValue: (locale, _namespace, key) => (locale === 'en' ? key : ''),
  indentation: 2,
  keepRemoved: true,
  keySeparator: '.',
  lexers: {
    js: ['JsxLexer'],
    jsx: ['JsxLexer'],
  },
  locales: ['en'],
  output: 'messages/$LOCALE.extracted.json',
  input: ['app/**/*.{js,jsx}', 'components/**/*.{js,jsx}', 'utils/**/*.{js,jsx}'],
  sort: true,
  verbose: false,
}
