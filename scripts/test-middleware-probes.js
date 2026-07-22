#!/usr/bin/env node
/**
 * Smoke test: GET `/` must never return health JSON (breaks Replit Preview).
 * GET `/healthz` is the explicit liveness JSON endpoint.
 */
const http = require('http')

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'

function fetchPath(path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}${path}`, { headers }, (resp) => {
      let body = ''
      resp.on('data', (chunk) => {
        body += chunk
      })
      resp.on('end', () => {
        resolve({
          status: resp.statusCode,
          body,
          isHealthJson: body.trim() === '{"ok":true}',
        })
      })
    })
    req.on('error', reject)
  })
}

async function main() {
  const rootCases = [
    ['curl', { 'user-agent': 'curl/8.0' }],
    ['go-http-client', { 'user-agent': 'Go-http-client/1.1', accept: '*/*' }],
    ['kube-probe', { 'user-agent': 'kube-probe/1.28', accept: '*/*' }],
    ['json Accept', { accept: 'application/json', 'user-agent': 'probe/1' }],
    ['browser html', { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/120', 'sec-fetch-dest': 'document' }],
    ['preview iframe', { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/120', 'sec-fetch-dest': 'iframe' }],
    ['star Accept mozilla', { accept: '*/*', 'user-agent': 'Mozilla/5.0 Chrome/120' }],
    ['Replit/1.0 empty', { accept: '', 'user-agent': 'Replit/1.0' }],
    ['Replit Agent star', { accept: '*/*', 'user-agent': 'Replit-Agent/1.0' }],
    ['RSC text/x-component', { accept: 'text/x-component', rsc: '1', 'user-agent': 'Mozilla/5.0' }],
    ['RSC star', { accept: '*/*', rsc: '1', 'user-agent': 'Mozilla/5.0' }],
  ]

  console.log(`Testing http://${HOST}:${PORT} (no health JSON on /)…\n`)
  let failed = 0

  for (const [label, headers] of rootCases) {
    const result = await fetchPath('/', headers)
    const pass = !result.isHealthJson && result.status >= 200 && result.status < 500
    if (!pass) failed += 1
    console.log(
      `${pass ? 'PASS' : 'FAIL'} | GET / ${label} | status=${result.status} healthJson=${result.isHealthJson}`,
    )
  }

  const healthz = await fetchPath('/healthz', { 'user-agent': 'curl/8.0' })
  const healthzPass = healthz.isHealthJson && healthz.status === 200
  if (!healthzPass) failed += 1
  console.log(
    `${healthzPass ? 'PASS' : 'FAIL'} | GET /healthz -> health JSON | status=${healthz.status} healthJson=${healthz.isHealthJson}`,
  )

  const total = rootCases.length + 1
  console.log(failed === 0 ? `\nAll ${total} tests passed.` : `\n${failed} test(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
