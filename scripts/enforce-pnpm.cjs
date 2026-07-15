#!/usr/bin/env node
/**
 * Cross-platform package-manager guard (runs on `preinstall`).
 *
 * Replaces the previous `sh -c '...'` guard, which failed on Windows
 * (PowerShell/cmd have no `sh`). Node ships with both Replit and Windows,
 * so this works everywhere.
 *
 * Behaviour:
 *   1. Delete stray npm/yarn lockfiles so they never shadow pnpm-lock.yaml.
 *   2. Require pnpm as the installing package manager; otherwise print an
 *      actionable message and exit non-zero.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

for (const lockfile of ['package-lock.json', 'yarn.lock']) {
  try {
    fs.rmSync(path.join(repoRoot, lockfile), { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.startsWith('pnpm')) {
  console.error(
    [
      '',
      'This workspace uses pnpm. Install/use pnpm instead of npm or yarn.',
      '',
      '  Windows / local:',
      '    corepack enable            # corepack ships with Node',
      '    # or: npm install -g pnpm',
      '    pnpm install',
      '',
      '  (Replit already provides pnpm.)',
      '',
    ].join('\n'),
  );
  process.exit(1);
}
