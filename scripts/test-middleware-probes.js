#!/usr/bin/env node
/** Smoke test: GET / health short-circuit must not eat RSC/Preview traffic. */
const http = require('http')

const PORT = Number(process.env.PORT || 3011)
const HOST = process.env.HOST || '127.0.0.1'

function fetchRoot(headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}/`, { headers }, (resp) => {
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
  const tests = [
    ['curl -> health JSON', { 'user-agent': 'curl/8.0' }, true],
    ['json Accept -> health JSON', { accept: 'application/json', 'user-agent': 'probe/1' }, true],
    ['browser html -> NOT health JSON', { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/120', 'sec-fetch-dest': 'document' }, false],
    ['preview iframe -> NOT health JSON', { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/120', 'sec-fetch-dest': 'iframe' }, false],
    ['preview star Accept -> NOT health JSON', { accept: '*/*', 'user-agent': 'Mozilla/5.0 Chrome/120' }, false],
    ['RSC text/x-component -> NOT health JSON', { accept: 'text/x-component', rsc: '1', 'user-agent': 'Mozilla/5.0' }, false],
    ['RSC star Accept -> NOT health JSON', { accept: '*/*', rsc: '1', 'user-agent': 'Mozilla/5.0' }, false],
    ['next-url star Accept -> NOT health JSON', { accept: '*/*', 'next-url': '/', 'user-agent': 'Mozilla/5.0' }, false],
    ['empty Accept non-browser -> health JSON', { accept: '', 'user-agent': 'Replit/1.0' }, true],
  ]

  console.log(`Testing http://${HOST}:${PORT}/ middleware probes...\n`)
  let failed = 0
  for (const [label, headers, expectHealth] of tests) {
    const result = await fetchRoot(headers)
    const pass = result.isHealthJson === expectHealth
    if (!pass) failed += 1
    console.log(
      `${pass ? 'PASS' : 'FAIL'} | ${label} | status=${result.status} healthJson=${result.isHealthJson}`,
    )
  }

  console.log(failed === 0 ? `\nAll ${tests.length} tests passed.` : `\n${failed} test(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
