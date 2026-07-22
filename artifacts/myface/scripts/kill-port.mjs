#!/usr/bin/env node
/** Free port before dev — works on Windows and Linux (Replit). Always exits 0. */
import { execSync } from 'node:child_process'

const port = Number(process.argv[2] || process.env.PORT || 3000)

try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    const pids = new Set()
    const suffix = `:${port}`
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const local = parts[1] || ''
      const pid = parts[parts.length - 1]
      if (local.endsWith(suffix) && pid && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
      } catch {
        /* already gone */
      }
    }
  } else {
    execSync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`, {
      shell: true,
      stdio: 'ignore',
    })
  }
} catch {
  /* nothing listening */
}
