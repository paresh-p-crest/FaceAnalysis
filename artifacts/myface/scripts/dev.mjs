#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'

process.env.NEXT_DISABLE_REACT_REFRESH = '1'
process.env.FAST_REFRESH = 'false'

const args = ['dev', '--hostname', '0.0.0.0', ...process.argv.slice(2)]
const child = spawn('next', args, {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
